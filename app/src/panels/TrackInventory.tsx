// The host's track fact index, as a table: the same facts scan_video rendered
// as text for the agent, plus what the agent then did with each track.

import type { Loaded } from "../types";
import { DIR_LABEL, dirClass, stepDone, stepTrack, trackColor, tracksShown, visualShown } from "../data";
import type { Focus } from "./RunView";

interface Props { bundle: Loaded; t: number; focus: Focus; points: number[][][] }

export default function TrackInventory({ bundle, t, focus, points }: Props) {
  if (!tracksShown(bundle, t)) {
    return <p className="pending">No track facts yet. They are built when scan_video returns at run t+{bundle.tracking.visible_from.toFixed(1)}s.</p>;
  }
  const scan = bundle.steps.find((s) => s.tool === "scan_video");
  const reads = new Map<string, number>();
  for (const s of bundle.steps) {
    if (s.tool === "observation_get" && stepDone(s, t)) {
      const r = stepTrack(s);
      if (r) reads.set(r, (reads.get(r) ?? 0) + 1);
    }
  }
  const submittedRefs = bundle.submission.uncertainty;

  return (
    <div className="inventory">
      <div className="tbl">
        <table>
          <thead>
            <tr><th>Track</th><th>Seen</th><th>Movement</th><th>Screen path</th><th>Agent</th></tr>
          </thead>
          <tbody>
            {bundle.tracking.tracks.map((tr, i) => {
              const vis = bundle.visual.map((v, k) => ({ v, k })).filter(({ v, k }) => v.track_ref === tr.alias && visualShown(bundle, k, t));
              const n = reads.get(tr.alias) ?? 0;
              const ndet = points[i].length;
              const cur = focus.track === i || focus.hover === i;
              return (
                <tr key={tr.alias} className={cur ? "cur" : undefined}
                    onMouseEnter={() => focus.setHover(i)} onMouseLeave={() => focus.setHover(null)}
                    onClick={() => { focus.setTrack(i); focus.setFrame(vis[0]?.v.frame ?? Math.round((tr.observed[0] + tr.observed[1]) / 2)); }}>
                  <th scope="row">
                    <i className="dot" style={{ background: trackColor(i) }} />{tr.alias}
                    {new RegExp(`\\b${tr.alias}\\b`).test(submittedRefs) &&<span className="pill cite" title="named in the submitted uncertainty">answer</span>}
                  </th>
                  <td className="num">{tr.observed[0]}–{tr.observed[1]}<br /><span className="dim">{ndet} det.</span></td>
                  <td>
                    {tr.phases.map((p) => (
                      <span key={p.start} className={`dirchip d-${dirClass(p.direction)}`} title={p.direction}>
                        {p.start}–{p.end} {DIR_LABEL[dirClass(p.direction)]}
                      </span>
                    ))}
                  </td>
                  <td className="path">{tr.phases.map((p) => p.origin === p.destination ? p.origin : `${p.origin} → ${p.destination}`).filter((v, k, a) => a.indexOf(v) === k).join("; ")}</td>
                  <td className="agentcol">
                    {n > 0 && <span className="dim">re-read ×{n}</span>}
                    {vis.map(({ v }) => <q key={v.observation_ref}>{v.text}</q>)}
                    {n === 0 && vis.length === 0 && <span className="dim">–</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {scan && (
        <details className="rawtext">
          <summary>exact text the agent received from scan_video ({scan.agent_text_chars} chars)</summary>
          <pre>{scan.agent_text}</pre>
        </details>
      )}
      <p className="fine">
        No confidence scores, no colours and no wrong-way labels are given to the agent. Re-reading a summary
        (observation_get) returns the same facts as the first scan.
      </p>
    </div>
  );
}
