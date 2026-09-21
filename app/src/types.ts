// Mirrors schema/bundle.schema.json, content/oracle/<clip>.json and
// content/experiment.json. The viewer knows only these shapes; it never reads a
// run directory.

export type EventType =
  | "run.start" | "step.begin" | "agent.say" | "tool.call" | "tool.result"
  | "tool.error" | "tool.fault" | "budget.spend" | "frames.ready" | "observe.done"
  | "answer.submit" | "verify.result" | "run.end";

export interface HEvent {
  t: number;
  type: EventType;
  tool?: string;
  script?: string;
  text?: string;
  args?: Record<string, unknown>;
  ok?: boolean;
  detail?: unknown;
}

export type LayerName = "L0" | "L1" | "L2" | "L3" | "L4";
export type LayerStatus = "pass" | "fail" | "unknown" | "n/a";
export type OutcomeKey = "fn" | "fp" | "unsupported" | "execution_failure" | "abstain" | "unknown";
export type Outcome = Record<OutcomeKey, number>;

export interface Frame {
  key: string;
  frame_id: number | null;
  t: number;
  file: string | null;
  window: string | null;
  reason: string | null;
  inspected: boolean;
  cited: boolean;
  observation: string | null;
}

export interface Anchor {
  frame_id: number | null;
  timestamp_sec: number | null;
  roi_xyxy: number[] | null;
  claim: string | null;
  file: string | null;
}

export interface ReportedTarget {
  target_ref: string | null;
  color_name: string | null;
  interval_frames: number[] | null;
  anchors: Anchor[];
}

export interface MatchEdge {
  report_index: number;
  target_index: number;
  cost: number;
  roi_iou: number;
  temporal_iou: number;
  color_score: number;
  feasible: boolean;
  reasons: string[];
}

export interface LayerDetails {
  L1?: { object_id: string; covered: boolean }[];
  L2?: { status: LayerStatus; reason?: string; assertions?: unknown[]; errors?: unknown[] };
  L3?: { status: LayerStatus; failures?: { report_index?: number; reason: string }[]; unknown?: unknown[] };
  L4_matching?: {
    matches: { report_index: number; target_index: number; roi_iou: number; temporal_iou: number }[];
    false_positive_reports: number[];
    false_negative_targets: number[];
    unknown_reports: number[];
    unresolved_targets: number[];
    edges: MatchEdge[];
  };
}

export interface Enhanced {
  primary_eligible: boolean;
  layers: Record<LayerName, LayerStatus>;
  layer_details: LayerDetails;
  outcome: Outcome;
  earliest_violated_layer: LayerName | null;
  full_signatures: string[];
  comparison_patterns: string[];
  v0_blind_spot: boolean;
}

export interface Bundle {
  bundle_version: string;
  run_id: string;
  harness: string;
  live: boolean;
  run: {
    stage: "discovery" | "confirmation" | "live";
    clip_id: string;
    replicate: number | null;
    agent_seed: number | null;
    applied_seed: number | null;
    layout_block: number | null;
    candidate: number | null;
    locked_pattern: string | null;
    run_status: string | null;
    agent_exit_code: number | null;
    created_at: string | null;
    finished_at: string | null;
    models: Record<string, { model: string; revision: string }>;
  };
  task: { question: string; oracle_exposed: boolean };
  video: { id: string; duration_sec: number; fps: number; width: number; height: number; nb_frames: number; proxy: string };
  budget: { limits: Record<string, number>; final: Record<string, number> };
  frames: Frame[];
  windows: { dir: string; window: number[] | null; reason: string | null; count: number }[];
  events: HEvent[];
  pipeline: { declared: string[]; actual: string[]; claimed: string[]; agrees: boolean };
  evidence: {
    present: boolean;
    decision: "report" | "abstain" | null;
    reported_count: number | null;
    frames_processed: number | null;
    windows_examined: number[][];
    notes: string | null;
    reported_targets: ReportedTarget[];
  };
  v0: { status: "pass" | "fail" | "not_run"; checks: Record<string, boolean>; errors: string[] };
  enhanced: Enhanced | null;
  telemetry: { wall_clock_sec: number | null; slow_run: boolean; vlm_calls: number; vlm_tokens: number; tool_faults: number };
}

export type Loaded = Bundle & { _dir: string };

export interface OracleTarget {
  object_id: string;
  color_name: string;
  color_hex: string | null;
  event_interval_frames: number[] | null;
  answerable: boolean;
  witness_pair: number[] | null;
  eligible_frames: number[];
  pairable_frames: number[];
}

export interface Oracle {
  clip_id: string;
  observability: "nominal" | "challenging";
  wrong_way_count: number;
  layout_block: number | null;
  primary_eligible: boolean;
  fps: number;
  width: number;
  height: number;
  frame_count: number;
  oracle_sha256: string;
  video_sha256: string;
  policy: Record<string, number | number[]>;
  objects: { id: string; name: string; vehicle_type: string; color_name: string; color_hex: string; wrong_way: boolean }[];
  targets: OracleTarget[];
  /** object id -> [frame, x0, y0, x1, y1, full(1)|partial(0)] for every visible frame */
  boxes: Record<string, number[][]>;
}

export interface RunSummary {
  bundle: string;
  stage: "discovery" | "confirmation";
  clip_id: string;
  replicate: number;
  agent_seed: number;
  layout_block: number;
  candidate: number | null;
  locked_pattern: string | null;
  run_status: string;
  wall_clock_sec: number | null;
  decision: "report" | "abstain" | null;
  reported_count: number | null;
  v0: "pass" | "fail" | "not_run";
  v0_blind_spot: boolean;
  outcome: Outcome;
  layers: Record<LayerName, LayerStatus>;
  earliest_violated_layer: LayerName | null;
  comparison_patterns: string[];
  full_signatures: string[];
  inspected_frames: number[];
}

export interface StageAggregate {
  n: number;
  failure_runs: number;
  failure_wilson_95: [number, number];
  outcome_run_counts: Outcome;
  v0: Record<string, number>;
  v0_blind_spot_runs: number;
  layer_status: Record<LayerName, Record<string, number>>;
  run_status: Record<string, number>;
  comparison_patterns: Record<string, number>;
}

export interface Candidate {
  clip_id: string;
  pattern: string;
  n: number;
  confirmation_recurrence: number;
  discovery_recurrence: number;
  observed_patterns: Record<string, number>;
  wilson_95: [number, number];
  confirmed_at_3_of_5: boolean;
}

export interface Experiment {
  // The Overview page is gone, so the report/derived aggregates it displayed are
  // no longer part of the contract. `source` is present only when the runs were
  // built against a finished experiment report; a line with no signed report
  // (the ISR model-swap line) omits it.
  source?: { final_analysis_sha256: string; final_analysis_path: string };
  runs: RunSummary[];
}

export interface Featured {
  id: string;
  title: string;
  note: string;
  bundle: string;
  compare?: string[];
}
