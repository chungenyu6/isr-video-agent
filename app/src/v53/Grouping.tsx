// How tracker IDs became vehicle records: every join with its geometric
// evidence, every pair that might be one vehicle but was kept apart, and what
// happened to the boxes the tracker could not match.

import type { Loaded53 } from "./types";
import { fmt } from "./derive";
import type { Focus53 } from "./RunView";

interface Props { bundle: Loaded53; stage: number; focus: Focus53 }

// Before grouping, record Vn holds exactly tracker ID Tn.
const tOf = (v: string) => `T${v.slice(1)}`;

export default function Grouping({ bundle, stage, focus }: Props) {
  if (stage < 2) return <p className="pending">Grouping is stage 2. Until then each tracker ID stands alone.</p>;
  const rt = bundle.runtime;
  const fps = bundle.video.fps;
  const vIdx = new Map(bundle.vehicles.map((v, i) => [v.ref, i]));
  const unmatched = bundle.tracking.frames.reduce((n, fr) => n + fr.d.filter((d) => d[5] < 0).length, 0);
  const joined = bundle.vehicles.reduce((n, v) => n + v.attached_unmatched, 0);
  const ungrouped = bundle.answer.ungrouped_detection_count;
  const go = (v: string) => { const i = vIdx.get(bundle.aliases[v] ?? v); if (i !== undefined) focus.setVeh(i); };

  return (
    <div className="grouping">
      <p className="gsum">
        <b>{bundle.tracking.tracks.length}</b> tracker IDs → <b>{bundle.vehicles.length}</b> vehicle records.
        {" "}The tracker left <b>{unmatched}</b> boxes unmatched; the host attached <b>{joined}</b> to a vehicle record
        and left <b className="bad">{ungrouped}</b> ungrouped.
      </p>
      <h4 className="ph sub">Joined</h4>
      {bundle.links.length === 0 ? <p className="pending">No tracker IDs were joined in this run.</p> : (
        <ul className="glist">
          {bundle.links.map((l) => (
            <li key={l.first + l.second}>
              <button className="glink" onClick={() => go(l.first)}>
                <b>{bundle.aliases[l.first]}</b> = {tOf(l.first)} + {tOf(l.second)}
              </button>
              <span className="mono dim">
                gap {l.evidence.missing_frames} frame{l.evidence.missing_frames === 1 ? "" : "s"} · IoU {fmt(l.evidence.iou)} ·
                size ratio {fmt(l.evidence.area_ratio)} · predicted-position error {fmt(l.evidence.prediction_error_diagonals)} box diagonals
              </span>
            </li>
          ))}
        </ul>
      )}
      <h4 className="ph sub">Might be one vehicle, kept apart</h4>
      {bundle.possible_links.length === 0 ? <p className="pending">None.</p> : (
        <ul className="glist">
          {bundle.possible_links.map((l) => (
            <li key={l.first + l.second}>
              <button className="glink" onClick={() => go(l.first)}>
                {bundle.aliases[l.first]} ≈ {bundle.aliases[l.second]}
              </button>
              <span className="mono dim">
                gap {l.evidence.missing_frames} · IoU {fmt(l.evidence.iou)} · size ratio {fmt(l.evidence.area_ratio)}.
                {" "}Close enough to be the same car, not clear enough to join: they cast one vote together.
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="fine">
        Join rule: a gap of at most {Math.max(1, Math.round(fps * Number(rt.link_gap_fps_fraction)))} frames, size ratio
        within {rt.link_area_ratio}×, heading change under {rt.link_angle_degrees}° when both are moving, and either IoU ≥
        {" "}{rt.link_iou} or a predicted position within {rt.link_distance_diagonals} box diagonals. Both sides must be
        each other's only candidate. Two records seen in the same frame are never joined. Original tracker IDs and
        boxes are kept unchanged; joins are recorded separately and rebuilt by the Post-hoc Verifier.
      </p>
    </div>
  );
}
