// V5.3 bundle: mirrors schema/bundle-v53.schema.json (tools/export_v53_run.py).
// bundle_kind "run": one attempt of the stability batch; "diagnostic": one Pi
// attempt of the saved-state diagnostic batch.

import type { Box } from "../types";

/** [x0, y0, x1, y1, class_id, track index or -1, vehicle index or -1] */
export type Det53 = [number, number, number, number, number, number, number];
/** [x0, y0, x1, y1, track index] - Kalman prediction for a lost track, never observed */
export type Pred53 = [number, number, number, number, number];

export interface Phase53 {
  start: number;
  end: number;
  origin: string;
  destination: string;
  direction: string;
  valid: boolean;
  points: number;
  vector: [number, number];
}

export interface Vehicle {
  ref: string;
  members: string[];
  observed: [number, number];
  frames_observed: number;
  attached_unmatched: number;
  status: "normal" | "opposing" | "stationary" | "unresolved";
  phases: Phase53[];
  opposing: [number, number][];
  vote: [number, number] | null;
  vote_shared_with: string[];
  flow: [number, number] | null;
  comparison_units: number;
  support_units: number;
  identity_component: string[];
}

export interface LinkEvidence { missing_frames: number; iou: number; area_ratio: number; prediction_error_diagonals: number | null }

/** One frame Gemma was shown: the full frame with TARGET boxes and one crop per target. */
export interface LookMedia {
  frame: number;
  targets: { track_ref: string; bbox: Box }[];
  full: string;
  crops: { path: string; bounds: Box; track_ref: string }[];
}

export interface Appearance {
  observation_ref: string;
  intent: string;
  /** host: the main flow's colour check; agent: asked by Pi in a case;
   *  imported: a saved reply from an earlier run (diagnostic, text only) */
  origin: "host" | "agent" | "imported" | "fixed";
  case_ref: string | null;
  compare?: boolean;
  asked_ref: string | string[] | null;
  track_ref: string;
  vehicle_ref: string | null;
  media: LookMedia[];
  text: string;
  finish_reason: string;
  truncated: boolean;
  latency_sec: number | null;
  tokens: { prompt: number; completion: number } | null;
  color_parse: { status: string; value: string | null } | null;
  /** index of the agent step that asked for it */
  step?: number;
}

export interface Case {
  case_ref: string;
  type: string;
  refs: string[];
  question: string | null;
  impact: string | null;
  first_frame: number | null;
  key: string | null;
  /** assigned by the diagnostic packet rather than proposed by the program */
  assigned: boolean;
  status: "pending" | "resolved" | "unresolved" | "unsupported";
  result: { case_ref: string; outcome: string; finding?: string; observation_refs?: string[] } | null;
}

export interface Budget53 {
  main_remaining: number;
  gemma_remaining: number;
  text_remaining: number;
  /** V5.3: the active case's own Gemma budget, shown to the agent */
  case_ref?: string;
  case_gemma_remaining?: number;
  case_gemma_cap?: number;
}

export interface AgentStep {
  i: number;
  /** tool: one Nemotron call that made a tool call; message: one Nemotron call that
   *  answered in text instead; nudge: the host's continuation prompt (not a model call) */
  kind: "tool" | "message" | "nudge";
  tool: string | null;
  args: Record<string, unknown>;
  t_call: number;
  t_result: number;
  /** accepted by the gateway; refused by the Runtime Verifier; rejected by Pi itself; or a message/nudge */
  outcome: "accepted" | "refused" | "pi_error" | "message" | "nudge";
  code: string | null;
  detail?: string;
  visuals: number[];
  text: string;
  text_chars: number;
  budget_before: Budget53 | null;
}

export interface PropertyEval {
  evaluator_version: "property_eval_v1";
  answer_shape_valid: boolean;
  count_match: boolean;
  color_exact: boolean;
  count_complete: boolean;
  count_complete_calibration: "justified_true" | "conservative_false" | "false_and_wrong" | "overclaim";
  color_token: {
    matched_targets: number;
    expected_targets: number;
    all_targets_matched: boolean;
    pairs: { reported_color: string; object_id: string; expected_color: string; extra_hues: string[] }[];
    unmatched_reported_colors: string[];
    scope: string;
  };
  geometry: {
    iou_threshold: number;
    matched: { vehicle_ref: string; object_id: string; event_frames: number; covered_event_frames: number; event_coverage: number; cited_frames_outside_event: number }[];
    false_positive_vehicles: string[];
    false_negative_objects: string[];
    scope: string;
  };
}

export interface Gpu {
  interval_sec: number;
  samples: number;
  services: Record<string, { gpus: string[]; nvidia_smi_used_max_mib: number; total_mib: number; kv_cache_usage_max: number | null; kv_cache_usage_mean: number | null }>;
  tracking_job: { seconds: number; peak_allocated_mib: number; peak_reserved_mib: number; matches_this_run: boolean } | null;
}

export interface AttemptSummary {
  attempt: string;
  pass?: number | null;
  query_id?: string | null;
  controller?: string | null;
  arm?: string | null;
  visual_cap?: number | null;
  submission: { decision: string; reported_count: number | null; colors: string[]; count_complete: boolean };
  pi_started?: boolean;
  nemotron: number;
  gemma: number;
  wall_sec: number;
  cases: { case_ref: string; status: string; result: Case["result"] }[];
  gemma_texts: string[];
  query_text?: string;
  query_delivered_to?: string[];
  scorer?: { count_numeric_match: boolean; color_multiset_correct: boolean; complete_count_correct: boolean } | null;
  property_eval?: PropertyEval | null;
  property_eval_v2?: { fields: string[]; Y: number[] } | null;
}

export interface Target {
  vehicle_ref: string;
  member_track_refs: string[];
  color_description: string | null;
  color_observation_ref: string | null;
  source_frame_intervals: [number, number][];
}

export interface Bundle53 {
  bundle_version: "5.3";
  bundle_kind: "run" | "diagnostic";
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
    tracking: {
      contract: string;
      weights_sha256: string;
      inference: { conf: number; imgsz: number; classes: number[] };
      tracker: Record<string, number | boolean>;
    } | null;
  };
  query: { task_id: string; query_id: string | null; text: string; delivered_to: string[]; understanding_tested: boolean };
  task: {
    question: string;
    investigation: { used: boolean; statement: string; instructions: string; system: string; tools: Record<string, string> };
  };
  runtime: Record<string, number | string | boolean>;
  video: { fps: number; width: number; height: number; nb_frames: number; duration_sec: number; proxy: string };
  tracking: {
    classes: Record<string, string>;
    tracks: { alias: string; raw_id: number; observed: [number, number]; vehicle: string }[];
    frames: { d: Det53[]; p: Pred53[] }[];
  };
  vehicles: Vehicle[];
  links: { first: string; second: string; kind: string; evidence: LinkEvidence }[];
  possible_links: { first: string; second: string; evidence: LinkEvidence }[];
  aliases: Record<string, string>;
  votes: { vector: [number, number]; vehicles: string[] }[];
  appearance: Appearance[];
  cases: Case[];
  agent: { initial_user: string; steps: AgentStep[]; calls: number; refused: number; pi_errors: number; continuations: number } | null;
  answer: {
    status: string;
    scope: string;
    submission: { decision: string; reported_count: number | null; colors: string[]; count_complete: boolean; uncertainty: string | null };
    targets: Target[];
    ungrouped_detection_count: number;
    unresolved_vehicles: string[];
    pending_cases: string[];
  };
  runtime_verifier: { agent_tool_calls: number; agent_refused: number; final_answer_check: "pass" | "not_reached" };
  posthoc_verifier: { status: string; issues: unknown[]; traffic_truth_checked: false };
  run: {
    wall_sec: number;
    terminal_reason: string;
    pi_started: boolean;
    investigation_terminal: string | null;
    investigation_sec: number | null;
    tracking_sec: number | null;
    /** false when tracking was imported from a saved run (diagnostic) */
    tracking_new_inference: boolean;
    gemma_sec: number[];
    gpu: Gpu | null;
  };
  budget: {
    nemotron: { used: number; limit: number };
    gemma: { used: number; limit: number };
    tool_text: { remaining: number; limit: number };
  };
  /** run bundles only */
  scorer?: {
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
  /** Property Evaluator v1: count, colour words and geometry against ground truth */
  property_eval?: PropertyEval;
  /** Property Evaluator v2: the L0-L6 outcome vector Y (22 fields, Y-schema v1) */
  property_eval_v2?: {
    evaluator_version: "property_eval_v2";
    y_schema: string;
    fields: string[];
    Y: number[];
    counts: Record<string, number>;
    info_fields: string[];
    scope: string;
    identity_readings: { observation_ref: string; reading: string; truth: string }[];
  };
  review?: {
    reviewer: "coding-agent";
    independent: false;
    method: string;
    scope: string;
    changed_from_v52: boolean;
    changed_reason: string | null;
  };
  stability?: {
    attempts: AttemptSummary[];
    identical_answers: boolean;
    identical_targets: boolean;
    identical_tracking: boolean;
    identical_gemma_text: boolean;
  };
  /** diagnostic bundles only */
  diagnostic?: {
    scenario: string;
    controller: "pi";
    arm: "pi-cap2" | "pi-cap4";
    visual_cap: number;
    packet: { case: { refs: string[]; type: string } | null; deferred_links: string[][]; media_available: boolean; used_frames: number[] };
    limits: { main: number; visual: number };
    fixed_policy: string;
    siblings: AttemptSummary[];
    review: { reviewer: "coding-agent"; independent: false; item: string };
  };
}

export type Loaded53 = Bundle53 & { _dir: string };
