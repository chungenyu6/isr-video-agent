#!/usr/bin/env python3
"""Gate V4.2 and V5.3 replay bundles before they may be committed or published.

Three independent layers:

  1. SCHEMA   the bundle matches schema/bundle-v42 or bundle-v53, chosen by
              its bundle_version
  2. LEAK     no host path, loopback URL, credential, stray file or oracle path
  3. SANITY   frame ids inside the clip, track indexes in range, every Gemma
              frame shows a real detection of its track, proxy video present,
              size under budget; V4.2: one monotonic clock; V5.3: vehicle
              members are real tracks, reported intervals lie on observed
              frames, the ungrouped count matches the detections, agent steps
              are ordered, linked to their Gemma images, and their tool and text
              turns equal the Nemotron budget, every case and colour cites something the bundle holds

The exporter enforces the leak rules as it writes; this re-checks what is on
disk, because a bundle can be edited after export and CI never runs the exporter.

Usage:
  python3 tools/validate_bundle.py bundles/*/
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

sys.dont_write_bytecode = True

try:
    import jsonschema
except ImportError:
    sys.exit("jsonschema is required: pip install jsonschema")

sys.path.insert(0, str(Path(__file__).resolve().parent))
from publish_guard import leaks  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
SCHEMAS = {"4.2": ROOT / "schema" / "bundle-v42.schema.json",
           "5.3": ROOT / "schema" / "bundle-v53.schema.json"}
VIDEO_DIR = ROOT / "app" / "public" / "video"
FRAME_FILE_RE = re.compile(r"frames/o[0-9a-f]{32}-\d+-(full|crop\d*)\.jpg")

MAX_BUNDLE_BYTES = 1_500_000
MAX_DIR_BYTES = 8 * 1024 * 1024


def validate(bundle_dir: Path, schemas: dict[str, dict]) -> list[str]:
    path = bundle_dir / "bundle.json"
    if not path.is_file():
        return ["bundle.json missing"]
    raw = path.read_text()
    try:
        b = json.loads(raw)
    except json.JSONDecodeError as exc:
        return [f"bundle.json does not parse: {exc}"]

    schema = schemas.get(b.get("bundle_version")) if isinstance(b, dict) else None
    if schema is None:
        return [f"schema: unknown bundle_version {b.get('bundle_version') if isinstance(b, dict) else None!r}"]
    fails = [f"schema: {'/'.join(map(str, e.path)) or '<root>'}: {e.message[:160]}"
             for e in jsonschema.Draft202012Validator(schema).iter_errors(b)]
    fails += [f"leak: {x}" for x in leaks(raw)]
    for f in bundle_dir.rglob("*"):
        rel = f.relative_to(bundle_dir).as_posix()
        if f.is_symlink():
            fails.append(f"leak: symlink {rel}")
        elif f.is_file() and rel != "bundle.json" and not FRAME_FILE_RE.fullmatch(rel):
            fails.append(f"leak: unexpected file {rel}")
    if any(x.startswith("schema") for x in fails):
        return fails

    nb = b["video"]["nb_frames"]
    tr = b["tracking"]
    nt = len(tr["tracks"])
    if len(tr["frames"]) != nb:
        fails.append(f"sanity: {len(tr['frames'])} tracking frames for a {nb}-frame clip")
    for i, fr in enumerate(tr["frames"]):
        for d in fr["d"]:
            if not -1 <= int(d[5]) < nt:
                fails.append(f"sanity: frame {i} detection track index {d[5]} out of range")
        for p in fr["p"]:
            if not 0 <= int(p[4]) < nt:
                fails.append(f"sanity: frame {i} prediction track index {p[4]} out of range")
    for t in tr["tracks"]:
        s, e = t["observed"]
        if not 0 <= s <= e < nb:
            fails.append(f"sanity: {t['alias']} observed {s}-{e} outside the clip")

    alias_idx = {t["alias"]: i for i, t in enumerate(tr["tracks"])}
    if b["bundle_version"] == "5.3":
        fails += sanity_v53(b)
        visuals = [{"observation_ref": o["observation_ref"], "track_ref": t["track_ref"],
                    "frame": m["frame"], "full": m["full"], "crop": c["path"]}
                   for o in b["appearance"] for m in o["media"]
                   for t, c in zip(m["targets"], m["crops"])]
    else:
        times = [x for s in b["steps"] for x in (s["t_call"], s["t_result"])]
        if times != sorted(times):
            fails.append("sanity: steps are not in clock order")
        if [s["i"] for s in b["steps"]] != list(range(len(b["steps"]))):
            fails.append("sanity: step indexes are not 0..n-1")
        visuals = b["visual"]
    for v in visuals:
        for key in ("full", "crop"):
            if not (bundle_dir / v[key]).is_file():
                fails.append(f"sanity: visual image missing {v[key]}")
        ti = alias_idx.get(v["track_ref"])
        if ti is None or not 0 <= v["frame"] < nb:
            fails.append(f"sanity: visual {v['observation_ref']} names an unknown track or frame")
        elif not any(int(d[5]) == ti for d in tr["frames"][v["frame"]]["d"]):
            fails.append(f"sanity: {v['track_ref']} has no real detection at frame {v['frame']}")
        if b["bundle_version"] == "4.2" and "step" in v and b["steps"][v["step"]].get("visual") is None:
            fails.append(f"sanity: visual {v['observation_ref']} is not linked from its step")

    if not (VIDEO_DIR / Path(b["video"]["proxy"]).name).is_file():
        fails.append(f"sanity: proxy video missing {b['video']['proxy']}")
    if path.stat().st_size > MAX_BUNDLE_BYTES:
        fails.append(f"sanity: bundle.json is {path.stat().st_size} bytes")
    total = sum(f.stat().st_size for f in bundle_dir.rglob("*") if f.is_file())
    if total > MAX_DIR_BYTES:
        fails.append(f"sanity: bundle directory is {total} bytes")
    return fails


def sanity_v53(b: dict) -> list[str]:
    fails = []
    tr = b["tracking"]
    vrefs = [v["ref"] for v in b["vehicles"]]
    nv = len(vrefs)
    tracks = {t["alias"]: t for t in tr["tracks"]}
    observed: dict[str, set[int]] = {v: set() for v in vrefs}
    ungrouped = 0
    for i, fr in enumerate(tr["frames"]):
        for d in fr["d"]:
            vi = int(d[6])
            if not -1 <= vi < nv:
                fails.append(f"sanity: frame {i} detection vehicle index {vi} out of range")
                continue
            if vi < 0:
                ungrouped += 1
                if int(d[5]) >= 0:
                    fails.append(f"sanity: frame {i} tracked detection outside every vehicle record")
            else:
                observed[vrefs[vi]].add(i)
                if int(d[5]) >= 0 and tr["tracks"][int(d[5])]["vehicle"] != vrefs[vi]:
                    fails.append(f"sanity: frame {i} track/vehicle mismatch")
    for v in b["vehicles"]:
        for m in v["members"]:
            if m not in tracks or tracks[m]["vehicle"] != v["ref"]:
                fails.append(f"sanity: {v['ref']} member {m} is not a track of that vehicle")
        seen = observed[v["ref"]]
        if not seen or [min(seen), max(seen)] != v["observed"] or len(seen) != v["frames_observed"]:
            fails.append(f"sanity: {v['ref']} observed span does not match its detections")
    a = b["answer"]
    if ungrouped != a["ungrouped_detection_count"]:
        fails.append(f"sanity: {ungrouped} ungrouped detections, answer says {a['ungrouped_detection_count']}")
    s = a["submission"]
    if s["decision"] == "answer" and not s["reported_count"] == len(s["colors"]) == len(a["targets"]):
        fails.append("sanity: reported count, colours and targets disagree")
    obs = {x["observation_ref"] for x in b["appearance"]}
    for t in a["targets"]:
        seen = observed.get(t["vehicle_ref"])
        if seen is None:
            fails.append(f"sanity: target {t['vehicle_ref']} is not a vehicle record")
            continue
        for lo, hi in t["source_frame_intervals"]:
            if not all(f in seen for f in range(lo, hi + 1)):
                fails.append(f"sanity: {t['vehicle_ref']} interval {lo}-{hi} includes unobserved frames")
        if t["color_observation_ref"] is not None and t["color_observation_ref"] not in obs:
            fails.append(f"sanity: {t['vehicle_ref']} colour cites an unknown observation")
    for x in b["appearance"]:
        if tracks.get(x["track_ref"], {}).get("vehicle") != x["vehicle_ref"]:
            fails.append(f"sanity: appearance {x['observation_ref']} track/vehicle mismatch")
        if (x["origin"] == "imported") != (not x["media"]):
            fails.append(f"sanity: appearance {x['observation_ref']} images do not match its origin")
    if sum(x["origin"] != "imported" for x in b["appearance"]) != b["budget"]["gemma"]["used"]:
        fails.append("sanity: Gemma observations differ from the Gemma budget")

    ag = b["agent"]
    if (ag is not None) != b["run"]["pi_started"]:
        fails.append("sanity: agent trace present without Pi, or Pi without a trace")
    steps = ag["steps"] if ag else []
    calls = [s for s in steps if s["kind"] in ("tool", "message")]
    if len(calls) != b["budget"]["nemotron"]["used"] or (ag and ag["calls"] != len(calls)):
        fails.append(f"sanity: {len(calls)} Nemotron turns, {b['budget']['nemotron']['used']} Nemotron calls")
    if (ag and ag["continuations"] != sum(s["kind"] == "nudge" for s in steps)):
        fails.append("sanity: continuation count disagrees with the steps")
    for s in steps:
        if (s["kind"] == "tool") != (s["tool"] is not None) or (s["kind"] != "tool" and s["outcome"] != s["kind"]):
            fails.append(f"sanity: step {s['i']} kind, tool and outcome disagree")
    if b["runtime_verifier"]["agent_tool_calls"] != sum(s["kind"] == "tool" for s in steps):
        fails.append("sanity: Runtime Verifier tool-call count disagrees with the steps")
    if [s["i"] for s in steps] != list(range(len(steps))):
        fails.append("sanity: step indexes are not 0..n-1")
    times = [t for s in steps for t in (s["t_call"], s["t_result"])]
    if times != sorted(times):
        fails.append("sanity: agent steps are not in clock order")
    for s in steps:
        if (s["outcome"] == "refused") != (s["code"] is not None):
            fails.append(f"sanity: step {s['i']} refusal code does not match its outcome")
        for v in s["visuals"]:
            if not 0 <= v < len(b["appearance"]) or b["appearance"][v].get("step") != s["i"]:
                fails.append(f"sanity: step {s['i']} links a visual that does not link back")
    if ag and (ag["refused"] != sum(s["outcome"] == "refused" for s in steps)
               or b["runtime_verifier"]["agent_refused"] != ag["refused"]):
        fails.append("sanity: refusal totals disagree")
    refs = set(vrefs) | set(tracks)
    for c in b["cases"]:
        if not set(c["refs"]) <= refs:
            fails.append(f"sanity: case {c['case_ref']} names unknown records {c['refs']}")
        for o in (c["result"] or {}).get("observation_refs", []):
            if o not in obs:
                fails.append(f"sanity: case {c['case_ref']} cites unknown observation {o}")
    v2 = b.get("property_eval_v2")
    if v2 is not None:
        y = dict(zip(v2["fields"], v2["Y"]))
        if any(y[f] != int(v2["counts"].get(f.split(".", 1)[1], 0) > 0) for f in v2["fields"]):
            fails.append("sanity: Property Evaluator v2 Y disagrees with its counts")
        pe = b.get("property_eval")
        if pe and y.get("L6.answer_FP") != int(bool(pe["geometry"]["false_positive_vehicles"])):
            fails.append("sanity: v2 answer_FP disagrees with v1 geometry false positives")
    if set(a["pending_cases"]) - {c["case_ref"] for c in b["cases"]}:
        fails.append("sanity: pending case missing from cases")
    return fails


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("paths", nargs="+")
    args = ap.parse_args()
    schemas = {k: json.loads(p.read_text()) for k, p in SCHEMAS.items()}
    dirs = [Path(p).parent if p.endswith("bundle.json") else Path(p) for p in args.paths]
    bad = 0
    for d in dirs:
        fails = validate(d, schemas)
        if fails:
            bad += 1
            print(f"FAIL {d.name}")
            for f in fails[:12]:
                print(f"     {f}")
    print(f"{len(dirs) - bad}/{len(dirs)} bundles pass")
    return 1 if bad else 0


if __name__ == "__main__":
    raise SystemExit(main())
