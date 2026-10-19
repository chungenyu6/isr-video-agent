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

CURRENT = "v52"
#: Per version: bundle prefix, featured bundle and the figures its delivered
#: report states (experiments/video-agent-capability/reports/...).
VERSIONS = {
    "v52": {
        "label": "V5.2",
        "candidate_revision": "v5.2",
        "featured": "v52-2-challenging-r2-s1",
        #: sut-v5.2-stability-20261016.zh-TW.md sections 1 and 5 (group A:
        #: 12 clips x Q1/Q2 x two passes); summary for the totals
        "report": {
            "attempts": 48,
            "accepted": 48,
            "posthoc_pass": 48,
            "count_correct": 48,
            "count_and_exact_colors": 28,
            "count_and_supported_colors": 48,
            "white_only_underdescribed": 8,
            "complete_property_true": 8,
            "natural_investigations": 4,
            "nemotron_calls": 68,
            "gemma_calls": 56,
            "tracking_jobs": 48,
            "identical_answers_clips": 12,
            "identical_gemma_text_clips": 9,
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


#: sut-v5.2-investigation-value-20261016.zh-TW.md sections 2 and 4 (group B):
#: seven saved-state scenarios x three controllers, one attempt each.
#: Per cell: Nemotron calls, Gemma calls, final case status, and the report's
#: description. Only the pi cells carry a verdict (the coding-agent review's
#: pi_correct); the none and fixed cells are described, not scored.
def _c(n, g, case, note, correct=None):
    return {"nemotron": n, "gemma": g, "case": case, "note": note, **(
        {"correct": correct} if correct is not None else {})}


DIAGNOSTIC = {
    "batch": "20261016-07-diagnostic-7x3-v5.2-investigation-value",
    "replays": {"B2": "v52-diag-B2-pi", "B4": "v52-diag-B4-pi", "B7": "v52-diag-B7-pi"},
    "scenarios": {
        "B1": "A saved Gemma reply already says purple, but has no Body color line",
        "B2": "First look unclear; a better view exists later",
        "B3": "One car split into T8 and T9",
        "B4": "Same colour, different cars (T7, T9)",
        "B5": "No additional media available",
        "B6": "Nothing worth investigating",
        "B7": "A wrong-way join (T1/T3) held back",
    },
    "assigned": ["B3", "B4"],
    "cells": {
        "B1": {"none": _c(0, 0, "pending", "Host colour unknown; the saved reply is still readable"),
               "fixed": _c(0, 1, "pending", "Asked frame 42: purple"),
               "pi": _c(9, 2, "unresolved", "Two visibility checks; did not use the saved reply; colour unknown", False)},
        "B2": {"none": _c(0, 0, "pending", "Second car's colour unknown"),
               "fixed": _c(0, 1, "pending", "Asked frame 85 (next best): White and purple"),
               "pi": _c(8, 2, "unresolved", "Visibility checks on T7 and T8, no appearance check; colour unknown", False)},
        "B3": {"none": _c(0, 0, "pending", "Join stays open"),
               "fixed": _c(0, 1, "pending", "One boundary compare supports one car; by design not parsed as same"),
               "pi": _c(11, 2, "unresolved", "Separate visibility checks, no compare", False)},
        "B4": {"none": _c(0, 0, "pending", "Assigned case left open; frame 71 shows both cars"),
               "fixed": _c(0, 0, "resolved", "Saved detections show both at once: different"),
               "pi": _c(12, 2, "unresolved", "Tried different, cited only T7, refused, then unresolved", False)},
        "B5": {"none": _c(0, 0, "pending", "Colour stays unknown"),
               "fixed": _c(0, 0, "pending", "No media: stops, colour stays unknown"),
               "pi": _c(8, 0, "unresolved", "Unresolved, correctly; costlier than stopping", True)},
        "B6": {"none": _c(0, 0, None, "No case"),
               "fixed": _c(0, 0, None, "No case"),
               "pi": _c(0, 0, None, "Pi not started, correctly", True)},
        "B7": {"none": _c(0, 0, "pending", "Program opens an identity case; count 1"),
               "fixed": _c(0, 1, "pending", "Compare: Gemma calls the small TARGET a yellow bus; not adopted"),
               "pi": _c(8, 2, "resolved", "Adopted different on Gemma's misidentification; count still 1", False)},
    },
    "totals": {"none": {"nemotron": 0, "gemma": 0, "wall_sec": 6.30},
               "fixed": {"nemotron": 0, "gemma": 4, "wall_sec": 13.42},
               "pi": {"nemotron": 56, "gemma": 10, "wall_sec": 102.56}},
    "pi_cases": 6, "pi_correct": 1, "wrong_different_adopted": 1, "wrong_same_adopted": 0,
    "all_totals": {"nemotron": 124, "gemma": 70, "items": 69},
}


def supported_v52(b: dict) -> bool:
    """Count matches and the source review judged every reported target's identity
    and visible colour supported (white-only answers are flagged separately)."""
    r = b["review"]
    return (b["scorer"]["count_numeric_match"] and r["count_review"] == "supported"
            and (not b["answer"]["targets"] or r["identity_review"].startswith("supported"))
            and (not b["answer"]["targets"] or "supported" in r["color_review"]))


def row_v52(name: str, b: dict) -> dict:
    s = b["answer"]["submission"]
    st = b["stability"]
    return {
        "bundle": name, "attempt": b["attempt"], "clip_id": b["clip_id"], "seed": b["seed"],
        "reported_count": s["reported_count"], "colors": s["colors"],
        "count_complete": s["count_complete"],
        "accepted": b["runtime_verifier"]["final_answer_check"] == "pass",
        "posthoc": b["posthoc_verifier"]["status"],
        "expected_count": b["scorer"]["wrong_way_count"],
        "count_correct": b["scorer"]["count_numeric_match"],
        "exact_colors": b["scorer"]["count_numeric_match"] and b["scorer"]["color_multiset_correct"],
        "goal_correct": supported_v52(b),
        "underdescribed": "omits" in b["review"]["color_review"],
        "complete_correct": b["scorer"]["complete_count_correct"],
        "visual_calls": b["budget"]["gemma"]["used"],
        "orchestrator_calls": b["budget"]["nemotron"]["used"],
        "investigation": b["run"]["pi_started"],
        "repeats": len(st["attempts"]),
        "identical_answers": st["identical_answers"] and st["identical_targets"],
        "identical_gemma_text": st["identical_gemma_text"],
    }


def figures_v52(bundles: list[dict]) -> dict:
    """Group A figures over all 48 attempts: each bundle carries its clip's four."""
    att = [(b, a) for b in bundles for a in b["stability"]["attempts"]]
    sc = lambda a, k: a["scorer"][k]  # noqa: E731
    return {
        "attempts": len(att),
        "accepted": len(att) if all(b["runtime_verifier"]["final_answer_check"] == "pass" for b in bundles) else None,
        "posthoc_pass": len(att) if all(b["posthoc_verifier"]["status"] == "pass" for b in bundles) else None,
        "count_correct": sum(sc(a, "count_numeric_match") for _, a in att),
        "count_and_exact_colors": sum(sc(a, "count_numeric_match") and sc(a, "color_multiset_correct") for _, a in att),
        "count_and_supported_colors": sum(supported_v52(b) and sc(a, "count_numeric_match") for b, a in att),
        "white_only_underdescribed": sum("omits" in b["review"]["color_review"] for b, _ in att),
        "complete_property_true": sum(a["submission"]["count_complete"] for _, a in att),
        "natural_investigations": sum(a["pi_started"] for _, a in att),
        "nemotron_calls": sum(a["nemotron"] for _, a in att),
        "gemma_calls": sum(a["gemma"] for _, a in att),
        "tracking_jobs": len(att),
        "identical_answers_clips": sum(b["stability"]["identical_answers"] and b["stability"]["identical_targets"] for b in bundles),
        "identical_gemma_text_clips": sum(b["stability"]["identical_gemma_text"] for b in bundles),
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
        got = {"pi": (b["budget"]["nemotron"]["used"], b["budget"]["gemma"]["used"],
                      b["cases"][0]["status"] if b["cases"] else None, d["review"]["pi_correct"])}
        for s in d["siblings"]:
            got[s["controller"]] = (s["nemotron"], s["gemma"], s["cases"][0]["status"] if s["cases"] else None, None)
        for ctl, g in got.items():
            w = DIAGNOSTIC["cells"][scen][ctl]
            if g != (w["nemotron"], w["gemma"], w["case"], w.get("correct")):
                fails.append(f"diagnostic {scen}/{ctl}: bundle {g} != report {w}")
    for ctl, t in DIAGNOSTIC["totals"].items():
        for k in ("nemotron", "gemma"):
            if sum(c[ctl][k] for c in DIAGNOSTIC["cells"].values()) != t[k]:
                fails.append(f"diagnostic {ctl} {k} cells do not sum to the report total")
    if sum(c["pi"]["correct"] for k, c in DIAGNOSTIC["cells"].items() if k != "B6") != DIAGNOSTIC["pi_correct"]:
        fails.append("diagnostic pi_correct does not match the cells")
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
        runs.append((row_v52 if key == "v52" else row_v42)(p.parent.name, b))
    runs.sort(key=lambda r: r["attempt"])
    if key == "v52":
        return finish_version(key, spec, first, runs, figures_v52(loaded))
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
    if key == "v52":
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
