// The answer and the three things that looked at it, kept apart on purpose:
// the Runtime Verifier (live, shape and resources only), the Post-hoc Verifier
// (after the run, record integrity only) and the study's Property Evaluator (after the run,
// against ground truth). Neither verifier judges traffic truth.

import type { Loaded } from "../../types";
import { submitted } from "../../data";

const Mark = ({ ok }: { ok: boolean }) => <span className={`pill ${ok ? "st-pass" : "st-fail"}`}>{ok ? "yes" : "no"}</span>;

export default function Verdict({ bundle, t }: { bundle: Loaded; t: number }) {
  const done = submitted(bundle, t);
  const s = bundle.submission;
  const rv = bundle.runtime_verifier;
  const ph = bundle.posthoc_verifier;
  const sc = bundle.scorer;
  const rw = bundle.review;
  const expected = Object.entries(sc.expected_color_multiset).flatMap(([c, n]) => Array(n).fill(c) as string[]);

  if (!done) {
    return (
      <div className="verdict">
        <h3 className="ph">Answer</h3>
        <p className="pending">
          No answer yet. evidence_submit returns at run t+{bundle.steps[s.step].t_result.toFixed(1)}s.
        </p>
      </div>
    );
  }
  return (
    <div className="verdict">
      <h3 className="ph">Answer the agent submitted</h3>
      <div className="answer">
        <div className="big">{s.reported_count ?? "–"}</div>
        <div>
          <div className="colors">{s.colors.map((c, i) => <span key={i} className="colorchip">{c}</span>)}</div>
          <div className="mono dim">count_complete = {String(s.count_complete)} · decision = {s.decision}</div>
        </div>
      </div>

      <div className="vboxes">
        <div className={`vbox ${rv.rejected_calls === 0 && rv.submission_accepted ? "pass" : "fail"}`}>
          <span className="eyebrow">Runtime Verifier · live</span>
          <div className="vline">{rv.tool_calls - rv.rejected_calls}/{rv.tool_calls} tool calls allowed</div>
          <div className="vline">answer shape {rv.submission_accepted ? "accepted" : "rejected"}</div>
          <p className="vnote">Checks schema, session, frames, call budget and answer shape while the agent runs, and can refuse a call. No formal proof is required in V4.2.</p>
        </div>
        <div className={`vbox ${ph.status === "pass" ? "pass" : "fail"}`}>
          <span className="eyebrow">Post-hoc Verifier · after the run</span>
          <div className="vline">integrity {ph.status}{ph.issues.length ? ` · ${ph.issues.length} issues` : ""}</div>
          <div className="vline">semantic correctness: {ph.semantic_correctness.replace("_", " ")}</div>
          <p className="vnote">Rebuilds motion, requests, media, headers and budgets from the records. A pass means the record is intact, not that the answer is right.</p>
        </div>
      </div>

      <div className="vbox scorer">
        <span className="eyebrow">Property Evaluator · automatic, ground truth, after the run</span>
        <div className="truthline">
          truth: <b>{sc.wrong_way_count}</b> wrong-way vehicle{sc.wrong_way_count === 1 ? "" : "s"}
          {expected.length > 0 && <> ({expected.join(", ")})</>}
        </div>
        <div className="scoregrid">
          <span>count right</span><Mark ok={sc.count_numeric_match} />
          <span>colours right</span><Mark ok={sc.color_multiset_correct} />
          <span>count and colours supported by the frames</span><Mark ok={rw.goal_correct} />
          <span>complete answer</span><Mark ok={sc.complete_count_correct} />
        </div>
        <p className="vnote">
          Frame review: {rw.semantic_color_support}; identity {rw.final_item_identity}. This is a coding-agent review of
          sources and images, not an independent blind evaluation. Nothing on this card was visible to the agent.
        </p>
      </div>
    </div>
  );
}
