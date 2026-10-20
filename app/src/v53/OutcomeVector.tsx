// Property Evaluator v2: the run's outcome vector Y. 22 yes/no fields in seven
// layers that follow the pipeline (L0 submission ... L6 final answer). Reading
// it top to bottom shows where a failure entered and how it travelled: in V5.3
// 2-challenging-r2, L1-L3 are clean, L4 (Gemma's wrong identity reading) and L5
// (the agent adopting it) light up, then L6 (one extra vehicle reported).
// Computed after the run against ground truth; never visible to the system.

const LAYERS: [string, string, string][] = [
  ["L0", "Execution", "an answer, in the right shape"],
  ["L1", "Perception coverage", "every true target detected and tracked"],
  ["L2", "Grouping", "the program's records and counting units"],
  ["L3", "Rule & selection", "the traffic rule, and Gemma sent to look"],
  ["L4", "Observation (Gemma)", "what Gemma said, against the labels"],
  ["L5", "Evidence & decision", "cited evidence, and what the agent adopted"],
  ["L6", "Final answer", "the answer against ground truth"],
];
/** Recorded for information: the program keeping two records for one car is a design choice, not an error. */
const INFO = new Set(["L2.target_fragmented"]);

export interface V2 {
  fields: string[];
  Y: number[];
  counts?: Record<string, number>;
  identity_readings?: { observation_ref: string; reading: string; truth: string }[];
}

export default function OutcomeVector({ v2, compact = false }: { v2: V2; compact?: boolean }) {
  const y = new Map(v2.fields.map((f, i) => [f, v2.Y[i]]));
  const fails = v2.fields.filter((f) => y.get(f) === 1 && !INFO.has(f));
  return (
    <div className={`ovec${compact ? " compact" : ""}`}>
      <div className="ov-head">
        <span className="eyebrow">Property Evaluator v2 · where it failed, layer by layer</span>
        <span className={`pill ${fails.length ? "st-fail" : "st-pass"}`}>{fails.length ? `${fails.length} of 21 failure fields` : "no failure field"}</span>
      </div>
      <ol className="ov-layers">
        {LAYERS.map(([id, name, what]) => {
          const fs = v2.fields.filter((f) => f.startsWith(id + "."));
          const bad = fs.some((f) => y.get(f) === 1 && !INFO.has(f));
          return (
            <li key={id} className={bad ? "bad" : ""}>
              <span className="ov-id">{id}</span>
              <span className="ov-name"><b>{name}</b>{!compact && <span className="dim"> · {what}</span>}</span>
              <span className="ov-fields">
                {fs.map((f) => {
                  const k = f.split(".", 2)[1];
                  const on = y.get(f) === 1;
                  const n = v2.counts?.[k];
                  return (
                    <span key={f} className={`ov-f${on ? (INFO.has(f) ? " info" : " on") : ""}`}
                          title={`${f} = ${y.get(f)}${n !== undefined ? ` (count ${n})` : ""}${INFO.has(f) ? " · for information" : ""}`}>
                      {k}{on && n !== undefined && n > 1 ? ` ×${n}` : ""}
                    </span>
                  );
                })}
              </span>
            </li>
          );
        })}
      </ol>
      {!compact && v2.identity_readings && v2.identity_readings.length > 0 && (
        <p className="vnote">
          Identity readings of Gemma's compare replies: {v2.identity_readings.map((r) => `${r.reading} (truth: ${r.truth})`).join("; ")}.
        </p>
      )}
      {!compact && (
        <p className="vnote">
          Each field is 1 when it happened at least once in the run. Layers follow the pipeline, so the first lit layer is
          where the failure entered. A grouping change made after the agent's decision counts in L5, not L2. Geometric
          matches and text readings are rules, not proof of physical identity.
        </p>
      )}
    </div>
  );
}
