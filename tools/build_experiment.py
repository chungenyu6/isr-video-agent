#!/usr/bin/env python3
"""Build content/experiment.json and prove each version's batch figures equal its report's.

  build   derive one summary row per bundle plus the batch figures, write
          content/experiment.json
  check   recompute everything from the committed bundles and fail if it differs
          from experiment.json or from VERSIONS[*]["report"] (the figures each delivered
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

CURRENT = "v50"
#: Per version: bundle prefix, featured bundle and the figures its delivered
#: report states (experiments/video-agent-capability/reports/...).
VERSIONS = {
    "v50": {
        "label": "V5.0",
        "candidate_revision": "v5.0",
        "featured": "v50-1-nominal-r1-s1",
        #: sut-v5.0-six-video-20261015.zh-TW.md, section 1 and 7
        "report": {
            "attempts": 6,
            "accepted": 6,
            "posthoc_pass": 6,
            "count_correct": 6,
            "count_and_exact_colors": 4,
            "count_and_supported_colors": 6,
            "complete_correct": 0,
            "nemotron_calls": 0,
            "gemma_calls": 6,
            "tracking_jobs": 6,
            "promoted": False,
        },
    },
    "v42": {
        "label": "V4.2",
        "candidate_revision": "v4.2",
        "featured": "v42-1-nominal-r1-s1",
        #: sut-v4.2-six-video-20261015-resumed.zh-TW.md
        "report": {
            "attempts": 6,
            "accepted": 6,
            "posthoc_pass": 6,
            "count_correct": 3,
            "count_and_supported_colors": 1,
            "complete_correct": 0,
            "promoted": False,
        },
    },
}


def supported_v50(b: dict) -> bool:
    """Count matches and every reported target's identity and colour were judged
    supported by the source review (zero answers have no target to support)."""
    r = b["review"]
    return (b["scorer"]["count_numeric_match"] and r["false_reported_targets"] == 0
            and all(t["identity"].startswith("supported") and t["color"].startswith("supported")
                    for t in r["targets"]))


def row_v50(name: str, b: dict) -> dict:
    s = b["answer"]["submission"]
    return {
        "bundle": name, "attempt": b["attempt"], "clip_id": b["clip_id"], "seed": b["seed"],
        "reported_count": s["reported_count"], "colors": s["colors"],
        "count_complete": s["count_complete"],
        "accepted": b["runtime_verifier"]["final_answer_check"] == "pass",
        "posthoc": b["posthoc_verifier"]["status"],
        "expected_count": b["scorer"]["wrong_way_count"],
        "count_correct": b["scorer"]["count_numeric_match"],
        "exact_colors": b["scorer"]["count_numeric_match"] and b["scorer"]["color_multiset_correct"],
        "goal_correct": supported_v50(b),
        "complete_correct": b["scorer"]["complete_count_correct"],
        "visual_calls": len(b["appearance"]),
        "orchestrator_calls": b["budget"]["nemotron"]["used"],
    }


def row_v42(name: str, b: dict) -> dict:
    s = b["submission"]
    return {
        "bundle": name, "attempt": b["attempt"], "clip_id": b["clip_id"], "seed": b["seed"],
        "reported_count": s["reported_count"], "colors": s["colors"],
        "count_complete": s["count_complete"], "accepted": s["accepted"],
        "posthoc": b["posthoc_verifier"]["status"],
        "expected_count": b["scorer"]["wrong_way_count"],
        "count_correct": b["scorer"]["count_numeric_match"],
        "goal_correct": b["review"]["goal_correct"],
        "complete_correct": b["scorer"]["complete_count_correct"],
        "visual_calls": b["run"]["visual_calls"],
        "orchestrator_calls": b["run"]["orchestrator_calls"],
    }


def build_version(key: str) -> dict:
    spec = VERSIONS[key]
    runs, first = [], None
    for p in sorted(BUNDLES.glob(f"{key}-*/bundle.json")):
        b = json.loads(p.read_text())
        if b.get("live"):
            continue
        first = first or b
        runs.append((row_v50 if key == "v50" else row_v42)(p.parent.name, b))
    runs.sort(key=lambda r: r["attempt"])
    figures = {
        "attempts": len(runs),
        "accepted": sum(r["accepted"] for r in runs),
        "posthoc_pass": sum(r["posthoc"] == "pass" for r in runs),
        "count_correct": sum(r["count_correct"] for r in runs),
    }
    if key == "v50":
        figures["count_and_exact_colors"] = sum(r["exact_colors"] for r in runs)
    figures["count_and_supported_colors"] = sum(bool(r["goal_correct"]) for r in runs)
    figures["complete_correct"] = sum(r["complete_correct"] for r in runs)
    if key == "v50":
        figures["nemotron_calls"] = sum(r["orchestrator_calls"] for r in runs)
        figures["gemma_calls"] = sum(r["visual_calls"] for r in runs)
        figures["tracking_jobs"] = len(runs)
    figures["promoted"] = False
    first = first or {}
    return {
        "label": spec["label"],
        "source": {
            "batch": first.get("batch", {}).get("name"),
            "candidate_revision": spec["candidate_revision"],
            "sut_commit": first.get("provenance", {}).get("sut_commit"),
            "study_commit": first.get("provenance", {}).get("study_commit"),
            "service_commit": first.get("provenance", {}).get("service_commit"),
        },
        "featured": spec["featured"],
        "figures": figures,
        "runs": runs,
    }


def build() -> dict:
    return {"current": CURRENT, "versions": {k: build_version(k) for k in VERSIONS}}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()
    data = build()
    fails = []
    for key, spec in VERSIONS.items():
        v = data["versions"][key]
        if v["figures"] != spec["report"]:
            fails.append(f"{key} figures {v['figures']} != report {spec['report']}")
        if spec["featured"] not in {r["bundle"] for r in v["runs"]}:
            fails.append(f"{key} featured bundle {spec['featured']} missing")
        for r in v["runs"]:
            if not (ORACLE / f"{r['clip_id']}.json").is_file():
                fails.append(f"no oracle for {r['clip_id']}")
    if args.check:
        committed = json.loads(OUT.read_text())
        if committed != data:
            fails.append("content/experiment.json is stale: run tools/build_experiment.py")
    else:
        OUT.write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n")
        print(f"wrote {OUT.relative_to(ROOT)}: " + ", ".join(
            f"{k} {len(v['runs'])} runs" for k, v in data["versions"].items()))
    for f in fails:
        print("FAIL", f)
    if not fails:
        for k, v in data["versions"].items():
            print(f"ok {k}:", v["figures"])
    return 1 if fails else 0


if __name__ == "__main__":
    raise SystemExit(main())
