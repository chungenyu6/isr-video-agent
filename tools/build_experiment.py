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

CURRENT = "v53"
#: Per version: bundle prefix, featured bundle and the figures its delivered
#: report states (experiments/video-agent-capability/reports/...).
VERSIONS = {
    "v53": {
        "label": "V5.3",
        "candidate_revision": "v5.3",
        "featured": "v53-2-challenging-r2-s1",
        #: sut-v5.3-results-20261019.zh-TW.md sections 1-3 (group A: 12 clips x
        #: Q1/Q2 x two passes)
        "report": {
            "attempts": 48,
            "accepted": 48,
            "posthoc_pass": 48,
            "count_correct": 44,
            "count_and_exact_colors": 28,
            "color_tokens_matched": 40,
            "false_positive_vehicles": 4,
            "false_negative_objects": 0,
            "count_complete_true": 8,
            "count_complete_conservative_false": 36,
            "count_complete_false_and_wrong": 4,
            "natural_investigations": 4,
            "nemotron_calls": 45,
            "gemma_calls": 62,
            "tracking_jobs": 48,
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


#: sut-v5.3-results-20261019.zh-TW.md section 4 (group B): seven saved-state
#: scenarios x none / fixed / pi-cap2 / pi-cap4, one attempt each. Per cell:
#: Nemotron calls, Gemma calls, final case status (from each run.json) and the
#: report's description. Only the Pi cells carry a verdict (the report's table,
#: against answers written down before V5.2); none and fixed are described.
def _c(n, g, case, note, correct=None):
    return {"nemotron": n, "gemma": g, "case": case, "note": note, **(
        {"correct": correct} if correct is not None else {})}


CONTROLLERS = ["none", "fixed", "pi-cap2", "pi-cap4"]
DIAGNOSTIC = {
    "batch": "20261019-04-diagnostic-7x4-v5.3-investigation-value",
    "controllers": CONTROLLERS,
    "replays": {"B2": "v53-diag-B2-pi-cap2", "B4": "v53-diag-B4-pi-cap2", "B7": "v53-diag-B7-pi-cap2"},
    "scenarios": {
        "B1": "A saved Gemma reply already says purple, but has no Body color line",
        "B2": "First look unclear; a better view exists later",
        "B3": "One car split into T8 and T9",
        "B4": "Same colour, different cars (T7, T9)",
        "B5": "No additional media available",
        "B6": "Nothing worth investigating",
        "B7": "A wrong-way join (T1/T3) held back",
    },
    "expected": {"B1": "purple", "B2": "White and purple", "B3": "same", "B4": "different",
                 "B5": "unresolved", "B6": "no case", "B7": "same"},
    "v52_pi": {"B1": False, "B2": False, "B3": False, "B4": False, "B5": True, "B6": True, "B7": False},
    "assigned": ["B3", "B4"],
    "cells": {
        "B1": {"none": _c(0, 0, "pending", "Host colour unknown"),
               "fixed": _c(0, 1, "pending", "Host parser reads purple"),
               "pi-cap2": _c(5, 1, "resolved", "purple", True),
               "pi-cap4": _c(4, 1, "resolved", "purple", True)},
        "B2": {"none": _c(0, 0, "pending", "Second car's colour unknown"),
               "fixed": _c(0, 1, "pending", "White and purple"),
               "pi-cap2": _c(6, 2, "resolved", "White and purple", True),
               "pi-cap4": _c(8, 1, "resolved", "White and purple", True)},
        "B3": {"none": _c(0, 0, "pending", "Join stays open"),
               "fixed": _c(0, 1, "pending", "Compare text supports one car; by design not adopted"),
               "pi-cap2": _c(4, 1, "resolved", "same", True),
               "pi-cap4": _c(4, 1, "resolved", "same", True)},
        "B4": {"none": _c(0, 0, "pending", "Assigned case left open"),
               "fixed": _c(0, 0, "resolved", "different, from saved detections"),
               "pi-cap2": _c(6, 2, "resolved", "different", True),
               "pi-cap4": _c(6, 3, "resolved", "different", True)},
        "B5": {"none": _c(0, 0, "pending", "Colour stays unknown"),
               "fixed": _c(0, 0, "pending", "No media: stops"),
               "pi-cap2": _c(9, 0, "unresolved", "unresolved", True),
               "pi-cap4": _c(9, 0, "unresolved", "unresolved", True)},
        "B6": {"none": _c(0, 0, None, "No case"),
               "fixed": _c(0, 0, None, "No case"),
               "pi-cap2": _c(0, 0, None, "Pi not started", True),
               "pi-cap4": _c(0, 0, None, "Pi not started", True)},
        "B7": {"none": _c(0, 0, "pending", "Program opens an identity case; count 1"),
               "fixed": _c(0, 1, "pending", "Compare says the two correspond; not adopted"),
               "pi-cap2": _c(6, 2, "resolved", "different: Gemma called the small TARGET a yellow bus", False),
               "pi-cap4": _c(7, 4, "resolved", "different, same misreading", False)},
    },
    "totals": {"none": {"nemotron": 0, "gemma": 0}, "fixed": {"nemotron": 0, "gemma": 4},
               "pi-cap2": {"nemotron": 36, "gemma": 8}, "pi-cap4": {"nemotron": 38, "gemma": 10}},
    "pi_cases": 6, "pi_correct": {"pi-cap2": 5, "pi-cap4": 5, "v52_pi": 1},
    "wrong_different_adopted": 1, "wrong_same_adopted": 0,
    "all_totals": {"nemotron": 119, "gemma": 84, "jobs": 49},
}


def goal_v53(pe: dict) -> bool:
    """Property Evaluator v1: count right and every reported colour's words match its object."""
    return pe["count_match"] and pe["color_token"]["all_targets_matched"]


def row_v53(name: str, b: dict) -> dict:
    s = b["answer"]["submission"]
    st = b["stability"]
    pe = b["property_eval"]
    return {
        "bundle": name, "attempt": b["attempt"], "clip_id": b["clip_id"], "seed": b["seed"],
        "reported_count": s["reported_count"], "colors": s["colors"],
        "count_complete": s["count_complete"],
        "accepted": b["runtime_verifier"]["final_answer_check"] == "pass",
        "posthoc": b["posthoc_verifier"]["status"],
        "expected_count": b["scorer"]["wrong_way_count"],
        "count_correct": b["scorer"]["count_numeric_match"],
        "exact_colors": b["scorer"]["count_numeric_match"] and b["scorer"]["color_multiset_correct"],
        "goal_correct": goal_v53(pe),
        "false_positive_vehicles": pe["geometry"]["false_positive_vehicles"],
        "changed_from_v52": b["review"]["changed_from_v52"],
        "complete_correct": b["scorer"]["complete_count_correct"],
        "visual_calls": b["budget"]["gemma"]["used"],
        "orchestrator_calls": b["budget"]["nemotron"]["used"],
        "investigation": b["run"]["pi_started"],
        "repeats": len(st["attempts"]),
        "identical_answers": st["identical_answers"] and st["identical_targets"],
        "identical_gemma_text": st["identical_gemma_text"],
    }


def figures_v53(bundles: list[dict]) -> dict:
    """Group A figures over all 48 attempts: each bundle carries its clip's four."""
    att = [(b, a) for b in bundles for a in b["stability"]["attempts"]]
    sc = lambda a, k: a["scorer"][k]  # noqa: E731
    cal = lambda a: a["property_eval"]["count_complete_calibration"]  # noqa: E731
    return {
        "attempts": len(att),
        "accepted": len(att) if all(b["runtime_verifier"]["final_answer_check"] == "pass" for b in bundles) else None,
        "posthoc_pass": len(att) if all(b["posthoc_verifier"]["status"] == "pass" for b in bundles) else None,
        "count_correct": sum(sc(a, "count_numeric_match") for _, a in att),
        "count_and_exact_colors": sum(sc(a, "count_numeric_match") and sc(a, "color_multiset_correct") for _, a in att),
        "color_tokens_matched": sum(a["property_eval"]["color_token"]["all_targets_matched"] for _, a in att),
        "false_positive_vehicles": sum(len(a["property_eval"]["geometry"]["false_positive_vehicles"]) for _, a in att),
        "false_negative_objects": sum(len(a["property_eval"]["geometry"]["false_negative_objects"]) for _, a in att),
        "count_complete_true": sum(cal(a) == "justified_true" for _, a in att),
        "count_complete_conservative_false": sum(cal(a) == "conservative_false" for _, a in att),
        "count_complete_false_and_wrong": sum(cal(a) == "false_and_wrong" for _, a in att),
        "natural_investigations": sum(a["pi_started"] for _, a in att),
        "nemotron_calls": sum(a["nemotron"] for _, a in att),
        "gemma_calls": sum(a["gemma"] for _, a in att),
        "tracking_jobs": len(att),
        "promoted": False,
    }


def check_diagnostic() -> list[str]:
    """The cells the committed diagnostic bundles hold must equal the report's matrix."""
    fails = []
    for scen, name in DIAGNOSTIC["replays"].items():
        p = BUNDLES / name / "bundle.json"
        if not p.is_file():
            fails.append(f"diagnostic replay {name} missing")
            continue
        b = json.loads(p.read_text())
        d = b["diagnostic"]
        got = {d["arm"]: (b["budget"]["nemotron"]["used"], b["budget"]["gemma"]["used"],
                          b["cases"][0]["status"] if b["cases"] else None)}
        for s in d["siblings"]:
            got[s["arm"]] = (s["nemotron"], s["gemma"], s["cases"][0]["status"] if s["cases"] else None)
        if sorted(got) != sorted(CONTROLLERS):
            fails.append(f"diagnostic {scen}: arms {sorted(got)}")
        for arm, g in got.items():
            w = DIAGNOSTIC["cells"][scen][arm]
            if g != (w["nemotron"], w["gemma"], w["case"]):
                fails.append(f"diagnostic {scen}/{arm}: bundle {g} != report {w}")
    for arm, t in DIAGNOSTIC["totals"].items():
        for k in ("nemotron", "gemma"):
            if sum(c[arm][k] for c in DIAGNOSTIC["cells"].values()) != t[k]:
                fails.append(f"diagnostic {arm} {k} cells do not sum to the report total")
    for arm in ("pi-cap2", "pi-cap4"):
        if sum(c[arm]["correct"] for k, c in DIAGNOSTIC["cells"].items() if k != "B6") != DIAGNOSTIC["pi_correct"][arm]:
            fails.append(f"diagnostic {arm} correct count does not match the cells")
    return fails


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
    runs, first, loaded = [], None, []
    for p in sorted(BUNDLES.glob(f"{key}-*/bundle.json")):
        b = json.loads(p.read_text())
        if b.get("live") or b.get("bundle_kind") == "diagnostic":
            continue
        first = first or b
        loaded.append(b)
        runs.append((row_v53 if key == "v53" else row_v42)(p.parent.name, b))
    runs.sort(key=lambda r: r["attempt"])
    if key == "v53":
        return finish_version(key, spec, first, runs, figures_v53(loaded))
    figures = {
        "attempts": len(runs),
        "accepted": sum(r["accepted"] for r in runs),
        "posthoc_pass": sum(r["posthoc"] == "pass" for r in runs),
        "count_correct": sum(r["count_correct"] for r in runs),
    }
    figures["count_and_supported_colors"] = sum(bool(r["goal_correct"]) for r in runs)
    figures["complete_correct"] = sum(r["complete_correct"] for r in runs)
    figures["promoted"] = False
    return finish_version(key, spec, first, runs, figures)


def finish_version(key: str, spec: dict, first: dict | None, runs: list[dict], figures: dict) -> dict:
    first = first or {}
    out = {
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
    if key == "v53":
        out["diagnostic"] = DIAGNOSTIC
    return out


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
    fails += check_diagnostic()
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
