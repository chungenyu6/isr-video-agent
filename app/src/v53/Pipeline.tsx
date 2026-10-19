// The V5.2 transport. The run is stepped by pipeline stage: each panel reveals
// what exists after the current stage. Stage 5 (Investigate) is the optional
// agent branch; it lights up only when the program proposed a case.

import { useEffect, useState } from "react";
import type { Loaded52 } from "./types";
import { gemmaUsedAt, LAST_STAGE, STAGE, STAGES } from "./derive";

interface Props { bundle: Loaded52; stage: number; setStage: (s: number) => void }

export default function Pipeline({ bundle, stage, setStage }: Props) {
  const [playing, setPlaying] = useState(false);
  const r = bundle.run;
  const gemma = r.gemma_sec.reduce((a, b) => a + b, 0);
  const hostLooks = gemmaUsedAt(bundle, STAGE.look);
  const agentLooks = gemmaUsedAt(bundle, STAGE.investigate) - hostLooks;
  const nCases = bundle.cases.length;
  const imported = !r.tracking_new_inference;
  const opp = bundle.vehicles.filter((v) => v.status === "opposing").length;
  const unres = bundle.vehicles.filter((v) => v.status === "unresolved").length;
  const s = bundle.answer.submission;
  const sub: Record<string, string> = {
    track: `${bundle.tracking.tracks.length} tracker IDs · ${imported || r.tracking_sec === null ? "saved, no new job" : `${r.tracking_sec.toFixed(2)} s`}`,
    group: `${bundle.tracking.tracks.length} IDs → ${bundle.vehicles.length} vehicles`,
    rule: `${opp} opposite${unres ? ` · ${unres} unresolved` : ""}`,
    look: hostLooks ? `Gemma ×${hostLooks}` : bundle.appearance.some((a) => a.origin === "imported") ? "saved replies" : "no candidate, no call",
    investigate: nCases === 0 ? "no case · Pi not started"
      : bundle.agent ? `${bundle.cases.map((c) => `${c.case_ref} ${c.status}`).join(", ")} · ${bundle.budget.nemotron.used} Nemotron${agentLooks ? ` · Gemma ×${agentLooks}` : ""}`
      : `${nCases} case${nCases === 1 ? "" : "s"}, no agent`,
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
          wall {r.wall_sec.toFixed(2)} s:{r.tracking_sec !== null ? ` tracking ${r.tracking_sec.toFixed(2)} s ·` : " tracking imported ·"} Gemma {gemma.toFixed(2)} s
          {r.investigation_sec !== null ? ` · investigation ${r.investigation_sec.toFixed(2)} s (includes its Gemma calls)` : ""}
        </span>
      </div>
      <div className="pl-row">
        <ol className="pl-stages">
          {STAGES.map((st) => (
            <li key={st.key}>
              <button className={`pl-stage${stage === st.n ? " cur" : ""}${stage < st.n ? " todo" : ""}${st.key === "investigate" ? (nCases ? " branch on" : " branch off") : ""}`}
                      onClick={() => { setPlaying(false); setStage(st.n); }} aria-pressed={stage === st.n}>
                <span className="pl-n">{st.n}</span>
                <b>{st.label}</b>
                <span className="pl-sub">{sub[st.key]}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
      <div className="pl-note" aria-live="polite">
        {cur ? <><b>{cur.n}. {cur.label}.</b> {cur.detail}</> : <><b>Before the run.</b> Only the video exists. Nothing has been detected yet.</>}
      </div>
    </div>
  );
}
