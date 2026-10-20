// How V5.3 works: components and trust zones, the call sequence of an attempt,
// what each stage hands to the next, grouping and the traffic rule in four
// pictures, whether the agent branch adds anything (the controlled diagnostic),
// and what changed from V4.2 to V5.3.

import { useEffect, useState } from "react";
import type { Controller, Experiment } from "../types";
import type { Loaded53 } from "./types";
import { loadBundle53 } from "../data";
import { archHref, caseHref, runHref, stageHref } from "../router";
import { BOUNDARIES, CHANGES, COMPONENTS, FLOW, PARTICIPANTS, SEQ_FRAMES, SEQUENCE, VERSUS, ZONES } from "./content";
import ComponentMap from "../arch/ComponentMap";
import Sequence from "../arch/Sequence";
import DataFlow from "../arch/DataFlow";
import RuleExplainer from "./RuleExplainer";

/** The rule explainer is drawn on the clip where V5.0, V5.2 and V5.3 agree frame for frame. */
const EXPLAINER = "v53-1-nominal-r1-s1";
const CTL_LABEL: Record<Controller, string> = { none: "No follow-up", fixed: "Fixed check", "pi-cap2": "Pi · cap 2", "pi-cap4": "Pi · cap 4" };

export default function ArchitecturePage({ exp }: { exp: Experiment }) {
  const ver = exp.versions.v53;
  const diag = ver.diagnostic!;
  const CTLS = diag.controllers;
  const [bundle, setBundle] = useState<Loaded53 | null>(null);
  const [cur, setCur] = useState(0);
  const [selected, setSelected] = useState<string | null>("cases");
  const [playing, setPlaying] = useState(false);

  useEffect(() => { loadBundle53(EXPLAINER).then(setBundle).catch(() => setBundle(null)); }, []);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setCur((c) => {
        if (c >= SEQUENCE.length - 1) { setPlaying(false); return c; }
        return c + 1;
      });
    }, 2200);
    return () => window.clearInterval(id);
  }, [playing]);

  // In-page anchor. The app scrolls to the top on every page change, so wait for
  // that (and for the sections above to lay out) before jumping.
  useEffect(() => {
    if (!window.location.hash.endsWith("#agent-value")) return;
    const id = window.setTimeout(() => document.getElementById("agent-value")?.scrollIntoView(), 150);
    return () => window.clearTimeout(id);
  }, []);

  const msg = SEQUENCE[cur];
  const src = ver.source;
  const f = ver.figures;

  return (
    <main className="arch">
      <section className="hero">
        <span className="eyebrow">How it works · V5.3</span>
        <h1>A program finds the cars; a language model is on call</h1>
        <p className="lede">
          The question: how many vehicles move against the traffic around them, and what colour are they? A trusted host
          program does the work. It tracks every vehicle, joins broken tracks, applies a fixed traffic rule, asks a vision
          model only for the colour of each candidate, and writes the answer itself. The language-model agent is started
          only when a doubt could change the answer and another look could settle it. V5.3 keeps that pipeline and changes
          only how the agent is guided: each case now suggests a first step and shows its own Gemma budget.
        </p>
        <div className="boundary">
          This page shows the <b>implemented runtime</b> at SUT <code>{src.sut_commit.slice(0, 7)}</code>. Measured on 12
          clips, each four times: <b>{f.count_correct}/{f.attempts} right count</b> (V5.2: 48/48),{" "}
          {f.color_tokens_matched}/{f.attempts} with matching colour words, {f.count_and_exact_colors}/{f.attempts} exact colour
          strings, {f.count_complete_true}/{f.attempts} count_complete true and right. The guidance made the agent better in
          controlled cases, <b>{diag.pi_correct["pi-cap2"]}/{diag.pi_cases}</b> right (V5.2: {diag.pi_correct.v52_pi}/{diag.pi_cases}),
          and worse on the main task: in the one clip where the program called it, it acted on Gemma's misreading of a tiny
          target and the host counted one car twice. The clips are a known regression set, not new scenes. V5.3 was not promoted.
        </div>
      </section>

      <section>
        <h2>1 · Components and trust boundaries</h2>
        <p className="intro">
          The host does everything on the main path. The agent sandbox sits behind five typed tools and starts only for a
          case. Highlighted cards are the ones involved in the current step of section 2.
        </p>
        <ComponentMap zones={ZONES} components={COMPONENTS} selected={selected} onSelect={setSelected} highlight={msg.highlight} />
        <h3 className="ph sub">What crosses each boundary</h3>
        <div className="tbl">
          <table>
            <thead><tr><th>From</th><th>To</th><th>Payload</th></tr></thead>
            <tbody>
              {BOUNDARIES.map((b) => (
                <tr key={b.from + b.to}><td className="num">{b.from}</td><td className="num">{b.to}</td><td>{b.payload}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>2 · How a run executes</h2>
        <p className="intro">
          The implemented call sequence of any V5.3 attempt. Self-arrows are host-internal steps; loop boxes repeat, opt
          boxes run only when needed. The outer opt box is the investigation branch: in the stability batch it ran in
          4 of 48 attempts.
        </p>
        <div className="stepper" role="group" aria-label="Sequence stepper">
          <button onClick={() => { setPlaying(false); setCur(Math.max(0, cur - 1)); }} aria-label="previous step">◀</button>
          <button className="primary" onClick={() => { if (cur >= SEQUENCE.length - 1) setCur(0); setPlaying(!playing); }}>
            {playing ? "❚❚ pause" : "▶ play"}
          </button>
          <button onClick={() => { setPlaying(false); setCur(Math.min(SEQUENCE.length - 1, cur + 1)); }} aria-label="next step">▶</button>
          <span className="mono dim">step {cur + 1} / {SEQUENCE.length}</span>
        </div>
        <div className="seqnote" aria-live="polite">
          <b>{cur + 1}. {msg.label}</b>
          <p>{msg.detail}</p>
          {msg.stage !== undefined && msg.stage > 0 && (
            <a href={stageHref(ver.featured, msg.stage)}>see this stage in the featured replay →</a>
          )}
        </div>
        <Sequence participants={PARTICIPANTS} sequence={SEQUENCE} frames={SEQ_FRAMES} cur={cur} onPick={(i) => { setPlaying(false); setCur(i); }}
                  label="Call sequence of a V5.3 attempt" />
      </section>

      <section>
        <h2>3 · How information flows</h2>
        <p className="intro">
          From pixels to an answer, with the actual values of the featured attempt (a012, clip 2-challenging-r2), the one
          clip where the program called the agent, and where V5.3 got the count wrong. Checking after the run never feeds back.
        </p>
        <DataFlow flow={FLOW} />
      </section>

      <section>
        <h2>4 · Grouping and the traffic rule</h2>
        <p className="intro">
          Drawn from the real tracking data of clip 1-nominal-r1 over frame 30. These two steps replaced the agent's job
          in V4.2: deciding which tracks are the same car, and which car moves against the others. They are unchanged
          since V5.0. A joined pair is marked with a ring; a frame sent to Gemma, on the replay, with a diamond.
        </p>
        {bundle ? <RuleExplainer bundle={bundle} /> : <div className="loading">loading tracking data…</div>}
      </section>

      <section id="agent-value">
        <h2>5 · Is the agent worth it?</h2>
        <p className="intro">
          A controlled diagnostic. Seven scenarios were saved from earlier runs; each was run once four ways: no
          follow-up, a fixed scripted check (no language model), and Pi with Nemotron at a per-case Gemma cap of 2 and of
          4. No arm saw another's new Gemma replies. B3 and B4 are assigned cases; in B7 a join was held back so that the
          program would open one. The expected answers were written down before V5.2. This tests the branch on known
          doubts; it is not a natural trigger rate.
        </p>
        <div className="tbl">
          <table className="diagmatrix">
            <thead>
              <tr><th>Scenario · expected</th>{CTLS.map((c) => <th key={c}>{CTL_LABEL[c]}</th>)}<th>V5.2 Pi</th></tr>
            </thead>
            <tbody>
              {Object.entries(diag.cells).map(([s, row]) => (
                <tr key={s}>
                  <th scope="row">
                    <b>{s}</b> {diag.scenarios[s]} · <i>{diag.expected[s]}</i>
                    {diag.assigned.includes(s) && <span className="pill">assigned</span>}
                    {diag.replays[s] && <> <a href={caseHref(diag.replays[s])}>replay →</a></>}
                  </th>
                  {CTLS.map((c) => {
                    const x = row[c];
                    return (
                      <td key={c} className={x.correct === undefined ? "" : x.correct ? "ok" : "bad"}>
                        <span className="mono dim">{x.nemotron} N · {x.gemma} G · {x.case ?? "no case"}</span>
                        <span>{x.note}</span>
                        {x.correct !== undefined && <span className={`pill ${x.correct ? "st-pass" : "st-fail"}`}>{x.correct ? "right" : "wrong"}</span>}
                      </td>
                    );
                  })}
                  <td className={diag.v52_pi[s] ? "ok" : "bad"}><span className={`pill ${diag.v52_pi[s] ? "st-pass" : "st-fail"}`}>{diag.v52_pi[s] ? "right" : "wrong"}</span></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Total</th>
                {CTLS.map((c) => (
                  <td key={c} className="mono">{diag.totals[c].nemotron} Nemotron · {diag.totals[c].gemma} Gemma</td>
                ))}
                <td className="mono">{diag.pi_correct.v52_pi}/{diag.pi_cases} right</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="boundary">
          With the new case cards Pi was right in <b>{diag.pi_correct["pi-cap2"]}/{diag.pi_cases}</b> at cap 2 and{" "}
          <b>{diag.pi_correct["pi-cap4"]}/{diag.pi_cases}</b> at cap 4: the same answers, so the raised cap only cost two more
          Gemma calls. Its new Gemma calls were compare and appearance checks, where V5.2's had all been visibility checks.
          B7 is still wrong: Gemma described the small TARGET as a yellow bus, and Pi read the conflict as “different”
          instead of leaving it unresolved. The fixed check makes no such errors because it never adopts free Gemma text
          as an identity, at the price of leaving B3 and B7 open. Only Pi's columns are scored (the report's table,
          coding-agent review, not blind).{" "}
          <a href={runHref(ver.featured)}>The natural case, where the same eagerness cost a wrong count →</a>
        </div>
      </section>

      {ver.outcome_vector && (
        <section id="failure-layers">
          <h2>6 · Where it fails, layer by layer</h2>
          <p className="intro">
            Property Evaluator v2 gives every run an outcome vector Y: 22 yes/no fields in seven layers that follow the
            pipeline, from L0 (an answer was given) to L6 (the final answer against ground truth). A field is 1 if it
            happened at least once in the run. Computed after the runs with no new model calls; the system never saw it.
          </p>
          <div className="tbl">
            <table className="ovtable">
              <thead>
                <tr><th>Field</th>{(["v50", "v52", "v53"] as const).map((k) => (
                  <th key={k}>{k === "v50" ? "V5.0" : k === "v52" ? "V5.2" : "V5.3"} · {ver.outcome_vector!.runs[k]} runs</th>
                ))}</tr>
              </thead>
              <tbody>
                {ver.outcome_vector.fields.map((f) => {
                  const info = ver.outcome_vector!.info_fields.includes(f);
                  return (
                    <tr key={f} className={info ? "info" : ""}>
                      <th scope="row"><code>{f}</code>{info && <span className="dim"> (for information)</span>}</th>
                      {(["v50", "v52", "v53"] as const).map((k) => {
                        const n = ver.outcome_vector!.ones[k][f];
                        return <td key={k} className={`num${n && !info ? " hot" : ""}`}>{n}</td>;
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="boundary">
            <b>V5.3's extra wrong-way vehicle (4/48 runs, all 2-challenging-r2).</b> L1–L3 are clean: the purple car was
            tracked, the rule flagged it and Gemma was sent to look. L2 records the program keeping it as two records (V6,
            V8) in one counting unit, a deliberate cautious choice and not an error. Then L4: asked to compare the two
            sightings, Gemma called the small, blurred one a different vehicle. L5: the agent adopted that, with matching
            citations; the decision fitted its evidence, but the evidence was wrong. L6: the host counted two cars where there
            is one. V5.2 on the same clip and the same tracking has the same L2 field, but its agent never compared the
            sightings, so L4–L6 stay 0. The cautious split is necessary but not sufficient; only a wrong reading that the
            agent adopts turns it into a wrong count.{" "}
            <a href={stageHref(ver.featured, 7)}>See the vector on the replay →</a>
          </div>
          <div className="boundary">
            <b>Colour under-described (8/48 runs, V5.2 and V5.3 alike).</b> In exactly the runs where L6
            <code>answer_color_miss</code> is 1, L4 <code>color_FN</code> is 1: Gemma described a purple car with a white roof as
            just “white”, and the host passed the wording on. No agent decision is involved.
          </div>
          <p className="fine">
            The links between layers rest on fields lighting up together in the same runs and on a same-clip comparison
            with V5.2, not on a randomised experiment, and the extra-vehicle failure comes from one scene repeated four
            times. Geometric matches and text readings are rules, not proof of physical identity. The visible-colour labels
            behind L4 were cropped by a coding agent and confirmed row by row by the researcher.
          </p>
        </section>
      )}

      <section>
        <h2>7 · V4.2 → V5.0 → V5.2 → V5.3</h2>
        <p className="intro">
          V4.2 and V5.0 were measured once on the same six clips; V5.2 and V5.3 each reproduced the earlier answers in a
          replay with no model calls, then ran 12 clips four times each. Several things changed between versions, so this describes
          designs; it does not show that any one change caused a difference. <a href={archHref("v42")}>How V4.2 works →</a>
        </p>
        <div className="tbl">
          <table>
            <thead><tr><th /><th>V4.2 · six clips</th><th>V5.0 · same six</th><th>V5.2 · 12 × 4</th><th>V5.3 · 12 × 4</th></tr></thead>
            <tbody>
              {VERSUS.map((r) => <tr key={r.row}><th scope="row">{r.row}</th><td>{r.v42}</td><td>{r.v5six}</td><td>{r.v52}</td><td>{r.v53}</td></tr>)}
            </tbody>
          </table>
        </div>
        <h3 className="ph sub">Every version so far</h3>
        <div className="tbl">
          <table>
            <thead><tr><th>Version</th><th>Design</th><th>Measured</th></tr></thead>
            <tbody>
              {CHANGES.map((c) => (
                <tr key={c.version}><th scope="row">{c.version}</th><td>{c.what}</td><td>{c.result}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {bundle && bundle.provenance.tracking && (
        <section>
          <h2>8 · Models and versions</h2>
          <div className="tbl">
            <table>
              <thead><tr><th>Role</th><th>Model</th><th>Revision</th><th>Settings</th></tr></thead>
              <tbody>
                <tr><td>Detector + tracker</td><td>YOLO26s (ultralytics 8.4.176) + ByteTrack</td>
                  <td className="num">{bundle.provenance.tracking.weights_sha256.slice(0, 7)}</td>
                  <td>confidence ≥ {bundle.provenance.tracking.inference.conf}, {bundle.provenance.tracking.inference.imgsz} px, no ReID</td></tr>
                <tr><td>Vision</td><td>Google Gemma 4 26B-A4B-it</td>
                  <td className="num">{bundle.provenance.perception.revision.slice(0, 7)}</td>
                  <td>temperature {bundle.provenance.perception.temperature}, seed 1, one factual question per call</td></tr>
                <tr><td>Investigator (cases only)</td><td>NVIDIA Nemotron 3.5 Lightning 30B-A3B (NVFP4)</td>
                  <td className="num">{bundle.provenance.orchestrator.revision.slice(0, 7)}</td>
                  <td>temperature {bundle.provenance.orchestrator.temperature}, top-p {bundle.provenance.orchestrator.top_p}, seed 1, thinking off · {f.nemotron_calls} calls in the stability batch, {diag.totals["pi-cap2"].nemotron + diag.totals["pi-cap4"].nemotron} in the diagnostic</td></tr>
                <tr><td>Agent harness (cases only)</td><td>Pi + V5.3 extension</td><td className="num">–</td><td>five typed investigation tools</td></tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      <footer className="footnote">
        <p>
          Source: the V5.3 deployment, call-sequence and data/decision views at SUT <code>{src.sut_commit.slice(0, 12)}</code>,
          the measurement batches <code>{src.batch}</code> and <code>{diag.batch}</code> (study{" "}
          <code>{src.study_commit.slice(0, 12)}</code>, model serving <code>{src.service_commit.slice(0, 12)}</code>) and their
          delivered reports.
        </p>
        <p>
          Runtime Verifier and Post-hoc Verifier are separate components; neither evaluates traffic truth. The traffic
          rule is a third, separate host component. Scores on the replay come from the study's Property Evaluator after the run and
          were never visible to the system.
        </p>
      </footer>
    </main>
  );
}
