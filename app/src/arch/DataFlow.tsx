// What each stage hands to the next, with the actual a002 values as payloads.

import { FLOW } from "./content";

const LANE: Record<string, string> = {
  host: "trusted host",
  model: "model service",
  agent: "agent",
  after: "after the run",
};

export default function DataFlow() {
  return (
    <div className="flow">
      <div className="flowlegend">
        {Object.entries(LANE).map(([k, v]) => <span key={k} className={`lanetag ln-${k}`}>{v}</span>)}
      </div>
      <ol>
        {FLOW.map((s, i) => (
          <li key={i} className={`fstage ln-${s.lane}${s.lane === "after" && FLOW[i - 1]?.lane !== "after" ? " split" : ""}`}>
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
