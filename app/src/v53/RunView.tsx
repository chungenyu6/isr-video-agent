// The V5.3 run layout. Two positions: the pipeline stage (what the host has
// done so far) and the video frame (where you are looking in the clip).

import { useEffect, useMemo, useState } from "react";
import type { Oracle } from "../types";
import { clipLabel } from "../data";
import type { Loaded53 } from "./types";
import { LAST_STAGE, trackPoints53, vehiclePoints } from "./derive";
import Pipeline from "./Pipeline";
import VideoPanel from "./VideoPanel";
import VehicleTimeline from "./VehicleTimeline";
import TrafficRule from "./TrafficRule";
import Grouping from "./Grouping";
import Perception from "./Perception";
import Answer from "./Answer";
import Budget from "./Budget";
import Investigation from "./Investigation";
import Stability from "./Stability";

interface Props { bundle: Loaded53; oracle: Oracle; startStage: number | null }

export interface Focus53 {
  frame: number;
  setFrame: (f: number) => void;
  veh: number | null;
  setVeh: (i: number | null) => void;
  hover: number | null;
  setHover: (i: number | null) => void;
}

export default function RunView({ bundle, oracle, startStage }: Props) {
  const vpts = useMemo(() => vehiclePoints(bundle), [bundle]);
  const tpts = useMemo(() => trackPoints53(bundle), [bundle]);
  const firstTarget = bundle.answer.targets[0];
  const look = bundle.appearance.find((a) => a.media.length)?.media[0];
  const startVeh = firstTarget ? bundle.vehicles.findIndex((v) => v.ref === firstTarget.vehicle_ref) : null;
  const startFrame = look?.frame ?? oracle.targets[0]?.event_interval_frames?.[0] ?? Math.floor(bundle.video.nb_frames / 4);

  const clampStage = (s: number | null) => (s === null ? LAST_STAGE : Math.max(0, Math.min(LAST_STAGE, Math.round(s))));
  const [stage, setStage] = useState(clampStage(startStage));
  const [frame, setFrame] = useState(startFrame);
  const [veh, setVeh] = useState<number | null>(startVeh !== null && startVeh >= 0 ? startVeh : null);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => { setStage(clampStage(startStage)); }, [startStage]);
  const focus: Focus53 = { frame, setFrame, veh, setVeh, hover, setHover };

  const r = bundle.run;
  const q = bundle.query;
  return (
    <>
      <div className="runhead">
        <p className="question"><q>{q.text}</q></p>
        <div className="meta">
          <span>{bundle.attempt} · {clipLabel(bundle.clip_id, bundle.scorer?.wrong_way_count ?? oracle.wrong_way_count)}</span>
          <span>task_id {q.task_id}{q.query_id ? ` · wording ${q.query_id}` : ""}</span>
          <span>seed {bundle.seed}</span>
          <span>{r.wall_sec.toFixed(1)} s wall</span>
          <span>{bundle.budget.nemotron.used} Nemotron calls · {bundle.budget.gemma.used} Gemma calls · {r.tracking_new_inference ? "1 tracking job" : "tracking imported, no new job"}</span>
          <span>SUT <code>{bundle.provenance.sut_commit.slice(0, 7)}</code></span>
        </div>
        <p className="fine">
          The host runs the task named by task_id; the question text is passed along as written.
          {" "}{q.delivered_to.length ? `In this run it reached ${q.delivered_to.join(", ")} inside the investigation case.` : "In this run no model read it: no case, so no agent."}
        </p>
      </div>

      <section className="panel pipepanel">
        <Pipeline bundle={bundle} stage={stage} setStage={setStage} />
      </section>

      <div className="grid-top">
        <section className="panel">
          <VideoPanel bundle={bundle} oracle={oracle} stage={stage} focus={focus} vpts={vpts} tpts={tpts} />
        </section>
        <section className="panel">
          <Answer bundle={bundle} stage={stage} focus={focus} />
        </section>
      </div>

      <section className="panel">
        <h3 className="ph">{stage >= 2 ? "Vehicle records over the clip" : "Tracker IDs over the clip"}</h3>
        <VehicleTimeline bundle={bundle} oracle={oracle} stage={stage} focus={focus} vpts={vpts} tpts={tpts} />
      </section>

      <div className="grid-2">
        <section className="panel">
          <h3 className="ph">Traffic rule: who moves against the flow</h3>
          <TrafficRule bundle={bundle} stage={stage} focus={focus} />
        </section>
        <section className="panel">
          <h3 className="ph">Grouping: tracker IDs into vehicle records</h3>
          <Grouping bundle={bundle} stage={stage} focus={focus} />
        </section>
      </div>

      <section className={`panel${bundle.cases.length ? "" : " quiet"}`} id="investigate">
        <h3 className="ph">Investigate: cases and Nemotron's calls</h3>
        <Investigation bundle={bundle} stage={stage} focus={focus} />
      </section>

      <div className="grid-2 narrow-right">
        <section className="panel">
          <h3 className="ph">What Gemma was shown, and what it said</h3>
          <Perception bundle={bundle} stage={stage} focus={focus} />
        </section>
        <section className="panel">
          <h3 className="ph">Budgets and the agent branch</h3>
          <Budget bundle={bundle} stage={stage} />
        </section>
      </div>

      {bundle.stability && (
        <section className="panel">
          <h3 className="ph">Stability: this clip, four times</h3>
          <Stability bundle={bundle} />
        </section>
      )}
    </>
  );
}
