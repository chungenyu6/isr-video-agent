// Components grouped by trust zone. Click a card for its role and settings;
// cards named by the current sequence step are highlighted. Zones and cards
// marked idle are implemented but were not exercised in the measured batch.

import type { Component, Zone, ZoneInfo } from "./types";

interface Props {
  zones: Record<Zone, ZoneInfo>;
  components: Component[];
  selected: string | null;
  onSelect: (id: string) => void;
  highlight: string[];
}

export default function ComponentMap({ zones, components, selected, onSelect, highlight }: Props) {
  const sel = components.find((c) => c.id === selected) ?? null;
  return (
    <div className="compmap">
      <div className="zones">
        {(Object.keys(zones) as Zone[]).map((z) => (
          <div key={z} className={`zone z-${z}${zones[z].idle ? " idle" : ""}`}>
            <div className="zhead"><b>{zones[z].name}</b><span>{zones[z].note}</span></div>
            <div className="zcards">
              {components.filter((c) => c.zone === z).map((c) => (
                <button key={c.id}
                        className={`ccard${highlight.includes(c.id) ? " hot" : ""}${selected === c.id ? " sel" : ""}${c.idle ? " idle" : ""}`}
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
            <span className="eyebrow">{zones[sel.zone].name}</span>
            <h4>{sel.name}</h4>
            {sel.idle && <p className="idlenote">Implemented, not exercised in the measured batch.</p>}
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
