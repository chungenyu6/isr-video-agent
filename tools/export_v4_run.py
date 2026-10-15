#!/usr/bin/env python3
"""Export V4.2 attempts into replay bundles.

SECURITY POSTURE - read before editing.

This is an ALLOWLIST exporter. Per attempt it opens only:

  sut/tracking.jsonl, sut/motion.json, sut/gateway-events.jsonl,
  sut/pi-events.jsonl (message timestamps only), sut/run.json,
  verdict.json (Post-hoc Verifier), score.json (study scorer),
  the two images per Gemma call named by a visual_request event,

and per batch: manifest.json (commits and model revisions only) and
review-final-v1/semantic-review.json (one row per attempt).

It never opens agent-command.json, worker-request.json, requests/*, TRACE files,
review images, the source video or anything under data/. Selected fields are
copied by name; nothing is copied wholesale. The experiment repository is read,
never written (no bytecode, no output there). Every bundle passes
publish_guard.leaks() before it is written.

Usage:
  python3 -B tools/export_v4_run.py --batch <batch dir> [--attempt a002 ...]
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import shutil
import sys
from pathlib import Path

sys.dont_write_bytecode = True

from PIL import Image  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
from publish_guard import leaks  # noqa: E402

BUNDLES = ROOT / "bundles"
VIDEO_DIR = ROOT / "app" / "public" / "video"
CLASSES = {1: "bicycle", 2: "car", 3: "motorcycle", 5: "bus", 7: "truck"}
BUDGET_RE = re.compile(
    r"main calls remaining (\d+); Gemma remaining (\d+); host text remaining (\d+)")
STEP_TEXT_CAP = 6000


def jl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def r1(x: float) -> float:
    return round(float(x), 1)


def export_tracking(sut: Path) -> tuple[dict, dict]:
    rows = jl(sut / "tracking.jsonl")
    start = next(r for r in rows if r["kind"] == "start")
    end = next(r for r in rows if r["kind"] == "end")
    motion = json.loads((sut / "motion.json").read_text())
    alias_of = {int(v.rsplit("_", 1)[1]): k for k, v in motion["aliases"].items()}
    order = sorted(alias_of, key=lambda raw: int(alias_of[raw][1:]))
    index = {raw: i for i, raw in enumerate(order)}

    frames = [{"d": [], "p": []} for _ in range(start["frame_count"])]
    for r in rows:
        if r["kind"] != "frame":
            continue
        f = frames[r["source_frame_id"]]
        for d in r["detections"]:
            ti = index[d["track_id"]] if d["track_id"] is not None else -1
            f["d"].append([*map(r1, d["bbox"]), d["class_id"], ti, round(d["private_score"], 3)])
        for p in r["predictions"]:
            if p["track_id"] in index:
                f["p"].append([*map(r1, p["bbox"]), index[p["track_id"]]])

    tracks = []
    for raw in order:
        alias = alias_of[raw]
        segs = motion["motion"][alias]
        tracks.append({
            "alias": alias,
            "raw_id": raw,
            "observed": [segs[0]["observed_start"], segs[-1]["observed_end"]],
            "phases": [{"start": p["start_frame"], "end": p["end_frame"], "origin": p["origin"],
                        "destination": p["destination"], "direction": p["direction"]}
                       for s in segs for p in s["phases"]],
        })
    video = {"fps": start["fps"], "width": start["width"], "height": start["height"],
             "nb_frames": start["frame_count"],
             "duration_sec": round(start["frame_count"] / start["fps"], 2)}
    assert end["complete"] and end["frames"] == start["frame_count"]
    return {"classes": CLASSES, "tracks": tracks, "frames": frames}, video


def step_times(sut: Path, latencies: list[float]) -> list[tuple[float, float]]:
    """(t_call, t_result) per tool call, seconds from the task message.

    Pi stamps an assistant message when its request starts and a tool result
    when it returns. The call itself exists once the model has answered, so
    t_call = request start + that turn's orchestrator latency.
    """
    msgs = [e["message"] for e in jl(sut / "pi-events.jsonl") if e["type"] == "message_end"]
    t0 = next(m["timestamp"] for m in msgs if m["role"] == "user")
    out, pending, turn = [], [], 0
    for m in msgs:
        if m["role"] == "assistant":
            calls = [c for c in m["content"] if isinstance(c, dict) and c.get("type") == "toolCall"]
            lat = latencies[turn] if turn < len(latencies) else 0.0
            turn += 1
            pending += [(m["timestamp"] - t0) / 1000 + lat] * len(calls)
        elif m["role"] == "toolResult" and pending:
            out.append((round(pending.pop(0), 3), round((m["timestamp"] - t0) / 1000, 3)))
    return out


def jpeg(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    Image.open(src).convert("RGB").save(dst, "JPEG", quality=85, optimize=True)


def export_attempt(batch: Path, attempt: str, manifest: dict, review: dict) -> str:
    adir = batch / attempt
    sut = adir / "sut"
    meta = json.loads((adir / "attempt.json").read_text())
    clip = meta["clip_id"]
    name = f"v42-{clip}-s{meta['seed']}"
    out = BUNDLES / name
    if out.exists():
        shutil.rmtree(out)
    (out / "frames").mkdir(parents=True)

    tracking, video = export_tracking(sut)
    video["proxy"] = f"video/{clip}.mp4"
    events = jl(sut / "gateway-events.jsonl")
    conf = next(e for e in events if e["kind"] == "configuration")
    latencies = [e["latency_sec"] for e in events if e["kind"] == "orchestrator_response"]
    tool_events = [e for e in events if e["kind"] == "tool"]
    times = step_times(sut, latencies)
    assert len(times) == len(tool_events), (attempt, len(times), len(tool_events))

    visuals, by_ref = [], {}
    for e in events:
        if e["kind"] == "visual_request":
            full = next(m for m in e["media"] if m["role"] == "full")
            crop = next(m for m in e["media"] if m["role"] == "crop")
            ref = e["observation_ref"]
            f = full["source_frame_id"]
            jpeg(sut / full["path"], out / "frames" / f"{ref}-{f}-full.jpg")
            jpeg(sut / crop["path"], out / "frames" / f"{ref}-{f}-crop.jpg")
            target = full["targets"][0]
            by_ref[ref] = len(visuals)
            visuals.append({
                "observation_ref": ref, "intent": e["intent"], "track_ref": target["track_ref"],
                "frame": f, "target_bbox": [r1(v) for v in target["original_bbox"]],
                "crop_bounds": crop["crop_bounds"],
                "full": f"frames/{ref}-{f}-full.jpg", "crop": f"frames/{ref}-{f}-crop.jpg",
            })
        elif e["kind"] == "visual_response":
            rec = e["record"]
            v = visuals[by_ref[rec["observation_ref"]]]
            v.update({"text": rec["text"], "finish_reason": rec["finish_reason"],
                      "truncated": rec["truncated"], "latency_sec": round(e["latency_sec"], 3)})

    steps, vis_i = [], 0
    for i, (e, (tc, tr)) in enumerate(zip(tool_events, times)):
        text = e["result"].get("agent_text", "")
        m = BUDGET_RE.search(text)
        step = {
            "i": i, "tool": e["name"], "args": e["args"], "accepted": e["accepted"],
            "t_call": tc, "t_result": tr,
            "agent_text": text[:STEP_TEXT_CAP], "agent_text_chars": len(text),
            "budget_before": ({"main_remaining": int(m[1]), "gemma_remaining": int(m[2]),
                               "text_remaining": int(m[3])} if m else None),
        }
        if e["name"] == "inspect_window" and e["accepted"] and vis_i < len(visuals):
            step["visual"] = vis_i
            visuals[vis_i]["step"] = i
            vis_i += 1
        if e["name"] == "scan_video":
            tracking["visible_from"] = tr
        steps.append(step)

    sub = next(e for e in events if e["kind"] == "submission")
    run = json.loads((sut / "run.json").read_text())
    verdict = json.loads((adir / "verdict.json").read_text())
    score = json.loads((adir / "score.json").read_text())
    rv = review["attempts"][attempt]
    rt = conf["runtime"]
    rev = manifest["revisions"]

    bundle = {
        "bundle_version": "4.2",
        "run_id": name,
        "attempt": attempt,
        "clip_id": clip,
        "seed": meta["seed"],
        "live": False,
        "exported_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "batch": {"name": batch.name, "created": manifest["created"],
                  "candidate_revision": manifest["candidate_revision"]},
        "provenance": {
            "sut_commit": rev["v4"]["commit"],
            "study_commit": rev["study"]["commit"],
            "service_commit": rev["model_serving"]["commit"],
            "orchestrator": {"model": conf["orchestrator_config"]["model"],
                             "revision": conf["orchestrator_config"]["revision"],
                             "temperature": conf["orchestrator_config"]["temperature"],
                             "top_p": conf["orchestrator_config"]["top_p"]},
            "perception": {"model": conf["visual_config"]["model"],
                           "revision": conf["visual_config"]["revision"],
                           "temperature": conf["visual_config"]["temperature"]},
            "tracking": {"contract": manifest["tracking_service"]["contract"],
                         "weights_sha256": manifest["tracking_service"]["weights_sha256"]},
        },
        "task": {
            "statement": conf["profile"]["task_statement"],
            "system": conf["surface"]["system"],
            "tools": conf["surface"]["descriptions"],
        },
        "runtime": {k: rt[k] for k in (
            "model_calls", "visual_calls", "tool_text_total", "tool_text_page", "control_text_reserve",
            "crop_padding", "inspect_source_frame_cap", "max_inspect_seconds", "compare_image_cap",
            "motion_median_points", "motion_min_pixels", "motion_diagonal_fraction",
            "motion_stride_fps_divisor", "main_input_target", "memory_summary")},
        "video": video,
        "tracking": tracking,
        "steps": steps,
        "visual": visuals,
        "submission": {**{k: sub["bundle"][k] for k in (
            "decision", "reported_count", "colors", "count_complete", "uncertainty")},
            "accepted": sub["accepted"], "step": len(steps) - 1},
        "runtime_verifier": {
            "tool_calls": len(steps),
            "rejected_calls": sum(not s["accepted"] for s in steps),
            "submission_accepted": sub["accepted"],
            "formal_evidence_gate": sub["formal_evidence_gate"],
        },
        "posthoc_verifier": {"status": verdict["v4_status"], "issues": verdict["issues"],
                             "scope": verdict["scope"],
                             "semantic_correctness": verdict["semantic_correctness"]},
        "run": {"wall_sec": run["wall_sec"], "terminal_reason": run["terminal_reason"],
                "orchestrator_calls": run["orchestrator_calls"],
                "visual_calls": len(visuals),
                "tracking_latency_sec": round(next(
                    e["latency_sec"] for e in events if e["kind"] == "tracking_response"), 3),
                "replay_sec": steps[-1]["t_result"]},
        "scorer": {k: score[k] for k in (
            "scorer_version", "wrong_way_count", "expected_color_multiset", "outcome",
            "count_numeric_match", "color_multiset_correct", "complete_count_correct",
            "partial_color_matches", "matching_scope")},
        "review": {"scope": review["scope"], **{k: rv.get(k) for k in (
            "count_correct", "semantic_color_support", "final_item_identity", "goal_correct")}},
    }

    blob = json.dumps(bundle, ensure_ascii=False)
    if found := leaks(blob):
        shutil.rmtree(out)
        raise SystemExit(f"REFUSING TO WRITE {name}: " + "; ".join(found))
    if not (VIDEO_DIR / f"{clip}.mp4").is_file():
        raise SystemExit(f"{name}: no committed proxy for {clip}")
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
    review = {"scope": sem["scope"], "attempts": {a["attempt"]: a for a in sem["attempts"]}}
    attempts = args.attempt or [p["attempt"] for p in manifest["plan"]]
    for a in attempts:
        print("wrote", export_attempt(batch, a, manifest, review))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
