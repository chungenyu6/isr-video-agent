// Every Gemma observation: who asked (the host's colour check, Pi inside a case,
// or a saved reply imported from an earlier run), which tracker ID and frames
// that resolved to, the exact images, Gemma's words verbatim, and the colour the
// host parsed. Agent requests use other intents (visibility, compare) and are not
// colour-parsed.

import type { Loaded53 } from "./types";
import { bundleFile } from "../data";
import { lookStage, STAGE } from "./derive";
import type { Focus53 } from "./RunView";

interface Props { bundle: Loaded53; stage: number; focus: Focus53 }

const WHO: Record<string, string> = {
  host: "host colour check",
  agent: "asked by Pi",
  imported: "saved reply, imported",
  diagnostic: "fixed check",
};

export default function Perception({ bundle, stage, focus }: Props) {
  if (bundle.appearance.length === 0) {
    return (
      <p className="pending">
        The rule found no candidate in this clip, so the host asked Gemma nothing. The answer has no colours to report.
      </p>
    );
  }
  const shown = bundle.appearance.map((a, i) => ({ a, i })).filter(({ a }) => lookStage(a) <= stage);
  if (shown.length === 0) return <p className="pending">Gemma is called in stage {STAGE.look} (Look), once per candidate.</p>;
  const vIdx = new Map(bundle.vehicles.map((v, i) => [v.ref, i]));
  const later = bundle.appearance.some((a) => lookStage(a) > stage);
  return (
    <div className="perception">
      <ol>
        {shown.map(({ a }) => {
          const vi = a.vehicle_ref ? vIdx.get(a.vehicle_ref) ?? null : null;
          const asked = Array.isArray(a.asked_ref) ? a.asked_ref.join(" + ") : a.asked_ref;
          return (
            <li key={a.observation_ref} className={`${focus.veh === vi ? "cur" : ""}${a.origin !== "host" ? " o-agent" : ""}`}>
              <div className="pv-imgs">
                {a.media.length === 0 && <span className="noimg">no image in this run</span>}
                {a.media.map((m) => (
                  <span key={m.frame} className="pv-pair">
                    <button className="thumb" onClick={() => { focus.setVeh(vi); focus.setFrame(m.frame); }}
                            aria-label={`Show frame ${m.frame} in the video`}>
                      <img src={bundleFile(bundle._dir, m.full)} alt={`Frame ${m.frame} with TARGET ${m.targets.map((t) => t.track_ref).join(", ")} boxed`} loading="lazy" />
                    </button>
                    {m.crops.map((c) => (
                      <span key={c.path} className="cropthumb">
                        <img src={bundleFile(bundle._dir, c.path)} alt={`Crop around ${c.track_ref} at frame ${m.frame}`} loading="lazy" />
                      </span>
                    ))}
                  </span>
                ))}
              </div>
              <div className="pv-text">
                <div className="ohead">
                  <b>{asked ?? a.track_ref}</b>
                  <span className={`pill ${a.origin === "host" ? "" : "o-agent"}`}>{WHO[a.origin]}{a.case_ref ? ` · ${a.case_ref}` : ""}</span>
                  <span className="mono dim">
                    {a.intent} · {a.track_ref}
                    {a.media.length ? ` @ frame${a.media.length > 1 ? "s" : ""} ${a.media.map((m) => m.frame).join(", ")}` : ""}
                  </span>
                </div>
                <blockquote>{a.text}</blockquote>
                {a.color_parse ? (
                  <div className="parsed">
                    parsed Body color: <span className="colorchip">{a.color_parse.value ?? "unknown"}</span>
                    <span className="mono dim"> ({a.color_parse.status}; kept exactly as written)</span>
                  </div>
                ) : (
                  <div className="parsed mono dim">not a colour check: the host stores this text and does not parse a colour from it</div>
                )}
                <span className="fine">
                  {a.latency_sec !== null ? `${a.latency_sec.toFixed(2)} s · ` : ""}
                  {a.tokens ? `${a.tokens.prompt}+${a.tokens.completion} tokens · ` : ""}
                  {a.finish_reason}{a.truncated ? " · truncated" : ""} · <code>{a.observation_ref}</code>
                  {a.step !== undefined ? ` · Pi step ${a.step + 1}` : ""}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
      {later && <p className="pending">More Gemma calls follow in stage {STAGE.investigate} (Investigate), on Pi's request.</p>}
      <p className="fine">
        The host always picks the frames (real detections of the vehicle), draws the TARGET boxes and cuts the crops,
        including when Pi asks. Gemma is stateless and gets one factual question per call. Its reply is stored verbatim;
        for a colour check the host reads only the Body color line. Two-tone or shaded answers are not mapped to a colour list.
      </p>
    </div>
  );
}
