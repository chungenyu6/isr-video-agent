// Tracker IDs → vehicle records → one vote each → against the flow, drawn from
// the real tracking data of clip 1-nominal-r1 over frame 30 (V5.3 attempt a005;
// identical tracking to V5.0 attempt a002).

import { useMemo } from "react";
import { asset, trackColor } from "../data";
import type { Loaded53 } from "./types";
import { maxAngle, memberSpans, trackPoints53, vehiclePoints } from "./derive";

const STILL = "arch/1-nominal-r1-f30.jpg";
const OPP = "#FF5A3C";
const FLOW = "#5FE0D2";

function Panel({ n, title, children, caption }: { n: number; title: string; children: React.ReactNode; caption: React.ReactNode }) {
  return (
    <figure className="explain">
      <div className="screen" style={{ aspectRatio: "960 / 540" }}>
        <img src={asset(STILL)} alt="" />
        <svg className="overlay" viewBox="0 0 960 540" preserveAspectRatio="none" aria-hidden="true">{children}</svg>
      </div>
      <figcaption><b>{n}. {title}</b> {caption}</figcaption>
    </figure>
  );
}

const line = (pts: number[][]) => pts.map((p) => `${p[1]},${p[2]}`).join(" ");
const mean = (pts: number[][]) => [pts.reduce((a, p) => a + p[1], 0) / pts.length, pts.reduce((a, p) => a + p[2], 0) / pts.length];

export default function RuleExplainer({ bundle }: { bundle: Loaded53 }) {
  const tpts = useMemo(() => trackPoints53(bundle), [bundle]);
  const vpts = useMemo(() => vehiclePoints(bundle), [bundle]);
  const vIdx = new Map(bundle.vehicles.map((v, i) => [v.ref, i]));
  const tIdx = new Map(bundle.tracking.tracks.map((t, i) => [t.alias, i]));
  const multi = bundle.vehicles.map((v, i) => ({ v, i, m: memberSpans(bundle, v) })).filter((x) => x.m.length > 1);
  const target = bundle.vehicles.find((v) => v.status === "opposing");
  const ti = target ? vIdx.get(target.ref)! : -1;
  const flow = target?.flow ?? null;
  const ang = target ? maxAngle(target) : null;
  const split = multi.find((x) => x.v.ref === target?.ref) ?? multi[0];

  return (
    <div className="explainers">
      <Panel n={1} title="Tracker IDs"
             caption={<>ByteTrack hands back {bundle.tracking.tracks.length} tentative IDs for the whole clip. A car that is
               lost for a frame comes back with a new ID{split ? <>: {split.m.map((m) => m.alias).join(" and ")} are one car</> : null}.</>}>
        {tpts.map((pts, i) => pts.length > 1 && (
          <polyline key={i} className="trail" points={line(pts)} stroke={trackColor(i)} />
        ))}
        {split?.m.map((m) => {
          const pts = tpts[tIdx.get(m.alias)!];
          const p = pts[Math.floor(pts.length / 2)];
          return <g key={m.alias} className="det"><text x={p[1] + 10} y={p[2]} fill={trackColor(tIdx.get(m.alias)!)}>{m.alias}</text></g>;
        })}
      </Panel>
      <Panel n={2} title="Vehicle records"
             caption={<>The host joins IDs only when the gap is short, the position and size fit, and each is the other's
               only candidate: {bundle.vehicles.length} vehicle records. Close-but-unclear pairs stay apart.</>}>
        {vpts.map((pts, i) => pts.length > 1 && (
          <polyline key={i} className="trail" points={line(pts)} stroke={trackColor(i)} />
        ))}
        {multi.map(({ v, i, m }) => m.slice(1).map((mm) => {
          const p = vpts[i].find((q) => q[0] >= mm.span[0]);
          return p && (
            <g key={v.ref + mm.alias} className="det">
              <circle className="joinmark" cx={p[1]} cy={p[2]} r={8} />
              <text x={p[1] + 12} y={p[2] + 5} fill={trackColor(i)}>{v.ref} = {m.map((x) => x.alias).join("+")}</text>
            </g>
          );
        }))}
      </Panel>
      <Panel n={3} title="One vote each"
             caption={<>Each record votes once with its stable direction; records that might be one car vote together.
               {" "}{bundle.votes.length} votes here.</>}>
        <defs>
          <marker id="ex5-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill="#F4F7F7" />
          </marker>
        </defs>
        {bundle.votes.map((u, k) => {
          const pts = u.vehicles.flatMap((r) => vpts[vIdx.get(r)!]);
          const [cx, cy] = mean(pts);
          return (
            <g key={k} className="motion">
              <line x1={cx - u.vector[0] * 28} y1={cy - u.vector[1] * 28} x2={cx + u.vector[0] * 28} y2={cy + u.vector[1] * 28}
                    stroke="#F4F7F7" markerEnd="url(#ex5-arrow)" />
              {u.vehicles.length > 1 && <text x={cx + 14} y={cy + 4} fill="#F4F7F7">{u.vehicles.join("+")}</text>}
            </g>
          );
        })}
      </Panel>
      <Panel n={4} title="Against the flow"
             caption={target && ang !== null
               ? <>The other votes agree on one flow. {target.ref}'s phase {target.opposing.map(([a, b]) => `${a}–${b}`).join(", ")} runs
                 {" "}{ang.toFixed(0)}° against it, past the 135° line: a candidate. Nobody asked a model.</>
               : <>No vehicle runs 135° or more against the flow.</>}>
        <defs>
          <marker id="ex5-opp" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill={OPP} />
          </marker>
          <marker id="ex5-flow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill={FLOW} />
          </marker>
        </defs>
        {vpts.map((pts, i) => i !== ti && pts.length > 1 && (
          <polyline key={i} className="trail ghost" points={line(pts)} stroke="#C9D1D2" />
        ))}
        {flow && (
          <g className="motion">
            <line x1={760} y1={420} x2={760 + flow[0] * 150} y2={420 + flow[1] * 150} stroke={FLOW} markerEnd="url(#ex5-flow)" />
            <text x={772} y={330} fill={FLOW}>flow of the others</text>
          </g>
        )}
        {target && target.opposing.map(([a, b]) => {
          const pts = vpts[ti].filter((p) => p[0] >= a && p[0] <= b);
          if (pts.length < 2) return null;
          const s = pts[0], e = pts[pts.length - 1];
          return (
            <g key={a} className="motion opp">
              <polyline className="trail" points={line(pts)} stroke={OPP} />
              <line x1={s[1]} y1={s[2]} x2={e[1]} y2={e[2]} stroke={OPP} markerEnd="url(#ex5-opp)" />
              <text x={e[1] + 10} y={e[2] - 30} fill={OPP}>{target.ref} · {ang?.toFixed(0)}°</text>
            </g>
          );
        })}
      </Panel>
    </div>
  );
}
