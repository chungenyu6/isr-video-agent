"""Helpers shared by the V4.2 and V5.2 allowlist exporters.

Nothing here opens a file on its own; each exporter decides what it reads.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.dont_write_bytecode = True

from PIL import Image  # noqa: E402

CLASSES = {1: "bicycle", 2: "car", 3: "motorcycle", 5: "bus", 7: "truck"}


def jl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def r1(x: float) -> float:
    return round(float(x), 1)


def jpeg(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    Image.open(src).convert("RGB").save(dst, "JPEG", quality=85, optimize=True)


# --- V5 family: tracker IDs (T) grouped into vehicle records (V) ---

EVIDENCE_KEYS = ("missing_frames", "iou", "area_ratio", "prediction_error_diagonals")


def r3(x: float | None) -> float | None:
    return None if x is None else round(float(x), 3)


def vnum(ref: str) -> int:
    return int(ref[1:])


def export_tracking(sut: Path, snap: dict) -> tuple[dict, dict, dict]:
    """Detections with both their tracker id (T) and the host's vehicle record (V).

    T aliases follow the host's own order: ascending raw tracker id
    (store/motion_v41.MotionIndex). The mapping is checked against every V
    record's member list.
    """
    rows = jl(sut / "tracking.jsonl")
    start = next(r for r in rows if r["kind"] == "start")
    end = next(r for r in rows if r["kind"] == "end")
    assert end["complete"] and end["frames"] == start["frame_count"]

    raw_order: list[int] = []
    for r in rows:
        if r["kind"] == "frame":
            for d in r["detections"]:
                if d["track_id"] is not None and d["track_id"] not in raw_order:
                    raw_order.append(d["track_id"])
    raw_order.sort()
    t_alias = {raw: f"T{i}" for i, raw in enumerate(raw_order, 1)}
    t_index = {raw: i for i, raw in enumerate(raw_order)}

    groups = snap["groups"]
    v_refs = sorted(groups, key=vnum)
    v_index = {v: i for i, v in enumerate(v_refs)}
    owner: dict[tuple[int, int], str] = {}
    for v, g in groups.items():
        for p in g["points"]:
            owner[(p["frame"], p["detection_index"])] = v

    frames = [{"d": [], "p": []} for _ in range(start["frame_count"])]
    t_vehicle: dict[str, str] = {}
    attached: dict[str, int] = {}
    for r in rows:
        if r["kind"] != "frame":
            continue
        fid = r["source_frame_id"]
        f = frames[fid]
        for d in r["detections"]:
            v = owner.get((fid, d["detection_index"]))
            ti = t_index[d["track_id"]] if d["track_id"] is not None else -1
            if d["track_id"] is not None:
                alias = t_alias[d["track_id"]]
                assert v is not None and t_vehicle.setdefault(alias, v) == v, (alias, v)
            elif v is not None:
                attached[v] = attached.get(v, 0) + 1
            f["d"].append([*map(r1, d["bbox"]), d["class_id"], ti, v_index[v] if v else -1])
        for p in r["predictions"]:
            if p["track_id"] in t_index:
                f["p"].append([*map(r1, p["bbox"]), t_index[p["track_id"]]])

    for v, g in groups.items():
        assert sorted(g["members"], key=vnum) == sorted(
            (a for a, w in t_vehicle.items() if w == v), key=vnum), (v, g["members"])

    tracks = []
    for raw in raw_order:
        alias = t_alias[raw]
        seen = [fid for fid, f in enumerate(frames) for d in f["d"] if d[5] == t_index[raw]]
        tracks.append({"alias": alias, "raw_id": raw, "observed": [min(seen), max(seen)],
                       "vehicle": t_vehicle[alias]})
    video = {"fps": start["fps"], "width": start["width"], "height": start["height"],
             "nb_frames": start["frame_count"],
             "duration_sec": round(start["frame_count"] / start["fps"], 2)}
    return ({"classes": CLASSES, "tracks": tracks, "frames": frames},
            video, {"v_refs": v_refs, "attached": attached})


def phase(p: dict) -> dict:
    return {"start": p["start_frame"], "end": p["end_frame"], "origin": p["origin"],
            "destination": p["destination"], "direction": p["direction"],
            "valid": p["valid"], "points": p["observed_points"],
            "vector": [r1(p["vector"][0]), r1(p["vector"][1])]}


def export_vehicles(snap: dict, v_refs: list[str], attached: dict[str, int]) -> dict:
    an = snap["analysis"]
    votes = an["comparison_votes"]
    vehicles = []
    for v in v_refs:
        g, a = snap["groups"][v], an["vehicles"][v]
        frames = [p["frame"] for p in g["points"]]
        vote = next((u for u in votes if v in u["vehicles"]), None)
        vehicles.append({
            "ref": v,
            "members": g["members"],
            "observed": [min(frames), max(frames)],
            "frames_observed": len(set(frames)),
            "attached_unmatched": attached.get(v, 0),
            "status": a["status"],
            "phases": [phase(p) for p in a["phases"]],
            "opposing": [[p["start_frame"], p["end_frame"]] for p in a.get("opposing_phases", [])],
            "vote": [r3(x) for x in vote["vector"]] if vote else None,
            "vote_shared_with": [w for w in vote["vehicles"] if w != v] if vote else [],
            "flow": [r3(x) for x in a["flow_vector"]] if a.get("flow_vector") else None,
            "comparison_units": len(a.get("comparison_units", [])),
            "support_units": len(a.get("support_units", [])),
            "identity_component": a.get("identity_component", [v]),
        })
    return {
        "vehicles": vehicles,
        "links": [{"first": l["first"], "second": l["second"], "kind": l["source"]["kind"],
                   "evidence": {k: r3(l["source"]["evidence"].get(k)) for k in EVIDENCE_KEYS}}
                  for l in snap["links"]],
        "possible_links": [{"first": l["first"], "second": l["second"],
                            "evidence": {k: r3(l["evidence"].get(k)) for k in EVIDENCE_KEYS}}
                           for l in an["possible_links"]],
        "aliases": snap["aliases"],
        "votes": [{"vector": [r3(x) for x in u["vector"]], "vehicles": u["vehicles"]} for u in votes],
    }
