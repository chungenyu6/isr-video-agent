// V4.2 bundle: mirrors schema/bundle-v42.schema.json. Experiment: tools/build_experiment.py.
// The V5.3 bundle lives in v53/types.ts.

export type Box = [number, number, number, number];

/** [x0, y0, x1, y1, class_id, track index or -1, detector score] */
export type Detection = [number, number, number, number, number, number, number];
/** [x0, y0, x1, y1, track index] - Kalman prediction for a lost track, never observed */
export type Prediction = [number, number, number, number, number];

export interface Phase {
  start: number;
  end: number;
  origin: string;
  destination: string;
  direction: string;
}

export interface Track {
  alias: string;
  raw_id: number;
  observed: [number, number];
  phases: Phase[];
}

export interface Step {
  i: number;
  tool: string;
  args: Record<string, unknown>;
  accepted: boolean;
  t_call: number;
  t_result: number;
  agent_text: string;
  agent_text_chars: number;
  budget_before: { main_remaining: number; gemma_remaining: number; text_remaining: number } | null;
  visual?: number;
}

export interface Visual {
  observation_ref: string;
  intent: string;
  track_ref: string;
  frame: number;
  target_bbox: Box;
  crop_bounds: Box;
  full: string;
  crop: string;
  text: string;
  finish_reason: string;
  truncated: boolean;
  latency_sec: number;
  step: number;
}

export interface Bundle {
  bundle_version: "4.2";
  run_id: string;
  attempt: string;
  clip_id: string;
  seed: number;
  live: false;
  exported_at: string;
  batch: { name: string; created: string; candidate_revision: string };
  provenance: {
    sut_commit: string;
    study_commit: string;
    service_commit: string;
    orchestrator: { model: string; revision: string; temperature: number; top_p: number };
    perception: { model: string; revision: string; temperature: number };
    tracking: { contract: string; weights_sha256: string };
  };
  task: { statement: string; system: string; tools: Record<string, string> };
  runtime: Record<string, number | string>;
  video: { fps: number; width: number; height: number; nb_frames: number; duration_sec: number; proxy: string };
  tracking: {
    classes: Record<string, string>;
    visible_from: number;
    tracks: Track[];
    frames: { d: Detection[]; p: Prediction[] }[];
  };
  steps: Step[];
  visual: Visual[];
  submission: {
    decision: string;
    reported_count: number | null;
    colors: string[];
    count_complete: boolean;
    uncertainty: string;
    accepted: boolean;
    step: number;
  };
  runtime_verifier: { tool_calls: number; rejected_calls: number; submission_accepted: boolean; formal_evidence_gate: boolean };
  posthoc_verifier: { status: string; issues: unknown[]; scope: string; semantic_correctness: string };
  run: {
    wall_sec: number;
    terminal_reason: string;
    orchestrator_calls: number;
    visual_calls: number;
    tracking_latency_sec: number;
    replay_sec: number;
  };
  scorer: {
    scorer_version: string;
    wrong_way_count: number;
    expected_color_multiset: Record<string, number>;
    outcome: string;
    count_numeric_match: boolean;
    color_multiset_correct: boolean;
    complete_count_correct: boolean;
    partial_color_matches: number;
    matching_scope: string;
  };
  review: {
    scope: string;
    count_correct: boolean;
    semantic_color_support: string;
    final_item_identity: string;
    goal_correct: boolean;
  };
}

export type Loaded = Bundle & { _dir: string };

export interface OracleTarget {
  object_id: string;
  color_name: string;
  color_hex: string | null;
  event_interval_frames: number[] | null;
}

export interface Oracle {
  clip_id: string;
  observability: "nominal" | "challenging";
  wrong_way_count: number;
  fps: number;
  width: number;
  height: number;
  frame_count: number;
  video_sha256: string;
  objects: { id: string; name: string; vehicle_type: string; color_name: string; color_hex: string; wrong_way: boolean }[];
  targets: OracleTarget[];
  /** object id -> [frame, x0, y0, x1, y1, full(1)|partial(0)] for every visible frame */
  boxes: Record<string, number[][]>;
}

export interface RunSummary {
  bundle: string;
  attempt: string;
  clip_id: string;
  seed: number;
  reported_count: number | null;
  colors: string[];
  count_complete: boolean;
  accepted: boolean;
  posthoc: string;
  expected_count: number;
  count_correct: boolean;
  /** V5.3 only: count right and the exact colour strings equal the labels */
  exact_colors?: boolean;
  /** V5.3 only: Property Evaluator v1 geometry found vehicles matching no labelled object */
  false_positive_vehicles?: string[];
  /** V5.3 only: the answer differs from V5.2's on the same attempt */
  changed_from_v52?: boolean;
  /** V5.3 only: the program opened a case and Pi ran */
  investigation?: boolean;
  repeats?: number;
  identical_answers?: boolean;
  identical_gemma_text?: boolean;
  goal_correct: boolean;
  complete_correct: boolean;
  visual_calls: number;
  orchestrator_calls: number;
}

export interface Figures {
  attempts: number;
  accepted: number;
  posthoc_pass: number;
  count_correct: number;
  count_and_exact_colors?: number;
  count_and_supported_colors?: number;
  complete_correct?: number;
  color_tokens_matched?: number;
  false_positive_vehicles?: number;
  false_negative_objects?: number;
  count_complete_true?: number;
  count_complete_conservative_false?: number;
  count_complete_false_and_wrong?: number;
  natural_investigations?: number;
  nemotron_calls?: number;
  gemma_calls?: number;
  tracking_jobs?: number;
  promoted: boolean;
}

export interface DiagCell { nemotron: number; gemma: number; case: string | null; note: string; correct?: boolean }
export type Controller = "none" | "fixed" | "pi-cap2" | "pi-cap4";

export interface Diagnostic {
  batch: string;
  controllers: Controller[];
  replays: Record<string, string>;
  scenarios: Record<string, string>;
  expected: Record<string, string>;
  v52_pi: Record<string, boolean>;
  assigned: string[];
  cells: Record<string, Record<Controller, DiagCell>>;
  totals: Record<Controller, { nemotron: number; gemma: number }>;
  pi_cases: number;
  pi_correct: Record<"pi-cap2" | "pi-cap4" | "v52_pi", number>;
  wrong_different_adopted: number;
  wrong_same_adopted: number;
  all_totals: { nemotron: number; gemma: number; jobs: number };
}

export type VersionKey = "v53" | "v42";

export interface VersionData {
  label: string;
  source: { batch: string; candidate_revision: string; sut_commit: string; study_commit: string; service_commit: string };
  featured: string;
  figures: Figures;
  runs: RunSummary[];
  diagnostic?: Diagnostic;
}

export interface Experiment {
  current: VersionKey;
  versions: Record<VersionKey, VersionData>;
}
