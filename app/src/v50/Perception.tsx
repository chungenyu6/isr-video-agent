// Every Gemma call: which vehicle the host asked about, which tracker ID and frame
// it resolved that to, the two images, Gemma's words verbatim, and the colour the
// host parsed from them. In V5.0 nobody else reads this text: there is no agent.

import type { Loaded50 } from "./types";
import { bundleFile } from "../data";
import type { Focus50 } from "./RunView";

interface Props { bundle: Loaded50; stage: number; focus: Focus50 }

export default function Perception({ bundle, stage, focus }: Props) {
  if (bundle.appearance.length === 0) {
    return (
      <p className="pending">
        The rule found no candidate in this clip, so the host asked Gemma nothing. The answer has no colours to report.
      </p>
    );
  }
  if (stage < 4) return <p className="pending">Gemma is called in stage 4 (Look), once per candidate.</p>;
  const vIdx = new Map(bundle.vehicles.map((v, i) => [v.ref, i]));
  return (
    <div className="perception">
      <ol>
        {bundle.appearance.map((a) => {
          const vi = vIdx.get(a.vehicle_ref) ?? null;
          return (
            <li key={a.observation_ref} className={focus.veh === vi ? "cur" : undefined}>
              <div className="pv-imgs">
                <button className="thumb" onClick={() => { focus.setVeh(vi); focus.setFrame(a.frame); }}
                        aria-label={`Show frame ${a.frame} in the video`}>
                  <img src={bundleFile(bundle._dir, a.full)} alt={`Frame ${a.frame} with TARGET ${a.track_ref} boxed`} loading="lazy" />
                </button>
                <span className="cropthumb">
                  <img src={bundleFile(bundle._dir, a.crop)} alt={`Crop around ${a.track_ref}`} loading="lazy" />
                </span>
              </div>
              <div className="pv-text">
                <div className="ohead">
                  <b>{a.asked_ref}</b>
                  <span className="mono dim">host chose {a.track_ref} @ frame {a.frame} · body colour question</span>
                </div>
                <blockquote>{a.text}</blockquote>
                <div className="parsed">
                  parsed Body color: <span className="colorchip">{a.color_parse.value ?? "unknown"}</span>
                  <span className="mono dim"> ({a.color_parse.status}; kept exactly as written)</span>
                </div>
                <span className="fine">
                  {a.latency_sec.toFixed(2)} s · {a.tokens.prompt}+{a.tokens.completion} tokens · {a.finish_reason}
                  {a.truncated ? " · truncated" : ""} · <code>{a.observation_ref}</code>
                </span>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="fine">
        The host picked the frame (a real detection of the vehicle), drew the box and cut the crop. Gemma is
        stateless and gets one factual question per call. Its reply is stored verbatim; the host reads only the
        Body color line. Two-tone or shaded answers are not mapped to a colour list.
      </p>
    </div>
  );
}
