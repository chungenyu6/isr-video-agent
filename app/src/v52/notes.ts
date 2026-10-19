// V5.2 casenotes, keyed by clip (the run bundles) or scenario (the diagnostic
// replays). Sources: the study's V5.2 stability and investigation-value reports
// (sections 2-4) and the bundles themselves. Every number here is in one of them.

export interface Note { title: string; note: string }

export const RUN_NOTES_V52: Record<string, Note> = {
  "0-nominal-r1": {
    title: "Zero, but not claimed complete",
    note: "No wrong-way car. The rule found no candidate, so Gemma was never called. 103 boxes belong to no vehicle record, so the host answers 0 without claiming the count is certain. Four repeats, same answer.",
  },
  "0-nominal-r2": {
    title: "Zero, and complete",
    note: "No wrong-way car. Every box belongs to a vehicle record and nothing is unresolved, so count_complete is true. Only the two r2 empty scenes reach that: 8 of the 48 attempts.",
  },
  "0-challenging-r1": {
    title: "Zero, but not claimed complete",
    note: "No wrong-way car in degraded imagery. No candidate, no Gemma call. 117 ungrouped boxes keep count_complete false.",
  },
  "0-challenging-r2": {
    title: "Zero, and complete",
    note: "No wrong-way car; nothing left unexplained, so count_complete is true. Four repeats, same answer.",
  },
  "1-nominal-r1": {
    title: "One car, joined from two tracker IDs",
    note: "The purple wrong-way car was split into T1 and T3; the host joined them into V1 and the rule put it against the flow. Gemma, shown frame 43: “purple”. Same answer as V5.0 on this clip, four times out of four.",
  },
  "1-nominal-r2": {
    title: "One car, two-tone colour",
    note: "Gemma described the target as “purple and white”. The frames show a purple car with a white roof; the Property Evaluator's exact-string check wants “purple”. Gemma's full text varied between repeats (white roof and hood, or roof and mirrors) while the Body color line stayed the same.",
  },
  "1-challenging-r1": {
    title: "Found despite degraded imagery",
    note: "V4 found and called “purple”. V8, a short fragment that barely moves, stays unresolved: not counted and not silently dropped.",
  },
  "1-challenging-r2": {
    title: "Right car, under-described colour",
    note: "The right vehicle, in all four repeats. Gemma said only “white”: the body is white, but the visible purple lower part is left out. Counted as frame-supported, flagged as under-described, and not quietly corrected to purple.",
  },
  "2-nominal-r1": {
    title: "Two cars; one colour string differs",
    note: "Both wrong-way cars found. Gemma called the first “light purple”: a shade of the right colour on the right car, but not the Property Evaluator's exact string. V7 has no box at frame 85, so its frames are reported in pieces rather than filled in.",
  },
  "2-nominal-r2": {
    title: "Two cars, two-tone colours",
    note: "A green and a purple car against traffic. V7 joins T7 and T8. Gemma: “Green and white” and “White and purple”; both match the frames (white roofs), neither matches the exact strings.",
  },
  "2-challenging-r1": {
    title: "Two purple cars, kept apart",
    note: "Both found, each with its own source frames: V6 joins T6 and T9 across a short gap. Two “purple” answers are two cars, not one car counted twice.",
  },
  "2-challenging-r2": {
    title: "Featured: the only clip where the program called the agent",
    note: "The count is right: V3 (“Green and white”) and V8 (“white”, under-described: the car is white and purple). V6 also moves against the flow and might be the same car as V8: the host counts the two once and opened identity case C1, because “different” would make the count 3. Pi started. Nemotron made 17 calls: it read the case, listed detections, checked T7 and T8 separately for visibility instead of comparing them, then kept asking for more. The Runtime Verifier refused 9 calls: two unknown references, six image requests past the case's budget or already answered, one malformed finish. It closed the case unresolved. Gemma called the tiny T7 a yellow vehicle. The host's answer did not change; the open case keeps it incomplete. All four repeats opened the same case, made 17 calls and ended unresolved.",
  },
};

export const DIAG_NOTES_V52: Record<string, Note> = {
  B2: {
    title: "A better view existed; Pi did not ask for a colour",
    note: "Saved state from clip 2-nominal-r2: the second car's colour is unknown after a first, unclear look. The fixed check asked Gemma about frame 85 once and got “White and purple”. Pi ran two visibility checks on T7 and T8 instead of an appearance check, so the colour stayed unknown and the case unresolved: 8 Nemotron calls, 2 Gemma calls.",
  },
  B4: {
    title: "Pi had it right, then could not cite it",
    note: "Saved state from clip 2-nominal-r1, with an assigned case: are T7 and T9 one car? Frame 71 shows both at once, so they are different; the fixed check read that from the saved detections with no new Gemma call. Pi listed detections twice and tried to finish with “different”, but cited only T7's observations. The Runtime Verifier refused it: identity citations must cover both sightings. Pi then closed the case unresolved. 12 Nemotron calls.",
  },
  B7: {
    title: "Gemma misread a small target; Pi adopted it",
    note: "Saved state from clip 1-nominal-r1, with the T1/T3 join held back so the program opens an identity case. T1 is a small, partly visible purple car at the top edge. Gemma, shown T1 with its TARGET box, said “a yellow bus” (the bus elsewhere in the frame was not boxed). Pi read that against T3's “purple car” and closed the case as different: legal, cited, and wrong. The count stayed 1. The fixed compare made the same Gemma error but did not adopt it.",
  },
};
