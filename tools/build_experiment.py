#!/usr/bin/env python3
"""Build content/experiment.json and prove the site's batch figures equal the report's.

  build   derive one summary row per bundle plus the batch figures, write
          content/experiment.json
  check   recompute everything from the committed bundles and fail if it differs
          from experiment.json or from REPORT (the figures the study's delivered
          report states). The site must not publish a number the study did not.

`--check` needs only this repository; CI has no access to the experiment.

Usage:
  python3 tools/build_experiment.py
  python3 tools/build_experiment.py --check
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.dont_write_bytecode = True

ROOT = Path(__file__).resolve().parent.parent
BUNDLES = ROOT / "bundles"
OUT = ROOT / "content" / "experiment.json"
ORACLE = ROOT / "content" / "oracle"

FEATURED = "v42-1-nominal-r1-s1"
#: experiments/video-agent-capability/reports/sut-v4.2-six-video-20261015-resumed.zh-TW.md
REPORT = {
    "attempts": 6,
    "accepted": 6,
    "posthoc_pass": 6,
    "count_correct": 3,
    "count_and_supported_colors": 1,
    "complete_correct": 0,
    "promoted": False,
}


def build() -> dict:
    runs = []
    for p in sorted(BUNDLES.glob("*/bundle.json")):
        b = json.loads(p.read_text())
        if b.get("live"):
            continue
        s = b["submission"]
        runs.append({
            "bundle": p.parent.name,
            "attempt": b["attempt"],
            "clip_id": b["clip_id"],
            "seed": b["seed"],
            "reported_count": s["reported_count"],
            "colors": s["colors"],
            "count_complete": s["count_complete"],
            "accepted": s["accepted"],
            "posthoc": b["posthoc_verifier"]["status"],
            "expected_count": b["scorer"]["wrong_way_count"],
            "count_correct": b["scorer"]["count_numeric_match"],
            "goal_correct": b["review"]["goal_correct"],
            "complete_correct": b["scorer"]["complete_count_correct"],
            "visual_calls": b["run"]["visual_calls"],
            "orchestrator_calls": b["run"]["orchestrator_calls"],
        })
    runs.sort(key=lambda r: r["attempt"])
    figures = {
        "attempts": len(runs),
        "accepted": sum(r["accepted"] for r in runs),
        "posthoc_pass": sum(r["posthoc"] == "pass" for r in runs),
        "count_correct": sum(r["count_correct"] for r in runs),
        "count_and_supported_colors": sum(bool(r["goal_correct"]) for r in runs),
        "complete_correct": sum(r["complete_correct"] for r in runs),
        "promoted": False,
    }
    first = json.loads((BUNDLES / runs[0]["bundle"] / "bundle.json").read_text()) if runs else {}
    return {
        "source": {
            "batch": first.get("batch", {}).get("name"),
            "candidate_revision": "v4.2",
            "sut_commit": first.get("provenance", {}).get("sut_commit"),
            "study_commit": first.get("provenance", {}).get("study_commit"),
            "service_commit": first.get("provenance", {}).get("service_commit"),
        },
        "featured": FEATURED,
        "figures": figures,
        "runs": runs,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()
    data = build()
    fails = []
    if data["figures"] != REPORT:
        fails.append(f"figures {data['figures']} != report {REPORT}")
    if FEATURED not in {r["bundle"] for r in data["runs"]}:
        fails.append(f"featured bundle {FEATURED} missing")
    for r in data["runs"]:
        if not (ORACLE / f"{r['clip_id']}.json").is_file():
            fails.append(f"no oracle for {r['clip_id']}")
    if args.check:
        committed = json.loads(OUT.read_text())
        if committed != data:
            fails.append("content/experiment.json is stale: run tools/build_experiment.py")
    else:
        OUT.write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n")
        print(f"wrote {OUT.relative_to(ROOT)}: {len(data['runs'])} runs")
    for f in fails:
        print("FAIL", f)
    if not fails:
        print("ok:", data["figures"])
    return 1 if fails else 0


if __name__ == "__main__":
    raise SystemExit(main())
