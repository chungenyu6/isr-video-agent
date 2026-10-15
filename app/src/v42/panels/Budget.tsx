// Host-enforced budgets. The Runtime Verifier refuses a call that would exceed them.

import type { Loaded } from "../types";
import { budgetAt } from "../data";

function Gauge({ label, used, limit, unit = "" }: { label: string; used: number; limit: number; unit?: string }) {
  const pct = Math.min(100, (100 * used) / limit);
  return (
    <div className="gauge">
      <div className="gauge-lab"><span>{label}</span><span>{used}{unit} / {limit}{unit}</span></div>
      <div className="bar-bg"><div className={`bar-fg${used >= limit ? " full" : ""}`} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

export default function Budget({ bundle, t }: { bundle: Loaded; t: number }) {
  const b = budgetAt(bundle, t);
  const rt = bundle.runtime;
  return (
    <div>
      <Gauge label="Nemotron calls" used={b.main} limit={Number(rt.model_calls)} />
      <Gauge label="Gemma calls" used={b.gemma} limit={Number(rt.visual_calls)} />
      <Gauge label="tool text delivered" used={b.text} limit={Number(rt.tool_text_total)} unit=" ch" />
      <p className="fine">
        Tracking runs once per attempt ({bundle.run.tracking_latency_sec.toFixed(1)} s for {bundle.video.nb_frames} frames)
        and does not count against these. One inspection covers at most {rt.max_inspect_seconds} s and{" "}
        {rt.inspect_source_frame_cap} source frames. Four Nemotron calls are reserved for answering.
      </p>
    </div>
  );
}
