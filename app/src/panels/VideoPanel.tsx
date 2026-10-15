// The clip with the host's perception drawn on it.
//
// Every layer is in source pixels (960x540) inside an SVG whose viewBox matches
// the video, so no coordinate maths is needed. Tracking layers stay hidden until
// scan_video returns on the run clock: before that, nobody - host or agent - has
// seen a single detection.

import { useEffect, useRef, useState } from "react";
import type { Loaded, Oracle } from "../types";
import {
  asset, bundleFile, DIR_LABEL, dirClass, gtBoxesAt, phaseAt, trackColor, tracksShown, visualShown,
} from "../data";
import type { Focus } from "./RunView";

interface Props { bundle: Loaded; oracle: Oracle; t: number; focus: Focus; points: number[][][] }

const DIR_STROKE = { down: "#C3A6FF", up: "#5FE0D2", side: "#F6C453", unresolved: "#A9B4B6" };
const LAYERS = [
  ["det", "Detections"],
  ["trail", "Track trails"],
  ["motion", "Movement"],
  ["pred", "Kalman predictions"],
  ["gt", "Ground truth"],
] as const;
type Layer = (typeof LAYERS)[number][0];

export default function VideoPanel({ bundle, oracle, t, focus, points }: Props) {
  const [mode, setMode] = useState<"video" | "gemma">("video");
  const [on, setOn] = useState<Record<Layer, boolean>>({ det: true, trail: true, motion: true, pred: false, gt: false });
  const [playing, setPlaying] = useState(false);
  const vref = useRef<HTMLVideoElement | null>(null);
  const { fps, nb_frames: nb, width, height } = bundle.video;
  const { frame, setFrame } = focus;
  const shown = tracksShown(bundle, t);
  const tracks = bundle.tracking.tracks;
  const fr = bundle.tracking.frames[frame];
  const emph = focus.hover ?? focus.track;
  const dim = (i: number) => (emph !== null && i !== emph ? 0.3 : 1);

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

  const visibleVisuals = bundle.visual.map((v, i) => ({ v, i })).filter(({ i }) => visualShown(bundle, i, t));
  const gem = mode === "gemma"
    ? visibleVisuals.find(({ v }) => focus.track !== null && v.track_ref === tracks[focus.track]?.alias)?.v
      ?? visibleVisuals[visibleVisuals.length - 1]?.v ?? null
    : null;

  // Tracks worth drawing at this frame: observed now, or seen within the last second.
  const active = tracks.map((tr, i) => ({ tr, i })).filter(({ tr }) =>
    frame >= tr.observed[0] && frame <= tr.observed[1] + fps);

  const nDet = fr.d.length;
  const nUnassoc = fr.d.filter((d) => d[5] < 0).length;

  return (
    <div className="videopanel">
      <div className="vtools">
        <div className="toggle" role="group" aria-label="View">
          <button aria-pressed={mode === "video"} onClick={() => setMode("video")}>Clip + tracking</button>
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
            {shown && on.trail && active.map(({ tr, i }) => {
              const pts = points[i].filter((p) => p[0] <= frame);
              if (pts.length < 2) return null;
              return (
                <polyline key={`tr${tr.alias}`} className="trail" points={pts.map((p) => `${p[1]},${p[2]}`).join(" ")}
                          stroke={trackColor(i)} opacity={dim(i)} />
              );
            })}
            {shown && on.motion && active.map(({ tr, i }) => {
              const ph = phaseAt(tr, Math.min(frame, tr.observed[1]));
              if (!ph) return null;
              const pts = points[i];
              const a = pts.find((p) => p[0] >= ph.start);
              const b = [...pts].reverse().find((p) => p[0] <= ph.end);
              if (!a || !b || a === b) return null;
              const dc = dirClass(ph.direction);
              const lab = Math.hypot(b[1] - a[1], b[2] - a[2]) > 20;
              return (
                <g key={`mv${tr.alias}`} className="motion" opacity={dim(i)}>
                  <line x1={a[1]} y1={a[2]} x2={b[1]} y2={b[2]} stroke={DIR_STROKE[dc]} markerEnd={`url(#arrow-${dc})`} />
                  {lab && <text x={(a[1] + b[1]) / 2 + 8} y={(a[2] + b[2]) / 2} fill={DIR_STROKE[dc]}>{DIR_LABEL[dc]}</text>}
                </g>
              );
            })}
            {shown && on.pred && fr.p.map((p, k) => (
              <g key={`p${k}`} className="pred" opacity={dim(p[4])}>
                <rect x={p[0]} y={p[1]} width={p[2] - p[0]} height={p[3] - p[1]} stroke={trackColor(p[4])} />
                <text x={p[0]} y={Math.max(12, p[1] - 4)} fill={trackColor(p[4])}>{tracks[p[4]].alias} predicted</text>
              </g>
            ))}
            {shown && on.det && fr.d.map((d, k) => (
              <g key={`d${k}`} className={d[5] < 0 ? "det unassoc" : "det"} opacity={d[5] < 0 ? 0.8 : dim(d[5])}>
                <rect x={d[0]} y={d[1]} width={d[2] - d[0]} height={d[3] - d[1]} stroke={trackColor(d[5])} />
                {d[5] >= 0 && (
                  <text x={d[0]} y={Math.max(13, d[1] - 4)} fill={trackColor(d[5])}>
                    {tracks[d[5]].alias}{d[4] !== 2 ? ` ${bundle.tracking.classes[String(d[4])] ?? ""}` : ""}
                  </text>
                )}
              </g>
            ))}
            {visibleVisuals.filter(({ v }) => v.frame === frame).map(({ v }) => (
              <g key={v.observation_ref} className="inspected">
                <rect x={v.target_bbox[0]} y={v.target_bbox[1]} width={v.target_bbox[2] - v.target_bbox[0]}
                      height={v.target_bbox[3] - v.target_bbox[1]} />
                <rect className="cropb" x={v.crop_bounds[0]} y={v.crop_bounds[1]}
                      width={v.crop_bounds[2] - v.crop_bounds[0]} height={v.crop_bounds[3] - v.crop_bounds[1]} />
                <text x={v.crop_bounds[0]} y={Math.max(14, v.crop_bounds[1] - 6)}>TARGET {v.track_ref} → Gemma</text>
              </g>
            ))}
            <defs>
              {Object.entries(DIR_STROKE).map(([k, c]) => (
                <marker key={k} id={`arrow-${k}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" fill={c} />
                </marker>
              ))}
            </defs>
          </svg>
          {!shown && (
            <span className="stamp warn">
              no detections yet · tracking runs inside scan_video and returns at run t+{bundle.tracking.visible_from.toFixed(1)}s
            </span>
          )}
        </div>
      ) : (
        <div className="gemscreen">
          {gem ? (
            <>
              <figure>
                <img src={bundleFile(bundle._dir, gem.full)} alt={`Frame ${gem.frame} with the TARGET ${gem.track_ref} box, as sent to Gemma`} />
                <figcaption>full frame {gem.frame}, TARGET box drawn by the host</figcaption>
              </figure>
              <figure className="crop">
                <img src={bundleFile(bundle._dir, gem.crop)} alt={`Padded crop around ${gem.track_ref}`} />
                <figcaption>crop, box + 25% padding</figcaption>
              </figure>
            </>
          ) : (
            <div className="empty">
              {bundle.visual.length === 0 ? "This attempt never called Gemma." : "Gemma has not been called yet at this point of the run."}
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
          <>Gemma gets exactly these two images and a one-line factual question. It never sees the video, other tracks or earlier answers.</>
        ) : shown ? (
          <>YOLO26s: <b>{nDet}</b> detection{nDet === 1 ? "" : "s"} in this frame{nUnassoc ? <>, {nUnassoc} not associated with any track (grey dashed)</> : null}.
            {" "}Box colour = track ID. Arrows = the host's movement phase for that track.</>
        ) : (
          <>The agent has not called scan_video yet, so no detector output exists.</>
        )}
      </p>
    </div>
  );
}

