// The same clip, four times: both wordings of the question (Q1, Q2) in two passes
// run in opposite order. Fresh tracking job, store and session each time. What
// stayed the same, and Gemma's words where they changed.

import type { Loaded52 } from "./types";

export default function Stability({ bundle }: { bundle: Loaded52 }) {
  const st = bundle.stability;
  if (!st) return null;
  const texts = new Map<string, string[]>();
  for (const a of st.attempts) {
    a.gemma_texts.forEach((t, k) => {
      const key = `${k}`;
      texts.set(key, [...(texts.get(key) ?? []), t]);
    });
  }
  const varied = [...texts.entries()].filter(([, v]) => new Set(v).size > 1);
  const queries = new Map(st.attempts.map((a) => [a.query_id ?? "", a.query_text ?? ""]));
  const Flag = ({ ok, label }: { ok: boolean; label: string }) => (
    <span className={`pill ${ok ? "st-pass" : "st-warn"}`}>{label}: {ok ? "identical" : "varied"}</span>
  );
  return (
    <div className="stability">
      <div className="flags">
        <Flag ok={st.identical_tracking} label="tracking (job id aside)" />
        <Flag ok={st.identical_answers} label="answer" />
        <Flag ok={st.identical_targets} label="targets and frames" />
        <Flag ok={st.identical_gemma_text} label="Gemma's full text" />
      </div>
      <div className="tablewrap">
        <table className="stab">
          <thead>
            <tr><th>attempt</th><th>pass</th><th>question</th><th>answer</th><th>complete</th><th>Pi</th><th>Nemotron</th><th>Gemma</th><th>wall</th></tr>
          </thead>
          <tbody>
            {st.attempts.map((a) => (
              <tr key={a.attempt} className={a.attempt === bundle.attempt ? "cur" : undefined}>
                <td className="mono">{a.attempt}{a.attempt === bundle.attempt ? " (shown)" : ""}</td>
                <td>{a.pass}</td>
                <td>{a.query_id}</td>
                <td>{a.submission.reported_count ?? "–"}{a.submission.colors.length ? `: ${a.submission.colors.join(", ")}` : ""}</td>
                <td>{String(a.submission.count_complete)}</td>
                <td>{a.pi_started ? `yes · ${a.cases.map((c) => `${c.case_ref} ${c.status}`).join(", ")}` : "no"}</td>
                <td>{a.nemotron}</td>
                <td>{a.gemma}</td>
                <td>{a.wall_sec.toFixed(1)} s</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className="queries">
        {[...queries.entries()].map(([q, t]) => (
          <div key={q}><dt>{q}</dt><dd>“{t}”</dd></div>
        ))}
      </dl>
      <p className="fine">
        {st.attempts.some((a) => (a.query_delivered_to ?? []).length > 0)
          ? <>The question reached Nemotron only through the investigation case (context_get). With no case, no model reads it: the host runs the wrong-way task it was given by task_id.</>
          : <>No attempt started Pi, so neither wording reached any model: the host runs the wrong-way task selected by task_id. Equal answers here show the pipeline is repeatable, not that a model understood both questions.</>}
      </p>
      {varied.length > 0 && (
        <details className="rawtext">
          <summary>Gemma's text varied with the same images and seed ({varied.length} call{varied.length === 1 ? "" : "s"})</summary>
          {varied.map(([k, v]) => (
            <div key={k} className="variants">
              {[...new Set(v)].map((t, j) => (
                <blockquote key={j}><span className="mono dim">{v.filter((x) => x === t).length}× </span>{t}</blockquote>
              ))}
            </div>
          ))}
        </details>
      )}
    </div>
  );
}
