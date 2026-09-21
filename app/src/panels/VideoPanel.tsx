// The clip, two ways.
//
// "Full clip" plays the 349-frame video; "What the model saw" collapses it to the
// frames actually sent to the vision model. Ground truth is an explicit toggle,
// off by default, so you can look with the agent's eyes before you look with the
// oracle's. The agent's own ROI claims are always drawn: they are its evidence.

import { useEffect, useMemo, useRef, useState } from "react";
import type { Loaded, Oracle } from "../types";
import { asset, boxesAt, frameAt, frameProgress, frameUrl } from "../data";

interface Props {
  bundle: Loaded;
  oracle: Oracle;
  frame: number;
  onFrame: (n: number) => void;
  t: number;
  prefix?: string;
}

export default function VideoPanel({ bundle, oracle, frame, onFrame, t, prefix }: Props) {
  const [mode, setMode] = useState<"video" | "agent">("video");
  const [truth, setTruth] = useState(false);
  const [playing, setPlaying] = useState(false);
  const vref = useRef<HTMLVideoElement | null>(null);
  const { fps, nb_frames: nb, width, height } = bundle.video;

  const progress = frameProgress(bundle, t);
  const seen = useMemo(
    () => bundle.frames.filter((f) => f.inspected && f.frame_id !== null)
      .sort((a, b) => (a.frame_id ?? 0) - (b.frame_id ?? 0)),
    [bundle]
  );
  const seenNow = seen.filter((f) => progress.sent.has(f.frame_id!));

  // Video -> frame while playing.
  useEffect(() => {
    if (!playing || mode !== "video") return;
    let raf = 0;
    const tick = () => {
      const v = vref.current;
      if (v) onFrame(frameAt(v.currentTime, fps, nb));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, mode, fps, nb, onFrame]);

  // Frame -> video when paused (timeline clicks, frame steps).
  useEffect(() => {
    const v = vref.current;
    if (!v || playing || mode !== "video") return;
    if (frameAt(v.currentTime, fps, nb) !== frame) v.currentTime = (frame + 0.5) / fps;
  }, [frame, playing, mode, fps, nb]);

  const cur = mode === "agent"
    ? [...seenNow].reverse().find((f) => (f.frame_id ?? 0) <= frame) ?? seenNow[0] ?? null
    : null;
  const shown = mode === "agent" ? cur?.frame_id ?? null : frame;

  const boxes = shown !== null && truth ? boxesAt(oracle, shown) : [];
  const anchors = shown === null ? [] : bundle.evidence.reported_targets.flatMap((rt) =>
    rt.anchors.filter((a) => a.frame_id === shown && a.roi_xyxy).map((a) => ({ ref: rt.target_ref, roi: a.roi_xyxy! })));

  const stepSeen = (dir: 1 | -1) => {
    const ids = seenNow.map((f) => f.frame_id!);
    const next = dir === 1 ? ids.find((i) => i > (shown ?? -1)) : [...ids].reverse().find((i) => i < (shown ?? nb));
    if (next !== undefined) onFrame(next);
  };

  return (
    <div className="videopanel">
      <div className="vtools">
        <div className="toggle" role="group" aria-label="View">
          <button aria-pressed={mode === "video"} onClick={() => setMode("video")}>Full clip</button>
          <button aria-pressed={mode === "agent"} onClick={() => { setMode("agent"); setPlaying(false); vref.current?.pause(); }}>
            What the model saw
          </button>
        </div>
        <label className="check" htmlFor="truth-toggle">
          <input id="truth-toggle" type="checkbox" checked={truth} onChange={(e) => setTruth(e.target.checked)} />
          Show ground truth
        </label>
      </div>

      <div className="screen" style={{ aspectRatio: `${width} / ${height}` }}>
        {mode === "video" ? (
          <video
            ref={vref}
            src={asset(bundle.video.proxy)}
            muted
            playsInline
            preload="auto"
            onPlay={() => setPlaying(true)}
            onPause={() => { setPlaying(false); if (vref.current) onFrame(frameAt(vref.current.currentTime, fps, nb)); }}
            onEnded={() => setPlaying(false)}
          />
        ) : cur?.file ? (
          <img src={frameUrl(bundle._dir, cur.file, prefix)} alt={`Frame ${cur.frame_id} as sent to the vision model`} />
        ) : (
          <div className="empty">{seenNow.length ? "frame file no longer on disk" : "no frame sent to the vision model yet"}</div>
        )}
        <svg className="overlay" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
          {boxes.map((b) => (
            <g key={b.id} className={b.wrongWay ? "gt target" : "gt other"}>
              <rect x={b.box[0]} y={b.box[1]} width={b.box[2] - b.box[0]} height={b.box[3] - b.box[1]} />
              {b.wrongWay && <text x={b.box[0]} y={Math.max(14, b.box[1] - 5)}>wrong-way · {b.color}</text>}
            </g>
          ))}
          {anchors.map((a, i) => (
            <g key={i} className="claim">
              <rect x={a.roi[0]} y={a.roi[1]} width={a.roi[2] - a.roi[0]} height={a.roi[3] - a.roi[1]} />
              <text x={a.roi[0]} y={a.roi[3] + 16}>agent: {a.ref}</text>
            </g>
          ))}
        </svg>
        {shown === 0 && <span className="stamp warn">frame 0 · never used as motion evidence</span>}
      </div>

      <div className="vcontrols">
        {mode === "video" ? (
          <>
            <button onClick={() => { const v = vref.current; if (v) { if (v.paused) void v.play(); else v.pause(); } }}>
              {playing ? "❚❚ pause clip" : "▶ play clip"}
            </button>
            <button onClick={() => onFrame(Math.max(0, frame - 1))} aria-label="previous frame">◀ frame</button>
            <button onClick={() => onFrame(Math.min(nb - 1, frame + 1))} aria-label="next frame">frame ▶</button>
          </>
        ) : (
          <>
            <button onClick={() => stepSeen(-1)} aria-label="previous frame the model saw">◀ seen</button>
            <button onClick={() => stepSeen(1)} aria-label="next frame the model saw">seen ▶</button>
          </>
        )}
        <span className="fcount">
          frame {shown ?? "–"} / {nb - 1} · {shown !== null ? (shown / fps).toFixed(1) : "–"} s
        </span>
      </div>
      <p className="gapline">
        The vision model received <b>{seen.length}</b> of {nb} frames
        ({((100 * seen.length) / nb).toFixed(1)}% of the clip).
        {truth && <> Red boxes: wrong-way cars. Grey: other vehicles. Yellow dashed: the agent's claimed region.</>}
      </p>
    </div>
  );
}
