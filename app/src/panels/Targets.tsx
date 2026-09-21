// Ground truth beside the agent's report, and the matching edges between them.

import type { Loaded, Oracle } from "../types";
import { boxesAt, frameUrl } from "../data";

interface Props { bundle: Loaded; oracle: Oracle; t: number; onFrame: (n: number) => void; prefix?: string }

const REASON: Record<string, string> = {
  roi_iou_below_min: "region overlap too small",
  temporal_iou_below_min: "interval overlap too small",
  interval_too_wide: "interval too wide",
  cost_above_reject_threshold: "match cost above threshold",
};

export default function Targets({ bundle, oracle, t, onFrame, prefix }: Props) {
  const answered = bundle.events.some((e) => e.type === "answer.submit" && e.t <= t);
  const ev = bundle.evidence;
  const edges = bundle.enhanced?.layer_details.L4_matching?.edges ?? [];
  const fps = oracle.fps;

  return (
    <div className="targets">
      <div className="truth">
        <span className="eyebrow">Ground truth</span>
        {oracle.targets.length === 0 ? (
          <p>No vehicle drives against traffic in this clip.</p>
        ) : (
          <ul>
            {oracle.targets.map((tg) => {
              const [a, b] = tg.event_interval_frames ?? [0, 0];
              const pf = tg.pairable_frames;
              return (
                <li key={tg.object_id}>
                  <i className="dot" style={{ background: tg.color_hex ?? undefined }} />
                  <b>{tg.color_name}</b> wrong-way car, visible and moving {(a / fps).toFixed(1)}–{(b / fps).toFixed(1)} s;
                  {" "}usable motion frames {pf.length ? `${pf[0]}–${pf[pf.length - 1]}` : "none"}
                  {tg.witness_pair && (
                    <> · e.g. <button className="link" onClick={() => onFrame(tg.witness_pair![0])}>frame {tg.witness_pair[0]}</button>
                    {" "}+ <button className="link" onClick={() => onFrame(tg.witness_pair![1])}>{tg.witness_pair[1]}</button></>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="said">
        <span className="eyebrow">The agent</span>
        {!answered ? (
          <p className="pending">has not submitted yet.</p>
        ) : !ev.present ? (
          <p>submitted nothing.</p>
        ) : ev.decision === "abstain" ? (
          <p><b>Abstained</b> — declined to answer, saying the evidence was insufficient.</p>
        ) : ev.reported_targets.length === 0 ? (
          <p><b>Reported no wrong-way vehicles.</b></p>
        ) : (
          <p><b>Reported {ev.reported_targets.length}</b> wrong-way vehicle{ev.reported_targets.length > 1 ? "s" : ""}.</p>
        )}
        {answered && ev.windows_examined.length > 0 && (
          <p className="fine">Claims to have examined {ev.windows_examined.map((w) => `${w[0]}–${w[1]} s`).join(", ")}; {ev.frames_processed} frames processed.</p>
        )}
      </div>

      {answered && ev.reported_targets.map((rt, ri) => (
        <div className="report" key={ri}>
          <div className="rhead">
            <b>{rt.target_ref}</b>
            <span className="dim">{rt.color_name ?? "no colour given"} · frames {rt.interval_frames?.join("–") ?? "?"}</span>
          </div>
          <div className="anchors">
            {rt.anchors.map((a, ai) => {
              const boxes = a.frame_id !== null ? boxesAt(oracle, a.frame_id).filter((b) => b.wrongWay) : [];
              return (
                <figure key={ai}>
                  <button className="thumb" onClick={() => a.frame_id !== null && onFrame(a.frame_id)} aria-label={`Show frame ${a.frame_id}`}>
                    {a.file ? <img src={frameUrl(bundle._dir, a.file, prefix)} alt="" loading="lazy" /> : <span className="empty">file missing</span>}
                    <svg viewBox={`0 0 ${oracle.width} ${oracle.height}`} preserveAspectRatio="none" aria-hidden="true">
                      {boxes.map((b) => <rect key={b.id} className="gt target" x={b.box[0]} y={b.box[1]} width={b.box[2] - b.box[0]} height={b.box[3] - b.box[1]} />)}
                      {a.roi_xyxy && <rect className="claim" x={a.roi_xyxy[0]} y={a.roi_xyxy[1]} width={a.roi_xyxy[2] - a.roi_xyxy[0]} height={a.roi_xyxy[3] - a.roi_xyxy[1]} />}
                    </svg>
                  </button>
                  <figcaption><span className="mono">frame {a.frame_id}</span> {a.claim}</figcaption>
                </figure>
              );
            })}
          </div>
          {edges.filter((e) => e.report_index === ri).map((e) => (
            <div className={`edge ${e.feasible ? "ok" : "no"}`} key={e.target_index}>
              vs {oracle.targets[e.target_index]?.color_name ?? `target ${e.target_index}`}: ROI IoU {e.roi_iou.toFixed(2)},
              interval IoU {e.temporal_iou.toFixed(2)}, cost {e.cost.toFixed(2)} —{" "}
              {e.feasible ? "feasible" : e.reasons.map((r) => REASON[r] ?? r).join(", ")}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
