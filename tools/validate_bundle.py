#!/usr/bin/env python3
"""Gate replay bundles before they may be committed or published.

Three independent layers:

  1. SCHEMA   the bundle matches schema/bundle.schema.json
  2. LEAK     no host path, credential file, stray file or unrefused oracle path
  3. SANITY   frames on disk, one monotonic clock, frame ids inside the clip,
              an enhanced report on every formal run, size under budget

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

try:
    import jsonschema
except ImportError:
    sys.exit("jsonschema is required: pip install jsonschema")

ROOT = Path(__file__).resolve().parent.parent
SCHEMA = ROOT / "schema" / "bundle.schema.json"
VIDEO_DIR = ROOT / "app" / "public" / "video"

HARD_FORBIDDEN = ("/home/", "/root/", "auth.json", "apiKey", "api_key", "Authorization")
SOFT_FORBIDDEN = ("data/labels", "oracle.json", "scenario-index.jsonl")
DENIED_RE = re.compile(r"Permission denied|EACCES|Operation not permitted", re.IGNORECASE)
FRAME_FILE_RE = re.compile(r"frames/\d{3}_[\w.\-]+\.jpe?g")

MAX_BUNDLE_BYTES = 1_500_000
MAX_DIR_BYTES = 2_500_000


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

    for needle in HARD_FORBIDDEN:
        if needle in raw:
            fails.append(f"leak: contains {needle!r}")
    for needle in SOFT_FORBIDDEN:
        start = 0
        while (i := raw.find(needle, start)) != -1:
            start = i + len(needle)
            if not DENIED_RE.search(raw[max(0, i - 160): i + 240]):
                fails.append(f"leak: unrefused reference to {needle!r}")
                break
    for f in bundle_dir.rglob("*"):
        rel = f.relative_to(bundle_dir).as_posix()
        if f.is_symlink():
            fails.append(f"leak: symlink {rel}")
        elif f.is_file() and rel != "bundle.json" and not FRAME_FILE_RE.fullmatch(rel):
            fails.append(f"leak: unexpected file {rel}")

    if any(x.startswith("schema") for x in fails):
        return fails

    nb = b["video"]["nb_frames"]
    times = [e["t"] for e in b["events"]]
    if times != sorted(times):
        fails.append("sanity: events are not in clock order")
    for fr in b["frames"]:
        if fr["file"] and not (bundle_dir / fr["file"]).is_file():
            fails.append(f"sanity: frame file missing {fr['file']}")
        if fr["frame_id"] is not None and not 0 <= fr["frame_id"] < nb:
            fails.append(f"sanity: frame id {fr['frame_id']} outside 0..{nb - 1}")
    for t in b["evidence"]["reported_targets"]:
        for a in t["anchors"]:
            if a["file"] and not (bundle_dir / a["file"]).is_file():
                fails.append(f"sanity: anchor frame missing {a['file']}")
    if not b["live"] and b["enhanced"] is None:
        fails.append("sanity: formal bundle has no enhanced report")
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
