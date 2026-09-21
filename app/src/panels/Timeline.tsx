// The signature visual: the clip's 349 frames on one axis.
//
// For each wrong-way car: the frames where it is eligible evidence (visible,
// released, moving), and inside that the frames that belong to at least one valid
// motion pair under the frozen policy. Below: the frames the agent extracted, and
// the ones it actually sent to the vision model, revealed on the run clock.
// L1 asks one question of this picture - does the agent row hit a pair?

import type { Loaded, Oracle } from "../types";
import { frameProgress } from "../data";

interface Props {
  bundle: Loaded;
  oracle: Oracle;
  t: number;
  frame: number;
  onFrame: (n: number) => void;
}

const W = 1000;
const LEFT = 132;
const RIGHT = 12;
const ROW = 26;

export default function Timeline({ bundle, oracle, t, frame, onFrame }: Props) {
  const nb = bundle.video.nb_frames;
  const fps = bundle.video.fps;
  const x = (f: number) => LEFT + (f / (nb - 1)) * (W - LEFT - RIGHT);
  const fw = (W - LEFT - RIGHT) / (nb - 1);
  const progress = frameProgress(bundle, t);
  const answered = bundle.events.some((e) => e.type === "answer.submit" && e.t <= t);
  const reports = answered ? bundle.evidence.reported_targets.filter((r) => r.interval_frames) : [];

  const targetRows = Math.max(1, oracle.targets.length);
  const top = 22;
  const agentY = top + targetRows * ROW + 8;
  const reportY = agentY + 38;
  const H = reportY + (reports.length ? reports.length * 16 + 8 : 0) + 4;

  const covered = bundle.enhanced?.layer_details.L1 ?? [];
  const sentIds = new Set(bundle.frames.filter((f) => f.inspected && f.frame_id !== null && progress.sent.has(f.frame_id)).map((f) => f.frame_id!));

  const click = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const vx = ((e.clientX - rect.left) / rect.width) * W;
    if (vx < LEFT) return;
    onFrame(Math.max(0, Math.min(nb - 1, Math.round(((vx - LEFT) / (W - LEFT - RIGHT)) * (nb - 1)))));
  };

  return (
    <div>
      <div className="tl-scroll">
        <svg className="timeline" viewBox={`0 0 ${W} ${H}`} onClick={click} role="img"
          aria-label="Frame timeline: wrong-way car windows and frames the agent inspected">
          {Array.from({ length: Math.floor((nb - 1) / fps / 5) + 1 }, (_, i) => i * 5).map((s) => (
            <g key={s}>
              <line className="grid" x1={x(s * fps)} x2={x(s * fps)} y1={top - 4} y2={H} />
              <text className="axis" x={x(s * fps)} y={12} textAnchor="middle">{s}s</text>
            </g>
          ))}
          <rect className="frame0" x={x(0) - fw / 2} y={top - 4} width={fw * 1.5} height={H - top + 4} />

          {oracle.targets.length === 0 && (
            <text className="rowlab" x={LEFT + 8} y={top + 17}>No wrong-way car in this clip: any reported target is a false positive.</text>
          )}
          {oracle.targets.map((tg, i) => {
            const y = top + i * ROW;
            const [a, b] = tg.event_interval_frames ?? [0, 0];
            const ok = covered.find((c) => c.object_id === tg.object_id)?.covered;
            const hits = tg.pairable_frames.filter((f) => sentIds.has(f)).length;
            return (
              <g key={tg.object_id}>
                <circle cx={10} cy={y + 12} r={5} fill={tg.color_hex ?? "currentColor"} className="swatch" />
                <text className="rowlab" x={20} y={y + 16}>{tg.color_name} car</text>
                <rect className="eligible" x={x(a) - fw / 2} y={y + 4} width={x(b) - x(a) + fw} height={16} />
                {tg.pairable_frames.map((f) => (
                  <rect key={f} className="pairable" x={x(f) - fw / 2} y={y + 4} width={fw} height={16} />
                ))}
                {tg.witness_pair?.map((f) => <path key={f} className="witness" d={`M${x(f)} ${y + 1} l4 -5 h-8 z`} />)}
                <text className={`rowstat ${ok ? "ok" : "no"}`} x={Math.min(x(b) + 10, W - 150)} y={y + 16}>
                  {bundle.enhanced ? (ok ? `pair covered (${hits} usable sent)` : `no pair sent (${hits} usable sent)`) : ""}
                </text>
              </g>
            );
          })}

          <text className="rowlab" x={20} y={agentY + 12}>extracted</text>
          <text className="rowlab strong" x={20} y={agentY + 30}>sent to VLM</text>
          {bundle.frames.filter((f) => f.frame_id !== null).map((f) => {
            const fx = x(f.frame_id!);
            const isSent = f.inspected && progress.sent.has(f.frame_id!);
            const isExtracted = progress.extracted.has(f.key);
            if (!isSent && !isExtracted) return null;
            return (
              <g key={f.key}>
                <line className="tick-ex" x1={fx} x2={fx} y1={agentY + 2} y2={agentY + 14} />
                {isSent && <line className="tick-sent" x1={fx} x2={fx} y1={agentY + 18} y2={agentY + 34} />}
                {isSent && f.cited && answered && <circle className="cited" cx={fx} cy={agentY + 18} r={3} />}
              </g>
            );
          })}

          {reports.map((r, i) => {
            const [a, b] = r.interval_frames!;
            const y = reportY + i * 16;
            return (
              <g key={i}>
                <text className="rowlab" x={20} y={y + 11}>reported: {r.target_ref}</text>
                <rect className="reported" x={x(a)} y={y + 2} width={Math.max(2, x(b) - x(a))} height={10} />
              </g>
            );
          })}

          <line className="playhead" x1={x(frame)} x2={x(frame)} y1={top - 6} y2={H} />
        </svg>
      </div>
      <div className="legend">
        <span><i className="sw eligible" />car visible and moving</span>
        <span><i className="sw pairable" />frame in a valid motion pair</span>
        <span><i className="sw witness" />first valid pair</span>
        <span><i className="sw tick-ex" />extracted</span>
        <span><i className="sw tick-sent" />sent to the vision model</span>
        <span><i className="sw frame0" />frame 0, excluded</span>
      </div>
      <p className="fine">
        A valid pair: two fully visible frames at least {String(oracle.policy.pair_min_separation_seconds)} s apart, box diagonal
        ≥ {String(oracle.policy.pair_min_bbox_diagonal_px)} px, centre displacement ≥ max({String(oracle.policy.pair_min_displacement_px)} px,
        {" "}{String(oracle.policy.pair_min_displacement_bbox_ratio)} × diagonal). Click the axis to move the video.
      </p>
    </div>
  );
}
