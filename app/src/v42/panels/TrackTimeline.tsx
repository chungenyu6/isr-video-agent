// One row per tracker ID over the whole clip: where YOLO26s+ByteTrack actually
// detected it, where the tracker only predicted it, which way the host's geometry
// says it moved, and which frame went to Gemma. Click to move the video there.

import { useState } from "react";
import type { Loaded, Oracle } from "../../types";
import { detectionRuns, dirClass, phaseAt, tracksShown, visualShown } from "../../data";
import type { Focus } from "./RunView";

interface Props { bundle: Loaded; oracle: Oracle; t: number; focus: Focus; points: number[][][] }

const W = 1000, LAB = 46, R = 8, ROW = 15, TOP = 20;

export default function TrackTimeline({ bundle, oracle, t, focus, points }: Props) {
  const [truth, setTruth] = useState(false);
  const nb = bundle.video.nb_frames;
  const fps = bundle.video.fps;
  const tracks = bundle.tracking.tracks;
  const shown = tracksShown(bundle, t);
  const x = (f: number) => LAB + ((W - LAB - R) * f) / nb;
  const fw = (W - LAB - R) / nb;
  const gtRows = truth ? oracle.targets : [];
  const H = TOP + tracks.length * ROW + (gtRows.length ? 8 + gtRows.length * ROW : 0) + 6;

  const preds = tracks.map(() => [] as number[]);
  bundle.tracking.frames.forEach((fr, f) => fr.p.forEach((p) => preds[p[4]].push(f)));

  const onClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    const f = Math.round(((p.x - LAB) / (W - LAB - R)) * nb);
    if (f >= 0 && f < nb) focus.setFrame(f);
    const row = Math.floor((p.y - TOP) / ROW);
    if (shown && row >= 0 && row < tracks.length) focus.setTrack(row);
  };

  return (
    <div className="tracktl">
      <div className="tl-scroll">
        <svg className={`timeline${shown ? "" : " pending"}`} viewBox={`0 0 ${W} ${H}`} onClick={onClick}
             role="img" aria-label="Track timeline">
          {Array.from({ length: Math.floor(nb / 20) + 1 }, (_, k) => k * 20).map((f) => (
            <g key={f}>
              <line className="grid" x1={x(f)} x2={x(f)} y1={TOP - 4} y2={H - 4} />
              <text className="axis" x={x(f)} y={12} textAnchor="middle">{f}{f % 40 === 0 ? ` · ${(f / fps).toFixed(0)}s` : ""}</text>
            </g>
          ))}
          {tracks.map((tr, i) => {
            const y = TOP + i * ROW;
            const segs: { a: number; b: number; dc: string }[] = [];
            for (const [s, e] of detectionRuns(points[i])) {
              let a = s, cur = dirClass(phaseAt(tr, s)?.direction ?? "unresolved");
              for (let f = s + 1; f <= e + 1; f++) {
                const dc = f <= e ? dirClass(phaseAt(tr, f)?.direction ?? "unresolved") : "";
                if (dc !== cur) { segs.push({ a, b: f - 1, dc: cur }); a = f; cur = dc as typeof cur; }
              }
            }
            const emph = focus.hover === i || focus.track === i;
            return (
              <g key={tr.alias} className={`trow${emph ? " emph" : ""}`}
                 onMouseEnter={() => shown && focus.setHover(i)} onMouseLeave={() => focus.setHover(null)}>
                <rect className="rowbg" x={0} y={y} width={W} height={ROW} />
                <text className="rowlab" x={4} y={y + 11}>{tr.alias}</text>
                {preds[i].map((f) => <rect key={`p${f}`} className="predtick" x={x(f)} y={y + 7} width={fw} height={1.5} />)}
                {segs.map((s) => (
                  <rect key={s.a} className={`det d-${s.dc}`} x={x(s.a)} y={y + 3} width={Math.max(fw, x(s.b + 1) - x(s.a))} height={ROW - 6} />
                ))}
                {bundle.visual.map((v, k) => v.track_ref === tr.alias && visualShown(bundle, k, t) && (
                  <path key={v.observation_ref} className="gemma" d={`M${x(v.frame) + fw / 2},${y + 1} l5,6.5 l-5,6.5 l-5,-6.5 z`} />
                ))}
              </g>
            );
          })}
          {gtRows.map((g, k) => {
            const y = TOP + tracks.length * ROW + 8 + k * ROW;
            const iv = g.event_interval_frames;
            return (
              <g key={g.object_id}>
                <text className="rowlab truth" x={4} y={y + 11}>truth</text>
                {iv && <rect className="gtband" x={x(iv[0])} y={y + 3} width={x(iv[1] + 1) - x(iv[0])} height={ROW - 6} />}
                {iv && <text className="axis" x={x(iv[1] + 1) + 4} y={y + 11}>{g.object_id} · {g.color_name} wrong-way, frames {iv[0]}–{iv[1]}</text>}
              </g>
            );
          })}
          <line className="playhead" x1={x(focus.frame) + fw / 2} x2={x(focus.frame) + fw / 2} y1={TOP - 4} y2={H - 2} />
          {!shown && (
            <text className="waiting" x={W / 2} y={TOP + (tracks.length * ROW) / 2} textAnchor="middle">
              tracks appear when scan_video returns (run t+{bundle.tracking.visible_from.toFixed(1)}s)
            </text>
          )}
        </svg>
      </div>
      <div className="legend">
        <span><i className="sw d-up" />upward</span>
        <span><i className="sw d-down" />downward</span>
        <span><i className="sw d-side" />sideways</span>
        <span><i className="sw d-unresolved" />unresolved</span>
        <span><i className="sw predtick" />tracker prediction only (not observed)</span>
        <span><i className="sw gemma" />frame sent to Gemma</span>
        <label className="check" htmlFor="tl-truth">
          <input id="tl-truth" type="checkbox" checked={truth} onChange={(e) => setTruth(e.target.checked)} />
          show ground-truth interval
        </label>
      </div>
      <p className="fine">
        Bars are frames with a real detection. Gaps are frames where the tracker lost the vehicle. Colour is the host's
        movement phase (5-point median, 8 directions). It is geometry, not a wrong-way verdict. The host never decides
        which direction is "wrong"; the agent has to compare tracks. IDs are tentative, and one vehicle can appear
        as several IDs.
      </p>
    </div>
  );
}
