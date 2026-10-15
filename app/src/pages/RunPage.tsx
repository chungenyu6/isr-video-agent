// One attempt, end to end. Opens at the END of the run so the answer and the
// full tracking picture are on screen first; the transport replays it from 0.

import { useEffect, useState } from "react";
import type { Experiment, Loaded, Oracle } from "../types";
import { clipLabel, loadBundle, loadOracle, runDuration, RUN_NOTES } from "../data";
import { runHref } from "../router";
import { useClock } from "../clock";
import RunView from "../panels/RunView";

interface Props { exp: Experiment; bundleName: string; startT: number | null }

const compact = (colors: string[]) =>
  [...new Set(colors)].map((c) => {
    const n = colors.filter((x) => x === c).length;
    return n > 1 ? `${c} ×${n}` : c;
  }).join(", ");

export default function RunPage({ exp, bundleName, startT }: Props) {
  const [bundle, setBundle] = useState<Loaded | null>(null);
  const [oracle, setOracle] = useState<Oracle | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setErr(null);
    loadBundle(bundleName)
      .then(async (b) => {
        const o = await loadOracle(b.clip_id);
        if (alive) { setBundle(b); setOracle(o); }
      })
      .catch((e) => alive && setErr(String(e)));
    return () => { alive = false; };
  }, [bundleName]);

  const current = bundle && bundle._dir === bundleName ? bundle : null;
  const duration = current ? runDuration(current) : 0;
  const clock = useClock(duration);
  useEffect(() => {
    if (duration > 0) clock.seek(startT ?? duration);
    // clock.seek is recreated when duration changes; this should fire once per run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundleName, duration, startT]);

  const f = exp.figures;
  const note = current ? RUN_NOTES[current.attempt] : null;
  const summary = exp.runs.find((r) => r.bundle === bundleName);

  return (
    <main className="runpage">
      <div className="batchline">
        <span className="eyebrow">V4.2 measurement · six clips, one attempt each</span>
        <span>
          <b>{f.accepted}/{f.attempts}</b> answers accepted · <b>{f.count_correct}/{f.attempts}</b> right count ·{" "}
          <b>{f.count_and_supported_colors}/{f.attempts}</b> count and colours supported by the frames ·{" "}
          <b className="bad">{f.complete_correct}/{f.attempts}</b> complete answers · not promoted
        </span>
      </div>

      <div className="picker" role="group" aria-label="Choose an attempt">
        {exp.runs.map((r) => (
          <a key={r.bundle} className={`runcard${r.goal_correct ? " good" : ""}`} href={runHref(r.bundle)}
             aria-current={r.bundle === bundleName ? "page" : undefined}>
            <span className="rc-top"><b>{r.attempt}</b>{r.bundle === exp.featured && <span className="pill cite">featured</span>}</span>
            <span className="rc-clip">{clipLabel(r.clip_id, r.expected_count)}</span>
            <span className="rc-ans">answered {r.reported_count ?? "–"}{r.colors.length ? `: ${compact(r.colors)}` : ""}</span>
          </a>
        ))}
      </div>

      {note && (
        <div className={`casenote${summary?.goal_correct ? " good" : ""}`}>
          <b>{note.title}</b>
          <p>{note.note}</p>
        </div>
      )}

      {err && <div className="error">{err}</div>}
      {!current && !err && <div className="loading">loading run…</div>}
      {current && oracle && <RunView bundle={current} oracle={oracle} clock={clock} />}
    </main>
  );
}
