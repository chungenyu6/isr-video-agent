// Detection → association → trajectory → movement, drawn from the real a002
// tracking data over frame 30 of the published clip.

import { useMemo } from "react";
import type { Loaded } from "../types";
import { asset, DIR_LABEL, dirClass, trackColor, trackPoints } from "../data";

const F = 30;
const STILL = "arch/1-nominal-r1-f30.jpg";
const DIR_STROKE = { down: "#C3A6FF", up: "#5FE0D2", side: "#F6C453", unresolved: "#A9B4B6" };

function Panel({ n, title, children, caption }: { n: number; title: string; children: React.ReactNode; caption: string }) {
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

export default function TrackingExplainer({ bundle }: { bundle: Loaded }) {
  const fr = bundle.tracking.frames[F];
  const tracks = bundle.tracking.tracks;
  const points = useMemo(() => trackPoints(bundle), [bundle]);
  const cls = (c: number) => bundle.tracking.classes[String(c)] ?? String(c);
  // A second box on an already-boxed vehicle gets its label on the other side.
  const dup = fr.d.map((d, k) => fr.d.slice(0, k).some((e) => Math.abs(e[0] - d[0]) < 12 && Math.abs(e[1] - d[1]) < 12));

  return (
    <div className="explainers">
      <Panel n={1} title="Detect"
             caption={`YOLO26s finds ${fr.d.length} boxes in frame ${F}. It boxes the yellow van twice, once as a car and once as a truck. Every original frame is processed.`}>
        {fr.d.map((d, k) => (
          <g key={k} className="det plain">
            <rect x={d[0]} y={d[1]} width={d[2] - d[0]} height={d[3] - d[1]} />
            <text x={dup[k] ? d[2] + 4 : d[0]} y={dup[k] ? d[1] + 14 : d[3] + 15}>{cls(d[4])}</text>
          </g>
        ))}
      </Panel>
      <Panel n={2} title="Associate"
             caption="ByteTrack links each box to a tentative ID from frame to frame. The duplicate truck box matches no track and is kept apart, so it never becomes a second vehicle.">
        {fr.d.map((d, k) => (
          <g key={k} className={d[5] < 0 ? "det unassoc" : "det"}>
            <rect x={d[0]} y={d[1]} width={d[2] - d[0]} height={d[3] - d[1]} stroke={trackColor(d[5])} />
            <text x={dup[k] ? d[2] + 4 : d[0]} y={dup[k] ? d[1] + 14 : Math.max(13, d[1] - 4)} fill={trackColor(d[5])}>
              {d[5] < 0 ? "unmatched" : tracks[d[5]].alias}
            </text>
          </g>
        ))}
      </Panel>
      <Panel n={3} title="Trajectories"
             caption={`Box centres over the whole 20-second clip: ${tracks.length} track IDs. Short or broken tracks are common, and one car can end up as several IDs.`}>
        {points.map((pts, i) => pts.length > 1 && (
          <polyline key={i} className="trail" points={pts.map((p) => `${p[1]},${p[2]}`).join(" ")} stroke={trackColor(i)} />
        ))}
      </Panel>
      <Panel n={4} title="Movement"
             caption="The host median-smooths each path and labels every phase with one of 8 directions, or unresolved. Only T3 moves downward. The host does not decide which direction is wrong; the agent has to compare tracks.">
        <defs>
          {Object.entries(DIR_STROKE).map(([k, c]) => (
            <marker key={k} id={`ex-arrow-${k}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill={c} />
            </marker>
          ))}
        </defs>
        {tracks.flatMap((tr, i) => tr.phases.map((ph) => {
          const a = points[i].find((p) => p[0] >= ph.start);
          const b = [...points[i]].reverse().find((p) => p[0] <= ph.end);
          if (!a || !b || Math.hypot(b[1] - a[1], b[2] - a[2]) < 25) return null;
          const dc = dirClass(ph.direction);
          return (
            <g key={`${tr.alias}-${ph.start}`} className="motion">
              <line x1={a[1]} y1={a[2]} x2={b[1]} y2={b[2]} stroke={DIR_STROKE[dc]} markerEnd={`url(#ex-arrow-${dc})`} />
              {dc === "down" && <text x={b[1] + 8} y={b[2] - 8} fill={DIR_STROKE[dc]}>{tr.alias} {DIR_LABEL[dc]}</text>}
            </g>
          );
        }))}
      </Panel>
    </div>
  );
}
