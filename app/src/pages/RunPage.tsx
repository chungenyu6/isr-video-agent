// One run, end to end: what the agent looked at, what it said, and how V0 and the
// enhanced evaluator judged it. Opens at the END of the run so the verdict is
// the first thing on screen; the transport replays it from the start.

import { useEffect, useMemo, useState } from "react";
import type { Experiment, Featured, Loaded, Oracle } from "../types";
import { clipLabel, loadBundle, loadOracle, parseClip, runDuration, runLabel } from "../data";
import { runHref } from "../router";
import { useClock } from "../clock";
import RunView from "../panels/RunView";

interface Props { exp: Experiment; featured: Featured[]; bundleName: string }

export default function RunPage({ exp, featured, bundleName }: Props) {
  const [bundle, setBundle] = useState<Loaded | null>(null);
  const [oracle, setOracle] = useState<Oracle | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setErr(null);
    loadBundle(bundleName)
      .then(async (b) => {
        const o = await loadOracle(b.run.clip_id);
        if (alive) { setBundle(b); setOracle(o); }
      })
      .catch((e) => alive && setErr(String(e)));
    return () => { alive = false; };
  }, [bundleName]);

  const current = bundle && bundle._dir === bundleName ? bundle : null;
  const clip = current?.run.clip_id ?? exp.runs.find((r) => r.bundle === bundleName)?.clip_id ?? exp.runs[0].clip_id;
  const clips = useMemo(
    () => [...new Set(exp.runs.map((r) => r.clip_id))].sort((a, b) => {
      const pa = parseClip(a), pb = parseClip(b);
      return pa.count - pb.count || pb.observability.localeCompare(pa.observability) || pa.rep.localeCompare(pb.rep);
    }),
    [exp]
  );
  // Still needed for the seed chips at the top of the page: the clip picker
  // chooses the clip, these choose which run on it. The old bottom-of-page
  // "Every run on this clip" grid is gone.
  const siblings = exp.runs.filter((r) => r.clip_id === clip)
    .sort((a, b) => a.stage.localeCompare(b.stage) * -1 || a.replicate - b.replicate);
  const note = featured.find((f) => f.bundle === bundleName) ??
    featured.find((f) => f.compare?.includes(bundleName));

  const duration = current ? runDuration(current) : 0;
  const clock = useClock(duration);
  useEffect(() => {
    if (duration > 0) clock.seek(duration);
    // clock.seek is recreated when duration changes; this should fire once per run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundleName, duration]);

  return (
    <main className="runpage">
      <div className="picker">
        <label htmlFor="clip-select">
          <span className="eyebrow">Clip</span>
          <select
            id="clip-select"
            value={clip}
            onChange={(e) => {
              const first = exp.runs.find((r) => r.clip_id === e.target.value);
              if (first) window.location.hash = runHref(first.bundle);
            }}
          >
            {clips.map((c) => <option key={c} value={c}>{clipLabel(c)}</option>)}
          </select>
        </label>
        <div className="runchips" role="group" aria-label="Runs on this clip">
          {siblings.map((r) => (
            <a key={r.bundle} href={runHref(r.bundle)} aria-current={r.bundle === bundleName ? "page" : undefined}>
              {runLabel(r.stage, r.replicate)}
            </a>
          ))}
        </div>
      </div>

      {note && (
        <div className="casenote">
          <b>{note.title}</b>
          <p>{note.note}</p>
        </div>
      )}

      {err && <div className="error">{err}</div>}
      {!current && !err && <div className="loading">loading run…</div>}
      {current && oracle && (
        <RunView bundle={current} oracle={oracle} clock={clock} />
      )}
    </main>
  );
}
