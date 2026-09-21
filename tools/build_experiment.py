#!/usr/bin/env python3
"""Build content/experiment.json and prove the site's numbers equal the report's.

Two jobs, one file:

  build   derive per-run summaries from the committed bundles (so the overview
          page never has to download 56 bundles) and copy the headline figures
          from the experiment's final-analysis.json.

  check   recompute every figure the site displays from the bundles alone, and
          fail if any disagrees with final-analysis.json. The site must not be
          able to publish a number the experiment did not produce.

`--check` needs only this repository (CI has no access to the experiment
repository), because the copied figures travel inside experiment.json.

Usage:
  python3 tools/build_experiment.py            # rebuild from bundles + final-analysis.json
  python3 tools/build_experiment.py --check    # CI: bundles vs committed experiment.json
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BUNDLES = ROOT / "bundles"
OUT = ROOT / "content" / "experiment.json"
ORACLE = ROOT / "content" / "oracle"
EXPERIMENT = Path(os.environ.get("EXPERIMENT_ROOT", "/home/isr-video-agent"))
FINAL = EXPERIMENT / "docs" / "report" / "final-analysis.json"

OUTCOMES = ["fn", "fp", "unsupported", "execution_failure", "abstain", "unknown"]
LAYERS = ["L0", "L1", "L2", "L3", "L4"]


def wilson(k: int, n: int, z: float = 1.959963984540054) -> list[float]:
    if n == 0:
        return [0.0, 0.0]
    p = k / n
    denom = 1 + z * z / n
    centre = (p + z * z / (2 * n)) / denom
    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / denom
    return [max(0.0, centre - half), min(1.0, centre + half)]


def load_bundles() -> list[dict]:
    out = []
    for p in sorted(BUNDLES.glob("*/bundle.json")):
        b = json.loads(p.read_text())
        if not b.get("live"):
            b["_dir"] = p.parent.name
            out.append(b)
    return out


def summary(b: dict) -> dict:
    # A run killed by the hard timeout never reaches the enhanced evaluator, and
    # may never have submitted evidence at all. Those fields are then absent, not
    # zero: the run has no outcome, not an empty one. Keep them null so nothing
    # downstream counts a timeout as a clean result.
    e = b.get("enhanced") or {}
    ev = b.get("evidence") or {}
    v0 = b.get("v0") or {}
    return {
        "bundle": b["_dir"],
        "stage": b["run"]["stage"],
        "clip_id": b["run"]["clip_id"],
        "replicate": b["run"]["replicate"],
        "agent_seed": b["run"]["agent_seed"],
        "layout_block": b["run"]["layout_block"],
        "candidate": b["run"]["candidate"],
        "locked_pattern": b["run"]["locked_pattern"],
        "run_status": b["run"]["run_status"],
        "wall_clock_sec": b["telemetry"]["wall_clock_sec"],
        "decision": ev.get("decision"),
        "reported_count": ev.get("reported_count"),
        "v0": v0.get("status"),
        "v0_blind_spot": e.get("v0_blind_spot"),
        "outcome": e.get("outcome"),
        "layers": e.get("layers"),
        "earliest_violated_layer": e.get("earliest_violated_layer"),
        "comparison_patterns": e.get("comparison_patterns"),
        "full_signatures": e.get("full_signatures"),
        "inspected_frames": sorted({f["frame_id"] for f in b["frames"] if f["inspected"] and f["frame_id"] is not None}),
    }


def aggregate(runs: list[dict]) -> dict:
    failure = sum(1 for r in runs if any((r["outcome"] or {}).get(k) for k in OUTCOMES))
    return {
        "n": len(runs),
        "failure_runs": failure,
        "failure_wilson_95": wilson(failure, len(runs)),
        "outcome_run_counts": {k: sum(1 for r in runs if r["outcome"][k]) for k in OUTCOMES},
        "v0": dict(sorted(Counter(r["v0"] for r in runs).items())),
        "v0_blind_spot_runs": sum(1 for r in runs if r["v0_blind_spot"]),
        "layer_status": {L: dict(sorted(Counter(r["layers"][L] for r in runs).items())) for L in LAYERS},
        "run_status": dict(sorted(Counter(r["run_status"] for r in runs).items())),
        "comparison_patterns": dict(sorted(Counter(p for r in runs for p in r["comparison_patterns"]).items())),
    }


def derive(runs: list[dict]) -> dict:
    by_stage = defaultdict(list)
    for r in runs:
        by_stage[r["stage"]].append(r)
    disc, conf = by_stage["discovery"], by_stage["confirmation"]
    clips = defaultdict(list)
    for r in disc:
        clips[r["clip_id"]].append(r)

    candidates = {}
    for r in conf:
        c = candidates.setdefault(str(r["candidate"]), {
            "clip_id": r["clip_id"], "pattern": r["locked_pattern"], "n": 0,
            "confirmation_recurrence": 0, "observed_patterns": Counter()})
        c["n"] += 1
        c["confirmation_recurrence"] += int(r["locked_pattern"] in r["comparison_patterns"])
        c["observed_patterns"].update(r["comparison_patterns"])
    for c in candidates.values():
        c["discovery_recurrence"] = sum(1 for r in clips[c["clip_id"]] if c["pattern"] in r["comparison_patterns"])
        c["wilson_95"] = wilson(c["confirmation_recurrence"], c["n"])
        c["confirmed_at_3_of_5"] = c["confirmation_recurrence"] >= 3
        c["observed_patterns"] = dict(sorted(c["observed_patterns"].items()))

    positive = [r for r in disc if not r["clip_id"].startswith("0-")]
    v0_pass = [r for r in runs if r["v0"] == "pass"]
    return {
        "stages": {"discovery": aggregate(disc), "confirmation": aggregate(conf)},
        "formal_combined_descriptive": aggregate(runs),
        "discovery_clips": {k: aggregate(v) for k, v in sorted(clips.items())},
        "confirmation_candidates": dict(sorted(candidates.items())),
        "headline": {
            "v0_pass_runs": len(v0_pass),
            "v0_pass_flagged_by_enhanced": sum(1 for r in v0_pass if r["v0_blind_spot"]),
            "positive_target_discovery_runs": len(positive),
            "positive_target_discovery_l1_fail": sum(1 for r in positive if r["layers"]["L1"] == "fail"),
            "confirmed_candidates": sum(1 for c in candidates.values() if c["confirmed_at_3_of_5"]),
            "tested_candidates": len(candidates),
        },
    }


def compare(derived: dict, final: dict) -> list[str]:
    """Every figure the site shows, against the report. Returns mismatches."""
    bad = []

    def eq(label, a, b):
        if isinstance(a, float) or isinstance(b, float):
            same = a is not None and b is not None and abs(float(a) - float(b)) < 1e-9
        else:
            same = a == b
        if not same:
            bad.append(f"{label}: site={a!r} report={b!r}")

    keys = ["n", "failure_runs", "outcome_run_counts", "v0", "v0_blind_spot_runs", "layer_status",
            "run_status", "comparison_patterns"]
    for stage in ("discovery", "confirmation"):
        for k in keys:
            eq(f"stages.{stage}.{k}", derived["stages"][stage][k], final["stages"][stage][k])
        for i in (0, 1):
            eq(f"stages.{stage}.wilson[{i}]", derived["stages"][stage]["failure_wilson_95"][i],
               final["stages"][stage]["failure_wilson_95"][i])
    for k in keys:
        eq(f"formal_combined.{k}", derived["formal_combined_descriptive"][k], final["formal_combined_descriptive"][k])
    for clip, agg in derived["discovery_clips"].items():
        for k in ("n", "failure_runs", "comparison_patterns", "v0_blind_spot_runs"):
            eq(f"discovery_clips.{clip}.{k}", agg[k], final["discovery_clips"][clip][k])
    for cid, c in derived["confirmation_candidates"].items():
        fc = final["confirmation"]["candidates"][cid]
        for k in ("clip_id", "pattern", "n", "confirmation_recurrence", "discovery_recurrence",
                  "observed_patterns", "confirmed_at_3_of_5"):
            eq(f"confirmation.{cid}.{k}", c[k], fc[k])
        for i in (0, 1):
            eq(f"confirmation.{cid}.wilson[{i}]", c["wilson_95"][i], fc["wilson_95"][i])
    eq("confirmation.confirmed_candidates", derived["headline"]["confirmed_candidates"],
       final["confirmation"]["confirmed_candidates"])
    eq("headline.v0_pass_flagged", derived["headline"]["v0_pass_flagged_by_enhanced"],
       final["formal_combined_descriptive"]["v0_blind_spot_runs"])
    eq("headline.v0_pass_runs", derived["headline"]["v0_pass_runs"], final["formal_combined_descriptive"]["v0"]["pass"])
    eq("headline.l1_fail", derived["headline"]["positive_target_discovery_l1_fail"],
       derived["headline"]["positive_target_discovery_runs"])
    eq("scope.formal_runs", len([1 for s in ("discovery", "confirmation") for _ in range(derived["stages"][s]["n"])]),
       final["scope"]["formal_runs"])
    return bad


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()

    runs = [summary(b) for b in load_bundles()]

    if not args.check and not FINAL.exists():
        # A line with no preregistered campaign (the ISR model-swap line) has no
        # final-analysis.json to check against, and the aggregates below are
        # report-shaped: they assume every run reached the enhanced evaluator,
        # which a hard-timeout run never does. The site's only page is the run
        # replay, which reads `runs` and nothing else, so publish just that and
        # be explicit that no report backs it.
        OUT.parent.mkdir(parents=True, exist_ok=True)
        OUT.write_text(json.dumps({"runs": runs}, indent=1, ensure_ascii=False) + "\n")
        print(f"wrote {OUT.relative_to(ROOT)}: {len(runs)} runs (no final-analysis.json at "
              f"{FINAL}; figures are NOT report-checked)")
        return 0

    derived = derive(runs)

    if args.check:
        committed = json.loads(OUT.read_text())
        bad = compare(derived, committed["report"])
        if [r["bundle"] for r in runs] != [r["bundle"] for r in committed["runs"]]:
            bad.append("runs list differs from committed experiment.json - rebuild it")
        if derived != committed["derived"]:
            bad.append("derived figures differ from committed experiment.json - rebuild it")
        oracles = sorted(p.stem for p in ORACLE.glob("*.json"))
        if oracles != sorted({r["clip_id"] for r in runs}):
            bad.append(f"oracle files {oracles} do not cover the clips in the bundles")
        for line in bad:
            print(f"MISMATCH {line}")
        print(f"checked {len(runs)} runs: {'OK' if not bad else f'{len(bad)} mismatch(es)'}")
        return 1 if bad else 0

    final_raw = FINAL.read_bytes()
    final = json.loads(final_raw)
    bad = compare(derived, final)
    for line in bad:
        print(f"MISMATCH {line}")
    if bad:
        print("refusing to write experiment.json: bundles disagree with the final report")
        return 1

    report = {k: final[k] for k in ("stages", "formal_combined_descriptive", "discovery_clips", "scope",
                                    "claim_boundary", "hypothesis_disposition", "discovery_layout_blocks",
                                    "discovery_conditions")}
    report["confirmation"] = final["confirmation"]
    sens = final["threshold_sensitivity"]
    report["threshold_sensitivity"] = {k: sens[k] for k in (
        "grid_points", "points_changing_answerability", "eligible_speed_mps_range", "base_point", "implementation_note")}
    for stage in report["stages"].values():
        stage.pop("full_signatures", None)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        "source": {"final_analysis_sha256": hashlib.sha256(final_raw).hexdigest(),
                   "final_analysis_path": "docs/report/final-analysis.json"},
        "report": report,
        "derived": derived,
        "runs": runs,
    }, indent=1, ensure_ascii=False) + "\n")
    print(f"wrote {OUT.relative_to(ROOT)}: {len(runs)} runs, all figures agree with final-analysis.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
