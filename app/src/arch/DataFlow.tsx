// What each stage hands to the next, with the actual values of one run as payloads.

import type { FlowStage } from "./types";

const LANE: Record<string, string> = {
  host: "trusted host",
  model: "model service",
  agent: "agent",
  after: "after the run",
};

export default function DataFlow({ flow }: { flow: FlowStage[] }) {
  const lanes = Object.entries(LANE).filter(([k]) => flow.some((s) => s.lane === k));
  return (
    <div className="flow">
      <div className="flowlegend">
        {lanes.map(([k, v]) => <span key={k} className={`lanetag ln-${k}`}>{v}</span>)}
      </div>
      <ol>
        {flow.map((s, i) => (
          <li key={i} className={`fstage ln-${s.lane}${s.lane === "after" && flow[i - 1]?.lane !== "after" ? " split" : ""}`}>
            <div className="fcard">
              <span className={`lanetag ln-${s.lane}`}>{LANE[s.lane]}</span>
              <b>{s.name}</b>
              <p>{s.what}</p>
            </div>
            <code className="fpay">{s.payload}</code>
          </li>
        ))}
      </ol>
    </div>
  );
}
