#!/usr/bin/env python3
"""Export V5.2 attempts into replay bundles.

SECURITY POSTURE - read before editing.

This is an ALLOWLIST exporter. Per attempt it opens only:

  attempt.json, sut/tracking.jsonl, sut/gateway-events.jsonl, sut/run.json,
  sut/pi-events.jsonl (message_end events: tool calls, tool results, timestamps),
  sut/diagnostic-packet.json (five named fields, diagnostic batch only),
  verdict.json (Post-hoc Verifier), score.json (study scorer, stability batch only),
  the images named by a visual_request event,

and per batch: manifest.json (commits and plan) and
review-final-v1/semantic-review.json (structured fields only).

It never opens agent-command.json, worker-request.json, requests/*, TRACE files,
audit.json, stability-analysis.json, review images, the source video or anything
under data/. Packet "sources" (host paths) and the configuration event's service
endpoints are dropped; Pi's provider error message is never copied. Selected
fields are copied by name. The experiment repository is read, never written.
Every bundle passes publish_guard.leaks() before it is written.

Two batches:

  stability   20261016-06-eval-12x2x2-v5.2-stability: 12 clips x Q1/Q2 x two
              passes. One bundle per clip (pass 1, Q1); the other three attempts of
              the clip are summarised as `stability`.
  diagnostic  20261016-07-diagnostic-7x3-v5.2-investigation-value: seven saved-state
              scenarios x none / fixed / pi. One bundle per selected scenario's pi
              attempt; the none and fixed attempts are summarised as `siblings`.

Usage:
  python3 -B tools/export_v52_run.py --batch <stability batch>
  python3 -B tools/export_v52_run.py --batch <diagnostic batch> --scenario B2 --scenario B4 --scenario B7
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import re
import shutil
import sys
from pathlib import Path

sys.dont_write_bytecode = True

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
from export_common import export_tracking, export_vehicles, jl, jpeg, r1, r3  # noqa: E402
from publish_guard import leaks  # noqa: E402

BUNDLES = ROOT / "bundles"
VIDEO_DIR = ROOT / "app" / "public" / "video"
RUNTIME_KEYS = (
    "candidate_revision", "roadway_mode", "model_calls", "visual_calls", "case_limit",
    "case_visual_limit", "tool_text_total", "control_text_reserve", "tool_text_page",
    "max_inspect_seconds", "inspect_source_frame_cap", "crop_padding", "enable_thinking",
    "visual_seed", "diagnostic_model_calls", "diagnostic_visual_calls",
    "link_gap_fps_fraction", "link_iou", "link_distance_diagonals", "link_area_ratio",
    "link_angle_degrees", "possible_gap_fps_fraction", "possible_distance_diagonals",
    "possible_area_ratio", "stable_motion_fraction", "direction_cone_degrees",
    "majority_fraction", "comparison_min_units", "opposite_angle_degrees",
)
BUDGET_RE = re.compile(
    r"main calls remaining (\d+); Gemma remaining (\d+); host text remaining (\d+)")
STEP_TEXT_CAP = 6000
CASE_KEYS = ("case_ref", "type", "refs", "question", "impact", "first_frame", "key")
PACKET_KEYS = ("case", "deferred_links", "media_available", "used_frames", "video_sha256")


def text_of(msg: dict) -> str:
    return "".join(c.get("text", "") for c in msg["content"] if isinstance(c, dict))


def observations(sut: Path, events: list[dict], out: Path | None, t_vehicle: dict[str, str]) -> list[dict]:
    """Every Gemma observation the run holds: imported from a saved run (text only)
    or requested in this run (with the exact images Gemma was sent)."""
    obs, by_ref, pending = [], {}, None
    for e in events:
        k = e["kind"]
        if k == "observation_import":
            rec = e["record"]
            by_ref[rec["observation_ref"]] = len(obs)
            obs.append({"observation_ref": rec["observation_ref"], "intent": rec["intent"],
                        "origin": "imported", "case_ref": None, "asked_ref": None,
                        "track_ref": rec["track_refs"][0],
                        "vehicle_ref": t_vehicle.get(rec["track_refs"][0]),
                        "media": [], "text": rec["text"], "finish_reason": rec["finish_reason"],
                        "truncated": rec["truncated"], "color_parse": e.get("color_parse"),
                        "latency_sec": None, "tokens": None})
        elif k == "visual_resolution_v5":
            pending = e
        elif k == "visual_request":
            ref = e["observation_ref"]
            media = []
            fulls = [m for m in e["media"] if m["role"] == "full"]
            crops = [m for m in e["media"] if m["role"] == "crop"]
            for full in fulls:
                f = full["source_frame_id"]
                tgt = full["targets"]
                crop = [c for c in crops if c["source_frame_id"] == f]
                item = {"frame": f,
                        "targets": [{"track_ref": t["track_ref"],
                                     "bbox": [r1(v) for v in t["original_bbox"]]} for t in tgt],
                        "full": f"frames/{ref}-{f}-full.jpg", "crops": []}
                if out is not None:
                    jpeg(sut / full["path"], out / "frames" / f"{ref}-{f}-full.jpg")
                for j, c in enumerate(crop):
                    name = f"frames/{ref}-{f}-crop.jpg" if j == 0 else f"frames/{ref}-{f}-crop{j}.jpg"
                    if out is not None:
                        jpeg(sut / c["path"], out / name)
                    item["crops"].append({"path": name, "bounds": c["crop_bounds"],
                                          "track_ref": c["targets"][0]["track_ref"]})
                media.append(item)
            assert pending is not None, ref
            track = media[0]["targets"][0]["track_ref"]
            by_ref[ref] = len(obs)
            obs.append({"observation_ref": ref, "intent": e["intent"], "origin": pending["origin"],
                        "case_ref": pending.get("case_ref"), "compare": pending.get("compare", False),
                        "asked_ref": pending["original_args"].get("ref") or pending["original_args"].get("refs"),
                        "track_ref": track, "vehicle_ref": t_vehicle.get(track), "media": media})
            pending = None
        elif k == "visual_response":
            o = obs[by_ref[e["record"]["observation_ref"]]]
            o.update({"text": e["record"]["text"], "finish_reason": e["record"]["finish_reason"],
                      "truncated": e["record"]["truncated"], "latency_sec": r3(e["latency_sec"]),
                      "tokens": {"prompt": e["usage"]["prompt_tokens"],
                                 "completion": e["usage"]["completion_tokens"]}})
        elif k == "host_visual_consumption":
            obs[by_ref[e["record"]["observation_ref"]]]["color_parse"] = e["color_parse"]
    for o in obs:
        o.setdefault("color_parse", None)
    return obs


def agent_steps(sut: Path, events: list[dict], obs: list[dict]) -> dict | None:
    """One step per Nemotron turn. Each turn made exactly one tool call; the call
    either reached the gateway (accepted, or refused with a code) or was refused
    by Pi itself before it left the sandbox (local error)."""
    path = sut / "pi-events.jsonl"
    if not path.is_file():
        return None
    msgs = [e["message"] for e in jl(path) if e["type"] == "message_end"]
    t0 = next(m["timestamp"] for m in msgs if m["role"] == "user")
    initial = text_of(next(m for m in msgs if m["role"] == "user"))
    gw = [e for e in events if e["kind"] in ("tool", "denial")]
    deliveries = [e for e in events if e["kind"] == "text_delivery"]
    lat = [e["latency_sec"] for e in events if e["kind"] == "orchestrator_response"]
    vis_by_seq = [(e["seq"], e["observation_ref"]) for e in events if e["kind"] == "visual_request"]
    obs_idx = {o["observation_ref"]: i for i, o in enumerate(obs)}

    steps, gi, turn, pending, prev_seq = [], 0, 0, None, 0
    for m in msgs:
        if m["role"] == "assistant":
            calls = [c for c in m["content"] if isinstance(c, dict) and c.get("type") == "toolCall"]
            if m.get("stopReason") == "error" and not calls:
                continue  # the provider is closed after investigation_finish
            assert len(calls) == 1, "one tool call per turn"
            assert not any(c.get("type") in ("text", "thinking") and (c.get("text") or c.get("thinking"))
                           for c in m["content"] if isinstance(c, dict)), "assistant text present"
            pending = {"name": calls[0]["name"], "args": calls[0]["arguments"],
                       "t_call": round((m["timestamp"] - t0) / 1000 + (lat[turn] if turn < len(lat) else 0), 3)}
            turn += 1
        elif m["role"] == "toolResult":
            text = text_of(m)
            step = {"i": len(steps), "tool": pending["name"], "args": pending["args"],
                    "t_call": pending["t_call"], "t_result": round((m["timestamp"] - t0) / 1000, 3)}
            g = gw[gi] if gi < len(gw) else None
            if g is not None and g["kind"] == "tool" and g["result"].get("agent_text", "") == text:
                step.update(outcome="accepted", code=None)
                gi += 1
            elif g is not None and g["kind"] == "denial" and \
                    next((d["agent_text"] for d in deliveries if d["seq"] > g["seq"]), None) == text:
                step.update(outcome="refused", code=g["code"], detail=g["detail"])
                gi += 1
            else:
                assert m["isError"], (step, text[:200])
                step.update(outcome="pi_error", code=None)
                g = None
            if g is not None:
                step["visuals"] = [obs_idx[r] for s, r in vis_by_seq if prev_seq < s < g["seq"]]
                for v in step["visuals"]:
                    obs[v]["step"] = step["i"]
                prev_seq = g["seq"]
            else:
                step["visuals"] = []
            b = BUDGET_RE.search(text)
            step.update(text=text[:STEP_TEXT_CAP], text_chars=len(text),
                        budget_before=({"main_remaining": int(b[1]), "gemma_remaining": int(b[2]),
                                        "text_remaining": int(b[3])} if b else None))
            steps.append(step)
    assert gi == len(gw), (gi, len(gw))
    return {"initial_user": initial, "steps": steps,
            "refused": sum(s["outcome"] == "refused" for s in steps),
            "pi_errors": sum(s["outcome"] == "pi_error" for s in steps)}


def cases_of(events: list[dict]) -> list[dict]:
    out: dict[str, dict] = {}
    for e in events:
        if e["kind"] in ("case_created", "controlled_case_created"):
            c = e["case"]
            out[c["case_ref"]] = {**{k: c.get(k) for k in CASE_KEYS},
                                  "assigned": e["kind"] == "controlled_case_created",
                                  "status": c["status"], "result": None}
        elif e["kind"] == "case_result":
            c = e["case"]
            out[c["case_ref"]].update(status=c["status"], result=c.get("result"))
    return list(out.values())


def final_snapshot(events: list[dict]) -> dict:
    snaps = {e["stage"]: e["representation"] for e in events if e["kind"] == "vehicle_snapshot"}
    return snaps["final"]


def tracking_hash(sut: Path) -> str:
    """Hash of every frame row with the per-run job id removed, so repeats compare
    by what the tracker saw and returned."""
    rows = [{k: v for k, v in r.items() if k != "job"}
            for r in jl(sut / "tracking.jsonl") if r["kind"] == "frame"]
    return hashlib.sha256(json.dumps(rows, sort_keys=True).encode()).hexdigest()


def summary(adir: Path) -> dict:
    """Comparable outcome of one attempt, for the stability and sibling summaries."""
    sut = adir / "sut"
    meta = json.loads((adir / "attempt.json").read_text())
    run = json.loads((sut / "run.json").read_text())
    events = jl(sut / "gateway-events.jsonl")
    fin = next(e for e in events if e["kind"] == "host_final_answer")["answer"]
    texts = [e["record"]["text"] for e in events if e["kind"] == "visual_response"]
    return {
        "attempt": meta["attempt"], "pass": meta.get("pass"), "query_id": meta.get("query_id"),
        "controller": meta.get("controller"),
        "submission": {k: run["submission"][k] for k in ("decision", "reported_count", "colors", "count_complete")},
        "targets": [{"vehicle_ref": t["vehicle_ref"], "member_track_refs": t["member_track_refs"],
                     "color_description": t["color_description"],
                     "source_frame_intervals": t["source_frame_intervals"]} for t in fin["targets"]],
        "pi_started": run["pi_started"],
        "nemotron": run["budget"]["nemotron"]["used"],
        "gemma": run["budget"]["visual"]["vlm_requests"]["used"],
        "wall_sec": r3(run["wall_sec"]),
        "cases": [{"case_ref": c["case_ref"], "status": c["status"], "result": c.get("result")}
                  for c in run["cases"]],
        "gemma_texts": texts,
        "query_text": next(e for e in events if e["kind"] == "query_input")["user_query"],
        "query_delivered_to": run["query_delivered_to"],
        "tracking_sha256": tracking_hash(sut),
        "scorer": ({k: v for k, v in json.loads((adir / "score.json").read_text()).items() if k in (
            "count_numeric_match", "color_multiset_correct", "complete_count_correct")}
            if (adir / "score.json").is_file() else None),
    }


def export_attempt(batch: Path, attempt: str, manifest: dict, review: dict, kind: str,
                   extra: dict) -> str:
    adir = batch / attempt
    sut = adir / "sut"
    meta = json.loads((adir / "attempt.json").read_text())
    events = jl(sut / "gateway-events.jsonl")
    conf = next(e for e in events if e["kind"] == "configuration")
    query = next(e for e in events if e["kind"] == "query_input")
    run = json.loads((sut / "run.json").read_text())

    if kind == "run":
        clip = meta["clip_id"]
        name = f"v52-{clip}-s{query['seed']}"
    else:
        packet = json.loads((sut / "diagnostic-packet.json").read_text())
        clip = extra["clip_of_sha"][packet["video_sha256"]]
        name = f"v52-diag-{meta['case']}-{meta['controller']}"
    out = BUNDLES / name
    if out.exists():
        shutil.rmtree(out)
    (out / "frames").mkdir(parents=True)

    snap = final_snapshot(events)
    tracking, video, ext = export_tracking(sut, snap)
    video["proxy"] = f"video/{clip}.mp4"
    grouping = export_vehicles(snap, ext["v_refs"], ext["attached"])
    t_vehicle = {t["alias"]: t["vehicle"] for t in tracking["tracks"]}
    obs = observations(sut, events, out, t_vehicle)
    agent = agent_steps(sut, events, obs)
    fin = next(e for e in events if e["kind"] == "host_final_answer")
    ans = fin["answer"]
    verdict = json.loads((adir / "verdict.json").read_text())
    rev = manifest["revisions"]
    oc, vc = conf["orchestrator_config"], conf["visual_config"]
    budget = run["budget"]
    tr_resp = next((e for e in events if e["kind"] == "tracking_response"), None)
    tr_req = next((e for e in events if e["kind"] == "tracking_request"), None)
    det = (tr_resp or {}).get("service_provenance")

    bundle = {
        "bundle_version": "5.2",
        "bundle_kind": kind,
        "run_id": name,
        "attempt": attempt,
        "clip_id": clip,
        "seed": query["seed"],
        "live": False,
        "exported_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "batch": {"name": batch.name, "created": manifest["created"],
                  "candidate_revision": manifest["candidate_revision"]},
        "provenance": {
            "sut_commit": rev["v4"]["commit"],
            "study_commit": rev["study"]["commit"],
            "service_commit": rev["model_serving"]["commit"],
            "orchestrator": {"model": oc["model"], "revision": oc["revision"],
                             "temperature": oc["temperature"], "top_p": oc["top_p"]},
            "perception": {"model": vc["model"], "revision": vc["revision"],
                           "temperature": vc["temperature"]},
            "tracking": ({"contract": det["contract"], "weights_sha256": det["weights_sha256"],
                          "inference": {k: det["inference"][k] for k in ("conf", "imgsz", "classes")},
                          "tracker": det["tracker"]} if det else None),
        },
        "query": {"task_id": query["task_id"], "query_id": meta.get("query_id"),
                  "text": query["user_query"], "delivered_to": run["query_delivered_to"],
                  "understanding_tested": run["query_understanding_tested"]},
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
        "appearance": obs,
        "cases": cases_of(events),
        "agent": agent,
        "answer": {
            "status": ans["status"], "scope": ans["scope"],
            "submission": {**{k: ans["submission"][k] for k in (
                "decision", "reported_count", "colors", "count_complete")},
                "uncertainty": ans["submission"].get("uncertainty")},
            "targets": [{k: t[k] for k in (
                "vehicle_ref", "member_track_refs", "color_description", "color_observation_ref",
                "source_frame_intervals")} for t in ans["targets"]],
            "ungrouped_detection_count": ans["ungrouped_detection_count"],
            "unresolved_vehicles": ans["unresolved_vehicles"],
            "pending_cases": ans["pending_cases"],
        },
        "runtime_verifier": {
            "agent_tool_calls": len(agent["steps"]) if agent else 0,
            "agent_refused": agent["refused"] if agent else 0,
            "final_answer_check": "pass" if run["terminal_reason"] == "host_finalized" else "not_reached",
        },
        "posthoc_verifier": {"status": verdict["v5_status"], "issues": verdict["issues"],
                             "traffic_truth_checked": verdict["traffic_truth_checked"]},
        "run": {"wall_sec": r3(run["wall_sec"]), "terminal_reason": run["terminal_reason"],
                "pi_started": run["pi_started"],
                "investigation_terminal": (run["native_investigation"] or {}).get("terminal_reason"),
                "investigation_sec": r3((run["native_investigation"] or {}).get("wall_sec")),
                "tracking_sec": r3(tr_resp["latency_sec"]) if tr_resp else None,
                "tracking_new_inference": tr_req is not None,
                "gemma_sec": [o["latency_sec"] for o in obs if o["latency_sec"] is not None]},
        "budget": {
            "nemotron": {"used": budget["nemotron"]["used"], "limit": budget["nemotron"]["limit"]},
            "gemma": {"used": budget["visual"]["vlm_requests"]["used"],
                      "limit": budget["visual"]["vlm_requests"]["limit"]},
            "tool_text": {"remaining": budget["tool_text_remaining"],
                          "limit": conf["runtime"]["tool_text_total"]},
        },
    }

    if kind == "run":
        score = json.loads((adir / "score.json").read_text())
        bundle["scorer"] = {k: score[k] for k in (
            "scorer_version", "wrong_way_count", "expected_color_multiset", "outcome",
            "count_numeric_match", "color_multiset_correct", "complete_count_correct",
            "partial_color_matches", "matching_scope")}
        rc = review["clips"][clip]
        bundle["review"] = {"reviewer": review["reviewer"], "independent": review["independent"],
                            "count_review": rc["count_review"], "identity_review": rc["identity_review"],
                            "color_review": rc["color_review"],
                            "targets": [{k: t[k] for k in ("vehicle_ref", "object_id", "review_frame")}
                                        for t in rc["targets"]]}
        bundle["stability"] = extra["stability"][clip]
    else:
        bundle["diagnostic"] = {
            "scenario": meta["case"], "controller": meta["controller"],
            "packet": {k: packet[k] for k in PACKET_KEYS if k != "video_sha256"},
            "limits": next(e for e in events if e["kind"] == "diagnostic_start")["limits"],
            "fixed_policy": next(e for e in events if e["kind"] == "diagnostic_controller")["fixed_policy"],
            "siblings": extra["siblings"][meta["case"]],
            "review": {"reviewer": review["reviewer"], "independent": review["independent"],
                       "pi_correct": review["cases"][meta["case"]]["pi_correct"]},
        }

    # Self-checks against the run's own records.
    assert sum(d[6] < 0 for f in tracking["frames"] for d in f["d"]) == ans["ungrouped_detection_count"]
    assert sum(o["origin"] != "imported" for o in obs) == budget["visual"]["vlm_requests"]["used"]
    if agent:
        assert len(agent["steps"]) == budget["nemotron"]["used"], (len(agent["steps"]), budget["nemotron"])
    else:
        assert budget["nemotron"]["used"] == 0

    blob = json.dumps(bundle, ensure_ascii=False)
    if found := leaks(blob):
        shutil.rmtree(out)
        raise SystemExit(f"REFUSING TO WRITE {name}: " + "; ".join(found))
    if not (VIDEO_DIR / f"{clip}.mp4").is_file():
        raise SystemExit(f"{name}: no committed proxy for {clip}")
    if not any((out / "frames").iterdir()):
        (out / "frames").rmdir()
    (out / "bundle.json").write_text(json.dumps(bundle, ensure_ascii=False, separators=(",", ":")))
    return name


def stability(batch: Path, manifest: dict) -> dict:
    by_clip: dict[str, list[dict]] = {}
    for p in manifest["plan"]:
        by_clip.setdefault(p["clip_id"], []).append(summary(batch / p["attempt"]))
    out = {}
    for clip, rows in by_clip.items():
        rows.sort(key=lambda r: (r["pass"], r["query_id"], r["attempt"]))
        first = rows[0]
        same = lambda key: all(r[key] == first[key] for r in rows)  # noqa: E731
        out[clip] = {
            "attempts": [{k: r[k] for k in ("attempt", "pass", "query_id", "submission", "pi_started",
                                            "nemotron", "gemma", "wall_sec", "cases", "gemma_texts",
                                            "query_text", "query_delivered_to", "scorer")} for r in rows],
            "identical_answers": same("submission"),
            "identical_targets": same("targets"),
            "identical_tracking": same("tracking_sha256"),
            "identical_gemma_text": same("gemma_texts"),
        }
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--batch", required=True)
    ap.add_argument("--scenario", action="append", default=[])
    args = ap.parse_args()
    batch = Path(args.batch).resolve()
    manifest = json.loads((batch / "manifest.json").read_text())
    sem = json.loads((batch / "review-final-v1" / "semantic-review.json").read_text())
    review = {"reviewer": sem["reviewer"], "independent": sem["independent_blinded_human"]}
    plan = manifest["plan"]
    if all(p.get("group") == "A" for p in plan):
        review["clips"] = {c["clip_id"]: c for c in sem["clips"]}
        extra = {"stability": stability(batch, manifest)}
        firsts = [p["attempt"] for p in plan if p["pass"] == 1 and p["query_id"] == "Q1"]
        for a in firsts:
            print("wrote", export_attempt(batch, a, manifest, review, "run", extra))
    else:
        review["cases"] = sem["cases"]
        oracle = ROOT / "content" / "oracle"
        clip_of_sha = {json.loads(p.read_text())["video_sha256"]: p.stem for p in oracle.glob("*.json")}
        siblings: dict[str, list[dict]] = {}
        for p in plan:
            if p["controller"] != "pi":
                s = summary(batch / p["attempt"])
                siblings.setdefault(p["case"], []).append(
                    {k: s[k] for k in ("attempt", "controller", "submission", "nemotron", "gemma",
                                       "wall_sec", "cases", "gemma_texts")})
        extra = {"siblings": siblings, "clip_of_sha": clip_of_sha}
        for p in plan:
            if p["controller"] == "pi" and p["case"] in args.scenario:
                print("wrote", export_attempt(batch, p["attempt"], manifest, review, "diagnostic", extra))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
