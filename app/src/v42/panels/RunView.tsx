// The run layout. Two clocks: the run clock (agent wall time, drives what has
// happened yet) and the video frame (where you are looking in the clip).

import { useEffect, useMemo, useState } from "react";
import type { Loaded, Oracle } from "../types";
import type { Clock } from "../clock";
import { clipLabel, trackPoints } from "../data";
import VideoPanel from "./VideoPanel";
import TrackTimeline from "./TrackTimeline";
import TrackInventory from "./TrackInventory";
import Perception from "./Perception";
import Verdict from "./Verdict";
import Budget from "./Budget";
import Steps from "./Steps";

interface Props { bundle: Loaded; oracle: Oracle; clock: Clock }

export interface Focus {
  frame: number;
  setFrame: (f: number) => void;
  track: number | null;
  setTrack: (i: number | null) => void;
  hover: number | null;
  setHover: (i: number | null) => void;
}

export default function RunView({ bundle, oracle, clock }: Props) {
  const aliasIdx = useMemo(() => new Map(bundle.tracking.tracks.map((t, i) => [t.alias, i])), [bundle]);
  const points = useMemo(() => trackPoints(bundle), [bundle]);
  const v0 = bundle.visual[0];
  const startFrame = v0?.frame ?? oracle.targets[0]?.event_interval_frames?.[0] ?? Math.floor(bundle.video.nb_frames / 2);
  const startTrack = v0 ? aliasIdx.get(v0.track_ref) ?? null : null;

  const [frame, setFrame] = useState(startFrame);
  const [track, setTrack] = useState<number | null>(startTrack);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => { setFrame(startFrame); setTrack(startTrack); }, [bundle.run_id, startFrame, startTrack]);
  const focus: Focus = { frame, setFrame, track, setTrack, hover, setHover };

  const stops = useMemo(
    () => [...new Set(bundle.steps.flatMap((s) => [s.t_call, s.t_result]))].sort((a, b) => a - b),
    [bundle]
  );
  const jumps = useMemo(() => {
    const scan = bundle.steps.find((s) => s.tool === "scan_video");
    const out: { label: string; t: number }[] = [];
    if (scan) out.push({ label: "tracks ready", t: scan.t_result });
    bundle.visual.forEach((v) => out.push({ label: `Gemma ${v.track_ref}`, t: bundle.steps[v.step].t_result }));
    out.push({ label: "answer", t: bundle.steps[bundle.submission.step].t_result });
    return out;
  }, [bundle]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || tag === "BUTTON") return;
      if (e.code === "Space") { e.preventDefault(); clock.toggle(); }
      else if (e.code === "ArrowRight") { e.preventDefault(); clock.step(1, stops); }
      else if (e.code === "ArrowLeft") { e.preventDefault(); clock.step(-1, stops); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clock, stops]);

  const r = bundle.run;
  return (
    <>
      <div className="runhead">
        <p className="question"><q>{bundle.task.statement}</q></p>
        <div className="meta">
          <span>{bundle.attempt} · {clipLabel(bundle.clip_id, bundle.scorer.wrong_way_count)}</span>
          <span>seed {bundle.seed}</span>
          <span>{r.wall_sec.toFixed(1)} s wall</span>
          <span>{r.orchestrator_calls} Nemotron calls · {r.visual_calls} Gemma calls · 1 tracking job</span>
          <span>SUT <code>{bundle.provenance.sut_commit.slice(0, 7)}</code></span>
        </div>
      </div>

      <div className="transport" role="group" aria-label="Replay the agent's run">
        <button className="primary" onClick={clock.toggle}>{clock.playing ? "❚❚ pause" : "▶ replay"}</button>
        <button onClick={() => clock.step(-1, stops)} aria-label="previous event">◀ event</button>
        <button onClick={() => clock.step(1, stops)} aria-label="next event">event ▶</button>
        <button onClick={clock.restart}>↻ from start</button>
        <span className="clock">run t+{clock.t.toFixed(1)}s / {clock.duration.toFixed(1)}s</span>
        <input id="run-scrub" className="scrub" type="range" min={0} max={clock.duration} step={0.05}
               value={clock.t} onChange={(e) => clock.seek(Number(e.target.value))} aria-label="run position" />
        <select id="run-speed" value={clock.speed} onChange={(e) => clock.setSpeed(Number(e.target.value))}
                aria-label="playback speed">
          {[0.5, 1, 2, 4].map((s) => <option key={s} value={s}>{s}×</option>)}
        </select>
        <div className="jumps">
          <span className="eyebrow">jump to</span>
          {jumps.map((j) => (
            <button key={j.label} onClick={() => { clock.pause(); clock.seek(j.t); }}>{j.label}</button>
          ))}
        </div>
      </div>

      <div className="grid-top">
        <section className="panel">
          <VideoPanel bundle={bundle} oracle={oracle} t={clock.t} focus={focus} points={points} />
        </section>
        <section className="panel">
          <Verdict bundle={bundle} t={clock.t} />
        </section>
      </div>

      <section className="panel">
        <h3 className="ph">Detector and tracker output, track by track</h3>
        <TrackTimeline bundle={bundle} oracle={oracle} t={clock.t} focus={focus} points={points} />
      </section>

      <div className="grid-2">
        <section className="panel">
          <h3 className="ph">Track facts the agent was given</h3>
          <TrackInventory bundle={bundle} t={clock.t} focus={focus} points={points} />
        </section>
        <section className="panel">
          <h3 className="ph">What Gemma was shown, and what it said</h3>
          <Perception bundle={bundle} t={clock.t} focus={focus} aliasIdx={aliasIdx} />
        </section>
      </div>

      <div className="grid-2 narrow-left">
        <section className="panel">
          <h3 className="ph">Budgets</h3>
          <Budget bundle={bundle} t={clock.t} />
        </section>
        <section className="panel">
          <h3 className="ph">Agent trace: every tool call</h3>
          <Steps bundle={bundle} t={clock.t} focus={focus} aliasIdx={aliasIdx} onSeek={(t) => { clock.pause(); clock.seek(t); }} />
        </section>
      </div>
    </>
  );
}
