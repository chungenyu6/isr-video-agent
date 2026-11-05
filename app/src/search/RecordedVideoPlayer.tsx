import { useCallback, useEffect, useRef, useState } from 'react';
import { asset } from '../data';
import type { Detail } from './types';

export default function RecordedVideoPlayer({b, showGroundTruth = false, compact = false}: {
  b: Detail; showGroundTruth?: boolean; compact?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [frame, setFrame] = useState(0);
  const [layer, setLayer] = useState('none');
  const [targetOnly, setTargetOnly] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const sync = useCallback((time: number) => {
    setFrame(Math.max(0, Math.min(b.video.nb_frames - 1, Math.floor(time * b.video.fps + 0.0001))));
  }, [b.video.fps, b.video.nb_frames]);

  // Use presented-frame timestamps while playing; seeking also updates immediately.
  useEffect(() => {
    const video = ref.current;
    if (!playing || !video) return;
    let id = 0;
    let active = true;
    if (typeof video.requestVideoFrameCallback === 'function') {
      const tick: VideoFrameRequestCallback = (_now, metadata) => {
        if (!active) return;
        sync(metadata.mediaTime);
        id = video.requestVideoFrameCallback(tick);
      };
      id = video.requestVideoFrameCallback(tick);
      return () => { active = false; video.cancelVideoFrameCallback(id); };
    }
    const tick = () => { sync(video.currentTime); id = requestAnimationFrame(tick); };
    id = requestAnimationFrame(tick);
    return () => { active = false; cancelAnimationFrame(id); };
  }, [playing, sync]);

  const targets = new Set(b.answer.targets.map(t => t.vehicle_ref));
  const boxes = b.tracking.frames[frame]?.d ?? [];
  const seek = (next: number) => {
    setFrame(next);
    if (ref.current) ref.current.currentTime = next / b.video.fps;
  };
  return <div className={`recorded-player${compact ? ' recorded-player-compact' : ''}`}>
    <div className="search-filters">
      <label className="search-select">System overlay
        <select aria-label="System overlay" value={layer} onChange={e => setLayer(e.target.value)}>
          <option value="none">Video only</option>
          <option value="track">Detector boxes + track IDs</option>
          <option value="vehicle">Host vehicle groups</option>
        </select>
      </label>
      <label className="search-toggle"><input type="checkbox" checked={targetOnly} onChange={e => setTargetOnly(e.target.checked)}/>Reported vehicles only</label>
    </div>
    <div className="search-video">
      <video ref={ref} src={asset(`content/search/runs/${b.id}/video.mp4`)} controls playsInline preload="metadata"
        aria-label="Recorded traffic video"
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
        onTimeUpdate={e => sync(e.currentTarget.currentTime)} onSeeked={e => sync(e.currentTarget.currentTime)}
        onError={() => setFailed(true)}/>
      <svg viewBox={`0 0 ${b.video.width} ${b.video.height}`} aria-hidden="true">
        {layer !== 'none' && boxes.map((box, i) => {
          const vehicle = b.vehicles[box[6]]?.ref;
          const track = b.tracking.tracks[box[5]]?.alias ?? 'untracked';
          if (targetOnly && !targets.has(vehicle)) return null;
          const color = vehicle && targets.has(vehicle) ? '#ffce59' : '#4fe0de';
          return <g key={i} className="recorded-detection"><rect x={box[0]} y={box[1]} width={box[2]-box[0]} height={box[3]-box[1]} fill="none" stroke={color} strokeWidth="2"/>
            <text x={box[0]} y={Math.max(15, box[1]-5)} fill={color} stroke="#111" strokeWidth="3" paintOrder="stroke" fontSize="18">{layer === 'track' ? track : vehicle ?? 'ungrouped'}</text></g>;
        })}
        {showGroundTruth && b.ground_truth.targets.flatMap(t => t.boxes.filter(p => p[0] === frame).map(p => <g key={t.id} className="recorded-ground-truth">
          <rect x={p[1]} y={p[2]} width={p[3]-p[1]} height={p[4]-p[2]} fill="none" stroke="#98ff79" strokeWidth="3" strokeDasharray="6 4"/>
          <text x={p[1]} y={Math.max(17,p[2]+18)} fill="#98ff79" stroke="#111" strokeWidth="3" paintOrder="stroke" fontSize="18">GT {t.id}</text>
        </g>))}
      </svg>
    </div>
    {failed && <p role="alert">The recorded video could not be loaded. Try opening the full replay.</p>}
    <div className="recorded-frame-controls"><button type="button" aria-label="Previous frame" disabled={frame === 0} onClick={() => seek(Math.max(0,frame-1))}>←</button>
      <label className="search-scrub">Frame {frame} · {(frame/b.video.fps).toFixed(1)} s<input aria-label="Video frame" type="range" min="0" max={b.video.nb_frames-1} value={frame} onChange={e => seek(Number(e.target.value))}/></label>
      <button type="button" aria-label="Next frame" disabled={frame === b.video.nb_frames-1} onClick={() => seek(Math.min(b.video.nb_frames-1,frame+1))}>→</button></div>
    <p className="search-scope recorded-player-note">Cyan: recorded detections / groups. Amber: vehicles in the final answer. No predicted boxes are shown.</p>
  </div>;
}
