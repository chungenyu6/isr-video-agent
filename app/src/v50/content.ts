// Architecture page content for V5.0. Source of truth: video-agent
// docs/sut-v5/v5.0.zh-TW.md at SUT 5ff6b8a (implemented runtime, three views),
// config/runtime_v5.json, store/vehicles_v5.py and inspection/runtime_verifier_v5.py.
// Results: the study's sut-v5.0-six-video-20261015 report. The call sequence is
// general; the data flow uses example values from attempt a002 (clip 1-nominal-r1) as exported in bundles/v50-1-nominal-r1-s1.

import type { Component, FlowStage, Participant, SeqFrame, SeqMsg, Zone, ZoneInfo } from "../arch/types";

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
  { id: "pi", name: "Pi + Nemotron", sub: "agent · optional", idle: true },
  { id: "rv", name: "Runtime Verifier", sub: "host" },
  { id: "posthoc", name: "Post-hoc Verifier", sub: "host" },
];

/**
 * The implemented V5.0 call sequence for any attempt, after the canonical
 * call-sequence view in docs/sut-v5/v5.0.zh-TW.md. Messages 7-16 are the
 * investigation branch: implemented, never started in the measured batch.
 */
export const SEQUENCE: SeqMsg[] = [
  { from: "runner", to: "yolo", label: "fresh job: whole clip + SHA-256", stage: 1, highlight: ["runner", "yolo"],
    detail: "Each attempt starts a new gateway and private store and sends the whole clip to the detector and tracker once. Nothing carries over from any other attempt." },
  { from: "yolo", to: "gateway", label: "real boxes, tracker IDs, unmatched boxes", stage: 1, dashed: true, highlight: ["yolo", "gateway", "store"],
    detail: "Per frame: real boxes, class and a tentative tracker ID (T), or no ID if the tracker could not link the box. Kalman predictions are flagged as not observed. All of it lands in the private store unchanged." },
  { from: "gateway", to: "gateway", label: "group tracker IDs into vehicle records", stage: 2, highlight: ["gateway", "vehicles"],
    detail: "Tracker IDs that are clearly one vehicle are joined into a vehicle record (V): a short gap, similar size and heading, and each the other's only candidate. Unclear pairs stay apart and vote once together. Boxes that fit no record stay ungrouped." },
  { from: "gateway", to: "gateway", label: "movement, one vote each, traffic rule → candidates", stage: 3, highlight: ["gateway", "rules"],
    detail: "Each record gets movement phases and one stable-direction vote. For each record, the flow is what the other votes agree on (≥ 2 units, ≥ 2/3). A phase 135° or more against that flow makes it a candidate. Too little support or a tie stays unresolved." },
  { from: "gateway", to: "gemma", label: "host-chosen real frame: TARGET + 25% crop", stage: 4, highlight: ["gateway", "gemma"],
    detail: "For each candidate, the host picks a frame where one of its tracker IDs has a real box, draws TARGET on the full frame, cuts a crop with 25% padding and asks one factual body-colour question. No history, no traffic question." },
  { from: "gemma", to: "gateway", label: "free Body color + observation text", stage: 4, dashed: true, highlight: ["gemma", "gateway", "store"],
    detail: "The reply is stored verbatim, bound to the vehicle, tracker ID, frame and an observation reference. The host parses exactly one Body color line; anything else is unknown. Host-only replies cost no agent text." },
  { from: "runner", to: "pi", label: "fixed case prompt, five tools", skipped: true, highlight: ["runner", "pi"],
    detail: "Only when a doubt could change the answer and a new look could settle it does the runner open a case and start Pi with Nemotron, one case at a time, at most four per attempt. Implemented; no case arose in the measured batch, so this never ran." },
  { from: "pi", to: "rv", label: "context_get / observation_get / inspect / compare", skipped: true, highlight: ["pi", "nemotron", "rv"],
    detail: "Every tool call goes through the Runtime Verifier first: schema, argument combination, sources from this session, real boxes, call and time budgets." },
  { from: "rv", to: "gateway", label: "types, sources, frames, budgets checked", skipped: true, highlight: ["rv", "gateway"],
    detail: "Only a call that passes reaches the gateway. A refused call is recorded and costs budget." },
  { from: "gateway", to: "pi", label: "plain text, cursor, remaining budget", skipped: true, dashed: true, highlight: ["gateway", "pi"],
    detail: "The agent reads plain text pages: the case, related records, verbatim Gemma text under a fixed source header, and what budget is left. Every delivered character is counted." },
  { from: "gateway", to: "gemma", label: "fresh media, fixed factual question", skipped: true, highlight: ["gateway", "gemma"],
    detail: "If a new look is useful, the gateway makes fresh media for this case and asks Gemma the same kind of factual question, at most twice per case and within the shared 12-call cap." },
  { from: "gemma", to: "gateway", label: "verbatim text", skipped: true, dashed: true, highlight: ["gemma", "gateway", "store"],
    detail: "Stored verbatim with its source, like every other Gemma reply." },
  { from: "gateway", to: "pi", label: "source header + text (counted)", skipped: true, dashed: true, highlight: ["gateway", "pi"],
    detail: "Delivered to the agent under the fixed source header; the full text counts against the agent's text budget." },
  { from: "pi", to: "rv", label: "investigation_finish (outcome + refs)", skipped: true, highlight: ["pi", "rv"],
    detail: "The agent closes the case as resolved or unresolved and cites the observations it relied on. It cannot submit a count or approve the whole answer." },
  { from: "rv", to: "gateway", label: "shape, sources; co-visible records never merged", skipped: true, highlight: ["rv", "gateway"],
    detail: "The Runtime Verifier checks the outcome's shape and sources. Two records seen in the same frame can never be declared one vehicle." },
  { from: "gateway", to: "gateway", label: "update derived relations, keep raw facts", skipped: true, highlight: ["gateway", "vehicles"],
    detail: "The outcome updates derived relations with its citations. Raw tracking data and earlier records are never rewritten." },
  { from: "runner", to: "gateway", label: "main flow done → assembler writes the answer", stage: 5, highlight: ["runner", "gateway", "assembler"],
    detail: "The host assembler writes one target per candidate vehicle: its tracker IDs, Gemma's colour as written, the frames of its opposing phases. count_complete stays false while anything is unresolved, open or ungrouped. Nemotron never writes the count." },
  { from: "gateway", to: "rv", label: "host answer shape + real source intervals", stage: 6, highlight: ["gateway", "rv"],
    detail: "The Runtime Verifier checks count = colours = targets, that every reported frame is a real observation of that vehicle, and that every colour cites a stored reply. It does not judge whether a car really drove the wrong way." },
  { from: "runner", to: "posthoc", label: "after the run: rebuild ledger, grouping, rule, media, answer", stage: 6, highlight: ["runner", "posthoc", "store"],
    detail: "After the run ends, the Post-hoc Verifier rebuilds every step from the records and checks they match. A pass means the record is intact, not that the answer is right; that is the study scorer's job." },
];

export const SEQ_FRAMES: SeqFrame[] = [
  { first: 4, last: 5, kind: "loop", label: "each candidate · 12 Gemma calls per attempt, shared" },
  { first: 6, last: 15, kind: "opt", label: "investigation case · ≤ 4 per attempt · not exercised live", skipped: true },
  { first: 10, last: 12, kind: "opt", label: "new look useful · ≤ 2 per case", skipped: true },
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
