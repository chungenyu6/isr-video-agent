// Loading and derivation. Everything a panel renders is a pure function of
// (bundle, oracle, run-clock position, video frame), which is what lets replay
// and live mode share one renderer: live mode appends events, replay reveals them.

import type {
  Bundle, Experiment, Featured, HEvent, LayerName, Loaded, Oracle, Outcome, OutcomeKey,
} from "./types";

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

let featured: Promise<Featured[]> | null = null;
export const loadFeatured = () => (featured ??= getJSON<Featured[]>("content/featured.json"));

const oracles = new Map<string, Promise<Oracle>>();
export function loadOracle(clip: string): Promise<Oracle> {
  if (!oracles.has(clip)) oracles.set(clip, getJSON<Oracle>(`content/oracle/${clip}.json`));
  return oracles.get(clip)!;
}

const bundles = new Map<string, Promise<Loaded>>();
export function loadBundle(name: string, prefix = "bundles"): Promise<Loaded> {
  const key = `${prefix}/${name}`;
  if (!bundles.has(key)) {
    bundles.set(key, getJSON<Bundle>(`${prefix}/${name}/bundle.json`).then((b) => ({ ...b, _dir: name })));
  }
  return bundles.get(key)!;
}

export const frameUrl = (dir: string, file: string, prefix = "bundles") => asset(`${prefix}/${dir}/${file}`);

// --- labels ------------------------------------------------------------------

export function parseClip(clip: string) {
  const [count, observability, rep] = clip.split("-");
  return { count: Number(count), observability, rep };
}

export function clipLabel(clip: string): string {
  const { count, observability, rep } = parseClip(clip);
  const cars = count === 0 ? "no wrong-way car" : count === 1 ? "1 wrong-way car" : `${count} wrong-way cars`;
  return `${cars} · ${observability} · ${rep}`;
}

export function runLabel(stage: string, replicate: number | null): string {
  if (stage === "live") return "live run";
  return `${stage} · seed ${replicate === null ? "?" : replicate + 1}`;
}

export const OUTCOMES: OutcomeKey[] = ["fn", "fp", "unsupported", "execution_failure", "abstain", "unknown"];

export const OUTCOME_LABEL: Record<OutcomeKey, string> = {
  fn: "missed target",
  fp: "false report",
  unsupported: "unsupported report",
  execution_failure: "execution failure",
  abstain: "abstained",
  unknown: "evaluator unknown",
};

export const OUTCOME_SHORT: Record<OutcomeKey, string> = {
  fn: "FN", fp: "FP", unsupported: "UNSUP", execution_failure: "EXEC", abstain: "ABST", unknown: "UNK",
};

/** One outcome to colour a cell by. Components overlap; this order puts the most
 *  specific failure first, and is used only for colour - never for counting. */
export function primaryOutcome(o: Outcome | null | undefined): OutcomeKey | null {
  if (!o) return null;
  for (const k of ["fp", "unsupported", "fn", "execution_failure", "abstain", "unknown"] as OutcomeKey[]) {
    if (o[k]) return k;
  }
  return null;
}

export const LAYERS: LayerName[] = ["L0", "L1", "L2", "L3", "L4"];

export const LAYER_QUESTION: Record<LayerName, string> = {
  L0: "Did the run complete, within its contract?",
  L1: "Did the frames it inspected contain a usable motion pair for every wrong-way car?",
  L2: "Were the vision model's statements about those frames correct?",
  L3: "Does the evidence it cited support what it reported?",
  L4: "Was the final answer right?",
};

export const fmtS = (t: number) => `${t.toFixed(1)}s`;
export const pct = (k: number, n: number) => (n ? `${Math.round((100 * k) / n)}%` : "–");

// --- run clock derivations -------------------------------------------------------

export const runDuration = (b: Bundle) => (b.events.length ? b.events[b.events.length - 1].t : 0);

export function eventTime(b: Bundle, type: HEvent["type"]): number | null {
  const e = b.events.find((x) => x.type === type);
  return e ? e.t : null;
}

/** Frames extracted and frames sent to the VLM as of run-clock t. */
export function frameProgress(b: Bundle, t: number) {
  const dirs = new Set<string>();
  const sent = new Set<number>();
  for (const e of b.events) {
    if (e.t > t) break;
    if (e.type === "frames.ready") dirs.add((e.detail as { dir: string }).dir);
    if (e.type === "observe.done") {
      for (const id of (e.detail as { frame_ids: (number | null)[] }).frame_ids) if (id !== null) sent.add(id);
    }
  }
  const extracted = new Set(b.frames.filter((f) => (f.window && dirs.has(f.window)) || (f.frame_id !== null && sent.has(f.frame_id))).map((f) => f.key));
  return { extracted, sent };
}

export function budgetAt(b: Bundle, t: number): Record<string, number> {
  const spent: Record<string, number> = {};
  for (const k of Object.keys(b.budget.limits)) spent[k] = 0;
  for (const e of b.events) {
    if (e.t > t) break;
    if (e.type !== "budget.spend") continue;
    const d = e.detail as { category?: string; n?: number; granted?: boolean };
    if (!d?.category || !d.granted) continue;
    spent[d.category] = (spent[d.category] ?? 0) + (d.n ?? 0);
  }
  return spent;
}

export function activeScript(b: Bundle, t: number): string | null {
  let open: string | null = null;
  for (const e of b.events) {
    if (e.t > t) break;
    if (e.type === "tool.call") open = e.script ?? e.tool ?? "?";
    else if (e.type === "tool.result" || e.type === "tool.error") open = null;
  }
  return open;
}

export function stepLabel(e: HEvent): string {
  switch (e.type) {
    case "tool.call": return e.script ?? e.tool ?? "tool";
    case "tool.result": return e.script ?? e.tool ?? "tool";
    case "tool.error": return `${e.script ?? e.tool ?? "tool"} returned an error`;
    case "tool.fault": {
      const d = e.detail as { code?: string; message?: string };
      return `${e.script ?? "tool"} fault · ${d?.code ?? ""}`;
    }
    case "budget.spend": {
      const d = e.detail as { category?: string; n?: number; granted?: boolean; kind?: string };
      if (d?.kind === "release") return `released ${Math.abs(d.n ?? 0)} ${d.category}`;
      return `${d?.granted ? "reserved" : "DENIED"} ${d?.n} ${d?.category}`;
    }
    case "frames.ready": {
      const d = e.detail as { count?: number; dir?: string };
      return `${d?.count ?? "?"} frames extracted → ${d?.dir}`;
    }
    case "observe.done": {
      const d = e.detail as { frame_ids?: number[] };
      return `VLM looked at frames ${(d?.frame_ids ?? []).join(", ")}`;
    }
    case "answer.submit": {
      const d = e.detail as { decision?: string; reported_count?: number };
      return `submitted: ${d?.decision} · ${d?.reported_count} reported`;
    }
    case "verify.result": return "V0 and enhanced evaluation";
    default: return e.type;
  }
}

/** Frame index shown at a video time. Frame n occupies [n/fps, (n+1)/fps). */
export const frameAt = (seconds: number, fps: number, nb: number) =>
  Math.max(0, Math.min(nb - 1, Math.floor(seconds * fps + 1e-3)));

/** Which target, if any, a frame is useful for. */
export function frameRole(o: Oracle | null, frameId: number | null) {
  if (!o || frameId === null) return null;
  for (const t of o.targets) {
    if (t.pairable_frames.includes(frameId)) return { kind: "pairable" as const, target: t };
  }
  for (const t of o.targets) {
    if (t.eligible_frames.includes(frameId)) return { kind: "visible" as const, target: t };
  }
  return null;
}

export function boxesAt(o: Oracle, frame: number) {
  const out: { id: string; box: number[]; full: boolean; wrongWay: boolean; color: string; hex: string }[] = [];
  for (const obj of o.objects) {
    const rows = o.boxes[obj.id];
    if (!rows) continue;
    const row = rows.find((r) => r[0] === frame);
    if (row) {
      out.push({ id: obj.id, box: row.slice(1, 5), full: row[5] === 1, wrongWay: obj.wrong_way, color: obj.color_name, hex: obj.color_hex });
    }
  }
  return out;
}
