// The V5.0 transport. V5 has no agent steps to replay, so the run is stepped by
// pipeline stage instead of by clock. Each panel reveals what exists after the
// current stage. The investigation branch is drawn beside the pipeline: it is
// implemented, and it did not run.

import { useEffect, useState } from "react";
import type { Loaded50 } from "./types";
import { LAST_STAGE, STAGES } from "./derive";

interface Props { bundle: Loaded50; stage: number; setStage: (s: number) => void }

export default function Pipeline({ bundle, stage, setStage }: Props) {
  const [playing, setPlaying] = useState(false);
  const r = bundle.run;
  const gemma = r.gemma_sec.reduce((a, b) => a + b, 0);
  const opp = bundle.vehicles.filter((v) => v.status === "opposing").length;
  const unres = bundle.vehicles.filter((v) => v.status === "unresolved").length;
  const s = bundle.answer.submission;
  const sub: Record<string, string> = {
    track: `${bundle.tracking.tracks.length} tracker IDs · ${r.tracking_sec.toFixed(2)} s`,
    group: `${bundle.tracking.tracks.length} IDs → ${bundle.vehicles.length} vehicles`,
    rule: `${opp} opposite${unres ? ` · ${unres} unresolved` : ""}`,
    look: bundle.appearance.length ? `Gemma ×${bundle.appearance.length} · ${gemma.toFixed(2)} s` : "no candidate, no call",
    assemble: `${s.reported_count ?? "–"}${s.colors.length ? ` · ${s.colors.join(", ")}` : ""} · ${s.count_complete ? "complete" : "incomplete"}`,
    verify: `Runtime ${bundle.runtime_verifier.final_answer_check} · Post-hoc ${bundle.posthoc_verifier.status}`,
  };

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      if (stage >= LAST_STAGE) { setPlaying(false); return; }
      setStage(stage + 1);
    }, 1700);
    return () => window.clearInterval(id);
  }, [playing, stage, setStage]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || tag === "BUTTON") return;
      if (e.code === "ArrowRight") { e.preventDefault(); setPlaying(false); setStage(Math.min(LAST_STAGE, stage + 1)); }
      else if (e.code === "ArrowLeft") { e.preventDefault(); setPlaying(false); setStage(Math.max(0, stage - 1)); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stage, setStage]);

  const cur = STAGES[stage - 1];
  return (
    <div className="pipeline">
      <div className="pl-controls" role="group" aria-label="Step through the pipeline">
        <button className="primary" onClick={() => {
          if (playing) { setPlaying(false); return; }
          if (stage >= LAST_STAGE) setStage(0);
          setPlaying(true);
        }}>{playing ? "❚❚ pause" : "▶ replay"}</button>
        <button onClick={() => { setPlaying(false); setStage(Math.max(0, stage - 1)); }} aria-label="previous stage">◀ stage</button>
        <button onClick={() => { setPlaying(false); setStage(Math.min(LAST_STAGE, stage + 1)); }} aria-label="next stage">stage ▶</button>
        <span className="clock">
          wall {r.wall_sec.toFixed(2)} s: tracking {r.tracking_sec.toFixed(2)} s · Gemma {gemma.toFixed(2)} s · host
          work and records {(r.wall_sec - r.tracking_sec - gemma).toFixed(2)} s
        </span>
      </div>
      <div className="pl-row">
        <ol className="pl-stages">
          {STAGES.map((st) => (
            <li key={st.key}>
              <button className={`pl-stage${stage === st.n ? " cur" : ""}${stage < st.n ? " todo" : ""}`}
                      onClick={() => { setPlaying(false); setStage(st.n); }} aria-pressed={stage === st.n}>
                <span className="pl-n">{st.n}</span>
                <b>{st.label}</b>
                <span className="pl-sub">{sub[st.key]}</span>
              </button>
            </li>
          ))}
        </ol>
        <div className="pl-branch" title="Implemented and tested with fake providers; not exercised live">
          <b>Investigation</b>
          <span>Pi + Nemotron, five tools</span>
          <span className="pl-sub">{r.pi_started ? "started" : "not triggered in this run"}</span>
        </div>
      </div>
      <div className="pl-note" aria-live="polite">
        {cur ? <><b>{cur.n}. {cur.label}.</b> {cur.detail}</> : <><b>Before the run.</b> Only the video exists. Nothing has been detected yet.</>}
      </div>
    </div>
  );
}
