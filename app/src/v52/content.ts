// Architecture page content for V5.2. Source of truth: video-agent
// docs/sut-v5/v5.2.zh-TW.md (canonical three views) at SUT d55f235,
// config/runtime_v52.json, inspection/v52.py, runner/diagnostic_v52.py and the
// V5.0 rules it keeps (store/vehicles_v5.py). Results: the study's V5.2 summary,
// stability and investigation-value reports. The call sequence is general; the
// data flow uses example values from the featured attempt a012 (clip
// 2-challenging-r2), as exported in bundles/v52-2-challenging-r2-s1.

import type { Component, FlowStage, Participant, SeqFrame, SeqMsg, Zone, ZoneInfo } from "../arch/types";

export const ZONES: Record<Zone, ZoneInfo> = {
  agent: { name: "Agent sandbox · optional", note: "tested-agent-user · untrusted · starts only for an investigation case · 4 of 48 stability attempts, plus 6 diagnostic cases" },
  host: { name: "Trusted host", note: "root · owns the video, the tracking data, the rules, every check and every record" },
  models: { name: "Model services", note: "local GPUs · started and stopped only by model-serving · flags unchanged" },
};

export const COMPONENTS: Component[] = [
  {
    id: "runner", zone: "host", name: "Runner", sub: "runner/v5.py · v5/v5.2",
    role: "Starts one fresh workflow per clip with an explicit task_id and the user's question as written: a new gateway and store, a fresh tracking job, and the end state. It starts Pi only if a case needs it.",
    facts: ["--system-version v5, candidate revision v5.2, memory off", "task_id wrong_way selects the task; the question is passed along, not interpreted by the host", "deadline or caps reached: keep what is confirmed and pending, never claim absence"],
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
    id: "cases", zone: "host", name: "Case proposals", sub: "inspection/v52.py",
    role: "After the colour checks, proposes a case only where a doubt could change the answer and a new look could settle it: two records that might be one car, a colour the parser could not read.",
    facts: ["at most 4 cases per attempt, one at a time", "case card: readable text, the related records, the question", "no case: Pi is never started"],
  },
  {
    id: "diag", zone: "host", name: "Diagnostic controllers", sub: "runner/diagnostic_v52.py · root only",
    role: "For measurement only: replays a saved state and settles its case one of three ways (no follow-up, a fixed scripted check, or Pi), so their value can be compared. Never part of a normal run and never a tool.",
    facts: ["saved tracking and Gemma replies, no new tracking job", "some scenarios hold back a join or assign a case", "caps per item: 12 Nemotron, 2 Gemma"],
  },
  {
    id: "assembler", zone: "host", name: "Answer assembler", sub: "count · free colours · frames",
    role: "Writes the answer from the rule's candidates and any case results: one target per vehicle, Gemma's colour text as written, the frames of its opposing phases. count_complete stays false while any vehicle is unresolved, any case is open or any box is ungrouped.",
    facts: ["colours are not mapped to a list", "unknown colour does not change the count", "Nemotron never writes the count"],
  },
  {
    id: "rv", zone: "host", name: "Runtime Verifier", sub: "live checks",
    role: "Checks, while the run is live: every agent tool call's schema, references, frames and budgets, text delivery space, and the final answer's shape and sources. It refuses a call it cannot allow; it does not judge traffic.",
    facts: ["count = colours = targets", "every reported frame is a real observation of that vehicle", "identity findings must cite both sightings", "36 refusals in the stability batch, concentrated in the natural cases", "not the traffic rule"],
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
    id: "pi", zone: "agent", name: "Pi + V5.2 extension", sub: "five typed tools",
    role: "For one investigation case at a time: reads the case card, looks up saved detections or observations, asks for new Gemma looks if useful, and finishes the case with one typed finding and its sources. It cannot submit a count.",
    facts: ["context_get · observation_get · inspect_window · compare_windows · investigation_finish", "≤ 4 cases per attempt, ≤ 2 new Gemma calls per case", "no shell, no Python", "live: 4 natural sessions (all unresolved), 6 diagnostic (1 right)"],
  },
  {
    id: "yolo", zone: "models", name: "YOLO26s + ByteTrack", sub: "detector + tracker · :8003",
    role: "Detects vehicles in every original frame and links them into tentative tracker IDs. Boxes it cannot link are returned as unmatched.",
    facts: ["960 px, confidence ≥ 0.1, vehicle classes", "ByteTrack: high 0.25, low 0.1, buffer 30 frames, no ReID", "fresh job per attempt"],
  },
  {
    id: "gemma", zone: "models", name: "Gemma 4 26B-A4B", sub: "stateless vision · :8002",
    role: "Answers one factual question about the boxed vehicle (its colour, or whether it is visible, or whether two sightings correspond). It is never asked about direction or traffic.",
    facts: ["temperature 0.1 · seed 1", "12 calls per attempt", "free colour text, two-tone allowed", "can misread a very small target (B7: it described an unboxed yellow bus as the TARGET)"],
  },
  {
    id: "nemotron", zone: "models", name: "Nemotron 3.5 Lightning", sub: "30B-A3B · :8001",
    role: "The investigator inside a case. Each call returns one tool call; it wrote no free text in these runs.",
    facts: ["thinking off · temperature 1.0 · top-p 0.95 · seed 1", "20 calls per attempt cap", "68 calls in the stability batch, 56 in the diagnostic batch"],
  },
];

export const BOUNDARIES: { from: string; to: string; payload: string }[] = [
  { from: "Study launcher", to: "Host", payload: "task_id wrong_way, the question as written, and a fresh video bound by SHA-256." },
  { from: "Host", to: "Detector + tracker", payload: "The whole clip as one fresh tracking job." },
  { from: "Detector + tracker", to: "Host", payload: "Per frame: real boxes, class, tentative tracker ID or unmatched, and Kalman predictions flagged as not observed." },
  { from: "Host", to: "Gemma", payload: "Full frame(s) with TARGET boxes, original-pixel crops with 25% padding, one factual question. No history, no traffic question." },
  { from: "Gemma", to: "Host", payload: "Verbatim text, stored and bound to the vehicle, tracker ID, frames and an observation reference." },
  { from: "Host", to: "Pi (case only)", payload: "The case card and evidence as plain text (records, verbatim Gemma text under a source header, saved detections), plus remaining budgets." },
  { from: "Pi", to: "Nemotron", payload: "The native conversation and five tool schemas; seed 1, thinking off." },
  { from: "Pi", to: "Runtime Verifier → gateway", payload: "One tool name and typed arguments per call; investigation_finish carries case_ref, outcome, finding and O/E sources. Never a count." },
  { from: "Records", to: "Post-hoc Verifier", payload: "Ledger, snapshots, requests, media and tracking data, after the run ends." },
];

export const PARTICIPANTS: Participant[] = [
  { id: "runner", name: "Launcher", sub: "host" },
  { id: "yolo", name: "YOLO26s + ByteTrack", sub: "model" },
  { id: "gateway", name: "Host + gateway", sub: "host" },
  { id: "gemma", name: "Gemma", sub: "model" },
  { id: "pi", name: "Pi + Nemotron", sub: "agent · optional" },
  { id: "rv", name: "Runtime Verifier", sub: "host" },
  { id: "posthoc", name: "Post-hoc Verifier", sub: "host" },
];

/**
 * The implemented V5.2 call sequence for any attempt, after the canonical
 * call-sequence view in docs/sut-v5/v5.2.zh-TW.md. Messages 9-16 run only when
 * the program proposed a case.
 */
export const SEQUENCE: SeqMsg[] = [
  { from: "runner", to: "gateway", label: "task_id + question as written + fresh video", stage: 0, highlight: ["runner", "gateway", "store"],
    detail: "Each attempt starts a new gateway and private store. The task is selected by task_id (wrong_way); the user's question is kept as written and is only ever read by a model inside a case." },
  { from: "gateway", to: "yolo", label: "one fresh tracking job", stage: 1, highlight: ["gateway", "yolo"],
    detail: "All 199 frames go to YOLO26s + ByteTrack once." },
  { from: "yolo", to: "gateway", label: "real boxes, tracker IDs, unmatched boxes", stage: 1, dashed: true, highlight: ["yolo", "gateway", "store"],
    detail: "Per frame: real boxes, class and a tentative tracker ID (T), or none. Kalman predictions are flagged as not observed. Stored unchanged." },
  { from: "gateway", to: "gateway", label: "group tracker IDs into vehicle records", stage: 2, highlight: ["gateway", "vehicles"],
    detail: "Unchanged from V5.0: IDs that are clearly one vehicle are joined into a record (V); unclear pairs stay apart and vote once together; boxes that fit no record stay ungrouped." },
  { from: "gateway", to: "gateway", label: "movement, one vote each, traffic rule → candidates", stage: 3, highlight: ["gateway", "rules"],
    detail: "Unchanged from V5.0: each record's stable direction is one vote; a phase 135° or more against what the others agree on makes a candidate." },
  { from: "gateway", to: "gemma", label: "host-chosen real frame: TARGET + 25% crop", stage: 4, highlight: ["gateway", "gemma"],
    detail: "For each candidate the host picks a frame with a real box, draws TARGET, cuts a padded crop and asks one factual colour question." },
  { from: "gemma", to: "gateway", label: "Body color + verbatim observation", stage: 4, dashed: true, highlight: ["gemma", "gateway", "store"],
    detail: "Stored verbatim with its source. The host parses exactly one Body color line; anything else is unknown." },
  { from: "gateway", to: "gateway", label: "case_proposals", stage: 5, highlight: ["gateway", "cases"],
    detail: "A case is proposed only where a doubt could change the answer and a new look could settle it. In the stability batch that happened on one clip: V6 and V8 might be one car, and two cars would make the count wrong by one." },
  { from: "gateway", to: "pi", label: "case card, five tools", stage: 5, highlight: ["gateway", "pi"],
    detail: "Pi starts with a fixed instruction and the case card as readable text: the question, the records involved, their movement and saved Gemma text." },
  { from: "pi", to: "pi", label: "Nemotron: history + schemas → one tool call", stage: 5, highlight: ["pi", "nemotron"],
    detail: "Each Nemotron call returns exactly one tool call. Thinking is off; in these runs Nemotron wrote no free text." },
  { from: "pi", to: "rv", label: "tool name + typed arguments", stage: 5, highlight: ["pi", "rv"],
    detail: "Every call is checked first: schema, references from this session, real frames, call and visual budgets." },
  { from: "rv", to: "gateway", label: "allowed operation (or a refusal back to Pi)", stage: 5, highlight: ["rv", "gateway"],
    detail: "A refused call costs a call and returns an error line. In the natural case 9 of 17 calls were refused." },
  { from: "gateway", to: "gemma", label: "this round's media, factual question", stage: 5, highlight: ["gateway", "gemma"],
    detail: "If the call asks for a new look, the host makes fresh media (TARGET boxes, crops) and asks Gemma one factual question: appearance, visibility or correspondence. At most two per case." },
  { from: "gemma", to: "gateway", label: "verbatim text", stage: 5, dashed: true, highlight: ["gemma", "gateway", "store"],
    detail: "Stored with its source like every other reply. Gemma can be wrong: in the natural case it called a tiny purple target a yellow vehicle." },
  { from: "gateway", to: "pi", label: "readable result, remaining budget", stage: 5, dashed: true, highlight: ["gateway", "pi"],
    detail: "Plain text back to the agent, with a fixed source header for Gemma text. Every delivered character is counted." },
  { from: "gateway", to: "gateway", label: "case result: typed finding + cited sources", stage: 5, highlight: ["gateway", "vehicles"],
    detail: "investigation_finish closes the case as resolved (same / different / a colour) or unresolved, citing observations (O) or saved evidence (E). Raw records are never rewritten." },
  { from: "gateway", to: "gateway", label: "assemble the answer; open cases kept apart", stage: 6, highlight: ["gateway", "assembler"],
    detail: "Targets, colours as written, frames. An unresolved case keeps count_complete false; it does not silently change the count." },
  { from: "gateway", to: "rv", label: "answer shape + real source intervals", stage: 7, highlight: ["gateway", "rv"],
    detail: "count = colours = targets, every reported frame a real observation, every colour a stored reply. Not traffic truth." },
  { from: "rv", to: "gateway", label: "valid, or an operation error", stage: 7, dashed: true, highlight: ["rv", "gateway"],
    detail: "All 69 V5.2 attempts ended host_finalized." },
  { from: "runner", to: "posthoc", label: "after the run: rebuild every record → private review", stage: 7, highlight: ["runner", "posthoc", "store"],
    detail: "The Post-hoc Verifier rebuilds grouping, rule, media, Gemma parsing, cases, requests and budgets, and the answer. 69/69 passed: the records are intact, not the answers right." },
];

export const SEQ_FRAMES: SeqFrame[] = [
  { first: 5, last: 6, kind: "loop", label: "each candidate · 12 Gemma calls per attempt, shared" },
  { first: 8, last: 15, kind: "opt", label: "a case was proposed · ≤ 4 per attempt, one at a time" },
  { first: 9, last: 14, kind: "loop", label: "bounded investigation · ≤ 20 Nemotron calls" },
  { first: 12, last: 13, kind: "opt", label: "a new look is useful · ≤ 2 per case" },
];

/** a012 (clip 2-challenging-r2), values from the actual run */
export const FLOW: FlowStage[] = [
  { lane: "host", name: "Video + task", what: "199 source frames, 960×540, 10 fps, bound by SHA-256; task_id wrong_way and question Q1 as written.", payload: "frames 0–198 · Q1" },
  { lane: "model", name: "Detect + associate", what: "YOLO26s boxes in every frame; ByteTrack links them into tentative IDs.", payload: "17 tracker IDs · 153 unmatched boxes" },
  { lane: "host", name: "Group", what: "Join IDs that are clearly one vehicle; attach unmatched boxes only under the same rule.", payload: "15 vehicle records · 40 boxes attached · 113 ungrouped" },
  { lane: "host", name: "Movement + votes", what: "Phases per record; one stable-direction vote per comparison unit.", payload: "11 votes · V6≈V8 vote once" },
  { lane: "host", name: "Traffic rule", what: "Flow of the others; any phase 135° or more against it makes a candidate.", payload: "V3, and V6/V8 counted once · V14 unresolved" },
  { lane: "model", name: "Gemma colour checks", what: "One factual body-colour question per candidate.", payload: "V3 → T3 @ 42: “Green and white” · V8 → T8 @ 83: “white”" },
  { lane: "host", name: "Case proposal", what: "A doubt that could change the count and a look that could settle it.", payload: "C1 identity: V6 vs V8" },
  { lane: "agent", name: "Pi + Nemotron", what: "Readable case card, five tools, every call checked by the Runtime Verifier.", payload: "17 calls · 9 refused · 2 visibility checks" },
  { lane: "model", name: "Gemma, on Pi's request", what: "Fresh media from real frames; visibility question.", payload: "T7 @ 60, 62: “a small, yellow vehicle” · T8 @ 73–83: purple" },
  { lane: "agent", name: "Case result", what: "investigation_finish with outcome and cited observations.", payload: "C1 unresolved" },
  { lane: "host", name: "Assemble", what: "Targets, colours as written, frames; open case and ungrouped boxes keep it incomplete.", payload: "{ 2, [Green and white, white], count_complete: false }" },
  { lane: "after", name: "Verifiers", what: "Runtime: shape and sources, live. Post-hoc: rebuilds every step. Integrity only.", payload: "pass · pass" },
  { lane: "after", name: "Study scorer + review", what: "Against ground truth the system never saw.", payload: "count ✓ · second colour under-described · complete ✗" },
];

/** V4.2 report vs V5.0 report (same six clips; V5.2's compatibility replay
 *  reproduced V5.0's six answers) and the V5.2 stability report (12 clips x 4).
 *  A description of designs, not a causal experiment. */
export const VERSUS: { row: string; v42: string; v5six: string; v52: string }[] = [
  { row: "Who decides which vehicle is wrong-way", v42: "Nemotron, by comparing track facts it reads as text", v5six: "A fixed host rule over vehicle records", v52: "The same fixed rule" },
  { row: "Who writes the answer", v42: "Nemotron, through evidence_submit", v5six: "The host assembler", v52: "The host assembler" },
  { row: "What Nemotron does", v42: "Every step: 98 calls over six clips", v5six: "Investigation cases only: 0 calls (no case arose)", v52: "Cases only: 4 natural cases in 48 attempts, 68 calls, all unresolved" },
  { row: "Right count", v42: "3/6", v5six: "6/6", v52: "48/48" },
  { row: "Colours supported by the frames", v42: "1/6", v5six: "6/6", v52: "48/48 (8 only “white”)" },
  { row: "Exact colour strings", v42: "–", v5six: "4/6", v52: "28/48" },
  { row: "count_complete", v42: "0/6 complete", v5six: "0/6", v52: "8/48 true (the two empty r2 scenes)" },
  { row: "Typical failure", v42: "direction words written as colours; normal cars counted", v5six: "ungrouped boxes keep every count incomplete", v52: "the same, plus agent cases that end unresolved" },
];

export const CHANGES: { version: string; what: string; result: string }[] = [
  { version: "Earlier site (archived ISR agent)", what: "The agent sampled frames itself and asked a vision model what it saw. No detector, no tracker.", result: "Engineering runs only; no measured result." },
  { version: "V4.0", what: "YOLO26s + ByteTrack added. Full trajectories rendered as text for the agent.", result: "5/6 submitted, 1 main answer right." },
  { version: "V4.1", what: "Runtime Verifier as one component. Host-computed movement. Track-targeted Gemma crops.", result: "2/6 submitted." },
  { version: "V4.2", what: "Movement-first track facts, fixed source header, free-text colours. Nemotron still decides and answers.", result: "6/6 accepted, 3/6 right count, 1/6 supported, 0/6 complete. Not promoted." },
  { version: "V5.0", what: "Program-first: host grouping, a fixed traffic rule, host-chosen Gemma colour checks and a host-assembled answer. Pi + Nemotron only for investigation cases.", result: "6/6 right count, 6/6 supported, 4/6 exact colour strings, 0/6 complete, 0 Nemotron calls. Not promoted." },
  { version: "V5.1", what: "Readable case cards and saved vision evidence for the agent; thinking on/off compared on six saved-state cases.", result: "Controlled diagnostic only: off 3/5, on 3/5 cases right, below the 4/5 bar. Not promoted." },
  { version: "V5.2", what: "Same main pipeline. Explicit task_id and the question as written, program-proposed cases, one typed finding per case, and root-only diagnostic controllers to compare none / fixed / Pi.", result: "48/48 right count over 12 clips × 4; 28/48 exact colour strings; 8/48 complete. Pi right in 1/6 diagnostic cases; no gain over a fixed check. Not promoted." },
];
