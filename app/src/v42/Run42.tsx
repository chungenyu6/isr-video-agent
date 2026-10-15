// The V4.2 replay: one run clock (agent wall time) drives every panel. Opens at
// the END of the run so the answer and the full tracking picture are on screen
// first; the transport replays it from 0.

import { useEffect } from "react";
import type { Loaded, Oracle } from "../types";
import { runDuration } from "../data";
import { useClock } from "../clock";
import RunView from "./panels/RunView";

export default function Run42({ bundle, oracle, startT }: { bundle: Loaded; oracle: Oracle; startT: number | null }) {
  const duration = runDuration(bundle);
  const clock = useClock(duration);
  useEffect(() => {
    if (duration > 0) clock.seek(startT ?? duration);
    // clock.seek is recreated when duration changes; this should fire once per run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundle._dir, duration, startT]);
  return <RunView bundle={bundle} oracle={oracle} clock={clock} />;
}
