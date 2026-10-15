#!/usr/bin/env python3
"""Export V5.0 attempts into replay bundles.

SECURITY POSTURE - read before editing.

This is an ALLOWLIST exporter. Per attempt it opens only:

  attempt.json (clip id and seed), sut/tracking.jsonl, sut/gateway-events.jsonl,
  sut/run.json, verdict.json (Post-hoc Verifier), score.json (study scorer),
  the two images per Gemma call named by a visual_request event,

and per batch: manifest.json (commits only) and
review-final-v1/semantic-review.json (one item per attempt).

It never opens worker-request.json, requests/*, TRACE files, audit.json, review
images, segment frames, the source video or anything under data/. Selected
fields are copied by name; nothing is copied wholesale (service endpoints in the
configuration event are dropped). The experiment repository is read, never
written. Every bundle passes publish_guard.leaks() before it is written.

V5.0 is program-first: the host groups tracks (T) into vehicle records (V),
applies a fixed traffic rule, asks Gemma for the colour of each candidate and
assembles the answer. Pi + Nemotron start only for an investigation case; none
arose in this batch, so these bundles have no agent steps.

Usage:
  python3 -B tools/export_v50_run.py --batch <batch dir> [--attempt a002 ...]
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import shutil
import sys
from pathlib import Path

sys.dont_write_bytecode = True

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
from export_common import CLASSES, jl, jpeg, r1  # noqa: E402
from publish_guard import leaks  # noqa: E402

BUNDLES = ROOT / "bundles"
VIDEO_DIR = ROOT / "app" / "public" / "video"
RUNTIME_KEYS = (
    "candidate_revision", "roadway_mode", "model_calls", "visual_calls", "case_limit",
    "case_visual_limit", "tool_text_total", "control_text_reserve", "tool_text_page",
    "max_inspect_seconds", "inspect_source_frame_cap", "crop_padding",
    "link_gap_fps_fraction", "link_iou", "link_distance_diagonals", "link_area_ratio",
    "link_angle_degrees", "possible_gap_fps_fraction", "possible_distance_diagonals",
    "possible_area_ratio", "stable_motion_fraction", "direction_cone_degrees",
    "majority_fraction", "comparison_min_units", "opposite_angle_degrees",
)
EVIDENCE_KEYS = ("missing_frames", "iou", "area_ratio", "prediction_error_diagonals")


def r3(x: float | None) -> float | None:
    return None if x is None else round(float(x), 3)


def vnum(ref: str) -> int:
    return int(ref[1:])


def export_tracking(sut: Path, snap: dict) -> tuple[dict, dict, dict]:
    """Detections with both their tracker id (T) and the host's vehicle record (V).

    T aliases follow the host's own order: ascending raw tracker id
    (store/motion_v41.MotionIndex). The mapping is checked against every V
    record's member list.
    """
    rows = jl(sut / "tracking.jsonl")
    start = next(r for r in rows if r["kind"] == "start")
    end = next(r for r in rows if r["kind"] == "end")
    assert end["complete"] and end["frames"] == start["frame_count"]

    raw_order: list[int] = []
    for r in rows:
        if r["kind"] == "frame":
            for d in r["detections"]:
                if d["track_id"] is not None and d["track_id"] not in raw_order:
                    raw_order.append(d["track_id"])
    raw_order.sort()
    t_alias = {raw: f"T{i}" for i, raw in enumerate(raw_order, 1)}
    t_index = {raw: i for i, raw in enumerate(raw_order)}

    groups = snap["groups"]
    v_refs = sorted(groups, key=vnum)
    v_index = {v: i for i, v in enumerate(v_refs)}
    owner: dict[tuple[int, int], str] = {}
    for v, g in groups.items():
        for p in g["points"]:
            owner[(p["frame"], p["detection_index"])] = v

    frames = [{"d": [], "p": []} for _ in range(start["frame_count"])]
    t_vehicle: dict[str, str] = {}
    attached: dict[str, int] = {}
    for r in rows:
        if r["kind"] != "frame":
            continue
        fid = r["source_frame_id"]
        f = frames[fid]
        for d in r["detections"]:
            v = owner.get((fid, d["detection_index"]))
            ti = t_index[d["track_id"]] if d["track_id"] is not None else -1
            if d["track_id"] is not None:
                alias = t_alias[d["track_id"]]
                assert v is not None and t_vehicle.setdefault(alias, v) == v, (alias, v)
            elif v is not None:
                attached[v] = attached.get(v, 0) + 1
            f["d"].append([*map(r1, d["bbox"]), d["class_id"], ti, v_index[v] if v else -1])
        for p in r["predictions"]:
            if p["track_id"] in t_index:
                f["p"].append([*map(r1, p["bbox"]), t_index[p["track_id"]]])

    for v, g in groups.items():
        assert sorted(g["members"], key=vnum) == sorted(
            (a for a, w in t_vehicle.items() if w == v), key=vnum), (v, g["members"])

    tracks = []
    for raw in raw_order:
        alias = t_alias[raw]
        seen = [fid for fid, f in enumerate(frames) for d in f["d"] if d[5] == t_index[raw]]
        tracks.append({"alias": alias, "raw_id": raw, "observed": [min(seen), max(seen)],
                       "vehicle": t_vehicle[alias]})
    video = {"fps": start["fps"], "width": start["width"], "height": start["height"],
             "nb_frames": start["frame_count"],
             "duration_sec": round(start["frame_count"] / start["fps"], 2)}
    return ({"classes": CLASSES, "tracks": tracks, "frames": frames},
            video, {"v_refs": v_refs, "attached": attached})


def phase(p: dict) -> dict:
    return {"start": p["start_frame"], "end": p["end_frame"], "origin": p["origin"],
            "destination": p["destination"], "direction": p["direction"],
            "valid": p["valid"], "points": p["observed_points"],
            "vector": [r1(p["vector"][0]), r1(p["vector"][1])]}


def export_vehicles(snap: dict, v_refs: list[str], attached: dict[str, int]) -> dict:
    an = snap["analysis"]
    votes = an["comparison_votes"]
    vehicles = []
    for v in v_refs:
        g, a = snap["groups"][v], an["vehicles"][v]
        frames = [p["frame"] for p in g["points"]]
        vote = next((u for u in votes if v in u["vehicles"]), None)
        vehicles.append({
            "ref": v,
            "members": g["members"],
            "observed": [min(frames), max(frames)],
            "frames_observed": len(set(frames)),
            "attached_unmatched": attached.get(v, 0),
            "status": a["status"],
            "phases": [phase(p) for p in a["phases"]],
            "opposing": [[p["start_frame"], p["end_frame"]] for p in a.get("opposing_phases", [])],
            "vote": [r3(x) for x in vote["vector"]] if vote else None,
            "vote_shared_with": [w for w in vote["vehicles"] if w != v] if vote else [],
            "flow": [r3(x) for x in a["flow_vector"]] if a.get("flow_vector") else None,
            "comparison_units": len(a.get("comparison_units", [])),
            "support_units": len(a.get("support_units", [])),
            "identity_component": a.get("identity_component", [v]),
        })
    return {
        "vehicles": vehicles,
        "links": [{"first": l["first"], "second": l["second"], "kind": l["source"]["kind"],
                   "evidence": {k: r3(l["source"]["evidence"].get(k)) for k in EVIDENCE_KEYS}}
                  for l in snap["links"]],
        "possible_links": [{"first": l["first"], "second": l["second"],
                            "evidence": {k: r3(l["evidence"].get(k)) for k in EVIDENCE_KEYS}}
                           for l in an["possible_links"]],
        "aliases": snap["aliases"],
        "votes": [{"vector": [r3(x) for x in u["vector"]], "vehicles": u["vehicles"]} for u in votes],
    }


def export_attempt(batch: Path, attempt: str, manifest: dict, review: dict) -> str:
    adir = batch / attempt
    sut = adir / "sut"
    meta = json.loads((adir / "attempt.json").read_text())
    clip = meta["clip_id"]
    name = f"v50-{clip}-s{meta['seed']}"
    out = BUNDLES / name
    if out.exists():
        shutil.rmtree(out)
    (out / "frames").mkdir(parents=True)

    events = jl(sut / "gateway-events.jsonl")
    conf = next(e for e in events if e["kind"] == "configuration")
    snaps = {e["stage"]: e["representation"] for e in events if e["kind"] == "vehicle_snapshot"}
    snap = snaps["final"]
    tracking, video, extra = export_tracking(sut, snap)
    video["proxy"] = f"video/{clip}.mp4"
    grouping = export_vehicles(snap, extra["v_refs"], extra["attached"])
    t_vehicle = {t["alias"]: t["vehicle"] for t in tracking["tracks"]}

    appearance, by_ref, pending = [], {}, None
    for e in events:
        k = e["kind"]
        if k == "visual_resolution_v5":
            pending = e
        elif k == "visual_request":
            full = next(m for m in e["media"] if m["role"] == "full")
            crop = next(m for m in e["media"] if m["role"] == "crop")
            ref = e["observation_ref"]
            f = full["source_frame_id"]
            jpeg(sut / full["path"], out / "frames" / f"{ref}-{f}-full.jpg")
            jpeg(sut / crop["path"], out / "frames" / f"{ref}-{f}-crop.jpg")
            target = full["targets"][0]
            assert pending and pending["resolved_args"]["track_ref"] == target["track_ref"]
            by_ref[ref] = len(appearance)
            appearance.append({
                "observation_ref": ref, "intent": e["intent"], "origin": pending["origin"],
                "asked_ref": pending["original_args"]["ref"],
                "track_ref": target["track_ref"], "vehicle_ref": t_vehicle[target["track_ref"]],
                "frame": f, "target_bbox": [r1(v) for v in target["original_bbox"]],
                "crop_bounds": crop["crop_bounds"],
                "full": f"frames/{ref}-{f}-full.jpg", "crop": f"frames/{ref}-{f}-crop.jpg",
            })
            pending = None
        elif k == "visual_response":
            a = appearance[by_ref[e["record"]["observation_ref"]]]
            a.update({"text": e["record"]["text"], "finish_reason": e["record"]["finish_reason"],
                      "truncated": e["record"]["truncated"], "latency_sec": r3(e["latency_sec"]),
                      "tokens": {"prompt": e["usage"]["prompt_tokens"],
                                 "completion": e["usage"]["completion_tokens"]}})
        elif k == "host_visual_consumption":
            appearance[by_ref[e["record"]["observation_ref"]]]["color_parse"] = e["color_parse"]

    fin = next(e for e in events if e["kind"] == "host_final_answer")
    ans = fin["answer"]
    run = json.loads((sut / "run.json").read_text())
    verdict = json.loads((adir / "verdict.json").read_text())
    score = json.loads((adir / "score.json").read_text())
    item = review["items"][attempt]
    rev = manifest["revisions"]
    oc, vc = conf["orchestrator_config"], conf["visual_config"]
    budget = run["budget"]
    tracking_resp = next(e for e in events if e["kind"] == "tracking_response")
    det = tracking_resp["service_provenance"]

    bundle = {
        "bundle_version": "5.0",
        "run_id": name,
        "attempt": attempt,
        "clip_id": clip,
        "seed": meta["seed"],
        "live": False,
        "exported_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "batch": {"name": batch.name, "created": manifest["created"],
                  "candidate_revision": manifest["candidate_revision"]},
        "provenance": {
            "sut_commit": rev["sut"]["commit"],
            "study_commit": rev["study"]["commit"],
            "service_commit": rev["model_serving"]["commit"],
            "orchestrator": {"model": oc["model"], "revision": oc["revision"],
                             "temperature": oc["temperature"], "top_p": oc["top_p"]},
            "perception": {"model": vc["model"], "revision": vc["revision"],
                           "temperature": vc["temperature"]},
            "tracking": {"contract": det["contract"], "weights_sha256": det["weights_sha256"],
                         "inference": {k: det["inference"][k] for k in ("conf", "imgsz", "classes")},
                         "tracker": det["tracker"]},
        },
        "task": {
            "question": conf["profile"]["video_question"],
            "investigation": {
                "used": run["pi_started"],
                "statement": conf["profile"]["task_statement"],
                "instructions": conf["profile"]["reasoning_instructions"],
                "system": conf["surface"]["system"],
                "tools": conf["surface"]["descriptions"],
            },
        },
        "runtime": {k: conf["runtime"][k] for k in RUNTIME_KEYS},
        "video": video,
        "tracking": tracking,
        **grouping,
        "appearance": appearance,
        "answer": {
            "status": ans["status"], "scope": ans["scope"],
            "submission": {k: ans["submission"][k] for k in (
                "decision", "reported_count", "colors", "count_complete", "uncertainty")},
            "targets": [{k: t[k] for k in (
                "vehicle_ref", "member_track_refs", "color_description", "color_observation_ref",
                "source_frame_intervals")} for t in ans["targets"]],
            "ungrouped_detection_count": ans["ungrouped_detection_count"],
            "unresolved_vehicles": ans["unresolved_vehicles"],
            "pending_cases": ans["pending_cases"],
            "cases": fin["cases"],
        },
        "runtime_verifier": {
            "agent_tool_calls": 0 if not run["pi_started"] else None,
            "final_answer_check": "pass" if run["terminal_reason"] == "host_finalized" else "not_reached",
        },
        "posthoc_verifier": {"status": verdict["v5_status"], "issues": verdict["issues"],
                             "traffic_truth_checked": verdict["traffic_truth_checked"]},
        "run": {"wall_sec": r3(run["wall_sec"]), "terminal_reason": run["terminal_reason"],
                "pi_started": run["pi_started"],
                "tracking_sec": r3(tracking_resp["latency_sec"]),
                "gemma_sec": [a["latency_sec"] for a in appearance]},
        "budget": {
            "nemotron": {"used": budget["nemotron"]["used"], "limit": budget["nemotron"]["limit"]},
            "gemma": {"used": budget["visual"]["vlm_requests"]["used"],
                      "limit": budget["visual"]["vlm_requests"]["limit"]},
            "tool_text": {"remaining": budget["tool_text_remaining"],
                          "limit": conf["runtime"]["tool_text_total"]},
        },
        "scorer": {k: score[k] for k in (
            "scorer_version", "wrong_way_count", "expected_color_multiset", "outcome",
            "count_numeric_match", "color_multiset_correct", "complete_count_correct",
            "partial_color_matches", "matching_scope")},
        "review": {
            "reviewer": review["reviewer"], "independent": review["independent"],
            "count_complete": item["count_complete"],
            "false_reported_targets": item["false_reported_targets"],
            "targets": [{k: t[k] for k in ("vehicle_ref", "object_id", "color_original",
                                           "identity", "color", "interval")}
                        for t in item["target_identity_color_support"]],
            "meaning": item.get("meaning"),
        },
    }

    assert sum(d[6] < 0 for f in tracking["frames"] for d in f["d"]) == ans["ungrouped_detection_count"]
    assert len(appearance) == budget["visual"]["vlm_requests"]["used"]

    blob = json.dumps(bundle, ensure_ascii=False)
    if found := leaks(blob):
        shutil.rmtree(out)
        raise SystemExit(f"REFUSING TO WRITE {name}: " + "; ".join(found))
    if not (VIDEO_DIR / f"{clip}.mp4").is_file():
        raise SystemExit(f"{name}: no committed proxy for {clip}")
    if not appearance:
        (out / "frames").rmdir()
    (out / "bundle.json").write_text(json.dumps(bundle, ensure_ascii=False, separators=(",", ":")))
    return name


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--batch", required=True)
    ap.add_argument("--attempt", action="append", default=[])
    args = ap.parse_args()
    batch = Path(args.batch).resolve()
    manifest = json.loads((batch / "manifest.json").read_text())
    sem = json.loads((batch / "review-final-v1" / "semantic-review.json").read_text())
    review = {"reviewer": sem["reviewer"], "independent": sem["independent_blinded_human_review"],
              "items": {a["attempt"]: a for a in sem["items"]}}
    attempts = args.attempt or [p["attempt"] for p in manifest["plan"]]
    for a in attempts:
        print("wrote", export_attempt(batch, a, manifest, review))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
