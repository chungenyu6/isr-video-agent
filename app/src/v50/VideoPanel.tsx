// The clip with the host's perception drawn on it, as it stood after the
// current pipeline stage. Every layer is in source pixels (960x540) inside an
// SVG whose viewBox matches the video.
//
//   after Track:  boxes coloured by tentative tracker ID (T)
//   after Group:  boxes coloured by vehicle record (V); ungrouped boxes grey
//   after Rule:   phases that move against the flow drawn as TARGET
//   after Look:   the TARGET box and crop the host sent to Gemma

import { useEffect, useRef, useState } from "react";
import type { Oracle } from "../types";
import { asset, bundleFile, DIR_LABEL, dirClass, gtBoxesAt, trackColor } from "../data";
import type { Loaded50 } from "./types";
import { phaseAt50 } from "./derive";
import type { Focus50 } from "./RunView";

interface Props {
  bundle: Loaded50;
  oracle: Oracle;
  stage: number;
  focus: Focus50;
  vpts: number[][][];
  tpts: number[][][];
}

const DIR_STROKE = { down: "#C3A6FF", up: "#5FE0D2", side: "#F6C453", unresolved: "#A9B4B6" };
const OPP = "#FF5A3C";
const LAYERS = [
  ["det", "Boxes"],
  ["loose", "Ungrouped boxes"],
  ["trail", "Trails"],
  ["motion", "Movement"],
  ["pred", "Kalman predictions"],
  ["gt", "Ground truth"],
] as const;
type Layer = (typeof LAYERS)[number][0];

export default function VideoPanel({ bundle, oracle, stage, focus, vpts, tpts }: Props) {
  const [mode, setMode] = useState<"video" | "gemma">("video");
  const [on, setOn] = useState<Record<Layer, boolean>>({ det: true, loose: true, trail: true, motion: true, pred: false, gt: false });
  const [playing, setPlaying] = useState(false);
  const vref = useRef<HTMLVideoElement | null>(null);
  const { fps, nb_frames: nb, width, height } = bundle.video;
  const { frame, setFrame } = focus;
  const tracked = stage >= 1;
  const grouped = stage >= 2;
  const ruled = stage >= 3;
  const looked = stage >= 4;
  const tracks = bundle.tracking.tracks;
  const vehicles = bundle.vehicles;
  const fr = bundle.tracking.frames[frame];
  const emph = focus.hover ?? focus.veh;
  const dimV = (vi: number) => (emph !== null && vi !== emph ? 0.3 : 1);

  useEffect(() => {
    if (!playing || mode !== "video") return;
    let raf = 0;
    const tick = () => {
      const v = vref.current;
      if (v) setFrame(Math.min(nb - 1, Math.floor(v.currentTime * fps)));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, mode, fps, nb, setFrame]);

  useEffect(() => {
    const v = vref.current;
    if (!v || playing || mode !== "video") return;
    if (Math.floor(v.currentTime * fps) !== frame) v.currentTime = (frame + 0.5) / fps;
  }, [frame, playing, mode, fps]);

  const shownLooks = looked ? bundle.appearance : [];
  const gem = mode === "gemma"
    ? shownLooks.find((a) => focus.veh !== null && a.vehicle_ref === vehicles[focus.veh]?.ref)
      ?? shownLooks[shownLooks.length - 1] ?? null
    : null;

  // What to draw trails and arrows for: vehicles after grouping, tracker IDs before.
  const units = grouped
    ? vehicles.map((v, i) => ({ key: v.ref, i, span: v.observed, pts: vpts[i], color: trackColor(i), op: dimV(i) }))
    : tracks.map((t, i) => ({ key: t.alias, i, span: t.observed, pts: tpts[i], color: trackColor(i), op: 1 }));
  const active = units.filter((u) => frame >= u.span[0] && frame <= u.span[1] + fps);

  const boxes = fr.d.map((d) => {
    const loose = grouped ? d[6] < 0 : d[5] < 0;
    const color = loose ? "#B8C2C4" : trackColor(grouped ? d[6] : d[5]);
    let label = "";
    if (!loose) {
      if (!grouped) label = tracks[d[5]].alias;
      else label = d[5] >= 0 ? `${vehicles[d[6]].ref}·${tracks[d[5]].alias}` : `${vehicles[d[6]].ref} joined box`;
    }
    return { d, loose, color, label, op: grouped && !loose ? dimV(d[6]) : 1 };
  });
  const nLoose = boxes.filter((b) => b.loose).length;

  return (
    <div className="videopanel">
      <div className="vtools">
        <div className="toggle" role="group" aria-label="View">
          <button aria-pressed={mode === "video"} onClick={() => setMode("video")}>Clip + host perception</button>
          <button aria-pressed={mode === "gemma"} onClick={() => { setMode("gemma"); vref.current?.pause(); }}>
            What Gemma saw
          </button>
        </div>
        {mode === "video" && (
          <div className="layers" role="group" aria-label="Overlay layers">
            {LAYERS.map(([k, label]) => (
              <label key={k} className={`check l-${k}`}>
                <input type="checkbox" checked={on[k]} onChange={(e) => setOn({ ...on, [k]: e.target.checked })} />
                {label}
              </label>
            ))}
          </div>
        )}
      </div>

      {mode === "video" ? (
        <div className="screen" style={{ aspectRatio: `${width} / ${height}` }}>
          <video ref={vref} src={asset(bundle.video.proxy)} muted playsInline preload="auto"
                 onPlay={() => setPlaying(true)}
                 onPause={() => { setPlaying(false); if (vref.current) setFrame(Math.min(nb - 1, Math.floor(vref.current.currentTime * fps))); }}
                 onEnded={() => setPlaying(false)} />
          <svg className="overlay" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
            {on.gt && gtBoxesAt(oracle, frame).map((b) => (
              <g key={b.id} className={b.wrongWay ? "gt target" : "gt other"}>
                <rect x={b.box[0]} y={b.box[1]} width={b.box[2] - b.box[0]} height={b.box[3] - b.box[1]} />
                {b.wrongWay && <text x={b.box[0]} y={Math.min(height - 6, b.box[3] + 18)}>truth: wrong-way · {b.color}</text>}
              </g>
            ))}
            {tracked && on.trail && active.map((u) => {
              const pts = u.pts.filter((p) => p[0] <= frame);
              if (pts.length < 2) return null;
              return <polyline key={`tr${u.key}`} className="trail" points={pts.map((p) => `${p[1]},${p[2]}`).join(" ")}
                               stroke={u.color} opacity={u.op} />;
            })}
            {grouped && on.motion && active.map((u) => {
              const v = vehicles[u.i];
              const ph = phaseAt50(v, Math.min(frame, v.observed[1]));
              if (!ph) return null;
              const a = u.pts.find((p) => p[0] >= ph.start);
              const b = [...u.pts].reverse().find((p) => p[0] <= ph.end);
              if (!a || !b || a === b) return null;
              const opp = ruled && v.opposing.some(([s, e]) => s === ph.start && e === ph.end);
              const dc = ph.valid ? dirClass(ph.direction) : "unresolved";
              const stroke = opp ? OPP : DIR_STROKE[dc];
              const lab = Math.hypot(b[1] - a[1], b[2] - a[2]) > 20;
              return (
                <g key={`mv${v.ref}`} className={`motion${opp ? " opp" : ""}`} opacity={u.op}>
                  <line x1={a[1]} y1={a[2]} x2={b[1]} y2={b[2]} stroke={stroke} markerEnd={`url(#v5arrow-${opp ? "opp" : dc})`} />
                  {lab && (
                    <text x={(a[1] + b[1]) / 2 + 8} y={(a[2] + b[2]) / 2} fill={stroke}>
                      {opp ? "against the flow" : DIR_LABEL[dc]}
                    </text>
                  )}
                </g>
              );
            })}
            {tracked && on.pred && fr.p.map((p, k) => (
              <g key={`p${k}`} className="pred">
                <rect x={p[0]} y={p[1]} width={p[2] - p[0]} height={p[3] - p[1]} stroke={trackColor(p[4])} />
                <text x={p[0]} y={Math.max(12, p[1] - 4)} fill={trackColor(p[4])}>{tracks[p[4]].alias} predicted</text>
              </g>
            ))}
            {tracked && boxes.map((b, k) => {
              if (b.loose ? !on.loose : !on.det) return null;
              const d = b.d;
              return (
                <g key={`d${k}`} className={b.loose ? "det unassoc" : d[5] < 0 ? "det joined" : "det"} opacity={b.loose ? 0.85 : b.op}>
                  <rect x={d[0]} y={d[1]} width={d[2] - d[0]} height={d[3] - d[1]} stroke={b.color} />
                  {b.label && (
                    <text x={d[0]} y={Math.max(13, d[1] - 4)} fill={b.color}>
                      {b.label}{d[4] !== 2 ? ` ${bundle.tracking.classes[String(d[4])] ?? ""}` : ""}
                    </text>
                  )}
                </g>
              );
            })}
            {shownLooks.filter((a) => a.frame === frame).map((a) => (
              <g key={a.observation_ref} className="inspected">
                <rect x={a.target_bbox[0]} y={a.target_bbox[1]} width={a.target_bbox[2] - a.target_bbox[0]}
                      height={a.target_bbox[3] - a.target_bbox[1]} />
                <rect className="cropb" x={a.crop_bounds[0]} y={a.crop_bounds[1]}
                      width={a.crop_bounds[2] - a.crop_bounds[0]} height={a.crop_bounds[3] - a.crop_bounds[1]} />
                <text x={a.crop_bounds[0]} y={Math.max(14, a.crop_bounds[1] - 6)}>TARGET {a.vehicle_ref}·{a.track_ref} → Gemma</text>
              </g>
            ))}
            <defs>
              {Object.entries({ ...DIR_STROKE, opp: OPP }).map(([k, c]) => (
                <marker key={k} id={`v5arrow-${k}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" fill={c} />
                </marker>
              ))}
            </defs>
          </svg>
          {!tracked && <span className="stamp warn">no detections yet · tracking is stage 1</span>}
        </div>
      ) : (
        <div className="gemscreen">
          {gem ? (
            <>
              <figure>
                <img src={bundleFile(bundle._dir, gem.full)} alt={`Frame ${gem.frame} with the TARGET box on ${gem.track_ref}, as sent to Gemma`} />
                <figcaption>full frame {gem.frame}, TARGET box drawn by the host</figcaption>
              </figure>
              <figure className="crop">
                <img src={bundleFile(bundle._dir, gem.crop)} alt={`Padded crop around ${gem.track_ref}`} />
                <figcaption>crop, box + 25% padding</figcaption>
              </figure>
            </>
          ) : (
            <div className="empty">
              {bundle.appearance.length === 0
                ? "No candidate in this run, so Gemma was never called."
                : "Gemma is called in stage 4 (Look)."}
            </div>
          )}
        </div>
      )}

      {mode === "video" && (
        <div className="vcontrols">
          <button onClick={() => { const v = vref.current; if (v) { if (v.paused) void v.play(); else v.pause(); } }}>
            {playing ? "❚❚ pause clip" : "▶ play clip"}
          </button>
          <button onClick={() => setFrame(Math.max(0, frame - 1))} aria-label="previous frame">◀ frame</button>
          <button onClick={() => setFrame(Math.min(nb - 1, frame + 1))} aria-label="next frame">frame ▶</button>
          <span className="fcount">frame {frame} / {nb - 1} · {(frame / fps).toFixed(1)} s</span>
        </div>
      )}
      <p className="gapline">
        {mode === "gemma" ? (
          <>Gemma gets exactly these two images and one factual question about body colour. It never sees the video,
            other vehicles, earlier answers or anything about traffic direction.</>
        ) : !tracked ? (
          <>Tracking has not run yet, so no detector output exists.</>
        ) : grouped ? (
          <><b>{fr.d.length}</b> box{fr.d.length === 1 ? "" : "es"} in this frame{nLoose ? <>, {nLoose} ungrouped (grey dashed)</> : null}.
            {" "}Colour = vehicle record. Labels read <code>V·T</code>: vehicle record and tracker ID.</>
        ) : (
          <>YOLO26s: <b>{fr.d.length}</b> box{fr.d.length === 1 ? "" : "es"} in this frame{nLoose ? <>, {nLoose} not matched to any tracker ID</> : null}.
            {" "}Colour = tentative tracker ID. One car can carry several IDs.</>
        )}
      </p>
    </div>
  );
}
