// The host's answer and the four things that looked at it, kept apart on purpose:
// the Runtime Verifier (live, shape and sources), the Post-hoc Verifier (after
// the run, record integrity), the study's scorer (after the run, ground truth)
// and the source review (a coding agent reading the frames). Neither verifier
// judges traffic truth.

import type { Loaded50 } from "./types";
import type { Focus50 } from "./RunView";

const Mark = ({ ok }: { ok: boolean }) => <span className={`pill ${ok ? "st-pass" : "st-fail"}`}>{ok ? "yes" : "no"}</span>;

interface Props { bundle: Loaded50; stage: number; focus: Focus50 }

export default function Answer({ bundle, stage, focus }: Props) {
  const a = bundle.answer;
  const s = a.submission;
  const rv = bundle.runtime_verifier;
  const ph = bundle.posthoc_verifier;
  const sc = bundle.scorer;
  const rw = bundle.review;
  const expected = Object.entries(sc.expected_color_multiset).flatMap(([c, n]) => Array(n).fill(c) as string[]);
  const vIdx = new Map(bundle.vehicles.map((v, i) => [v.ref, i]));

  if (stage < 5) {
    return (
      <div className="verdict">
        <h3 className="ph">Answer</h3>
        <p className="pending">No answer yet. The host assembles it in stage 5, from the rule's candidates and Gemma's colour text.</p>
      </div>
    );
  }
  return (
    <div className="verdict">
      <h3 className="ph">Answer the host assembled</h3>
      <div className="answer">
        <div className="big">{s.reported_count ?? "–"}</div>
        <div>
          <div className="colors">{s.colors.map((c, i) => <span key={i} className="colorchip">{c}</span>)}</div>
          <div className="mono dim">count_complete = {String(s.count_complete)} · decision = {s.decision}</div>
        </div>
      </div>
      {a.targets.length > 0 && (
        <ul className="targets">
          {a.targets.map((t) => (
            <li key={t.vehicle_ref}>
              <button className="glink" onClick={() => {
                const i = vIdx.get(t.vehicle_ref);
                if (i !== undefined) { focus.setVeh(i); focus.setFrame(t.source_frame_intervals[0][0]); }
              }}><b>{t.vehicle_ref}</b></button>
              <span className="mono"> = {t.member_track_refs.join(" + ")} · frames {t.source_frame_intervals.map(([x, y]) => `${x}–${y}`).join(", ")} · “{t.color_description}”</span>
            </li>
          ))}
        </ul>
      )}
      <blockquote className="uncertainty">{s.uncertainty}</blockquote>

      {stage < 6 ? (
        <p className="pending">Checks run in stage 6 (Verify).</p>
      ) : (
        <>
          <div className="vboxes">
            <div className={`vbox ${rv.final_answer_check === "pass" ? "pass" : "fail"}`}>
              <span className="eyebrow">Runtime Verifier · live</span>
              <div className="vline">answer shape and sources {rv.final_answer_check}</div>
              <div className="vline">agent tool calls to check: {rv.agent_tool_calls ?? "–"}</div>
              <p className="vnote">Before the run ends: count = colours = targets, every reported frame is a real observation of that vehicle, every colour cites a stored Gemma reply. It would also check agent tool calls; there were none.</p>
            </div>
            <div className={`vbox ${ph.status === "pass" ? "pass" : "fail"}`}>
              <span className="eyebrow">Post-hoc Verifier · after the run</span>
              <div className="vline">integrity {ph.status}{ph.issues.length ? ` · ${ph.issues.length} issues` : ""}</div>
              <div className="vline">traffic truth checked: {String(ph.traffic_truth_checked)}</div>
              <p className="vnote">Rebuilds the grouping, the rule, the frames and crops, Gemma's parsed colours and the answer from the records. A pass means the record is intact, not that the answer is right.</p>
            </div>
          </div>

          <div className="vbox scorer">
            <span className="eyebrow">Study scorer · ground truth, after the run</span>
            <div className="truthline">
              truth: <b>{sc.wrong_way_count}</b> wrong-way vehicle{sc.wrong_way_count === 1 ? "" : "s"}
              {expected.length > 0 && <> ({expected.join(", ")})</>}
            </div>
            <div className="scoregrid">
              <span>count right</span><Mark ok={sc.count_numeric_match} />
              <span>colour strings equal the labels</span><Mark ok={sc.color_multiset_correct} />
              <span>complete answer</span><Mark ok={sc.complete_count_correct} />
            </div>
            <p className="vnote">Exact strings only: “light purple” is not “purple” here. Nothing on this card was visible to the system.</p>
          </div>

          <div className="vbox scorer review">
            <span className="eyebrow">Source review · coding agent, not blind</span>
            {rw.targets.length === 0 ? (
              <p className="vnote">No target reported; {rw.false_reported_targets} false targets. {rw.meaning}</p>
            ) : (
              <ul className="targets">
                {rw.targets.map((t) => (
                  <li key={t.vehicle_ref}>
                    <b>{t.vehicle_ref}</b> → {t.object_id}: identity {t.identity}; colour “{t.color_original}” {t.color}; {t.interval}.
                  </li>
                ))}
              </ul>
            )}
            <p className="vnote">A coding agent compared the reported vehicles, frames and crops with the ground-truth frames. It is not an independent blind evaluation.</p>
          </div>
        </>
      )}
    </div>
  );
}
