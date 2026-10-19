// V5.3 casenotes, keyed by clip (the run bundles) or scenario (the diagnostic
// replays). Sources: the study's V5.3 results report, the V5.2 reports for the 44
// attempts whose answers did not change, and the bundles themselves.

export interface Note { title: string; note: string }

export const RUN_NOTES_V53: Record<string, Note> = {
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
    note: "Gemma described the target as “purple and white”. The frames show a purple car with a white roof; the Property Evaluator's exact-string check wants “purple”. In V5.2 Gemma's full text varied between repeats with the same Body color line; in V5.3 all four replies were identical.",
  },
  "1-challenging-r1": {
    title: "Found despite degraded imagery",
    note: "V4 found and called “purple”. V8, a short fragment that barely moves, stays unresolved: not counted and not silently dropped.",
  },
  "1-challenging-r2": {
    title: "Right car, under-described colour",
    note: "The right vehicle, in all four repeats. Gemma said only “white”: the body is white, but the visible purple lower part is left out. The colour words do not match the label, and the answer is not quietly corrected to purple.",
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
    title: "Featured: the agent followed its new first step, and the count went wrong",
    note: "Two wrong-way cars: V3 (“Green and white”) and one purple car with a white top that the tracker split into V6 and V8. The host counts V6 and V8 once, as a possible single car, and opens identity case C1. V5.3's case card suggests compare_windows, and Pi does exactly that. Gemma, shown the distant V6 and the nearer V8, says they “appear to be different vehicles”, calling the tiny purple car “a small, dark shape”. Pi finishes C1 as different. The host now counts three cars, and opens C2 for V6's unknown colour. Pi answers in text instead of working on C2, the host sends one continuation prompt, and C2 stays open. Answer: 3 (truth 2). The same happened in all four repeats; V5.2's Pi, which only ran visibility checks and left C1 unresolved, kept the count right.",
  },
};

export const DIAG_NOTES_V53: Record<string, Note> = {
  B2: {
    title: "A better view existed, and Pi now asked for it",
    note: "Saved state from clip 2-nominal-r2: the second car's colour is unknown after a first, unclear look. Following the card's appearance hint, Pi asked Gemma for an appearance check on V7, then again with selection next_best, and got “White and purple” both times. It finished the case citing them: right, at cap 2 and at cap 4. V5.2's Pi had run visibility checks instead and left the colour unknown. The fixed check reached the same colour with one call.",
  },
  B4: {
    title: "Right finding, mixed evidence",
    note: "Saved state from clip 2-nominal-r1, with an assigned case: are T7 and T9 one car? Frame 71 shows both at once, so they are different. Pi listed detections, compared T7 and T9, checked T7's colour, was refused a third Gemma call (cap 2) and finished different, citing both sides: right. In the compare, Gemma called T9 “a yellow vehicle”, while an earlier V5.2 look saw a purple car; the finding is right, the visual evidence behind it is not clean. The fixed check got there from the saved detections alone, with no Gemma call.",
  },
  B7: {
    title: "Gemma misread a small target, and Pi still adopted it",
    note: "Saved state from clip 1-nominal-r1, with the T1/T3 join held back so the program opens an identity case. T1 is a small, partly visible purple car at the top edge. Pi followed the suggested compare. Gemma described both segments as “a yellow bus” and said they correspond; an appearance check saw T3 as a purple car. Faced with that conflict Pi finished different, where the instructions ask for unresolved: wrong at both caps, as it was in V5.2. The count stayed 1. The fixed compare met the same misreading and did not adopt it.",
  },
};
