// Architecture page content for V5.0. Source of truth: video-agent
// docs/sut-v5/v5.0.zh-TW.md at SUT 5ff6b8a (implemented runtime, three views),
// config/runtime_v5.json, store/vehicles_v5.py and inspection/runtime_verifier_v5.py.
// Results: the study's sut-v5.0-six-video-20261015 report. Example values are
// attempt a002 (clip 1-nominal-r1) as exported in bundles/v50-1-nominal-r1-s1.

import type { Component, FlowStage, Participant, SeqMsg, Zone, ZoneInfo } from "../arch/types";

export const ZONES: Record<Zone, ZoneInfo> = {
  agent: { name: "Agent sandbox · optional", note: "tested-agent-user · untrusted · starts only for an investigation case · none in this batch", idle: true },
  host: { name: "Trusted host", note: "root · owns the video, the tracking data, the rules, every check and every record" },
  models: { name: "Model services", note: "local GPUs · started and stopped only by model-serving · flags unchanged" },
};

export const COMPONENTS: Component[] = [
  {
    id: "runner", zone: "host", name: "Runner", sub: "runner/v5.py · v5/v5.0",
    role: "Starts one fresh workflow per clip: a new gateway and store, a fresh tracking job, and the end state. It starts Pi only if a case needs it.",
    facts: ["--system-version v5, candidate revision v5.0, memory off", "one clip, one seed, one attempt", "deadline or caps reached: keep what is confirmed and pending, never claim absence"],
  },
  {
    id: "gateway", zone: "host", name: "V5 Gateway", sub: "inspection/v5.py",
    role: "Runs the workflow, owns the session store, resolves a vehicle to a real frame and box for Gemma, and records every event in a hash-chained ledger.",
    facts: ["never rewrites Gemma's text", "tracking at most once per attempt", "host-only Gemma replies are stored privately and cost no agent text"],
  },
  {
    id: "vehicles", zone: "host", name: "Vehicle records", sub: "store/vehicles_v5.py · grouping",
    role: "Joins tracker IDs (T) that are clearly one vehicle into vehicle records (V). Original IDs and boxes are never changed; every join is recorded with its evidence.",
    facts: ["gap ≤ 3 frames, size ratio ≤ 4×, heading change < 60°", "IoU ≥ 0.1 or predicted position within 0.5 box diagonals", "both sides must be each other's only candidate", "never joins two records seen in the same frame", "close-but-unclear pairs are kept apart and vote once together"],
  },
  {
    id: "rules", zone: "host", name: "Traffic rule", sub: "fixed, not a model",
    role: "One vote per vehicle (its stable direction). For each vehicle, the flow is what most other votes agree on. A movement phase 135° or more against that flow makes it a candidate.",
    facts: ["phase: ≥ 3 points, real displacement", "vote: phases within 45° carrying ≥ 80% of the movement", "flow: ≥ 2 units and ≥ 2/3 agreeing, consistent clip-wide", "too little movement or a tie stays unresolved", "assumes a fixed camera and one comparable roadway"],
  },
  {
    id: "assembler", zone: "host", name: "Answer assembler", sub: "count · free colours · frames",
    role: "Writes the answer from the rule's candidates: one target per vehicle, Gemma's colour text as written, the frames of its opposing phases. count_complete stays false while any vehicle is unresolved, any identity is open or any box is ungrouped.",
    facts: ["colours are not mapped to a list", "unknown colour does not change the count", "Nemotron never writes the count"],
  },
  {
    id: "rv", zone: "host", name: "Runtime Verifier", sub: "live checks",
    role: "Checks, while the run is live: the five agent tools' schemas, sources and budgets (when an agent runs), text delivery space, and the final answer's shape and sources. It can refuse; it does not judge traffic.",
    facts: ["count = colours = targets", "every reported frame is a real observation of that vehicle", "every colour cites a stored Gemma reply", "not the traffic rule"],
  },
  {
    id: "store", zone: "host", name: "Private store", sub: "raw data + ledger",
    role: "Raw tracking JSON, vehicle snapshots (prepared, after appearance, final), Gemma requests and replies, and the hash-chained event ledger.",
    facts: ["raw tracking never overwritten", "actual model requests archived", "unreadable to tested-agent-user"],
  },
  {
    id: "posthoc", zone: "host", name: "Post-hoc Verifier", sub: "verifier/v5.py · after the run",
    role: "After the run, rebuilds the grouping, the rule, the representative frames, the image pixels, the colour parsing, any cases, the requests and budgets, and the answer, and checks they match the records.",
    facts: ["never feeds back into the run", "pass means the record is intact, not that the answer is right", "traffic_truth_checked: false"],
  },
  {
    id: "pi", zone: "agent", name: "Pi + V5 extension", sub: "five tools · not started", idle: true,
    role: "For one investigation case at a time: reads the case, looks again with Gemma if useful, and finishes the case resolved or unresolved. It cannot submit a count.",
    facts: ["context_get · observation_get · inspect_window · compare_windows · investigation_finish", "≤ 4 cases per attempt, ≤ 2 new Gemma calls per case", "no shell, no Python", "tested with fake model providers only"],
  },
  {
    id: "yolo", zone: "models", name: "YOLO26s + ByteTrack", sub: "detector + tracker · :8003",
    role: "Detects vehicles in every original frame and links them into tentative tracker IDs. Boxes it cannot link are returned as unmatched.",
    facts: ["960 px, confidence ≥ 0.1, vehicle classes", "ByteTrack: high 0.25, low 0.1, buffer 30 frames, no ReID", "fresh job per attempt"],
  },
  {
    id: "gemma", zone: "models", name: "Gemma 4 26B-A4B", sub: "stateless vision · :8002",
    role: "Answers one factual question about the boxed vehicle: “Body color: …” and an observation line. It is never asked about direction or traffic.",
    facts: ["temperature 0.1", "12 calls per attempt", "free colour text, two-tone allowed"],
  },
  {
    id: "nemotron", zone: "models", name: "Nemotron 3.5 Lightning", sub: "30B-A3B · :8001 · idle", idle: true,
    role: "Configured as the investigator for cases. With no case in this batch it received no request.",
    facts: ["thinking off · temperature 1.0 · top-p 0.95", "20 calls per attempt cap", "0 calls in all six runs"],
  },
];

export const BOUNDARIES: { from: string; to: string; payload: string }[] = [
  { from: "Runner", to: "Detector + tracker", payload: "The whole clip and its SHA-256, as one fresh job." },
  { from: "Detector + tracker", to: "Gateway", payload: "Per frame: real boxes, class, tentative tracker ID or unmatched, and Kalman predictions flagged as not observed." },
  { from: "Gateway", to: "Gemma", payload: "The full frame with a TARGET box, the original-pixel crop with 25% padding, and one factual body-colour question. No history, no traffic question." },
  { from: "Gemma", to: "Gateway", payload: "“Body color: purple” plus an observation line, stored verbatim and bound to the vehicle, tracker ID, frame and observation reference." },
  { from: "Gateway", to: "Pi (case only)", payload: "Plain text: the case, related records, verbatim Gemma text with a source header, remaining budgets. Not sent in this batch." },
  { from: "Pi (case only)", to: "Gateway", payload: "One of five tool calls, ending with investigation_finish { case_ref, outcome, observation_refs }. Never a count. Not sent in this batch." },
  { from: "Records", to: "Post-hoc Verifier", payload: "Ledger, snapshots, requests, media and tracking data, after the run ends." },
];

export const PARTICIPANTS: Participant[] = [
  { id: "runner", name: "Runner", sub: "host" },
  { id: "yolo", name: "YOLO26s + ByteTrack", sub: "model" },
  { id: "gateway", name: "Gateway + rules", sub: "host" },
  { id: "gemma", name: "Gemma", sub: "model" },
  { id: "pi", name: "Pi + Nemotron", sub: "agent", idle: true },
  { id: "rv", name: "Runtime Verifier", sub: "host" },
  { id: "posthoc", name: "Post-hoc Verifier", sub: "host" },
];

export const SEQUENCE: SeqMsg[] = [
  { from: "runner", to: "gateway", label: "fresh session, store, bound video", stage: 0, highlight: ["runner", "gateway", "store"],
    detail: "A new gateway and private store for this one clip. Nothing carries over from any other attempt." },
  { from: "runner", to: "yolo", label: "whole clip, one fresh job", stage: 1, highlight: ["runner", "yolo"],
    detail: "All 199 frames go to YOLO26s + ByteTrack once. In a002 this took 3.39 s." },
  { from: "yolo", to: "gateway", label: "boxes, 18 tracker IDs, 116 unmatched", stage: 1, dashed: true, highlight: ["yolo", "gateway", "store"],
    detail: "Raw boxes and associations land in the private store unchanged." },
  { from: "gateway", to: "gateway", label: "group: 18 T → 14 V", stage: 2, highlight: ["gateway", "vehicles"],
    detail: "T1+T3 → V1, T8+T9 → V8, T14+T15 → V14, T16+T17 → V16. 34 unmatched boxes are attached; 82 stay ungrouped. V10 and V12 might be one car: kept apart, one vote." },
  { from: "gateway", to: "gateway", label: "rule: V1 runs 152° against the flow", stage: 3, highlight: ["gateway", "rules"],
    detail: "13 comparison units vote. The other 12 all flow up the screen; V1's phase from frame 14 to 44 runs down, 152° from that flow. V1 is the only candidate." },
  { from: "gateway", to: "gemma", label: "V1 → T3 @ 43: TARGET + crop", stage: 4, highlight: ["gateway", "gemma"],
    detail: "The host picks frame 43, where T3 (part of V1) has a real box, draws TARGET, cuts a 25%-padded crop and asks for the body colour." },
  { from: "gemma", to: "gateway", label: "“Body color: purple”", stage: 4, dashed: true, highlight: ["gemma", "gateway", "store"],
    detail: "Stored verbatim, bound to V1, T3, frame 43 and an observation reference. The host parses the Body color line: purple. 0.78 s." },
  { from: "gateway", to: "pi", label: "investigation case? none → Pi not started", stage: 4, skipped: true, highlight: ["pi", "nemotron"],
    detail: "A case opens only when a doubt could change the answer and a new look could settle it. None did, so Pi and Nemotron never ran: 0 Nemotron calls. This branch is implemented but was not exercised live." },
  { from: "gateway", to: "gateway", label: "assemble: 1 · purple · incomplete", stage: 5, highlight: ["gateway", "assembler"],
    detail: "One target, V1 = T1+T3, frames 14–44, “purple”. 82 ungrouped boxes remain, so count_complete is false." },
  { from: "gateway", to: "rv", label: "answer shape + real source frames → pass", stage: 6, highlight: ["gateway", "rv"],
    detail: "The Runtime Verifier checks count = colours = targets, that frames 14–44 are real observations of V1, and that the colour cites a stored reply. Not whether the car really drove the wrong way." },
  { from: "gateway", to: "runner", label: "host_finalized", stage: 6, dashed: true, highlight: ["gateway", "runner"],
    detail: "The run ends after 5.49 s: 1 tracking job, 1 Gemma call, 0 Nemotron calls." },
  { from: "runner", to: "posthoc", label: "rebuild records → integrity pass", stage: 6, highlight: ["runner", "posthoc", "store"],
    detail: "After the run, the Post-hoc Verifier rebuilds grouping, rule, media, colour parsing and answer from the records. It passed. Whether the answer is right is a separate question for the study's scorer." },
];

/** a002, values from the actual run */
export const FLOW: FlowStage[] = [
  { lane: "host", name: "Video", what: "199 source frames, 960×540, 10 fps. Bound to the session by SHA-256.", payload: "frames 0–198" },
  { lane: "model", name: "Detect + associate", what: "YOLO26s boxes in every frame; ByteTrack links them into tentative IDs. Unmatched boxes are kept apart.", payload: "18 tracker IDs · 116 unmatched boxes" },
  { lane: "host", name: "Group", what: "Join IDs that are clearly one vehicle; attach unmatched boxes only under the same rule.", payload: "14 vehicle records · V1 = T1+T3 · 82 boxes ungrouped" },
  { lane: "host", name: "Movement + votes", what: "Phases per vehicle record; one stable-direction vote per comparison unit.", payload: "13 votes · V10≈V12 vote once" },
  { lane: "host", name: "Traffic rule", what: "Flow of the others; any phase 135° or more against it makes a candidate.", payload: "V1 frames 14–44: 152° → candidate" },
  { lane: "host", name: "Resolve target", what: "A real box of the candidate: frame, TARGET box, padded crop.", payload: "V1 → T3 @ frame 43 · crop [244, 317, 423, 540]" },
  { lane: "model", name: "Gemma", what: "One factual body-colour question; no history, no traffic.", payload: "“Body color: purple”" },
  { lane: "host", name: "Parse + bind", what: "Exactly one Body color line, not a direction word; otherwise unknown. Stored with its source.", payload: "purple · o…691a · appearance_check" },
  { lane: "host", name: "Assemble", what: "Targets, colours as written, frame intervals; completeness from what is still unexplained.", payload: "{ 1, [purple], count_complete: false }" },
  { lane: "host", name: "Runtime Verifier", what: "Answer shape and real source frames.", payload: "pass" },
  { lane: "after", name: "Post-hoc Verifier", what: "Rebuilds every step from the records. Integrity only.", payload: "pass" },
  { lane: "after", name: "Study scorer + review", what: "Against ground truth the system never saw.", payload: "count ✓ · colour ✓ · identity supported · complete ✗" },
];

/** Report section 8: a descriptive comparison of two designs, not a causal experiment. */
export const VERSUS: { row: string; v42: string; v50: string }[] = [
  { row: "Who decides which vehicle is wrong-way", v42: "Nemotron, by comparing track facts it reads as text", v50: "A fixed host rule over vehicle records" },
  { row: "Who writes the answer", v42: "Nemotron, through evidence_submit", v50: "The host assembler" },
  { row: "What Nemotron does", v42: "Every step: 98 calls over six clips", v50: "Investigation cases only: 0 calls (no case arose)" },
  { row: "Gemma calls (six clips)", v42: "10", v50: "6" },
  { row: "Right count", v42: "3/6", v50: "6/6" },
  { row: "Count and colours supported by the frames", v42: "1/6", v50: "6/6" },
  { row: "Complete answers", v42: "0/6", v50: "0/6" },
  { row: "Typical failure", v42: "direction words written as colours; normal cars counted", v50: "ungrouped boxes keep every count incomplete" },
];

export const CHANGES: { version: string; what: string; result: string }[] = [
  { version: "Earlier site (archived ISR agent)", what: "The agent sampled frames itself and asked a vision model what it saw. No detector, no tracker.", result: "Engineering runs only; no measured result." },
  { version: "V4.0", what: "YOLO26s + ByteTrack added. Full trajectories rendered as text for the agent.", result: "5/6 submitted, 1 main answer right." },
  { version: "V4.1", what: "Runtime Verifier as one component. Host-computed movement. Track-targeted Gemma crops.", result: "2/6 submitted." },
  { version: "V4.2", what: "Movement-first track facts, fixed source header, free-text colours. Nemotron still decides and answers.", result: "6/6 accepted, 3/6 right count, 1/6 supported, 0/6 complete. Not promoted." },
  { version: "V5.0", what: "Program-first: host grouping, a fixed traffic rule, host-chosen Gemma colour checks and a host-assembled answer. Pi + Nemotron only for investigation cases.", result: "6/6 right count, 6/6 supported, 4/6 exact colour strings, 0/6 complete, 0 Nemotron calls. Not promoted." },
];
