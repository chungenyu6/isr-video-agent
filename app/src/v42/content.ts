// Architecture page content. Source of truth: video-agent docs/sut-v4/v4.2.zh-TW.md
// at SUT 93d0e5b (implemented runtime), config/runtime_v42.json and
// model-serving/vision/server.py. Results: the study's V4.2 resumed report.

import type { Component, FlowStage, Participant, SeqMsg, Zone, ZoneInfo } from "../arch/types";

export const ZONES: Record<Zone, ZoneInfo> = {
  agent: { name: "Agent sandbox", note: "Unix user tested-agent-user · untrusted · no access to labels or other runs" },
  host: { name: "Trusted host", note: "root · owns the video, the tracking data, every check and every record" },
  models: { name: "Model services", note: "local GPUs · started and stopped only by model-serving" },
};

export const COMPONENTS: Component[] = [
  {
    id: "pi", zone: "agent", name: "Pi harness + V4.2 extension", sub: "the agent loop",
    role: "Runs the agent's conversation for one attempt: sends Nemotron the history and the six tool schemas, forwards each tool call to the gateway, appends the reply.",
    facts: ["six typed tools, no shell, no files", "fresh session per attempt, no memory across attempts", "schemas mirror the host's; the host re-checks everything"],
  },
  {
    id: "launcher", zone: "host", name: "Launcher", sub: "runner v4 · revision v4.2",
    role: "Starts a fresh gateway, private store and Pi session for one clip, with the system version chosen explicitly.",
    facts: ["--system-version v4, candidate revision v4.2", "one clip, one seed, one attempt"],
  },
  {
    id: "gateway", zone: "host", name: "V4.2 Gateway", sub: "the only door",
    role: "Executes the six tools, enforces budgets, renders every reply as text and binds each Gemma answer to its track, frames and observation reference.",
    facts: ["tool text: 12 000 chars per attempt, pages of 2 500", "never rewrites Gemma's text", "runs tracking at most once per attempt"],
  },
  {
    id: "rv", zone: "host", name: "Runtime Verifier", sub: "live checks",
    role: "Checks every call while the agent runs: schema, session and source, frame range, call budgets, delivery space, and the answer's shape. It can refuse; the agent gets a concrete error back.",
    facts: ["changes what the agent can do", "does not judge traffic or correctness", "no formal proof table required in V4.2"],
  },
  {
    id: "store", zone: "host", name: "Private store", sub: "raw data + ledger",
    role: "Holds the raw tracking JSON, observations and a hash-chained event ledger. The agent only ever sees rendered text derived from it.",
    facts: ["every event hash-chained", "actual model requests archived"],
  },
  {
    id: "motion", zone: "host", name: "Motion + track fact index", sub: "geometry, not judgement",
    role: "Turns each track into movement phases and keeps one fact record per track: movement, coarse screen area, and any Gemma text bound to it.",
    facts: ["5-point median on interior points; short tracks unsmoothed", "stride fps/4; threshold max(3 px, 0.5% of the diagonal)", "8 directions or unresolved", "never merges IDs, never says which direction is wrong"],
  },
  {
    id: "target", zone: "host", name: "Target resolver", sub: "frame, box, crop",
    role: "For inspect_window(track_ref, intent), picks a frame where that track has a real detection, draws a TARGET box on the full frame, and cuts a crop with 25% padding.",
    facts: ["never uses a predicted box", "at most 2 s and 6 source frames per inspection"],
  },
  {
    id: "posthoc", zone: "host", name: "Post-hoc Verifier", sub: "after the run",
    role: "After the run, rebuilds motion, requests, media, headers and budgets from the records and checks they agree.",
    facts: ["never feeds back into the run", "pass means the record is intact, not that the answer is right"],
  },
  {
    id: "nemotron", zone: "models", name: "Nemotron 3.5 Lightning", sub: "30B-A3B · orchestrator · :8001",
    role: "The decision maker. Reads the track facts, compares vehicles in the same roadway area, chooses which tracks to inspect and writes the answer.",
    facts: ["NVFP4 on one GPU, vLLM", "thinking off · temperature 1.0 · top-p 0.95", "20 calls per attempt"],
  },
  {
    id: "yolo", zone: "models", name: "YOLO26s + ByteTrack", sub: "detector + tracker · :8003",
    role: "Detects vehicles in every original frame and links detections into tentative track IDs.",
    facts: ["960 px, confidence ≥ 0.1, vehicle classes", "ByteTrack: high 0.25, low 0.1, buffer 30 frames, no ReID", "fresh tracker per attempt"],
  },
  {
    id: "gemma", zone: "models", name: "Gemma 4 26B-A4B", sub: "stateless vision · :8002",
    role: "Describes what is inside the TARGET box. It sees two images and one factual question per call and keeps no history.",
    facts: ["BF16, two GPUs, vLLM", "temperature 0.1", "12 calls per attempt", "never decides wrong-way"],
  },
];

export const BOUNDARIES: { from: string; to: string; payload: string }[] = [
  { from: "Agent", to: "Gateway", payload: "One of six tool calls, e.g. inspect_window { track_ref: \"T3\", intent: \"appearance_check\" }, or the answer { reported_count, colors, count_complete, uncertainty }." },
  { from: "Gateway", to: "Agent", payload: "Text only: movement phases, coarse screen areas, a fixed source header, Gemma's words verbatim, remaining budgets. No images, no scores, no clip name." },
  { from: "Gateway", to: "Detector + tracker", payload: "The whole clip and its source metadata, as one fresh job." },
  { from: "Detector + tracker", to: "Private store", payload: "Per frame: [x0, y0, x1, y1] boxes, class, tentative track ID, unmatched detections, and Kalman predictions flagged as not observed." },
  { from: "Target resolver", to: "Gemma", payload: "The full frame with a TARGET box, a padded crop, and one factual question for the intent." },
  { from: "Gemma", to: "Gateway", payload: "A factual description, e.g. “The vehicle marked TARGET T3 is a purple car…”. No verdict." },
  { from: "Records", to: "Post-hoc Verifier", payload: "Ledger, requests, media and tracking data, after the run ends." },
];

export const PARTICIPANTS: Participant[] = [
  { id: "launcher", name: "Launcher", sub: "host" },
  { id: "agent", name: "Pi + Nemotron", sub: "agent" },
  { id: "gateway", name: "Gateway", sub: "host" },
  { id: "rv", name: "Runtime Verifier", sub: "host" },
  { id: "yolo", name: "YOLO26s + ByteTrack", sub: "model" },
  { id: "gemma", name: "Gemma", sub: "model" },
  { id: "posthoc", name: "Post-hoc Verifier", sub: "host" },
];

export const SEQUENCE: SeqMsg[] = [
  { from: "launcher", to: "gateway", label: "fresh session, store, bound video", highlight: ["launcher", "gateway", "store"],
    detail: "A new gateway and private store are created for this one clip. Nothing carries over from any earlier attempt." },
  { from: "launcher", to: "agent", label: "task + V4.2 system + 6 tools", highlight: ["launcher", "pi", "nemotron"],
    detail: "The agent gets a two-sentence task, the V4.2 system prompt and six tool schemas. No clip name, no labels." },
  { from: "agent", to: "gateway", label: "context_get", step: 0, highlight: ["pi", "nemotron", "gateway"],
    detail: "The agent asks for the rules: how to read movement, what the tools do, the frame range and its budgets." },
  { from: "agent", to: "gateway", label: "scan_video", step: 1, highlight: ["pi", "nemotron", "gateway"],
    detail: "The agent asks for an overview of the clip. This is what triggers detection and tracking." },
  { from: "gateway", to: "rv", label: "check: schema, source, resources", highlight: ["gateway", "rv"],
    detail: "Every call is checked live before anything runs." },
  { from: "gateway", to: "yolo", label: "whole clip, one fresh job", highlight: ["gateway", "yolo"],
    detail: "All 199 frames go to YOLO26s + ByteTrack once. In a002 this took 3.3 s." },
  { from: "yolo", to: "gateway", label: "boxes + tentative IDs", dashed: true, highlight: ["yolo", "store", "motion"],
    detail: "Raw detections and associations land in the private store; the host computes movement phases and builds the track fact index." },
  { from: "gateway", to: "agent", label: "18-track inventory, movement first", step: 1, dashed: true, highlight: ["gateway", "motion", "pi", "nemotron"],
    detail: "The agent receives text: for each track its observed frames, movement phases and coarse screen path. Only T3 moves downward." },
  { from: "agent", to: "gateway", label: "observation_get T1…T13 (×13)", step: 14, highlight: ["pi", "nemotron", "gateway"],
    detail: "The agent re-reads thirteen track summaries one by one. Each returns facts it already had: 13 model calls, no new information." },
  { from: "agent", to: "gateway", label: "inspect_window(T3, appearance)", step: 15, highlight: ["pi", "nemotron", "gateway", "rv"],
    detail: "The agent picks the one downward track and asks what it looks like. It names only the track and the intent." },
  { from: "gateway", to: "gemma", label: "frame 43 + TARGET box + crop", step: 15, highlight: ["target", "gemma"],
    detail: "The host picks frame 43, where T3 has a real detection, draws the box, cuts a 25%-padded crop, and asks Gemma a factual question." },
  { from: "gemma", to: "gateway", label: "“…T3 is a purple car…”", step: 15, dashed: true, highlight: ["gemma", "gateway", "motion"],
    detail: "Gemma's text is bound to T3, frame 43 and an observation reference, and sent to the agent verbatim behind a fixed source header." },
  { from: "agent", to: "gateway", label: "inspect_window(T4) → “yellow van”", step: 16, highlight: ["pi", "nemotron", "gateway", "target", "gemma"],
    detail: "A comparison check on a normal upward vehicle. The agent correctly leaves it out of the answer." },
  { from: "agent", to: "gateway", label: "evidence_submit(1, [purple], complete=false)", step: 17, highlight: ["pi", "nemotron", "gateway"],
    detail: "The answer: one vehicle, purple, count possibly incomplete. Uncertainty: “T3 purple downward flow is the only confirmed opposite vehicle…”" },
  { from: "gateway", to: "rv", label: "answer shape check", step: 17, highlight: ["gateway", "rv"],
    detail: "The Runtime Verifier checks only the answer's shape: the number of colours equals the count. It does not check truth." },
  { from: "gateway", to: "agent", label: "accepted · terminal", step: 17, dashed: true, highlight: ["gateway", "pi"],
    detail: "The run ends after 18 Nemotron calls and 2 Gemma calls." },
  { from: "launcher", to: "posthoc", label: "rebuild records → integrity pass", highlight: ["launcher", "posthoc", "store"],
    detail: "After the run, the Post-hoc Verifier rebuilds motion, requests, media, headers and budgets from the records. It passed. It says nothing about whether the answer is right; the study's scorer does that separately against ground truth." },
];

/** a002, frames and values from the actual run */
export const FLOW: FlowStage[] = [
  { lane: "host", name: "Video", what: "199 source frames, 960×540, 10 fps. Bound to the session by SHA-256.", payload: "frames 0–198" },
  { lane: "model", name: "Detect (YOLO26s)", what: "Vehicle boxes in every original frame.", payload: "frame 43: [273.7, 361.9, 392.4, 537.7] car" },
  { lane: "model", name: "Associate (ByteTrack)", what: "Links boxes over time into tentative IDs. Gaps split tracks; unmatched boxes are kept apart.", payload: "raw ID 3 → alias T3 · frames 14–44 · 116 unmatched boxes in the clip" },
  { lane: "host", name: "Geometry", what: "Median-smoothed centre path → movement phases in 8 directions.", payload: "T3: frames 14–44 downward" },
  { lane: "host", name: "Track fact index", what: "Movement first, coarse screen area second, rendered as text.", payload: "“Track T3 … Movement: frames 14–44: downward … upper-center → lower-center”" },
  { lane: "agent", name: "Nemotron decides", what: "Compares tracks in the same area; picks what to check.", payload: "inspect_window { track_ref: T3, intent: appearance_check }" },
  { lane: "host", name: "Runtime Verifier", what: "Allows or refuses the call: target, range, budget, delivery space.", payload: "allow" },
  { lane: "host", name: "Target resolver", what: "Real detection frame, TARGET box, padded crop.", payload: "frame 43 · crop [244, 317, 423, 540]" },
  { lane: "model", name: "Gemma", what: "Factual description of the boxed vehicle.", payload: "“The vehicle marked TARGET T3 is a purple car…”" },
  { lane: "host", name: "Bind fact", what: "Text attached to the track, frames and observation reference; delivered verbatim.", payload: "T3 · frame 43 · o5a225a63… · appearance_check" },
  { lane: "agent", name: "Nemotron answers", what: "Count, free-text colours, completeness, uncertainty.", payload: "{ 1, [purple], count_complete: false }" },
  { lane: "host", name: "Runtime Verifier", what: "Answer shape only.", payload: "accepted" },
  { lane: "after", name: "Post-hoc Verifier", what: "Rebuilds the records after the run. Integrity only.", payload: "pass" },
  { lane: "after", name: "Study scorer + review", what: "Against ground truth the agent never saw.", payload: "count ✓ · colour ✓ · identity supported · complete ✗" },
];

export const CHANGES: { version: string; what: string; result: string }[] = [
  { version: "Earlier site (archived ISR agent)", what: "The agent sampled frames itself and asked a vision model what it saw. No detector, no tracker, no movement computed by the host.", result: "Engineering runs only; no measured result." },
  { version: "V4.0", what: "YOLO26s + ByteTrack added. Full trajectories rendered as text. Live checks scattered across the gateway.", result: "5/6 submitted, 1 main answer right; many Gemma answers never reached the agent." },
  { version: "V4.1", what: "Runtime Verifier as one component. Host-computed movement (median, 8 directions). inspect_window(track_ref, intent) with a host-chosen frame, TARGET box and crop.", result: "2/6 submitted; colours were a closed list and caused 9 rejections." },
  { version: "V4.2", what: "Movement-first track facts and a fact index. Fixed source header before Gemma's text. Colours as free text. Median boundary fixed. Generation adapter repaired.", result: "6/6 accepted, 3/6 right count, 1/6 count and colours supported, 0/6 complete. Not promoted." },
];
