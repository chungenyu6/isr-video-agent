// What the run spent against its caps, revealed by stage. Nemotron is used only
// inside investigation cases.

import type { Loaded52 } from "./types";
import { gemmaUsedAt, STAGE } from "./derive";

function Gauge({ label, used, limit, unit = "" }: { label: string; used: number; limit: number; unit?: string }) {
  const pct = Math.min(100, (100 * used) / limit);
  return (
    <div className="gauge">
      <div className="gauge-lab"><span>{label}</span><span>{used}{unit} / {limit}{unit}</span></div>
      <div className="bar-bg"><div className={`bar-fg${used >= limit ? " full" : ""}`} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

export default function Budget({ bundle, stage }: { bundle: Loaded52; stage: number }) {
  const b = bundle.budget;
  const inv = bundle.task.investigation;
  const rt = bundle.runtime;
  return (
    <div>
      <Gauge label="Nemotron calls" used={stage >= STAGE.investigate ? b.nemotron.used : 0} limit={b.nemotron.limit} />
      <Gauge label="Gemma calls" used={gemmaUsedAt(bundle, stage)} limit={b.gemma.limit} />
      <Gauge label="tool text delivered to the agent" used={stage >= STAGE.investigate ? b.tool_text.limit - b.tool_text.remaining : 0} limit={b.tool_text.limit} unit=" ch" />
      <div className="invest">
        <span className="eyebrow">Investigation branch · {inv.used ? "started in this run" : "not started in this run"}</span>
        <p>
          When a doubt could change the answer and a new look could settle it (which records are one car, an unreadable
          colour), the program opens a case and starts Pi with Nemotron: up to {String(rt.case_limit)} cases,
          {" "}{String(rt.case_visual_limit)} new Gemma calls each. Nemotron closes a case; it never writes the count.
          {" "}{inv.used
            ? "Every call it made, and every refusal, is in the Investigate panel."
            : "In the stability batch this happened in 4 of 48 attempts, all on one clip."}
        </p>
        <details className="rawtext">
          <summary>the five tools {inv.used ? "it had" : "it would get"}</summary>
          <ul className="toollist">
            {Object.entries(inv.tools).map(([k, v]) => <li key={k}><code>{k}</code> {v}</li>)}
          </ul>
        </details>
      </div>
    </div>
  );
}
