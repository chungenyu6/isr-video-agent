// How V5.2 works: components and trust zones, the call sequence of an attempt,
// what each stage hands to the next, grouping and the traffic rule in four
// pictures, whether the agent branch adds anything (the controlled diagnostic),
// and what changed from V4.2 and V5.0.

import { useEffect, useState } from "react";
import type { Controller, Experiment } from "../types";
import type { Loaded52 } from "./types";
import { loadBundle52 } from "../data";
import { archHref, caseHref, runHref, stageHref } from "../router";
import { BOUNDARIES, CHANGES, COMPONENTS, FLOW, PARTICIPANTS, SEQ_FRAMES, SEQUENCE, VERSUS, ZONES } from "./content";
import ComponentMap from "../arch/ComponentMap";
import Sequence from "../arch/Sequence";
import DataFlow from "../arch/DataFlow";
import RuleExplainer from "./RuleExplainer";

/** The rule explainer is drawn on the clip where V5.0 and V5.2 agree frame for frame. */
const EXPLAINER = "v52-1-nominal-r1-s1";
const CTLS: Controller[] = ["none", "fixed", "pi"];
const CTL_LABEL: Record<Controller, string> = { none: "No follow-up", fixed: "Fixed check", pi: "Pi + Nemotron" };

export default function ArchitecturePage({ exp }: { exp: Experiment }) {
  const ver = exp.versions.v52;
  const diag = ver.diagnostic!;
  const [bundle, setBundle] = useState<Loaded52 | null>(null);
  const [cur, setCur] = useState(0);
  const [selected, setSelected] = useState<string | null>("cases");
  const [playing, setPlaying] = useState(false);

  useEffect(() => { loadBundle52(EXPLAINER).then(setBundle).catch(() => setBundle(null)); }, []);

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
        <span className="eyebrow">How it works · V5.2</span>
        <h1>A program finds the cars; a language model is on call</h1>
        <p className="lede">
          The question: how many vehicles move against the traffic around them, and what colour are they? A trusted host
          program does the work. It tracks every vehicle, joins broken tracks, applies a fixed traffic rule, asks a vision
          model only for the colour of each candidate, and writes the answer itself. The language-model agent is started
          only when a doubt could change the answer and another look could settle it. V5.2 keeps V5.0's pipeline, takes
          the task and question explicitly, and was measured for repeatability and for whether the agent adds anything.
        </p>
        <div className="boundary">
          This page shows the <b>implemented runtime</b> at SUT <code>{src.sut_commit.slice(0, 7)}</code>. Measured on 12
          clips, each four times: {f.count_correct}/{f.attempts} right count, {f.count_and_supported_colors}/{f.attempts} colours
          supported by the frames ({f.white_only_underdescribed} only “white”), {f.count_and_exact_colors}/{f.attempts} exact
          colour strings, <b>{f.complete_property_true}/{f.attempts} count_complete</b>. The agent started in{" "}
          {f.natural_investigations}/{f.attempts} attempts and resolved none of those cases; in a controlled comparison it
          was right in <b>{diag.pi_correct}/{diag.pi_cases}</b>. The clips are a known regression set, not new scenes.
          V5.2 was not promoted.
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
          The implemented call sequence of any V5.2 attempt. Self-arrows are host-internal steps; loop boxes repeat, opt
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
                  label="Call sequence of a V5.2 attempt" />
      </section>

      <section>
        <h2>3 · How information flows</h2>
        <p className="intro">
          From pixels to an answer, with the actual values of the featured attempt (a012, clip 2-challenging-r2), the one
          clip where the program called the agent. Checking after the run never feeds back.
        </p>
        <DataFlow flow={FLOW} />
      </section>

      <section>
        <h2>4 · Grouping and the traffic rule</h2>
        <p className="intro">
          Drawn from the real tracking data of clip 1-nominal-r1 over frame 30. These two steps replaced the agent's job
          in V4.2: deciding which tracks are the same car, and which car moves against the others. They are unchanged
          since V5.0.
        </p>
        {bundle ? <RuleExplainer bundle={bundle} /> : <div className="loading">loading tracking data…</div>}
      </section>

      <section id="agent-value">
        <h2>5 · Is the agent worth it?</h2>
        <p className="intro">
          A controlled diagnostic. Seven scenarios were saved from earlier runs; each was run once three ways: no
          follow-up, a fixed scripted check (at most two Gemma calls, no language model), and Pi with Nemotron. No
          controller saw another's new Gemma replies. B3 and B4 are assigned cases; in B7 a join was held back so that the
          program would open one. This tests the branch on known doubts; it is not a natural trigger rate.
        </p>
        <div className="tbl">
          <table className="diagmatrix">
            <thead>
              <tr><th>Scenario</th>{CTLS.map((c) => <th key={c}>{CTL_LABEL[c]}</th>)}</tr>
            </thead>
            <tbody>
              {Object.entries(diag.cells).map(([s, row]) => (
                <tr key={s}>
                  <th scope="row">
                    <b>{s}</b> {diag.scenarios[s]}
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
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Total</th>
                {CTLS.map((c) => (
                  <td key={c} className="mono">{diag.totals[c].nemotron} Nemotron · {diag.totals[c].gemma} Gemma · {diag.totals[c].wall_sec.toFixed(1)} s</td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="boundary">
          Pi closed all six of its cases legally, but its result was right in <b>{diag.pi_correct}/{diag.pi_cases}</b> (B5,
          where “unresolved” is the right answer); B6 correctly never started it. It adopted one wrong “different” (B7) and
          no wrong “same”. The fixed check got correct colours in B1 and B2 and settled B4 from saved detections, with{" "}
          {diag.totals.fixed.gemma} Gemma calls in total. The study found <b>no reliable gain</b> from the agent over the fixed
          check. Not every failure is Nemotron's: in B7 Gemma described an unboxed yellow bus as the TARGET, and both the
          fixed check and Pi received that.{" "}
          Only Pi's column is scored (coding-agent case review, not blind); the other columns are described.{" "}
          <a href={runHref(ver.featured)}>The one natural case →</a>
        </div>
      </section>

      <section>
        <h2>6 · V4.2 → V5.0 → V5.2</h2>
        <p className="intro">
          V4.2 and V5.0 were measured once on the same six clips; V5.2 reproduced V5.0's six answers in a replay with no
          model calls, then ran 12 clips four times each. Several things changed between versions, so this describes
          designs; it does not show that any one change caused a difference. <a href={archHref("v42")}>How V4.2 works →</a>
        </p>
        <div className="tbl">
          <table>
            <thead><tr><th /><th>V4.2 · six clips</th><th>V5.0 · same six clips</th><th>V5.2 · 12 clips × 4</th></tr></thead>
            <tbody>
              {VERSUS.map((r) => <tr key={r.row}><th scope="row">{r.row}</th><td>{r.v42}</td><td>{r.v5six}</td><td>{r.v52}</td></tr>)}
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
          <h2>7 · Models and versions</h2>
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
                  <td>temperature {bundle.provenance.orchestrator.temperature}, top-p {bundle.provenance.orchestrator.top_p}, seed 1, thinking off · {f.nemotron_calls} calls in the stability batch, {diag.totals.pi.nemotron} in the diagnostic</td></tr>
                <tr><td>Agent harness (cases only)</td><td>Pi + V5.2 extension</td><td className="num">–</td><td>five typed investigation tools</td></tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      <footer className="footnote">
        <p>
          Source: the V5.2 deployment, call-sequence and data/decision views at SUT <code>{src.sut_commit.slice(0, 12)}</code>,
          the measurement batches <code>{src.batch}</code> and <code>{diag.batch}</code> (study{" "}
          <code>{src.study_commit.slice(0, 12)}</code>, model serving <code>{src.service_commit.slice(0, 12)}</code>) and their
          delivered reports.
        </p>
        <p>
          Runtime Verifier and Post-hoc Verifier are separate components; neither evaluates traffic truth. The traffic
          rule is a third, separate host component. Scores on the replay come from the study's scorer after the run and
          were never visible to the system.
        </p>
      </footer>
    </main>
  );
}
