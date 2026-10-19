// Derivations for the V5.0 replay. Every panel is a pure function of
// (bundle, pipeline stage, video frame, selected vehicle).

import type { Bundle50, Vehicle } from "./types";
import { center } from "../data";

/**
 * Pipeline stages, in the order the host ran them. A stage number on the page
 * means "this stage has finished"; 0 is before tracking.
 */
export const STAGES = [
  { n: 1, key: "track", label: "Track", detail: "YOLO26s + ByteTrack run once over all 199 frames in a fresh job. Out come boxes, tentative tracker IDs (T) and boxes the tracker could not match." },
  { n: 2, key: "group", label: "Group", detail: "The host joins tracker IDs that are clearly one vehicle into vehicle records (V): a short gap, a consistent position and size, and each the other's only candidate. Unmatched boxes are attached only under the same rule. Everything else stays ungrouped." },
  { n: 3, key: "rule", label: "Traffic rule", detail: "Each vehicle record casts one vote: its stable direction of travel. For every vehicle, the flow is the direction most of the other votes agree on (at least 2 units and 2/3 of them). A vehicle is a candidate when one of its observed movement phases runs 135° or more against that flow. Too little movement, or a tie, stays unresolved." },
  { n: 4, key: "look", label: "Look", detail: "For each candidate the host picks a frame with a real detection, draws a TARGET box, cuts a 25%-padded crop and asks Gemma one factual question: what is the body colour? Gemma never hears about direction or traffic." },
  { n: 5, key: "assemble", label: "Assemble", detail: "The host assembler writes the answer: count, Gemma's colour text as written, the frames each vehicle was seen. Any vehicle left unresolved or any detection left ungrouped keeps count_complete false." },
  { n: 6, key: "verify", label: "Verify", detail: "The Runtime Verifier checks the answer's shape and that every reported frame is a real observation, before the run ends. After the run, the Post-hoc Verifier rebuilds everything from the records. Neither judges traffic truth." },
] as const;
export const LAST_STAGE = STAGES.length;

export const vIndexMap = (b: Bundle50) => new Map(b.vehicles.map((v, i) => [v.ref, i]));
export const tIndexMap = (b: Bundle50) => new Map(b.tracking.tracks.map((t, i) => [t.alias, i]));

/** Per vehicle record: [frame, cx, cy] for every box it owns (tracked or joined). */
export function vehiclePoints(b: Bundle50): number[][][] {
  const pts: number[][][] = b.vehicles.map(() => []);
  b.tracking.frames.forEach((fr, f) => {
    for (const d of fr.d) if (d[6] >= 0) pts[d[6]].push([f, ...center(d)]);
  });
  return pts;
}

/** Per tracker ID: [frame, cx, cy] for every box the tracker associated. */
export function trackPoints50(b: Bundle50): number[][][] {
  const pts: number[][][] = b.tracking.tracks.map(() => []);
  b.tracking.frames.forEach((fr, f) => {
    for (const d of fr.d) if (d[5] >= 0) pts[d[5]].push([f, ...center(d)]);
  });
  return pts;
}

/** Ungrouped boxes per frame (after grouping), or tracker-unmatched (before). */
export function looseBoxes(b: Bundle50, grouped: boolean): number[] {
  return b.tracking.frames.map((fr) => fr.d.filter((d) => (grouped ? d[6] < 0 : d[5] < 0)).length);
}

export function angleDeg(a: [number, number], b: [number, number]): number {
  const dot = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1]));
  return (Math.acos(dot) * 180) / Math.PI;
}

/** Image-plane direction word for a unit vector (y grows downward). */
export function compassWord(v: [number, number]): string {
  const deg = (Math.atan2(-v[1], v[0]) * 180) / Math.PI; // 0 = right, 90 = up
  const words = ["right", "up-right", "up", "up-left", "left", "down-left", "down", "down-right"];
  return words[Math.round(((deg + 360) % 360) / 45) % 8];
}

export const phaseAt50 = (v: Vehicle, f: number) => v.phases.find((p) => p.start <= f && f <= p.end) ?? null;

export const STATUS_LABEL: Record<Vehicle["status"], string> = {
  normal: "with traffic",
  opposing: "against the flow",
  stationary: "stationary",
  unresolved: "unresolved",
};

const unit = (v: [number, number]): [number, number] => {
  const n = Math.hypot(v[0], v[1]);
  return n > 1e-9 ? [v[0] / n, v[1] / n] : [0, 0];
};

/** Valid phases with their unit direction and angle to this vehicle's flow. */
export function phaseAngles(v: Vehicle) {
  return v.phases.filter((p) => p.valid).map((p) => {
    const u = unit(p.vector);
    return { phase: p, u, angle: v.flow ? angleDeg(u, v.flow) : null };
  });
}

/** Largest angle any valid phase makes with the flow, if there is a flow. */
export function maxAngle(v: Vehicle): number | null {
  const a = phaseAngles(v).map((x) => x.angle).filter((x): x is number => x !== null);
  return a.length ? Math.max(...a) : null;
}

/** Member tracker IDs in observed order, with their spans. */
export function memberSpans(b: Bundle50, v: Vehicle) {
  return b.tracking.tracks
    .filter((t) => t.vehicle === v.ref)
    .sort((x, y) => x.observed[0] - y.observed[0])
    .map((t) => ({ alias: t.alias, span: t.observed }));
}

export const fmt = (x: number | null, d = 2) => (x === null ? "–" : x.toFixed(d));
