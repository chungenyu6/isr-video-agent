// The fixed traffic rule, drawn as a compass in image coordinates (up is up on
// screen). Dots: one vote per comparison unit (a vehicle record, or records that
// may be one vehicle), its stable direction. For the selected vehicle the flow
// is what most OTHER units agree on; its own movement phases are the thick
// arrows, and a phase inside the shaded wedge (135° or more from the flow)
// makes it a candidate. A host rule: not a model judgement, not the Runtime Verifier.

import type { Loaded52, Vehicle } from "./types";
import { compassWord, maxAngle, phaseAngles, STATUS_LABEL } from "./derive";
import type { Focus52 } from "./RunView";

interface Props { bundle: Loaded52; stage: number; focus: Focus52 }

const S = 240, C = S / 2, RAD = 92;

function wedge(dir: [number, number], half: number) {
  const a0 = Math.atan2(dir[1], dir[0]);
  const p = (a: number) => `${C + RAD * Math.cos(a)},${C + RAD * Math.sin(a)}`;
  const h = (half * Math.PI) / 180;
  return `M${C},${C} L${p(a0 - h)} A${RAD},${RAD} 0 0 1 ${p(a0 + h)} Z`;
}

const pillFor = (v: Vehicle) =>
  v.status === "opposing" ? "st-fail" : v.status === "unresolved" ? "st-unknown" : "st-na";

export default function TrafficRule({ bundle, stage, focus }: Props) {
  if (stage < 3) {
    return <p className="pending">The traffic rule runs in stage 3, after the tracker IDs are grouped into vehicle records.</p>;
  }
  const rt = bundle.runtime;
  const opp = Number(rt.opposite_angle_degrees);
  const vehicles = bundle.vehicles;
  const pick = focus.veh ?? Math.max(0, vehicles.findIndex((v) => v.status === "opposing"));
  const sel: Vehicle | undefined = vehicles[pick];
  const flow = sel?.flow ?? null;
  const own = sel ? phaseAngles(sel) : [];
  const worst = sel ? maxAngle(sel) : null;
  const tip = (v: [number, number], r = RAD) => [C + r * v[0], C + r * v[1]];

  return (
    <div className="rule">
      <div className="rule-top">
        <svg className="compass" viewBox={`0 0 ${S} ${S}`} role="img"
             aria-label={`Votes of ${bundle.votes.length} comparison units, the flow, and ${sel?.ref ?? "the selected vehicle"}'s movement phases`}>
          <circle className="ring" cx={C} cy={C} r={RAD} />
          <line className="axisl" x1={C} y1={C - RAD - 6} x2={C} y2={C + RAD + 6} />
          <line className="axisl" x1={C - RAD - 6} y1={C} x2={C + RAD + 6} y2={C} />
          <text className="cdir" x={C} y={12} textAnchor="middle">up</text>
          <text className="cdir" x={C} y={S - 3} textAnchor="middle">down</text>
          {flow && <path className="oppwedge" d={wedge([-flow[0], -flow[1]], 180 - opp)} />}
          {bundle.votes.map((u, k) => {
            const mine = sel && u.vehicles.includes(sel.ref);
            const [x2, y2] = tip(u.vector, RAD - 2);
            return (
              <g key={k} className={`vote${mine ? " mine" : ""}`}
                 onClick={() => focus.setVeh(vehicles.findIndex((v) => v.ref === u.vehicles[0]))}>
                <circle cx={x2} cy={y2} r={mine ? 5 : 3.4} />
                {mine && <text x={x2 + (u.vector[0] >= 0 ? 7 : -7)} y={y2 + 4} textAnchor={u.vector[0] >= 0 ? "start" : "end"}>vote</text>}
              </g>
            );
          })}
          {flow && (() => {
            const [x2, y2] = tip(flow, RAD * 0.62);
            return (
              <g className="flowarrow">
                <line x1={C} y1={C} x2={x2} y2={y2} markerEnd="url(#flowhead)" />
                <text x={x2 + 8} y={y2 + 4}>flow</text>
              </g>
            );
          })()}
          {own.map((p, k) => {
            const hit = p.angle !== null && p.angle >= opp - 1e-6;
            const [x2, y2] = tip(p.u, RAD * 0.86);
            return (
              <line key={k} className={`ownphase${hit ? " hit" : ""}`} x1={C} y1={C} x2={x2} y2={y2}
                    markerEnd={`url(#${hit ? "ownhead-hit" : "ownhead"})`} />
            );
          })}
          <defs>
            <marker id="flowhead" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" className="flowhead" />
            </marker>
            <marker id="ownhead" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" className="ownhead" />
            </marker>
            <marker id="ownhead-hit" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" className="ownhead hit" />
            </marker>
          </defs>
        </svg>
        <div className="rule-sel" aria-live="polite">
          {sel ? (
            <>
              <span className="eyebrow">Selected · click a row or a dot</span>
              <h4>{sel.ref} <span className={`pill ${pillFor(sel)}`}>{STATUS_LABEL[sel.status]}</span></h4>
              {!flow ? (
                <p>No settled flow to compare with, so this record is not judged. It stays unresolved: not counted, not dropped.</p>
              ) : own.length === 0 ? (
                <p>No movement phase long and clear enough to compare (at least 3 observed points and real displacement). It stays unresolved: not counted, not dropped.</p>
              ) : (
                <p>
                  The other {sel.comparison_units} comparison units mostly flow <b>{compassWord(flow)}</b> ({sel.support_units} agree).
                  {" "}{sel.ref} has {own.length} measured phase{own.length === 1 ? "" : "s"}
                  {own.map((p, k) => <span key={k}>{k ? "," : ":"} <b>{compassWord(p.u)}</b> {p.phase.start}–{p.phase.end} ({p.angle!.toFixed(0)}°)</span>)}.
                  {" "}{worst !== null && worst >= opp ? `At least ${opp}° from the flow, so it is a candidate.` : `None is ${opp}° from the flow.`}
                </p>
              )}
              {sel.vote_shared_with.length > 0 && (
                <p className="fine">Votes once together with {sel.vote_shared_with.join(", ")}: they might be one vehicle.</p>
              )}
            </>
          ) : <p className="dim">No vehicle records.</p>}
        </div>
      </div>
      <div className="tbl rule-tbl">
        <table>
          <thead><tr><th>Vehicle</th><th>Moves</th><th>Widest angle to flow</th><th>Result</th></tr></thead>
          <tbody>
            {vehicles.map((v, i) => {
              const a = maxAngle(v);
              return (
                <tr key={v.ref} className={`${focus.veh === i ? "cur" : ""}${v.status === "opposing" ? " opp" : ""}`}
                    onClick={() => focus.setVeh(i)} onMouseEnter={() => focus.setHover(i)} onMouseLeave={() => focus.setHover(null)}>
                  <th scope="row">{v.ref}</th>
                  <td className="num">{v.vote ? compassWord(v.vote) : "–"}</td>
                  <td className="num">{a === null ? "–" : `${a.toFixed(0)}°`}</td>
                  <td>{STATUS_LABEL[v.status]}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="fine">
        Votes: a unit's stable direction, from phases within {rt.direction_cone_degrees}° of each other that carry at
        least {Math.round(Number(rt.stable_motion_fraction) * 100)}% of its movement. Flow: the largest group of other
        units agreeing within {rt.direction_cone_degrees}°: at least {rt.comparison_min_units} units, 2/3 of them, and consistent with the clip-wide majority.
        Candidate: any measured phase {opp}° or more from that flow. Fixed camera and one comparable roadway are assumed.
      </p>
    </div>
  );
}
