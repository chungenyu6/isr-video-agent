#!/usr/bin/env python3
"""Export Failure Discovery MVP run directories into replay bundles.

SECURITY POSTURE - read before editing.

This is an ALLOWLIST exporter. It opens only the files named in SOURCES and
JSONL_SOURCES, plus `window.json` indexes inside the agent workspace, and it
copies only the .jpg frames those indexes or the VLM call log name. It never
walks a run directory looking for interesting things: a run directory also holds
`agent/pi-agent/auth.json`, `environment.txt`, the agent's own git objects and a
copy of the source video, none of which may be published.

Two further guards, because the bundle gets published:
  * absolute host paths are rewritten to placeholders before writing, and
    assert_publishable() refuses a bundle in which any survive;
  * the experiment repository is read, never written. Bytecode caching is off so
    that even importing from it leaves no trace there.

Usage:
  python3 tools/export_run.py --formal [--prune]
  python3 tools/export_run.py --run-dir <run> [--run-dir <run> ...] [--live]
"""

from __future__ import annotations

import argparse
import base64
import datetime as dt
import json
import os
import re
import shutil
import sys
from collections import Counter
from pathlib import Path

sys.dont_write_bytecode = True

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import adapters  # noqa: E402
from adapters.base import ev  # noqa: E402

EXPERIMENT = Path(os.environ.get("EXPERIMENT_ROOT", "/home/isr-video-agent"))
CAMPAIGN = EXPERIMENT / "experiments" / "isr-video-agent"

# --- the allowlist ----------------------------------------------------------
SOURCES = {
    "run": "run.json",
    "task": "input/task.json",
    "evidence": "evidence.json",
    "v0": "v0_report.json",
    "enhanced": "enhanced_report.json",
}
JSONL_SOURCES = {
    "budget": "tool-logs/budget.jsonl",
    "vlm": "tool-logs/vlm_calls.jsonl",
    "probe": "tool-logs/probe.jsonl",
    "errors": "tool-logs/errors.jsonl",
    "extraction": "tool-logs/extraction.jsonl",
    "sampling": "tool-logs/sampling.jsonl",
    #: Every image actually sent to the VLM, with its bytes. The agent deletes the
    #: window directories (`rm -rf coarse_scan`), so by export time the workspace
    #: usually holds no images at all and every observation showed "image file is
    #: missing". This archive is written into the root-owned tool-logs directory
    #: at send time and the agent cannot unlink it (D068).
    "vlm_frames": "tool-logs/vlm_frames.jsonl",
}

#: Strings that must never reach a published bundle, whatever their context.
HARD_FORBIDDEN = ("/home/", "/root/", "auth.json", "apiKey", "api_key", "Authorization")
#: Oracle paths may appear only as a refusal (the agent's own `find` hitting the
#: boundary). An unrefused mention means something read it.
SOFT_FORBIDDEN = ("data/labels", "oracle.json", "scenario-index.jsonl")
_DENIED_RE = re.compile(r"Permission denied|EACCES|Operation not permitted", re.IGNORECASE)

SCRIPT_RE = re.compile(r"\b(probe_video|crv_prepare|extract_window|vlm_inspect|submit_evidence)\b")
DECLARED_PIPELINE = ["probe_video", "extract_window", "vlm_inspect", "submit_evidence"]
DEFAULT_LIMITS = {"coarse_frames": 16, "dense_frames": 16, "vlm_inspected_frames": 32}
SLOW_RUN_SECONDS = 180


def read_json(path: Path):
    if not path.is_file():
        return None
    try:
        return json.loads(path.read_text(errors="replace"))
    except json.JSONDecodeError:
        return None


def read_jsonl(path: Path) -> list[dict]:
    if not path.is_file():
        return []
    rows = []
    for line in path.read_text(errors="replace").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            rows.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return rows


def parse_iso(value: str | None) -> float | None:
    if not value:
        return None
    try:
        return dt.datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()
    except ValueError:
        return None


def inside(base: Path, rel: str) -> Path | None:
    """Resolve a workspace-relative path, refusing anything that escapes it."""
    try:
        p = (base / rel).resolve()
        p.relative_to(base.resolve())
    except (ValueError, OSError):
        return None
    return p


# --- formal run discovery ---------------------------------------------------

def formal_runs() -> list[tuple[Path, dict]]:
    """The 56 formal rows, each mapped to exactly one non-excluded run directory."""
    excluded = {r["run_id"] for r in read_jsonl(CAMPAIGN / "exclusions.jsonl")}
    rows = [r for r in read_jsonl(CAMPAIGN / "run-matrix.jsonl") if r.get("stage") == "discovery"]
    rows += read_jsonl(CAMPAIGN / "confirmation-matrix.jsonl")
    out = []
    for row in rows:
        prefix = f"fd-pi-{row['stage']}-{row['clip_id']}-rep_{row['replicate']}-"
        hits = [d for d in sorted((CAMPAIGN / "runs").glob(prefix + "*"))
                if d.name not in excluded and (read_json(d / "run.json") or {}).get("agent_seed") == row["agent_seed"]]
        if len(hits) != 1:
            raise SystemExit(f"matrix row {row} maps to {len(hits)} run directories")
        out.append((hits[0], row))
    return out


# --- export -------------------------------------------------------------------

def export(run_dir: Path, out_root: Path, row: dict, *, live: bool = False) -> Path:
    src = {k: read_json(run_dir / v) for k, v in SOURCES.items()}
    logs = {k: read_jsonl(run_dir / v) for k, v in JSONL_SOURCES.items()}
    run = src["run"]
    if not run:
        raise SystemExit(f"no run.json in {run_dir}")
    run_id = run["run_id"]
    workspace = run_dir / "workspace"

    events = adapters.get("pi").agent_events(run_dir)
    if not events:
        raise SystemExit(f"adapter produced no events for {run_id}")

    def results_for(script: str) -> list[float]:
        return [e["_ts"] for e in events if e["type"] == "tool.result" and e.get("script") == script]

    session_end = max(e["_ts"] for e in events)

    # --- frames: every extraction index the agent produced -----------------
    frames: dict[str, dict] = {}
    windows = []
    for wp in sorted(workspace.rglob("window.json")):
        if ".git" in wp.parts:
            continue
        w = read_json(wp)
        if not isinstance(w, dict):
            continue
        out_dir = str(w.get("output_dir") or wp.parent.relative_to(workspace))
        stamps = [r["ts"] for r in logs["extraction"]
                  if isinstance(r.get("ts"), (int, float))
                  and any(isinstance(a, str) and a.startswith(out_dir + "/") for a in r.get("cmd") or [])]
        ts = max(stamps) if stamps else None
        windows.append({"dir": out_dir, "window": w.get("window"), "reason": w.get("reason"),
                        "count": len(w.get("frames") or []), "_ts": ts,
                        "limits": (w.get("budget") or {}).get("limits")})
        for f in w.get("frames") or []:
            rel = f.get("frame")
            if rel and rel not in frames:
                frames[rel] = {"rel": rel, "frame_id": f.get("source_frame_id"),
                               "t": float(f.get("timestamp_sec") or 0.0), "window": out_dir,
                               "reason": w.get("reason"), "inspected": False, "observations": []}

    vlm_calls = []
    for call in logs["vlm"]:
        sent = call.get("frames_sent") or []
        texts = {str(o.get("source_frame_id")): o.get("observation") or ""
                 for o in (call.get("result") or {}).get("observations") or []}
        ids = []
        for f in sent:
            rel = f.get("frame")
            if not rel:
                continue
            rec = frames.setdefault(rel, {"rel": rel, "frame_id": f.get("source_frame_id"),
                                          "t": float(f.get("timestamp_sec") or 0.0), "window": None,
                                          "reason": "sent to the VLM without an extraction index",
                                          "inspected": False, "observations": []})
            rec["inspected"] = True
            ids.append(f.get("source_frame_id"))
            text = texts.get(str(f.get("source_frame_id")))
            if text:
                rec["observations"].append(text)
        usage = call.get("usage") or {}
        vlm_calls.append({"frame_ids": ids, "latency_sec": call.get("latency_sec"),
                          "tokens": usage.get("total_tokens"), "_ts": call.get("ts")})

    evidence = src["evidence"] or {}
    anchors = [a for t in evidence.get("reported_targets") or [] for a in t.get("anchors") or []]
    cited_paths = {a.get("frame_path") for a in anchors}

    dest = out_root / (run_id if live else run_id.rsplit("-", 1)[0])
    if dest.exists():
        shutil.rmtree(dest)
    (dest / "frames").mkdir(parents=True)

    frame_list = []
    # Prefer the workspace copy; fall back to the archive when the agent deleted it.
    archived = {}
    for archived_row in logs.get("vlm_frames", []):
        key = archived_row.get("frame")
        if key and archived_row.get("jpeg_b64") and key not in archived:
            archived[key] = archived_row

    for i, rec in enumerate(sorted(frames.values(), key=lambda r: (r["t"], r["rel"]))):
        path = inside(workspace, rec["rel"])
        file = None
        if path and path.suffix.lower() in (".jpg", ".jpeg") and path.is_file() and not path.is_symlink():
            file = f"frames/{i:03d}_{path.name}"
            shutil.copy2(path, dest / file)
        else:
            # NB: not `row` -- that is this function's matrix-row parameter, and
            # shadowing it here set it to None and broke every export.
            kept = archived.get(rec["rel"]) or archived.get(rec["rel"].replace("<workspace>", str(workspace)))
            if kept is not None:
                name = kept.get("name") or f"{rec['frame_id']}.jpg"
                file = f"frames/{i:03d}_{name}"
                (dest / file).write_bytes(base64.b64decode(kept["jpeg_b64"]))
                rec["reason"] = (rec["reason"] or "") + " (recovered from the sent-frame archive)"
        frame_list.append({
            "key": rec["rel"], "frame_id": rec["frame_id"], "t": rec["t"], "file": file,
            "window": rec["window"], "reason": rec["reason"], "inspected": rec["inspected"],
            "cited": rec["rel"] in cited_paths,
            "observation": " / ".join(rec["observations"]) or None,
        })
    file_by_key = {f["key"]: f["file"] for f in frame_list}

    # --- derived events -----------------------------------------------------
    for w in windows:
        if w["_ts"] is not None:
            events.append(ev(w["_ts"], "frames.ready", detail={
                "dir": w["dir"], "window": w["window"], "count": w["count"], "reason": w["reason"]}))
    for c in vlm_calls:
        if isinstance(c["_ts"], (int, float)):
            events.append(ev(c["_ts"], "observe.done", detail={
                "frame_ids": c["frame_ids"], "latency_sec": c["latency_sec"], "tokens": c["tokens"]}))
    # budget.jsonl has no timestamps: pin each reservation to the completion of the
    # call that made it, in order. A release belongs to the reservation before it.
    cursors: dict[str, int] = {}
    for b in logs["budget"]:
        tool = b.get("tool") or ""
        stamps = results_for(tool)
        i = cursors.get(tool, 0)
        if b.get("kind") == "release":
            i = max(0, i - 1)
        else:
            cursors[tool] = i + 1
        ts = stamps[i] if i < len(stamps) else (stamps[-1] if stamps else session_end)
        events.append(ev(ts, "budget.spend", script=tool, detail={
            "category": b.get("category"), "n": b.get("n"), "granted": bool(b.get("granted")),
            "kind": b.get("kind") or "reserve", "used_before": b.get("used_before"),
            "limit": b.get("limit")}))
    for err in logs["errors"]:
        if isinstance(err.get("ts"), (int, float)):
            m = SCRIPT_RE.search(" ".join(map(str, err.get("argv") or [])))
            events.append(ev(err["ts"], "tool.fault", script=m.group(1) if m else None,
                             detail={"code": err.get("code"), "message": err.get("message")}))

    created = parse_iso(run.get("created_at"))
    finished = parse_iso(run.get("finished_at"))
    submit = results_for("submit_evidence")
    if evidence:
        events.append(ev(submit[-1] if submit else session_end, "answer.submit", detail={
            "decision": evidence.get("decision"), "reported_count": evidence.get("reported_count")}))
    end_ts = max(max(e["_ts"] for e in events), finished or 0)
    enhanced = src["enhanced"] or {}
    v0 = src["v0"] or {}
    events.append(ev(end_ts + 0.5, "verify.result", detail={
        "v0_status": v0.get("v0_status"), "layers": enhanced.get("layers"), "outcome": enhanced.get("outcome")}))
    events.append(ev(end_ts + 0.6, "run.end", detail={"run_status": run.get("run_status")}))

    t0 = min(created or 1e18, min(e["_ts"] for e in events))
    events.sort(key=lambda e: e["_ts"])
    norm = [{"t": 0.0, "type": "run.start"}]
    norm += [{"t": round(e["_ts"] - t0, 3), **{k: v for k, v in e.items() if k != "_ts"}} for e in events]

    limits = next((w["limits"] for w in windows if w.get("limits")), None) or DEFAULT_LIMITS
    final: Counter[str] = Counter()
    for b in logs["budget"]:
        if b.get("granted") and b.get("category"):
            final[b["category"]] += int(b.get("n") or 0)

    probe = (logs["probe"] or [{}])[0]
    task = src["task"] or {}
    actual = [e["script"] for e in norm if e["type"] == "tool.call" and e.get("script")]
    claimed = [m.group(1) for line in evidence.get("tool_trace") or [] if (m := SCRIPT_RE.search(str(line)))]
    wall = (finished - created) if created and finished else None
    applied = next((r.get("applied") for r in logs["sampling"] if r.get("applied")), None) or {}

    bundle = {
        "bundle_version": "2.0",
        "run_id": run_id,
        "harness": "pi",
        "live": live,
        "exported_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "run": {
            "stage": "live" if live else (row.get("stage") or run.get("stage")),
            "clip_id": run.get("clip_id"),
            "replicate": run.get("replicate"),
            "agent_seed": run.get("agent_seed"),
            "applied_seed": applied.get("seed"),
            "layout_block": run.get("layout_block"),
            "candidate": row.get("candidate"),
            "locked_pattern": row.get("comparison_pattern"),
            "run_status": run.get("run_status"),
            "agent_exit_code": run.get("agent_exit_code"),
            "created_at": run.get("created_at"),
            "finished_at": run.get("finished_at"),
            "models": {k: {"model": v.get("model"), "revision": v.get("revision")}
                       for k, v in (run.get("services") or {}).items()},
        },
        "task": {"question": task.get("question", ""), "oracle_exposed": bool(task.get("oracle_exposed"))},
        "video": {
            "id": run.get("clip_id"),
            "duration_sec": float(probe.get("duration_sec") or 34.9),
            "fps": probe.get("fps") or 10.0,
            "width": probe.get("width") or 960,
            "height": probe.get("height") or 540,
            "nb_frames": probe.get("nb_frames") or 349,
            "proxy": f"video/{run.get('clip_id')}.mp4",
        },
        "budget": {"limits": limits, "final": dict(final)},
        "frames": frame_list,
        "windows": [{k: v for k, v in w.items() if k not in ("_ts", "limits")} for w in windows],
        "events": norm,
        "pipeline": {"declared": DECLARED_PIPELINE, "actual": actual, "claimed": claimed,
                     "agrees": Counter(actual) == Counter(claimed)},
        "evidence": {
            "present": bool(evidence),
            "decision": evidence.get("decision"),
            "reported_count": evidence.get("reported_count"),
            "frames_processed": evidence.get("frames_processed"),
            "windows_examined": [list(w) for w in evidence.get("windows_examined") or []],
            "notes": evidence.get("notes"),
            "reported_targets": [
                {"target_ref": t.get("target_ref"), "color_name": t.get("color_name"),
                 "interval_frames": t.get("interval_frames"),
                 "anchors": [{"frame_id": a.get("frame_id"), "timestamp_sec": a.get("timestamp_sec"),
                              "roi_xyxy": a.get("roi_xyxy"), "claim": a.get("claim"),
                              "file": file_by_key.get(a.get("frame_path"))}
                             for a in t.get("anchors") or []]}
                for t in evidence.get("reported_targets") or []
            ],
        },
        "v0": {
            "status": v0.get("v0_status", "not_run"),
            "checks": {k: bool(v) for k, v in (v0.get("checks") or {}).items()},
            "errors": list(v0.get("errors") or []),
        },
        "enhanced": {k: enhanced.get(k) for k in (
            "primary_eligible", "layers", "layer_details", "outcome", "earliest_violated_layer",
            "full_signatures", "comparison_patterns", "v0_blind_spot")} if enhanced else None,
        "telemetry": {
            "wall_clock_sec": round(wall, 1) if wall is not None else None,
            "slow_run": bool(wall and wall > SLOW_RUN_SECONDS),
            "vlm_calls": len(vlm_calls),
            "vlm_tokens": sum(c["tokens"] or 0 for c in vlm_calls),
            "tool_faults": len(logs["errors"]),
        },
    }

    bundle = scrub(bundle, run_dir)
    assert_publishable(bundle)
    (dest / "bundle.json").write_text(json.dumps(bundle, indent=1, ensure_ascii=False) + "\n")
    size = sum(p.stat().st_size for p in dest.rglob("*") if p.is_file()) // 1024
    print(f"{run_id} -> {dest.name}  ({sum(1 for f in frame_list if f['file'])} frames, {size} KB, {len(norm)} events)")
    return dest


def scrub(obj, run_dir: Path):
    """Replace host paths with placeholders, longest first."""
    subs = [
        (str(run_dir / "workspace"), "<workspace>"),
        (str(run_dir), "<run>"),
        (str(EXPERIMENT), "<experiment>"),
        ("/home/phase0agent", "<agent-home>"),
        # The agent's PATH includes the archived Phase 0 venv, so tracebacks name it.
        ("/home/video-code-harness/video-agent-harness-phase0", "<phase0>"),
        (str(ROOT), "<demo>"),
    ]

    def walk(o):
        if isinstance(o, str):
            for a, b in subs:
                o = o.replace(a, b)
            return o
        if isinstance(o, list):
            return [walk(x) for x in o]
        if isinstance(o, dict):
            return {k: walk(v) for k, v in o.items()}
        return o

    return walk(obj)


def assert_publishable(bundle: dict) -> None:
    blob = json.dumps(bundle, ensure_ascii=False)
    for needle in HARD_FORBIDDEN:
        if (i := blob.find(needle)) != -1:
            raise SystemExit(f"REFUSING TO WRITE {bundle['run_id']}: contains {needle!r} near "
                             f"{blob[max(0, i - 80): i + 80]!r}")
    for needle in SOFT_FORBIDDEN:
        start = 0
        while (i := blob.find(needle, start)) != -1:
            start = i + len(needle)
            if not _DENIED_RE.search(blob[max(0, i - 160): i + 240]):
                raise SystemExit(f"REFUSING TO WRITE {bundle['run_id']}: unrefused reference to {needle!r}")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--formal", action="store_true", help="export the 56 formal matrix rows")
    ap.add_argument("--run-dir", action="append", default=[])
    ap.add_argument("--out", default=str(ROOT / "bundles"))
    ap.add_argument("--prune", action="store_true", help="with --formal: delete bundles not in the formal set")
    ap.add_argument("--live", action="store_true", help="mark bundles as live demo runs")
    args = ap.parse_args()

    out_root = Path(args.out)
    out_root.mkdir(parents=True, exist_ok=True)
    targets: list[tuple[Path, dict]] = formal_runs() if args.formal else []
    if args.run_dir:
        rows = {d.name: row for d, row in formal_runs()} if not args.live else {}
        for rd in args.run_dir:
            path = Path(rd).resolve()
            # A run outside any matrix has no row. `.get(name, {})` is not enough:
            # a name present with a None value still yields None.
            targets.append((path, rows.get(path.name) or {}))
    if not targets:
        ap.error("nothing to export: pass --formal or --run-dir")

    written = [export(d, out_root, row, live=args.live) for d, row in targets]
    if args.formal and args.prune:
        keep = {p.name for p in written}
        for d in out_root.iterdir():
            if d.is_dir() and d.name not in keep:
                shutil.rmtree(d)
                print(f"pruned {d.name}")
    print(f"\nexported {len(written)} bundle(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
