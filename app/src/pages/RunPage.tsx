// One attempt, end to end, for either version. The version comes from the bundle
// name; an unknown name (for example a link to the archived site) falls back to
// the current featured run with a one-line notice instead of an error.

import { useEffect, useState } from "react";
import type { Experiment, Loaded, Oracle, VersionKey } from "../types";
import type { Loaded50 } from "../v50/types";
import { clipLabel, loadAnyBundle, loadOracle, type AnyLoaded } from "../data";
import { runHref, versionOf } from "../router";
import { RUN_NOTES_V42 } from "../v42/notes";
import { RUN_NOTES_V50 } from "../v50/notes";
import Run42 from "../v42/Run42";
import RunView50 from "../v50/RunView";

interface Props { exp: Experiment; bundleName: string | null; startT: number | null; startStage: number | null }

const compact = (colors: string[]) =>
  [...new Set(colors)].map((c) => {
    const n = colors.filter((x) => x === c).length;
    return n > 1 ? `${c} ×${n}` : c;
  }).join(", ");

const VERSION_TAG: Record<VersionKey, string> = { v50: "current", v42: "previous" };

export default function RunPage({ exp, bundleName, startT, startStage }: Props) {
  const key = bundleName ? versionOf(bundleName) : null;
  const known = !!(key && exp.versions[key].runs.some((r) => r.bundle === bundleName));
  const vkey: VersionKey = known && key ? key : exp.current;
  const ver = exp.versions[vkey];
  const name = known && bundleName ? bundleName : ver.featured;
  const redirected = bundleName !== null && !known;

  const [bundle, setBundle] = useState<AnyLoaded | null>(null);
  const [oracle, setOracle] = useState<Oracle | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setErr(null);
    loadAnyBundle(name)
      .then(async (b) => {
        const o = await loadOracle(b.clip_id);
        if (alive) { setBundle(b); setOracle(o); }
      })
      .catch((e) => alive && setErr(String(e)));
    return () => { alive = false; };
  }, [name]);

  const current = bundle && bundle._dir === name ? bundle : null;
  const f = ver.figures;
  const notes = vkey === "v50" ? RUN_NOTES_V50 : RUN_NOTES_V42;
  const summary = ver.runs.find((r) => r.bundle === name);
  const note = summary ? notes[summary.attempt] : null;
  // The same clip in the other version, when it exists.
  const sibling = (k: VersionKey) => {
    const other = name.replace(/^v(42|50)-/, `${k}-`);
    return exp.versions[k].runs.some((r) => r.bundle === other) ? other : exp.versions[k].featured;
  };

  return (
    <main className="runpage">
      {redirected && (
        <div className="notice">
          The link pointed to a run that is not on this site any more (<code>{bundleName}</code>). Showing the featured
          {" "}{ver.label} run instead.
        </div>
      )}

      <div className="versions" role="group" aria-label="System version">
        {(["v50", "v42"] as VersionKey[]).map((k) => (
          <a key={k} href={runHref(k === vkey ? name : sibling(k))} aria-current={k === vkey ? "page" : undefined}>
            <b>{exp.versions[k].label}</b> · {VERSION_TAG[k]}
            <span>{k === "v50" ? "program-first, 0 agent calls" : "Nemotron agent with six tools"}</span>
          </a>
        ))}
      </div>

      {vkey === "v50" ? (
        <div className="batchline">
          <span className="eyebrow">V5.0 measurement · six clips, one attempt each</span>
          <span>
            <b>{f.accepted}/{f.attempts}</b> valid answers · <b>{f.count_correct}/{f.attempts}</b> right count ·{" "}
            <b>{f.count_and_supported_colors}/{f.attempts}</b> count and colours supported by the frames ·{" "}
            <b>{f.count_and_exact_colors}/{f.attempts}</b> exact colour strings ·{" "}
            <b className="bad">{f.complete_correct}/{f.attempts}</b> complete answers ·{" "}
            <b>{f.nemotron_calls}</b> Nemotron calls · not promoted
          </span>
        </div>
      ) : (
        <div className="batchline">
          <span className="eyebrow">V4.2 measurement · six clips, one attempt each</span>
          <span>
            <b>{f.accepted}/{f.attempts}</b> answers accepted · <b>{f.count_correct}/{f.attempts}</b> right count ·{" "}
            <b>{f.count_and_supported_colors}/{f.attempts}</b> count and colours supported by the frames ·{" "}
            <b className="bad">{f.complete_correct}/{f.attempts}</b> complete answers · not promoted
          </span>
        </div>
      )}

      <div className="picker" role="group" aria-label="Choose an attempt">
        {ver.runs.map((r) => (
          <a key={r.bundle} className={`runcard${r.goal_correct ? " good" : ""}`} href={runHref(r.bundle)}
             aria-current={r.bundle === name ? "page" : undefined}>
            <span className="rc-top"><b>{r.attempt}</b>{r.bundle === ver.featured && <span className="pill cite">featured</span>}</span>
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
      {current && oracle && current.bundle_version === "4.2" && (
        <Run42 bundle={current as Loaded} oracle={oracle} startT={startT} />
      )}
      {current && oracle && current.bundle_version === "5.0" && (
        <RunView50 key={current._dir} bundle={current as Loaded50} oracle={oracle} startStage={startStage} />
      )}
    </main>
  );
}
