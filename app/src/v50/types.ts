// V5.0 bundle: mirrors schema/bundle-v50.schema.json (tools/export_v50_run.py).

import type { Box } from "../types";

/** [x0, y0, x1, y1, class_id, track index or -1, vehicle index or -1] */
export type Det50 = [number, number, number, number, number, number, number];
/** [x0, y0, x1, y1, track index] - Kalman prediction for a lost track, never observed */
export type Pred50 = [number, number, number, number, number];

export interface Phase50 {
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
  phases: Phase50[];
  opposing: [number, number][];
  vote: [number, number] | null;
  vote_shared_with: string[];
  flow: [number, number] | null;
  comparison_units: number;
  support_units: number;
  identity_component: string[];
}

export interface LinkEvidence { missing_frames: number; iou: number; area_ratio: number; prediction_error_diagonals: number | null }

export interface Appearance {
  observation_ref: string;
  intent: string;
  origin: "host";
  asked_ref: string;
  track_ref: string;
  vehicle_ref: string;
  frame: number;
  target_bbox: Box;
  crop_bounds: Box;
  full: string;
  crop: string;
  text: string;
  finish_reason: string;
  truncated: boolean;
  latency_sec: number;
  tokens: { prompt: number; completion: number };
  color_parse: { status: string; value: string | null };
}

export interface Target {
  vehicle_ref: string;
  member_track_refs: string[];
  color_description: string | null;
  color_observation_ref: string | null;
  source_frame_intervals: [number, number][];
}

export interface Bundle50 {
  bundle_version: "5.0";
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
    };
  };
  task: {
    question: string;
    investigation: { used: boolean; statement: string; instructions: string; system: string; tools: Record<string, string> };
  };
  runtime: Record<string, number | string>;
  video: { fps: number; width: number; height: number; nb_frames: number; duration_sec: number; proxy: string };
  tracking: {
    classes: Record<string, string>;
    tracks: { alias: string; raw_id: number; observed: [number, number]; vehicle: string }[];
    frames: { d: Det50[]; p: Pred50[] }[];
  };
  vehicles: Vehicle[];
  links: { first: string; second: string; kind: string; evidence: LinkEvidence }[];
  possible_links: { first: string; second: string; evidence: LinkEvidence }[];
  aliases: Record<string, string>;
  votes: { vector: [number, number]; vehicles: string[] }[];
  appearance: Appearance[];
  answer: {
    status: string;
    scope: string;
    submission: { decision: string; reported_count: number | null; colors: string[]; count_complete: boolean; uncertainty: string };
    targets: Target[];
    ungrouped_detection_count: number;
    unresolved_vehicles: unknown[];
    pending_cases: unknown[];
    cases: unknown[];
  };
  runtime_verifier: { agent_tool_calls: number | null; final_answer_check: "pass" | "not_reached" };
  posthoc_verifier: { status: string; issues: unknown[]; traffic_truth_checked: false };
  run: { wall_sec: number; terminal_reason: string; pi_started: boolean; tracking_sec: number; gemma_sec: number[] };
  budget: {
    nemotron: { used: number; limit: number };
    gemma: { used: number; limit: number };
    tool_text: { remaining: number; limit: number };
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
    reviewer: "coding-agent";
    independent: false;
    count_complete: boolean;
    false_reported_targets: number;
    targets: { vehicle_ref: string; object_id: string; color_original: string; identity: string; color: string; interval: string }[];
    meaning: string | null;
  };
}

export type Loaded50 = Bundle50 & { _dir: string };
