// Loading and derivation. Every panel is a pure function of
// (bundle, oracle, run-clock position, video frame, selected track).

import type { Bundle, Detection, Experiment, Loaded, Oracle, Phase, Step, Track } from "./types";
import type { Bundle53, Loaded53 } from "./v53/types";

const base = import.meta.env.BASE_URL;

export const asset = (p: string) => `${base}${p.replace(/^\//, "")}`;

async function getJSON<T>(path: string): Promise<T> {
  const r = await fetch(asset(path));
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  // A dev server answers unknown paths with index.html and a 200; refuse to
  // parse that as data rather than failing somewhere far from the cause.
  if (!(r.headers.get("content-type") ?? "").includes("json")) {
    throw new Error(`${path}: not JSON (is the content synced? run npm run sync)`);
  }
  return r.json() as Promise<T>;
}

let experiment: Promise<Experiment> | null = null;
export const loadExperiment = () => (experiment ??= getJSON<Experiment>("content/experiment.json"));

const oracles = new Map<string, Promise<Oracle>>();
export function loadOracle(clip: string): Promise<Oracle> {
  if (!oracles.has(clip)) oracles.set(clip, getJSON<Oracle>(`content/oracle/${clip}.json`));
  return oracles.get(clip)!;
}

export type AnyLoaded = Loaded | Loaded53;

const bundles = new Map<string, Promise<AnyLoaded>>();
export function loadAnyBundle(name: string): Promise<AnyLoaded> {
  if (!bundles.has(name)) {
    bundles.set(name, getJSON<Bundle | Bundle53>(`bundles/${name}/bundle.json`).then((b) => ({ ...b, _dir: name }) as AnyLoaded));
  }
  return bundles.get(name)!;
}
export const loadBundle = (name: string) => loadAnyBundle(name) as Promise<Loaded>;
export const loadBundle53 = (name: string) => loadAnyBundle(name) as Promise<Loaded53>;

export const bundleFile = (dir: string, file: string) => asset(`bundles/${dir}/${file}`);

// --- labels ------------------------------------------------------------------

export function clipLabel(clip: string, expected?: number): string {
  const [count, observability, rep] = clip.split("-");
  const n = expected ?? Number(count);
  const cars = n === 0 ? "no wrong-way car" : n === 1 ? "1 wrong-way car" : `${n} wrong-way cars`;
  return `${cars} · ${observability} · ${rep}`;
}

// --- tracking ------------------------------------------------------------------

export type DirClass = "down" | "up" | "side" | "unresolved";

export function dirClass(direction: string): DirClass {
  if (direction.includes("unresolved")) return "unresolved";
  if (direction.startsWith("down")) return "down";
  if (direction.startsWith("up")) return "up";
  return "side";
}

export const DIR_LABEL: Record<DirClass, string> = {
  down: "downward",
  up: "upward",
  side: "sideways",
  unresolved: "unresolved",
};

export function phaseAt(track: Track, frame: number): Phase | null {
  return track.phases.find((p) => p.start <= frame && frame <= p.end) ?? null;
}

/** Fixed palette for overlays on video: bright enough over any frame. */
export const TRACK_COLORS = [
  "#4FD1C5", "#F6AD55", "#9F7AEA", "#68D391", "#F687B3", "#63B3ED",
  "#FBD38D", "#B794F4", "#81E6D9", "#FC8181", "#A3BFFA", "#C6F6D5",
];
export const trackColor = (i: number) => (i < 0 ? "#B8C2C4" : TRACK_COLORS[i % TRACK_COLORS.length]);

export const center = (d: Detection | number[]) => [(d[0] + d[2]) / 2, (d[1] + d[3]) / 2];

/** Per track: [frame, cx, cy] for every frame with a real detection. */
export function trackPoints(b: Bundle): number[][][] {
  const pts: number[][][] = b.tracking.tracks.map(() => []);
  b.tracking.frames.forEach((fr, f) => {
    for (const d of fr.d) if (d[5] >= 0) pts[d[5]].push([f, ...center(d)]);
  });
  return pts;
}

/** Contiguous detection runs per track: [startFrame, endFrame]. */
export function detectionRuns(points: number[][]): [number, number][] {
  const runs: [number, number][] = [];
  for (const [f] of points) {
    const last = runs[runs.length - 1];
    if (last && f === last[1] + 1) last[1] = f;
    else runs.push([f, f]);
  }
  return runs;
}

// --- run clock -------------------------------------------------------------------

export const runDuration = (b: Bundle) => b.run.replay_sec + 0.4;

export function currentStep(b: Bundle, t: number): Step | null {
  let cur: Step | null = null;
  for (const s of b.steps) if (s.t_call <= t) cur = s;
  return cur;
}

export const stepDone = (s: Step, t: number) => t >= s.t_result;
export const visualShown = (b: Bundle, i: number, t: number) => t >= b.steps[b.visual[i].step].t_result;
export const tracksShown = (b: Bundle, t: number) => t >= b.tracking.visible_from;
export const submitted = (b: Bundle, t: number) => t >= b.steps[b.submission.step].t_result;

export function budgetAt(b: Bundle, t: number) {
  const main = b.steps.filter((s) => s.t_call <= t).length;
  const gemma = b.visual.filter((_, i) => visualShown(b, i, t)).length;
  let text = 0;
  const total = Number(b.runtime.tool_text_total);
  for (const s of b.steps) {
    if (!stepDone(s, t)) break;
    const next = b.steps[s.i + 1]?.budget_before;
    if (next) text = total - next.text_remaining;
  }
  return { main, gemma, text };
}

/** The track a step is about, if any. */
export const stepTrack = (s: Step) => (s.args.track_ref ?? s.args.ref ?? null) as string | null;

// --- ground truth -----------------------------------------------------------------

export function gtBoxesAt(oracle: Oracle, frame: number) {
  const out: { id: string; box: number[]; wrongWay: boolean; color: string }[] = [];
  for (const o of oracle.objects) {
    const row = oracle.boxes[o.id]?.find((r) => r[0] === frame);
    if (row) out.push({ id: o.id, box: row.slice(1, 5), wrongWay: o.wrong_way, color: o.color_name });
  }
  return out;
}
