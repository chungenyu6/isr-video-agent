// Two verdicts on one run, side by side, then the L0-L4 ladder that explains the
// enhanced one. Hidden until the run clock reaches evaluation, because during a
// replay (and a live run) the evaluators have not run yet.

import { useState } from "react";
import type { LayerName, LayerStatus, Loaded, Oracle } from "../types";
import { LAYERS, LAYER_QUESTION, OUTCOMES, OUTCOME_LABEL, eventTime } from "../data";
import { CHECKS } from "../checks";

interface Props { bundle: Loaded; oracle: Oracle; t: number }

const L3_REASON: Record<string, string> = {
  unmatched_report: "the report matches no wrong-way car",
  fewer_than_two_inspected_anchors: "fewer than two cited frames were actually inspected",
  anchors_not_a_valid_motion_pair: "cited frames do not form a valid motion pair",
  claim_report_contradiction: "claims contradict the reported count",
};

function layerDetail(L: LayerName, b: Loaded, o: Oracle): string {
  const e = b.enhanced!;
  const d = e.layer_details;
  const colour = (id: string) => o.targets.find((t) => t.object_id === id)?.color_name ?? id;
  switch (L) {
    case "L0":
      return `run ${b.run.run_status}${b.run.agent_exit_code === 124 ? " at the 300 s hard timeout" : ""}; V0 ${b.v0.status}`;
    case "L1":
      if (!d.L1?.length) return "no wrong-way car to cover";
      return d.L1.map((c) => `${colour(c.object_id)}: ${c.covered ? "usable pair inspected" : "no usable pair inspected"}`).join(" · ");
    case "L2":
      if (d.L2?.status === "unknown") return "no observation parsed into a checkable claim";
      return `${d.L2?.assertions?.length ?? 0} checkable statement(s)${d.L2?.errors?.length ? `, ${d.L2.errors.length} contradicted by ground truth` : ""}`;
    case "L3":
      if (e.layers.L3 === "n/a") return "nothing reported, nothing to support";
      if (!d.L3?.failures?.length) return b.evidence.reported_targets.length ? "cited evidence supports the matched reports" : "no targets reported, no evidence required";
      return Object.entries(
        d.L3.failures.reduce<Record<string, number>>((acc, f) => {
          const k = L3_REASON[f.reason] ?? f.reason;
          acc[k] = (acc[k] ?? 0) + 1;
          return acc;
        }, {})
      ).map(([k, n]) => (n > 1 ? `${k} (×${n})` : k)).join(" · ");
    case "L4": {
      const m = d.L4_matching;
      const truth = o.wrong_way_count;
      const said = b.evidence.decision === "abstain" ? "abstained" : `reported ${b.evidence.reported_count ?? 0}`;
      const parts = [`${said}; truth ${truth}`];
      if (m?.false_negative_targets.length) parts.push(`missed ${m.false_negative_targets.map((i) => o.targets[i]?.color_name).join(", ")}`);
      if (m?.false_positive_reports.length) parts.push(`${m.false_positive_reports.length} false report(s)`);
      if (m?.matches.length) parts.push(`${m.matches.length} matched`);
      return parts.join(" · ");
    }
  }
}

const pill = (s: LayerStatus | string) => <span className={`pill st-${s.replace("/", "")}`}>{s}</span>;

export default function Verdict({ bundle, oracle, t }: Props) {
  const [showChecks, setShowChecks] = useState(false);
  const at = eventTime(bundle, "verify.result");
  const ready = at !== null && t >= at && bundle.enhanced;
  const e = bundle.enhanced;
  const checks = Object.entries(bundle.v0.checks).sort(([a], [b]) => a.localeCompare(b));
  const passed = checks.filter(([, v]) => v).length;
  const flagged = e ? OUTCOMES.some((k) => e.outcome[k]) : false;

  if (!ready || !e) {
    return (
      <div className="verdict">
        <h3 className="ph">Verdict</h3>
        <p className="pending">
          {at === null ? "Evaluation has not run yet." : "Evaluation runs after the agent exits."} Scrub to the end of the run, or press replay.
        </p>
      </div>
    );
  }

  return (
    <div className="verdict">
      <div className="twoverdicts">
        <div className={`vbox ${bundle.v0.status}`}>
          <span className="eyebrow">V0 · structure only</span>
          <div className="vline">{pill(bundle.v0.status)} <span className="dim">{passed}/{checks.length} checks</span></div>
          {bundle.v0.errors.map((x) => <div className="verr" key={x}>{x}</div>)}
          <button className="disclose" onClick={() => setShowChecks((s) => !s)} aria-expanded={showChecks}>
            {showChecks ? "hide checks" : "what V0 checks"}
          </button>
        </div>
        <div className={`vbox ${flagged ? "fail" : "pass"}`}>
          <span className="eyebrow">Enhanced · with ground truth</span>
          <div className="outcomes">
            {OUTCOMES.map((k) => (
              <span key={k} className={`oc${e.outcome[k] ? " on o-" + k : ""}`} title={OUTCOME_LABEL[k]}>
                {OUTCOME_LABEL[k]}{e.outcome[k] > 1 ? ` ×${e.outcome[k]}` : ""}
              </span>
            ))}
          </div>
          {!flagged && <div className="vline">{pill("pass")} <span className="dim">no outcome</span></div>}
        </div>
      </div>

      {e.v0_blind_spot && (
        <div className="blindnote">
          <b>V0 blind spot.</b> V0 passed this run; scored against ground truth, it did not.
        </div>
      )}

      {showChecks && (
        <div className="checklist">
          {checks.map(([name, ok]) => (
            <div className="ck" key={name}>
              <span className={`chk ${ok ? "ok" : "no"}`} />
              <div><code>{name}</code>{CHECKS[name] && <p>{CHECKS[name]}</p>}</div>
            </div>
          ))}
          <p className="cknote">
            None of these look at pixels or ground truth. V0 cannot tell whether the cars reported exist, whether a car was
            missed, or whether the inspected frames could show motion at all.
          </p>
        </div>
      )}

      <ol className="ladder">
        {LAYERS.map((L) => (
          <li key={L} className={`${e.layers[L]}${e.earliest_violated_layer === L ? " earliest" : ""}`}>
            <span className="lname">{L}</span>
            {pill(e.layers[L])}
            <div>
              <p className="lq">{LAYER_QUESTION[L]}</p>
              <p className="ld">{layerDetail(L, bundle, oracle)}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="fine">
        Earliest failing layer: <b>{e.earliest_violated_layer ?? "none"}</b> — a location, not a cause.
        Signature{e.full_signatures.length > 1 ? "s" : ""}: {e.full_signatures.length ? e.full_signatures.map((s) => <code key={s}>{s}</code>) : "none"}
      </p>
    </div>
  );
}
