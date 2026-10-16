// A run as a sequence diagram. One message is "current"; the stepper walks
// through them and the component map follows. A message to the same lifeline
// is drawn as a loop (host-internal work); a skipped message is an optional
// branch that did not run. Frames box a repeated (loop) or optional (opt)
// block of messages, as in UML.

import type { Participant, SeqFrame, SeqMsg } from "./types";

interface Props {
  participants: Participant[];
  sequence: SeqMsg[];
  frames?: SeqFrame[];
  cur: number;
  onPick: (i: number) => void;
  label: string;
}

const W = 1000, HEAD = 56, ROW = 34, PAD = 70, FTOP = 20, FEND = 10, INSET = 12;

export default function Sequence({ participants, sequence, frames = [], cur, onPick, label }: Props) {
  const col = (id: string) => {
    const i = participants.findIndex((p) => p.id === id);
    return PAD + (i * (W - 2 * PAD)) / (participants.length - 1);
  };
  // Frames listed earlier enclose frames listed later.
  const depth = frames.map((f, k) => frames.slice(0, k).filter((o) => o.first <= f.first && o.last >= f.last).length);
  const ys: number[] = [];
  let acc = HEAD;
  sequence.forEach((_, i) => {
    acc += frames.filter((f) => f.first === i).length * FTOP;
    ys.push(acc + 22);
    acc += ROW + frames.filter((f) => f.last === i).length * FEND;
  });
  const H = acc + 16;
  return (
    <div className="seq-scroll">
      <svg className="seq" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        <defs>
          <marker id="seq-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" className="ah" />
          </marker>
          <marker id="seq-arrow-hot" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" className="ah hot" />
          </marker>
        </defs>
        {participants.map((p) => (
          <g key={p.id} className={`life l-${p.sub}${p.idle ? " idle" : ""}`}>
            <line x1={col(p.id)} x2={col(p.id)} y1={HEAD - 6} y2={H - 6} />
            <rect x={col(p.id) - 64} y={6} width={128} height={38} rx={2} />
            <text x={col(p.id)} y={22} textAnchor="middle" className="pname">{p.name}</text>
            <text x={col(p.id)} y={36} textAnchor="middle" className="psub">{p.sub}</text>
          </g>
        ))}
        {frames.map((f, k) => {
          const sameStart = frames.filter((o, j) => j > k && o.first === f.first).length;
          const sameEnd = frames.filter((o, j) => j > k && o.last === f.last).length;
          const top = ys[f.first] - 22 - FTOP * (sameStart + 1) + 4;
          const bottom = ys[f.last] - 22 + ROW + FEND * sameEnd + 2;
          const x0 = 6 + depth[k] * INSET, x1 = W - 6 - depth[k] * INSET;
          const tab = `${f.kind} · ${f.label}`;
          const tw = tab.length * 6.1 + 14;
          return (
            <g key={`f${k}`} className={`seqframe${f.skipped ? " skipped" : ""}`}>
              <rect x={x0} y={top} width={x1 - x0} height={bottom - top} />
              <path d={`M${x0},${top} h${tw} v10 l-6,6 H${x0} z`} className="tab" />
              <text x={x0 + 5} y={top + 11.5} className="flab">{tab}</text>
            </g>
          );
        })}
        {sequence.map((m, i) => {
          const y = ys[i];
          const x1 = col(m.from), x2 = col(m.to);
          const hot = i === cur;
          const cls = `msg${hot ? " hot" : ""}${i > cur ? " later" : ""}${m.skipped ? " skipped" : ""}`;
          const marker = `url(#${hot ? "seq-arrow-hot" : "seq-arrow"})`;
          if (x1 === x2) {
            return (
              <g key={i} className={cls} onClick={() => onPick(i)}>
                <rect className="hit" x={x1 - 8} y={y - 22} width={250} height={ROW} />
                <path d={`M${x1},${y - 8} h26 v12 h-24`} fill="none" markerEnd={marker} />
                <text x={x1 + 34} y={y - 1} className="mlab">{i + 1}. {m.label}</text>
              </g>
            );
          }
          const dir = x2 > x1 ? 1 : -1;
          return (
            <g key={i} className={cls} onClick={() => onPick(i)}>
              <rect className="hit" x={Math.min(x1, x2) - 8} y={y - 22} width={Math.abs(x2 - x1) + 16} height={ROW} />
              <line x1={x1} x2={x2 - dir * 2} y1={y} y2={y}
                    strokeDasharray={m.skipped ? "2 4" : m.dashed ? "5 4" : undefined} markerEnd={marker} />
              <text x={(x1 + x2) / 2} y={y - 6} textAnchor="middle" className="mlab">{i + 1}. {m.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
