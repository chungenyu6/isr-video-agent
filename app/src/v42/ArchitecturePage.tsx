// How V4.2 (the previous version) works: components and trust zones, one real run as a call sequence,
// what each stage hands to the next, and the detector/tracker in four pictures.

import { useEffect, useState } from "react";
import type { Loaded, VersionData } from "../types";
import { loadBundle } from "../data";
import { archHref, runHref } from "../router";
import { BOUNDARIES, CHANGES, COMPONENTS, FLOW, PARTICIPANTS, SEQUENCE, ZONES } from "./content";
import ComponentMap from "../arch/ComponentMap";
import Sequence from "../arch/Sequence";
import DataFlow from "../arch/DataFlow";
import TrackingExplainer from "./TrackingExplainer";

export default function ArchitecturePage({ exp }: { exp: VersionData }) {
  const [bundle, setBundle] = useState<Loaded | null>(null);
  const [cur, setCur] = useState(0);
  const [selected, setSelected] = useState<string | null>("gateway");
  const [playing, setPlaying] = useState(false);

  useEffect(() => { loadBundle(exp.featured).then(setBundle).catch(() => setBundle(null)); }, [exp.featured]);

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
  const stepT = msg.step !== undefined && bundle ? bundle.steps[msg.step]?.t_result : undefined;
  const src = exp.source;
  const f = exp.figures;

  return (
    <main className="arch">
      <section className="hero">
        <div className="prevnote">
          Previous version. The current system is <a href={archHref("v52")}>V5.2, program-first →</a>
        </div>
        <span className="eyebrow">How it works · V4.2</span>
        <h1>A language model that never touches the video</h1>
        <p className="lede">
          The agent, Nemotron in a sandbox, sees only text. A trusted host owns the clip. It runs an object detector
          and a tracker, measures how every track moves, crops what the agent asks about for a vision model, and
          checks every call. The agent's job is to compare the tracks, decide which vehicles to look at, and answer:
          how many vehicles move against the traffic around them, and what colour they are.
        </p>
        <div className="boundary">
          This page shows the <b>implemented runtime</b> at SUT <code>{src.sut_commit.slice(0, 7)}</code>, not a strategy
          that worked. Measured on six clips: {f.accepted}/{f.attempts} answers accepted,{" "}
          {f.count_and_supported_colors}/{f.attempts} with count and colours supported by the frames,{" "}
          {f.complete_correct}/{f.attempts} complete. V4.2 was not promoted.
        </div>
      </section>

      <section>
        <h2>1 · Components and trust boundaries</h2>
        <p className="intro">
          Three zones. The agent can reach the world only through six typed tools on the gateway; the models run as
          separate services. Highlighted cards are the ones involved in the current step of section 2.
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
          The real call sequence of attempt a002 (clip 1-nominal-r1), the best of the six. Step through it, or click
          any arrow.
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
          {stepT !== undefined && <a href={runHref(exp.featured, stepT)}>see this moment in the replay →</a>}
        </div>
        <Sequence participants={PARTICIPANTS} sequence={SEQUENCE} label="Call sequence of attempt a002" cur={cur} onPick={(i) => { setPlaying(false); setCur(i); }} />
      </section>

      <section>
        <h2>3 · How information flows</h2>
        <p className="intro">
          From pixels to an answer. Each stage hands the next a specific payload; the examples are the actual values
          from a002. Perception stays on the host side; decisions stay with the agent; checking after the run never
          feeds back.
        </p>
        <DataFlow flow={FLOW} />
      </section>

      <section>
        <h2>4 · The detector and the tracker</h2>
        <p className="intro">
          What YOLO26s and ByteTrack add, drawn from the real a002 tracking data over frame 30. The agent never sees
          these pictures. It gets the result as text, and it can ask for a boxed crop of one track.
        </p>
        {bundle ? <TrackingExplainer bundle={bundle} /> : <div className="loading">loading tracking data…</div>}
      </section>

      <section>
        <h2>5 · What changed</h2>
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
              <thead><tr><th>Role</th><th>Model</th><th>Revision</th><th>Decoding</th></tr></thead>
              <tbody>
                <tr><td>Orchestrator</td><td>NVIDIA Nemotron 3.5 Lightning 30B-A3B (NVFP4)</td>
                  <td className="num">{bundle.provenance.orchestrator.revision.slice(0, 7)}</td>
                  <td>temperature {bundle.provenance.orchestrator.temperature}, top-p {bundle.provenance.orchestrator.top_p}, thinking off</td></tr>
                <tr><td>Vision</td><td>Google Gemma 4 26B-A4B-it</td>
                  <td className="num">{bundle.provenance.perception.revision.slice(0, 7)}</td>
                  <td>temperature {bundle.provenance.perception.temperature}</td></tr>
                <tr><td>Detector + tracker</td><td>YOLO26s (ultralytics 8.4.176) + ByteTrack</td>
                  <td className="num">{bundle.provenance.tracking.weights_sha256.slice(0, 7)}</td>
                  <td>confidence ≥ 0.1, 960 px, no ReID</td></tr>
                <tr><td>Agent harness</td><td>Pi + V4.2 extension</td><td className="num">–</td><td>six typed tools</td></tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      <footer className="footnote">
        <p>
          Source: the V4.2 design and implementation views at SUT <code>{src.sut_commit.slice(0, 12)}</code>, the
          measurement batch <code>{src.batch}</code> (study <code>{src.study_commit.slice(0, 12)}</code>, model
          serving <code>{src.service_commit.slice(0, 12)}</code>) and its delivered report.
        </p>
        <p>
          Runtime Verifier and Post-hoc Verifier are separate components; neither evaluates traffic truth. Scores
          shown on the replay come from the study's Property Evaluator after the run and were never visible to the agent.
        </p>
      </footer>
    </main>
  );
}
