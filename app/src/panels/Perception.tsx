// Every Gemma call: the host-chosen frame with the TARGET box, the padded crop,
// and Gemma's text verbatim. The agent chose only the track and the intent.

import type { Loaded } from "../types";
import { bundleFile, visualShown } from "../data";
import type { Focus } from "./RunView";

interface Props { bundle: Loaded; t: number; focus: Focus; aliasIdx: Map<string, number> }

const INTENT: Record<string, string> = {
  appearance_check: "appearance check: what does the boxed vehicle look like?",
  position_check: "position check",
  visibility_check: "visibility check",
  scene_check: "scene check",
  correspondence_check: "correspondence check",
};

export default function Perception({ bundle, t, focus, aliasIdx }: Props) {
  if (bundle.visual.length === 0) {
    return (
      <p className="pending">
        This attempt made no visual check. Its answer rests on track geometry alone, so any colour it reported
        was never looked at.
      </p>
    );
  }
  const shown = bundle.visual.map((v, i) => ({ v, i })).filter(({ i }) => visualShown(bundle, i, t));
  return (
    <div className="perception">
      {shown.length === 0 && <p className="pending">No Gemma call yet at this point of the run.</p>}
      <ol>
        {shown.map(({ v }) => {
          const ti = aliasIdx.get(v.track_ref) ?? null;
          return (
            <li key={v.observation_ref} className={focus.track === ti ? "cur" : undefined}>
              <div className="pv-imgs">
                <button className="thumb" onClick={() => { focus.setTrack(ti); focus.setFrame(v.frame); }}
                        aria-label={`Show frame ${v.frame} in the video`}>
                  <img src={bundleFile(bundle._dir, v.full)} alt={`Frame ${v.frame} with TARGET ${v.track_ref} boxed`} loading="lazy" />
                </button>
                <span className="cropthumb">
                  <img src={bundleFile(bundle._dir, v.crop)} alt={`Crop around ${v.track_ref}`} loading="lazy" />
                </span>
              </div>
              <div className="pv-text">
                <div className="ohead">
                  <b>{v.track_ref}</b>
                  <span className="mono dim">frame {v.frame} · {INTENT[v.intent] ?? v.intent}</span>
                </div>
                <blockquote>{v.text}</blockquote>
                <span className="fine">{v.latency_sec.toFixed(2)} s · {v.finish_reason}{v.truncated ? " · truncated" : ""} · <code>{v.observation_ref}</code></span>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="fine">
        The agent named only a track and an intent. The host picked a frame with a real detection, drew the box and
        cut the crop. Gemma is stateless: each call sees only these two images and the question. Its text reaches the
        agent verbatim, after a fixed source header.
      </p>
    </div>
  );
}
