// How V5.0 works: components and trust zones, one real run as a call sequence,
// what each stage hands to the next, grouping and the traffic rule in four
// pictures, and what changed from V4.2.

import { useEffect, useState } from "react";
import type { Experiment } from "../types";
import type { Loaded50 } from "./types";
import { loadBundle50 } from "../data";
import { archHref, stageHref } from "../router";
import { BOUNDARIES, CHANGES, COMPONENTS, FLOW, PARTICIPANTS, SEQUENCE, VERSUS, ZONES } from "./content";
import ComponentMap from "../arch/ComponentMap";
import Sequence from "../arch/Sequence";
import DataFlow from "../arch/DataFlow";
import RuleExplainer from "./RuleExplainer";

export default function ArchitecturePage({ exp }: { exp: Experiment }) {
  const ver = exp.versions.v50;
  const [bundle, setBundle] = useState<Loaded50 | null>(null);
  const [cur, setCur] = useState(0);
  const [selected, setSelected] = useState<string | null>("rules");
  const [playing, setPlaying] = useState(false);

  useEffect(() => { loadBundle50(ver.featured).then(setBundle).catch(() => setBundle(null)); }, [ver.featured]);

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

  const msg = SEQUENCE[cur];
  const src = ver.source;
  const f = ver.figures;

  return (
    <main className="arch">
      <section className="hero">
        <span className="eyebrow">How it works · V5.0</span>
        <h1>A program finds the cars; a language model is on call</h1>
        <p className="lede">
          The question: how many vehicles move against the traffic around them, and what colour are they? In V5.0 a
          trusted host program does the work. It tracks every vehicle, joins broken tracks, applies a fixed traffic
          rule, asks a vision model only for the colour of each candidate, and writes the answer itself. The language
          model agent is started only when a doubt could change the answer and another look could settle it.
          In the six measured clips that never happened: <b>zero</b> language-model calls.
        </p>
        <div className="boundary">
          This page shows the <b>implemented runtime</b> at SUT <code>{src.sut_commit.slice(0, 7)}</code>. Measured on six
          clips, one attempt each: {f.count_correct}/{f.attempts} right count, {f.count_and_supported_colors}/{f.attempts} with
          count and colours supported by the frames, {f.count_and_exact_colors}/{f.attempts} with exact colour strings,{" "}
          <b>{f.complete_correct}/{f.attempts} complete</b>. These six clips are a known regression set, not new scenes.
          The agent branch was not exercised live. V5.0 was not promoted.
        </div>
      </section>

      <section>
        <h2>1 · Components and trust boundaries</h2>
        <p className="intro">
          The host does everything on the main path. The agent sandbox is still there, behind five typed tools, but it
          is optional and dashed: nothing in this batch started it. Highlighted cards are the ones involved in the
          current step of section 2.
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
          The real sequence of attempt a002 (clip 1-nominal-r1). Loops are host-internal steps. The dotted arrow is the
          investigation branch that did not run.
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
          {msg.stage !== undefined && msg.stage > 0 && !msg.skipped && (
            <a href={stageHref(ver.featured, msg.stage)}>see this stage in the replay →</a>
          )}
        </div>
        <Sequence participants={PARTICIPANTS} sequence={SEQUENCE} cur={cur} onPick={(i) => { setPlaying(false); setCur(i); }}
                  label="Call sequence of attempt a002 in V5.0" />
      </section>

      <section>
        <h2>3 · How information flows</h2>
        <p className="intro">
          From pixels to an answer, with the actual a002 values. Everything on the main path is host code or a stateless
          model call; checking after the run never feeds back.
        </p>
        <DataFlow flow={FLOW} />
      </section>

      <section>
        <h2>4 · Grouping and the traffic rule</h2>
        <p className="intro">
          Drawn from the real a002 tracking data over frame 30. These two steps replaced the agent's job in V4.2: deciding
          which tracks are the same car, and which car moves against the others.
        </p>
        {bundle ? <RuleExplainer bundle={bundle} /> : <div className="loading">loading tracking data…</div>}
      </section>

      <section>
        <h2>5 · V4.2 → V5.0</h2>
        <p className="intro">
          The same six clips, measured once each in both versions. Several things changed at once, so this is a
          description of two designs, not a controlled experiment: it does not show that any one change caused the
          difference. <a href={archHref("v42")}>How V4.2 works →</a>
        </p>
        <div className="tbl">
          <table>
            <thead><tr><th /><th>V4.2</th><th>V5.0</th></tr></thead>
            <tbody>
              {VERSUS.map((r) => <tr key={r.row}><th scope="row">{r.row}</th><td>{r.v42}</td><td>{r.v50}</td></tr>)}
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

      {bundle && (
        <section>
          <h2>6 · Models and versions</h2>
          <div className="tbl">
            <table>
              <thead><tr><th>Role</th><th>Model</th><th>Revision</th><th>Settings</th></tr></thead>
              <tbody>
                <tr><td>Detector + tracker</td><td>YOLO26s (ultralytics 8.4.176) + ByteTrack</td>
                  <td className="num">{bundle.provenance.tracking.weights_sha256.slice(0, 7)}</td>
                  <td>confidence ≥ {bundle.provenance.tracking.inference.conf}, {bundle.provenance.tracking.inference.imgsz} px, no ReID</td></tr>
                <tr><td>Vision</td><td>Google Gemma 4 26B-A4B-it</td>
                  <td className="num">{bundle.provenance.perception.revision.slice(0, 7)}</td>
                  <td>temperature {bundle.provenance.perception.temperature}, one factual question per call</td></tr>
                <tr><td>Investigator (optional)</td><td>NVIDIA Nemotron 3.5 Lightning 30B-A3B (NVFP4)</td>
                  <td className="num">{bundle.provenance.orchestrator.revision.slice(0, 7)}</td>
                  <td>temperature {bundle.provenance.orchestrator.temperature}, top-p {bundle.provenance.orchestrator.top_p}, thinking off · <b>0 calls in this batch</b></td></tr>
                <tr><td>Agent harness (optional)</td><td>Pi + V5 extension</td><td className="num">–</td><td>five investigation tools · not started</td></tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      <footer className="footnote">
        <p>
          Source: the V5.0 deployment, call-sequence and data/decision views at SUT <code>{src.sut_commit.slice(0, 12)}</code>,
          the measurement batch <code>{src.batch}</code> (study <code>{src.study_commit.slice(0, 12)}</code>, model
          serving <code>{src.service_commit.slice(0, 12)}</code>) and its delivered report.
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
