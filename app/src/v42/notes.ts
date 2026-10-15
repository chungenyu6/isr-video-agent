// V4.2 casenotes, from the study's resumed V4.2 report (sections 3-5).

/** Honest one-paragraph reading of each attempt, from the study's delivered report. */
export const RUN_NOTES_V42: Record<string, { title: string; note: string }> = {
  a001: {
    title: "False report, no visual check",
    note: "This clip has no wrong-way car. The agent re-read thirteen track summaries, never asked Gemma to look, and reported seven vehicles with unknown colours.",
  },
  a002: {
    title: "Best of the six attempts: a source-backed partial success",
    note: "T3 is the only track the host measured moving downward. The agent asked Gemma to check its appearance, got “purple car”, inspected one normal vehicle (T4, yellow) and left it out, and reported 1 purple vehicle. Count, colour and the vehicle's identity are supported by the frames. It still marked the count as possibly incomplete, so this is not a complete answer.",
  },
  a003: {
    title: "Count matches, colours are not colours",
    note: "Two purple cars travel against traffic here. The agent reported 2, but never called Gemma and wrote direction words (“upward”, “downward”) in the colour field; the scorer counts them as wrong colours and neither vehicle is identified.",
  },
  a004: {
    title: "False report, no visual check",
    note: "This clip has no wrong-way car. The agent reported three vehicles with unknown colours without any visual check.",
  },
  a005: {
    title: "One real find mixed with two unsupported ones",
    note: "One purple car travels against traffic. The agent ran eight appearance checks and reported 3 (purple, purple, pink). The purple car T4 is correctly supported. For T8, Gemma described a large purple car although the boxed target was a small vehicle at the top edge; the pink car T14 moves with traffic.",
  },
  a006: {
    title: "Count matches, colours are not colours",
    note: "A green and a purple car travel against traffic. The agent reported 2, but with direction words in the colour field and no visual check.",
  },
};
