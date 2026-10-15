#!/usr/bin/env python3
"""Gate V4.2 replay bundles before they may be committed or published.

Three independent layers:

  1. SCHEMA   the bundle matches schema/bundle-v42.schema.json
  2. LEAK     no host path, loopback URL, credential, stray file or oracle path
  3. SANITY   frame ids inside the clip, track indexes in range, one monotonic
              clock, every Gemma frame shows a real detection of its track,
              proxy video present, size under budget

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
SCHEMA = ROOT / "schema" / "bundle-v42.schema.json"
VIDEO_DIR = ROOT / "app" / "public" / "video"
FRAME_FILE_RE = re.compile(r"frames/o[0-9a-f]{32}-\d+-(full|crop)\.jpg")

MAX_BUNDLE_BYTES = 1_500_000
MAX_DIR_BYTES = 8 * 1024 * 1024


def validate(bundle_dir: Path, schema: dict) -> list[str]:
    path = bundle_dir / "bundle.json"
    if not path.is_file():
        return ["bundle.json missing"]
    raw = path.read_text()
    try:
        b = json.loads(raw)
    except json.JSONDecodeError as exc:
        return [f"bundle.json does not parse: {exc}"]

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

    times = [x for s in b["steps"] for x in (s["t_call"], s["t_result"])]
    if times != sorted(times):
        fails.append("sanity: steps are not in clock order")
    if [s["i"] for s in b["steps"]] != list(range(len(b["steps"]))):
        fails.append("sanity: step indexes are not 0..n-1")

    alias_idx = {t["alias"]: i for i, t in enumerate(tr["tracks"])}
    for v in b["visual"]:
        for key in ("full", "crop"):
            if not (bundle_dir / v[key]).is_file():
                fails.append(f"sanity: visual image missing {v[key]}")
        ti = alias_idx.get(v["track_ref"])
        if ti is None or not 0 <= v["frame"] < nb:
            fails.append(f"sanity: visual {v['observation_ref']} names an unknown track or frame")
        elif not any(int(d[5]) == ti for d in tr["frames"][v["frame"]]["d"]):
            fails.append(f"sanity: {v['track_ref']} has no real detection at frame {v['frame']}")
        if b["steps"][v["step"]].get("visual") is None:
            fails.append(f"sanity: visual {v['observation_ref']} is not linked from its step")

    if not (VIDEO_DIR / Path(b["video"]["proxy"]).name).is_file():
        fails.append(f"sanity: proxy video missing {b['video']['proxy']}")
    if path.stat().st_size > MAX_BUNDLE_BYTES:
        fails.append(f"sanity: bundle.json is {path.stat().st_size} bytes")
    total = sum(f.stat().st_size for f in bundle_dir.rglob("*") if f.is_file())
    if total > MAX_DIR_BYTES:
        fails.append(f"sanity: bundle directory is {total} bytes")
    return fails


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("paths", nargs="+")
    args = ap.parse_args()
    schema = json.loads(SCHEMA.read_text())
    dirs = [Path(p).parent if p.endswith("bundle.json") else Path(p) for p in args.paths]
    bad = 0
    for d in dirs:
        fails = validate(d, schema)
        if fails:
            bad += 1
            print(f"FAIL {d.name}")
            for f in fails[:12]:
                print(f"     {f}")
    print(f"{len(dirs) - bad}/{len(dirs)} bundles pass")
    return 1 if bad else 0


if __name__ == "__main__":
    raise SystemExit(main())
