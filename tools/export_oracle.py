#!/usr/bin/env python3
"""Export the per-clip ground truth the viewer overlays on the video.

Published on purpose (researcher decision, 2026-09-14): the experiment is
complete, and what the oracle boundary protected was the agent's ignorance during
a run, not the secrecy of the labels. Live runs keep that boundary - the agent
user still cannot read data/labels, and nothing here is ever placed where it can.

Sources, all read-only:
  data/labels/generated/labels/<clip>.oracle.json   the exact oracle every run was scored with
  data/labels/generated/scenario-index.jsonl        layout block per clip
  Test_Against_Traffic/<clip>/frames.jsonl          per-frame boxes (authoritative for frame/ROI)
  Test_Against_Traffic/<clip>/events.json           vehicle colours and wrong-way flags

"Pairable" frames are computed with the experiment's own frozen predicate
(failure_discovery.scenario_bank._is_pair_valid) rather than a re-implementation,
so the shaded region on the timeline is the evaluator's definition by construction.

Usage: python3 tools/export_oracle.py [--out content/oracle]
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from pathlib import Path

sys.dont_write_bytecode = True

ROOT = Path(__file__).resolve().parent.parent
EXPERIMENT = Path(os.environ.get("EXPERIMENT_ROOT", "/home/isr-video-agent"))
sys.path.insert(0, str(EXPERIMENT))

from failure_discovery.common import load_policy  # noqa: E402
from failure_discovery.scenario_bank import _is_pair_valid  # noqa: E402

LABELS = EXPERIMENT / "data" / "labels" / "generated"
BANK = EXPERIMENT / "Test_Against_Traffic"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def export_clip(clip: str, index_row: dict, policy: dict) -> dict:
    oracle_path = LABELS / "labels" / f"{clip}.oracle.json"
    oracle = json.loads(oracle_path.read_text())
    events = json.loads((BANK / clip / "events.json").read_text())
    frames = [json.loads(l) for l in (BANK / clip / "frames.jsonl").read_text().splitlines() if l.strip()]
    if len(frames) != oracle["frame_count"] or any(r["frame"] != i for i, r in enumerate(frames)):
        raise SystemExit(f"{clip}: frames.jsonl rows do not align with frame indices")

    objects = []
    boxes: dict[str, list[list[int]]] = {}
    for obj in events["objects"]:
        oid = obj["object"]
        boxes[oid] = []
        objects.append({
            "id": oid, "name": obj.get("name"), "vehicle_type": obj.get("vehicle_type"),
            "color_name": obj.get("color_name"), "color_hex": obj.get("color_hex"),
            "wrong_way": bool(obj.get("wrong_way")),
        })
    for row in frames:
        for o in row["objects"]:
            if o.get("visible") and o.get("bbox_xyxy"):
                x0, y0, x1, y1 = (round(v) for v in o["bbox_xyxy"])
                boxes[o["object"]].append([row["frame"], x0, y0, x1, y1, 1 if o.get("visibility") == "full" else 0])

    colors = {o["id"]: o for o in objects}
    targets = []
    for t in oracle["targets"]:
        eligible = t["eligible_frames"]
        pairable = set()
        for i, a in enumerate(eligible):
            for b in eligible[i + 1:]:
                if _is_pair_valid(a, b, policy):
                    pairable.add(a["frame"])
                    pairable.add(b["frame"])
        targets.append({
            "object_id": t["object_id"],
            "color_name": t["color_name"],
            "color_hex": colors.get(t["object_id"], {}).get("color_hex"),
            "event_interval_frames": t["event_interval_frames"],
            "answerable": t["answerable"],
            "witness_pair": t["witness_pair"],
            "eligible_frames": [e["frame"] for e in eligible],
            "pairable_frames": sorted(pairable),
        })

    return {
        "clip_id": clip,
        "observability": "challenging" if "challenging" in clip else "nominal",
        "wrong_way_count": oracle["wrong_way_count"],
        "layout_block": index_row.get("layout_block"),
        "primary_eligible": oracle["primary_eligible"],
        "fps": oracle["fps"], "width": oracle["width"], "height": oracle["height"],
        "frame_count": oracle["frame_count"],
        "oracle_sha256": sha256(oracle_path),
        "video_sha256": oracle["video_sha256"],
        "policy": {k: policy["truth"][k] for k in (
            "pair_min_separation_seconds", "pair_min_bbox_diagonal_px",
            "pair_min_displacement_px", "pair_min_displacement_bbox_ratio", "exclude_motion_frames")},
        "objects": objects,
        "targets": targets,
        "boxes": boxes,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(ROOT / "content" / "oracle"))
    args = ap.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    policy = load_policy()
    index = {}
    for line in (LABELS / "scenario-index.jsonl").read_text().splitlines():
        if line.strip():
            row = json.loads(line)
            index[row["clip_id"]] = row
    for clip in sorted(index):
        data = export_clip(clip, index[clip], policy)
        path = out / f"{clip}.json"
        path.write_text(json.dumps(data, separators=(",", ":")) + "\n")
        n_pair = [len(t["pairable_frames"]) for t in data["targets"]]
        print(f"{clip}: {len(data['targets'])} target(s), pairable frames {n_pair}, {path.stat().st_size // 1024} KB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
