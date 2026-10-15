// The a002 run as a sequence diagram, generated from SEQUENCE. One message is
// "current"; the stepper walks through them and the component map follows.

import { PARTICIPANTS, SEQUENCE } from "./content";

interface Props { cur: number; onPick: (i: number) => void }

const W = 1000, HEAD = 56, ROW = 34, PAD = 70;

export default function Sequence({ cur, onPick }: Props) {
  const col = (id: string) => {
    const i = PARTICIPANTS.findIndex((p) => p.id === id);
    return PAD + (i * (W - 2 * PAD)) / (PARTICIPANTS.length - 1);
  };
  const H = HEAD + SEQUENCE.length * ROW + 16;
  return (
    <div className="seq-scroll">
      <svg className="seq" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Call sequence of attempt a002">
        <defs>
          <marker id="seq-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" className="ah" />
          </marker>
          <marker id="seq-arrow-hot" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" className="ah hot" />
          </marker>
        </defs>
        {PARTICIPANTS.map((p) => (
          <g key={p.id} className={`life l-${p.sub}`}>
            <line x1={col(p.id)} x2={col(p.id)} y1={HEAD - 6} y2={H - 6} />
            <rect x={col(p.id) - 64} y={6} width={128} height={38} rx={2} />
            <text x={col(p.id)} y={22} textAnchor="middle" className="pname">{p.name}</text>
            <text x={col(p.id)} y={36} textAnchor="middle" className="psub">{p.sub}</text>
          </g>
        ))}
        {SEQUENCE.map((m, i) => {
          const y = HEAD + i * ROW + 22;
          const x1 = col(m.from), x2 = col(m.to);
          const dir = x2 > x1 ? 1 : -1;
          const hot = i === cur;
          return (
            <g key={i} className={`msg${hot ? " hot" : ""}${i > cur ? " later" : ""}`} onClick={() => onPick(i)}>
              <rect className="hit" x={Math.min(x1, x2) - 8} y={y - 22} width={Math.abs(x2 - x1) + 16} height={ROW} />
              <line x1={x1} x2={x2 - dir * 2} y1={y} y2={y} strokeDasharray={m.dashed ? "5 4" : undefined}
                    markerEnd={`url(#${hot ? "seq-arrow-hot" : "seq-arrow"})`} />
              <text x={(x1 + x2) / 2} y={y - 6} textAnchor="middle" className="mlab">{i + 1}. {m.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
