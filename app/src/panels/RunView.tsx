// The run layout, shared by replay and live mode. Everything below is a function
// of (bundle, oracle, clock.t, video frame); live mode only feeds a growing bundle.

import { useEffect, useMemo, useState } from "react";
import type { Loaded, Oracle } from "../types";
import type { Clock } from "../clock";
import { clipLabel, runLabel } from "../data";
import VideoPanel from "./VideoPanel";
import Timeline from "./Timeline";
import Verdict from "./Verdict";
import Targets from "./Targets";
import Observations from "./Observations";
import Budget from "./Budget";
import ToolRack from "./ToolRack";
import Steps from "./Steps";

interface Props {
  bundle: Loaded;
  oracle: Oracle;
  clock: Clock;
  prefix?: string;
}

export default function RunView({ bundle, oracle, clock, prefix }: Props) {
  // Open on the frame the story is about: the first usable frame of the first
  // wrong-way car, or the middle of the clip when there is none.
  const startFrame = oracle.targets[0]?.pairable_frames[0] ?? Math.floor(bundle.video.nb_frames / 2);
  const [frame, setFrame] = useState(startFrame);
  useEffect(() => { setFrame(startFrame); }, [bundle.run_id, startFrame]);

  const stops = useMemo(() => [...new Set(bundle.events.map((e) => e.t))].sort((a, b) => a - b), [bundle]);

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
        <p className="question"><q>{bundle.task.question}</q></p>
        <div className="meta">
          <span>{clipLabel(r.clip_id)}</span>
          <span>{runLabel(r.stage, r.replicate)}</span>
          {r.candidate !== null && <span>candidate {r.candidate} · locked <code>{r.locked_pattern}</code></span>}
          <span>agent seed {r.agent_seed}</span>
          {r.layout_block !== null && <span>layout {r.layout_block}</span>}
          {bundle.telemetry.wall_clock_sec !== null && (
            <span>{bundle.telemetry.wall_clock_sec}s wall{bundle.telemetry.slow_run ? " · slow" : ""}</span>
          )}
          {r.run_status === "created" ? (
            <span>agent still running</span>
          ) : (
            <span className={r.run_status === "completed" ? "" : "bad"}>
              {r.run_status}{r.agent_exit_code === 124 ? " · hard timeout" : ""}
            </span>
          )}
        </div>
      </div>

      <div className="transport" role="group" aria-label="Replay the agent's run">
        <button className="primary" onClick={clock.toggle}>{clock.playing ? "❚❚ pause" : "▶ replay"}</button>
        <button onClick={() => clock.step(-1, stops)} aria-label="previous event">◀ event</button>
        <button onClick={() => clock.step(1, stops)} aria-label="next event">event ▶</button>
        <button onClick={clock.restart}>↻ from start</button>
        <span className="clock">run t+{clock.t.toFixed(1)}s / {clock.duration.toFixed(1)}s</span>
        <input
          id="run-scrub"
          className="scrub"
          type="range"
          min={0}
          max={clock.duration}
          step={0.05}
          value={clock.t}
          onChange={(e) => clock.seek(Number(e.target.value))}
          aria-label="run position"
        />
        <select
          id="run-speed"
          value={clock.speed}
          onChange={(e) => clock.setSpeed(Number(e.target.value))}
          aria-label="playback speed"
        >
          {[1, 2, 4, 8].map((s) => <option key={s} value={s}>{s}×</option>)}
        </select>
      </div>

      <div className="grid-top">
        <section className="panel">
          <VideoPanel bundle={bundle} oracle={oracle} frame={frame} onFrame={setFrame} t={clock.t} prefix={prefix} />
        </section>
        <section className="panel">
          <Verdict bundle={bundle} oracle={oracle} t={clock.t} />
        </section>
      </div>

      <section className="panel">
        <h3 className="ph">Where the agent looked, against where it needed to look</h3>
        <Timeline bundle={bundle} oracle={oracle} t={clock.t} frame={frame} onFrame={setFrame} />
      </section>

      <div className="grid-2">
        <section className="panel">
          <h3 className="ph">What it reported</h3>
          <Targets bundle={bundle} oracle={oracle} t={clock.t} onFrame={setFrame} prefix={prefix} />
        </section>
        <section className="panel">
          <h3 className="ph">What the vision model said</h3>
          <Observations bundle={bundle} oracle={oracle} t={clock.t} frame={frame} onFrame={setFrame} prefix={prefix} />
        </section>
      </div>

      <div className="grid-2 narrow-left">
        <section className="panel">
          <h3 className="ph">Frame budget</h3>
          <Budget bundle={bundle} t={clock.t} />
          <h3 className="ph">Tools</h3>
          <ToolRack bundle={bundle} t={clock.t} />
        </section>
        <section className="panel">
          <h3 className="ph">Agent trace</h3>
          <Steps bundle={bundle} t={clock.t} />
        </section>
      </div>
    </>
  );
}
