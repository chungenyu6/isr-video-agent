// One row per vehicle record over the whole clip. Bars are frames with a real
// box; colour is the movement phase. Inside each row the member tracker IDs are
// labelled, a diamond marks where two IDs were joined, and hollow ticks mark
// unmatched boxes the host attached. Under the rows, a strip counts the boxes
// that belong to no vehicle record: the reason no answer is called complete.
// Before grouping, rows are the raw tracker IDs.

import { useState } from "react";
import type { Oracle } from "../types";
import { detectionRuns, dirClass } from "../data";
import type { Loaded50, Vehicle } from "./types";
import { fmt, looseBoxes, memberSpans, phaseAt50 } from "./derive";
import type { Focus50 } from "./RunView";

interface Props { bundle: Loaded50; oracle: Oracle; stage: number; focus: Focus50; vpts: number[][][]; tpts: number[][][] }

const W = 1000, LAB = 74, R = 8, ROW = 17, TOP = 20, STRIP = 26;

export default function VehicleTimeline({ bundle, oracle, stage, focus, vpts, tpts }: Props) {
  const [truth, setTruth] = useState(false);
  const nb = bundle.video.nb_frames;
  const fps = bundle.video.fps;
  const tracked = stage >= 1;
  const grouped = stage >= 2;
  const ruled = stage >= 3;
  const looked = stage >= 4;
  const assembled = stage >= 5;
  const vehicles = bundle.vehicles;
  const tracks = bundle.tracking.tracks;
  const x = (f: number) => LAB + ((W - LAB - R) * f) / nb;
  const fw = (W - LAB - R) / nb;
  const nRows = grouped ? vehicles.length : tracks.length;
  const gtRows = truth ? oracle.targets : [];
  const stripY = TOP + nRows * ROW + 8;
  const gtY = stripY + STRIP + 6;
  const H = gtY + (gtRows.length ? gtRows.length * ROW : 0) + 6;

  const loose = looseBoxes(bundle, grouped);
  const looseTotal = loose.reduce((a, b) => a + b, 0);
  const looseMax = Math.max(1, ...loose);
  const possible = new Map<string, string[]>();
  for (const p of bundle.possible_links) {
    const a = bundle.aliases[p.first], b = bundle.aliases[p.second];
    possible.set(a, [...(possible.get(a) ?? []), b]);
    possible.set(b, [...(possible.get(b) ?? []), a]);
  }
  const targets = new Map(bundle.answer.targets.map((t) => [t.vehicle_ref, t]));

  // Boxes a vehicle record took over from the tracker's unmatched pile.
  const joined = vehicles.map(() => [] as number[]);
  bundle.tracking.frames.forEach((fr, f) => fr.d.forEach((d) => { if (d[5] < 0 && d[6] >= 0) joined[d[6]].push(f); }));

  const onClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    const f = Math.round(((p.x - LAB) / (W - LAB - R)) * nb);
    if (f >= 0 && f < nb) focus.setFrame(f);
    const row = Math.floor((p.y - TOP) / ROW);
    if (grouped && row >= 0 && row < vehicles.length) focus.setVeh(row);
  };

  const segsFor = (v: Vehicle, pts: number[][]) => {
    const segs: { a: number; b: number; dc: string }[] = [];
    const cls = (f: number) => {
      const ph = phaseAt50(v, f);
      return ph && ph.valid ? dirClass(ph.direction) : "unresolved";
    };
    for (const [s, e] of detectionRuns(pts)) {
      let a = s, cur: string = cls(s);
      for (let f = s + 1; f <= e + 1; f++) {
        const dc = f <= e ? cls(f) : "";
        if (dc !== cur) { segs.push({ a, b: f - 1, dc: cur }); a = f; cur = dc; }
      }
    }
    return segs;
  };

  return (
    <div className="tracktl">
      <div className="tl-scroll">
        <svg className={`timeline v5${tracked ? "" : " pending"}`} viewBox={`0 0 ${W} ${H}`} onClick={onClick}
             role="img" aria-label={grouped ? "Vehicle record timeline" : "Tracker ID timeline"}>
          {Array.from({ length: Math.floor(nb / 20) + 1 }, (_, k) => k * 20).map((f) => (
            <g key={f}>
              <line className="grid" x1={x(f)} x2={x(f)} y1={TOP - 4} y2={stripY + STRIP} />
              <text className="axis" x={x(f)} y={12} textAnchor="middle">{f}{f % 40 === 0 ? ` · ${(f / fps).toFixed(0)}s` : ""}</text>
            </g>
          ))}

          {!grouped && tracks.map((t, i) => {
            const y = TOP + i * ROW;
            return (
              <g key={t.alias} className="trow">
                <text className="rowlab" x={4} y={y + 12}>{t.alias}</text>
                {detectionRuns(tpts[i]).map(([a, b]) => (
                  <rect key={a} className="det d-raw" x={x(a)} y={y + 3} width={Math.max(fw, x(b + 1) - x(a))} height={ROW - 6} />
                ))}
              </g>
            );
          })}

          {grouped && vehicles.map((v, i) => {
            const y = TOP + i * ROW;
            const emph = focus.hover === i || focus.veh === i;
            const opp = ruled && v.status === "opposing";
            const unres = ruled && v.status === "unresolved";
            const members = memberSpans(bundle, v);
            const myLinks = bundle.links.filter((l) => bundle.aliases[l.first] === v.ref);
            const tgt = assembled ? targets.get(v.ref) : undefined;
            return (
              <g key={v.ref} className={`trow${emph ? " emph" : ""}${opp ? " opp" : ""}${unres ? " unres" : ""}`}
                 onMouseEnter={() => focus.setHover(i)} onMouseLeave={() => focus.setHover(null)}>
                <rect className="rowbg" x={0} y={y} width={W} height={ROW} />
                <text className="rowlab" x={4} y={y + 12}>
                  {v.ref}{unres ? " ?" : ""}
                  {possible.has(v.ref) && <tspan className="poss"> ≈{possible.get(v.ref)!.join(",")}</tspan>}
                </text>
                {segsFor(v, vpts[i]).map((s) => (
                  <rect key={s.a} className={`det d-${s.dc}`} x={x(s.a)} y={y + 3} width={Math.max(fw, x(s.b + 1) - x(s.a))} height={ROW - 6} />
                ))}
                {opp && v.opposing.map(([a, b]) => (
                  <rect key={`o${a}`} className="oppband" x={x(a)} y={y + 2} width={x(b + 1) - x(a)} height={ROW - 4} />
                ))}
                {members.length > 1 && members.map((m) => (
                  x(m.span[1] + 1) - x(m.span[0]) > 22 &&
                  <text key={m.alias} className="tlab" x={x(m.span[0]) + 3} y={y + 11.5}>{m.alias}</text>
                ))}
                {members.slice(1).map((m, k) => {
                  const prev = members[k];
                  const fx = (x(prev.span[1] + 1) + x(m.span[0])) / 2;
                  const ev = myLinks[k]?.evidence;
                  return (
                    <path key={`l${m.alias}`} className="linkmark" d={`M${fx},${y + 1} l4,7.5 l-4,7.5 l-4,-7.5 z`}>
                      <title>
                        {`${prev.alias} → ${m.alias} joined: gap ${ev ? ev.missing_frames : "?"} frame(s), IoU ${fmt(ev?.iou ?? null)}, size ratio ${fmt(ev?.area_ratio ?? null)}, prediction error ${fmt(ev?.prediction_error_diagonals ?? null)} diagonals; each was the other's only candidate`}
                      </title>
                    </path>
                  );
                })}
                {joined[i].map((f) => <rect key={`j${f}`} className="joinedtick" x={x(f) + fw * 0.2} y={y + ROW - 3} width={fw * 0.6} height={2.5} />)}
                {looked && bundle.appearance.map((a) => a.vehicle_ref === v.ref && (
                  <path key={a.observation_ref} className="gemma" d={`M${x(a.frame) + fw / 2},${y + 1.5} l5,7 l-5,7 l-5,-7 z`} />
                ))}
                {tgt?.source_frame_intervals.map(([a, b]) => (
                  <path key={`r${a}`} className="reported" d={`M${x(a)},${y + 4} v-3 H${x(b + 1)} v3`} />
                ))}
              </g>
            );
          })}

          {tracked && (
            <g className="loosestrip">
              <text className="rowlab" x={4} y={stripY + 11}>{grouped ? "ungrouped" : "unmatched"}</text>
              <text className="rowlab" x={4} y={stripY + 22}>{looseTotal} boxes</text>
              {loose.map((n, f) => n > 0 && (
                <rect key={f} className="loosebar" x={x(f)} width={fw} y={stripY + STRIP - (STRIP - 4) * (n / looseMax)}
                      height={(STRIP - 4) * (n / looseMax)} />
              ))}
            </g>
          )}

          {gtRows.map((g, k) => {
            const y = gtY + k * ROW;
            const iv = g.event_interval_frames;
            return (
              <g key={g.object_id}>
                <text className="rowlab truth" x={4} y={y + 12}>truth</text>
                {iv && <rect className="gtband" x={x(iv[0])} y={y + 3} width={x(iv[1] + 1) - x(iv[0])} height={ROW - 6} />}
                {iv && <text className="axis" x={x(iv[1] + 1) + 4} y={y + 12}>{g.object_id} · {g.color_name} wrong-way, frames {iv[0]}–{iv[1]}</text>}
              </g>
            );
          })}
          <line className="playhead" x1={x(focus.frame) + fw / 2} x2={x(focus.frame) + fw / 2} y1={TOP - 4} y2={stripY + STRIP} />
          {!tracked && (
            <text className="waiting" x={W / 2} y={TOP + (nRows * ROW) / 2} textAnchor="middle">
              rows appear after stage 1 (Track)
            </text>
          )}
        </svg>
      </div>
      <div className="legend">
        {grouped ? (
          <>
            <span><i className="sw d-up" />upward</span>
            <span><i className="sw d-down" />downward</span>
            <span><i className="sw d-side" />sideways</span>
            <span><i className="sw d-unresolved" />no direction</span>
            {ruled && <span><i className="sw oppband" />against the flow</span>}
            <span><i className="sw linkmark" />tracker IDs joined</span>
            <span><i className="sw joinedtick" />unmatched box attached</span>
            {looked && <span><i className="sw gemma" />frame sent to Gemma</span>}
            {assembled && <span><i className="sw reported" />frames reported in the answer</span>}
          </>
        ) : (
          <span><i className="sw d-raw" />frames with a box for this tracker ID</span>
        )}
        <label className="check" htmlFor="tl5-truth">
          <input id="tl5-truth" type="checkbox" checked={truth} onChange={(e) => setTruth(e.target.checked)} />
          show ground-truth interval
        </label>
      </div>
      <p className="fine">
        {grouped
          ? <>Rows are the host's vehicle records. ≈ marks two records that might be one vehicle but were not joined;
            they vote once together. The bottom strip counts boxes in no vehicle record, per frame. Because they are
            not explained, the host keeps count_complete false. They are box records, not missing cars: entries, exits
            and duplicate boxes of known vehicles land here too.</>
          : <>Rows are tentative tracker IDs, before the host groups them. The strip counts boxes the tracker matched
            to no ID.</>}
      </p>
    </div>
  );
}
