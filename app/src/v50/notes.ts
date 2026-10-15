// V5.0 casenotes, from the study's V5.0 six-video report (sections 3 and 5) and
// its coding-agent source review. Every number here is in that report.

export const RUN_NOTES_V50: Record<string, { title: string; note: string }> = {
  a001: {
    title: "Zero, but not claimed complete",
    note: "This clip has no wrong-way car. The traffic rule found no vehicle moving against the others, so Gemma was never called. The answer is 0 with count_complete = false: 103 detections were never assigned to any vehicle record, so the host does not claim the total is certainly zero.",
  },
  a002: {
    title: "Featured: one wrong-way car, joined from two tracker IDs",
    note: "One purple car drives against traffic. The tracker split it into T1 and T3; the host joined them into one vehicle record, V1. The rule found V1 moving opposite to all 12 other comparison units. The host showed Gemma frame 43 and Gemma said “purple”. Answer: 1 purple vehicle, frames 14–44. The tracker also split a normal purple car into T8 and T9; the host joined them as V8 and did not count it. 82 ungrouped detections keep the count marked incomplete.",
  },
  a003: {
    title: "Both found; one colour string differs",
    note: "Two purple cars drive against traffic, one after the other. Both were found (V2, V7). Gemma called the first “light purple”. The frames support that, but the exact-string scorer does not count it as purple. V7 has no detection at frame 85, so its interval is reported in pieces rather than filled in.",
  },
  a004: {
    title: "Zero, but not claimed complete",
    note: "This clip has no wrong-way car. No candidate was found and Gemma was never called. 117 ungrouped detections remain, so the count is reported as 0 and not claimed complete.",
  },
  a005: {
    title: "Found despite degraded imagery",
    note: "A challenging clip with one purple wrong-way car. V4 was found and Gemma said “purple”. Its interval, frames 24–45, misses the start of the event (from frame 8): only 22 of 39 frames are covered. V8 is a four-point fragment that moves too little to have a direction. It stays unresolved: it is not counted and not silently dropped.",
  },
  a006: {
    title: "Both found; two-tone colours",
    note: "A green and a purple car drive against traffic. Both were found; V7 joins tracker IDs T7 and T8. Gemma described them as “Green and white” and “White and purple”. The frames support both (white roofs), but the exact-string scorer does not match them. A normal green car and a normal pink/purple car on the same road were not counted.",
  },
};
