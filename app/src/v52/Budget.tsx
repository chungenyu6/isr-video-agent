// What the run spent against its caps, and the investigation branch that did
// not start. Nemotron is configured for investigation cases only.

import type { Loaded50 } from "./types";

function Gauge({ label, used, limit, unit = "" }: { label: string; used: number; limit: number; unit?: string }) {
  const pct = Math.min(100, (100 * used) / limit);
  return (
    <div className="gauge">
      <div className="gauge-lab"><span>{label}</span><span>{used}{unit} / {limit}{unit}</span></div>
      <div className="bar-bg"><div className={`bar-fg${used >= limit ? " full" : ""}`} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

export default function Budget({ bundle, stage }: { bundle: Loaded50; stage: number }) {
  const b = bundle.budget;
  const inv = bundle.task.investigation;
  const rt = bundle.runtime;
  return (
    <div>
      <Gauge label="Nemotron calls" used={b.nemotron.used} limit={b.nemotron.limit} />
      <Gauge label="Gemma calls" used={stage >= 4 ? b.gemma.used : 0} limit={b.gemma.limit} />
      <Gauge label="tool text delivered to an agent" used={b.tool_text.limit - b.tool_text.remaining} limit={b.tool_text.limit} unit=" ch" />
      <div className="invest">
        <span className="eyebrow">Investigation branch · {inv.used ? "started" : "not triggered"}</span>
        <p>
          When a doubt could change the answer and a new look could settle it (which vehicles are one car, which lanes
          are one road, an unreadable colour), the host opens a case and starts Pi with Nemotron: up to {rt.case_limit} cases,
          {" "}{rt.case_visual_limit} new Gemma calls each. Nemotron closes a case; it never writes the count. None of the six
          runs opened a case, so this branch is implemented but <b>not exercised live</b>.
        </p>
        <details className="rawtext">
          <summary>the five tools it would get (configured, unused)</summary>
          <ul className="toollist">
            {Object.entries(inv.tools).map(([k, v]) => <li key={k}><code>{k}</code> {v}</li>)}
          </ul>
        </details>
      </div>
    </div>
  );
}
