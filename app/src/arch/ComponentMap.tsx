// Components grouped by trust zone. Click a card for its role and settings;
// cards named by the current sequence step are highlighted.

import { COMPONENTS, ZONES, type Zone } from "./content";

interface Props { selected: string | null; onSelect: (id: string) => void; highlight: string[] }

export default function ComponentMap({ selected, onSelect, highlight }: Props) {
  const sel = COMPONENTS.find((c) => c.id === selected) ?? null;
  return (
    <div className="compmap">
      <div className="zones">
        {(Object.keys(ZONES) as Zone[]).map((z) => (
          <div key={z} className={`zone z-${z}`}>
            <div className="zhead"><b>{ZONES[z].name}</b><span>{ZONES[z].note}</span></div>
            <div className="zcards">
              {COMPONENTS.filter((c) => c.zone === z).map((c) => (
                <button key={c.id} className={`ccard${highlight.includes(c.id) ? " hot" : ""}${selected === c.id ? " sel" : ""}`}
                        onClick={() => onSelect(c.id)} aria-pressed={selected === c.id}>
                  <b>{c.name}</b>
                  <span>{c.sub}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <aside className="cdetail" aria-live="polite">
        {sel ? (
          <>
            <span className="eyebrow">{ZONES[sel.zone].name}</span>
            <h4>{sel.name}</h4>
            <p>{sel.role}</p>
            <ul>{sel.facts.map((f) => <li key={f}>{f}</li>)}</ul>
          </>
        ) : (
          <p className="dim">Select a component to see what it does and how it is configured.</p>
        )}
      </aside>
    </div>
  );
}
