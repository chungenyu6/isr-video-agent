// One attempt, end to end, for either version. The version comes from the bundle
// name. A V5.0 link lands on the V5.2 run of the same clip (V5.0 left the site
// with V5.2: same clips, same main pipeline); any other unknown name falls back
// to the current featured run with a one-line notice instead of an error.

import { useEffect, useState } from "react";
import type { Experiment, Loaded, Oracle, VersionKey } from "../types";
import type { Loaded52 } from "../v52/types";
import { clipLabel, loadAnyBundle, loadOracle, type AnyLoaded } from "../data";
import { archHref, runHref, upgradeLink, versionOf } from "../router";
import { RUN_NOTES_V42 } from "../v42/notes";
import { RUN_NOTES_V52 } from "../v52/notes";
import Run42 from "../v42/Run42";
import RunView52 from "../v52/RunView";

interface Props { exp: Experiment; bundleName: string | null; startT: number | null; startStage: number | null }

const compact = (colors: string[]) =>
  [...new Set(colors)].map((c) => {
    const n = colors.filter((x) => x === c).length;
    return n > 1 ? `${c} ×${n}` : c;
  }).join(", ");

const VERSION_TAG: Record<VersionKey, string> = { v52: "current", v42: "previous" };
const VERSION_SUB: Record<VersionKey, string> = {
  v52: "program-first; agent only for a case",
  v42: "Nemotron agent with six tools",
};

export default function RunPage({ exp, bundleName, startT, startStage }: Props) {
  const asked = bundleName ? upgradeLink(bundleName) : null;
  const upgraded = !!bundleName && asked !== bundleName;
  const key = asked ? versionOf(asked) : null;
  const known = !!(key && exp.versions[key].runs.some((r) => r.bundle === asked));
  const vkey: VersionKey = known && key ? key : exp.current;
  const ver = exp.versions[vkey];
  const name = known && asked ? asked : ver.featured;
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
  const summary = ver.runs.find((r) => r.bundle === name);
  const note = summary ? (vkey === "v52" ? RUN_NOTES_V52[summary.clip_id] : RUN_NOTES_V42[summary.attempt]) : null;
  // The same clip in the other version, when it exists.
  const sibling = (k: VersionKey) => {
    const other = name.replace(/^v(42|52)-/, `${k}-`);
    return exp.versions[k].runs.some((r) => r.bundle === other) ? other : exp.versions[k].featured;
  };
  const diag = exp.versions.v52.diagnostic;

  return (
    <main className="runpage">
      {redirected && (
        <div className="notice">
          The link pointed to a run that is not on this site any more (<code>{bundleName}</code>). Showing the featured
          {" "}{ver.label} run instead.
        </div>
      )}
      {upgraded && known && (
        <div className="notice">
          V5.0 has been replaced on this site by V5.2, which keeps V5.0's main pipeline. Showing the V5.2 run of the same
          clip. The V5.0 site is kept as the git tag <code>v50-site</code>.
        </div>
      )}

      <div className="versions" role="group" aria-label="System version">
        {(["v52", "v42"] as VersionKey[]).map((k) => (
          <a key={k} href={runHref(k === vkey ? name : sibling(k))} aria-current={k === vkey ? "page" : undefined}>
            <b>{exp.versions[k].label}</b> · {VERSION_TAG[k]}
            <span>{VERSION_SUB[k]}</span>
          </a>
        ))}
      </div>

      {vkey === "v52" ? (
        <div className="batchline">
          <span className="eyebrow">V5.2 measurement · 12 clips × two wordings × two passes = {f.attempts} attempts</span>
          <span>
            <b>{f.count_correct}/{f.attempts}</b> right count · <b>{f.count_and_supported_colors}/{f.attempts}</b> colours
            supported by the frames ({f.white_only_underdescribed} only “white”, purple left out) ·{" "}
            <b>{f.count_and_exact_colors}/{f.attempts}</b> exact colour strings ·{" "}
            <b className="bad">{f.complete_property_true}/{f.attempts}</b> count_complete ·{" "}
            <b>{f.identical_answers_clips}/12</b> clips identical in all four repeats ·{" "}
            agent started <b>{f.natural_investigations}/{f.attempts}</b>, every case left unresolved ·{" "}
            {f.nemotron_calls} Nemotron / {f.gemma_calls} Gemma calls · not promoted
          </span>
          {diag && (
            <span className="fine">
              Investigation value, separately: in {diag.pi_cases} saved-state cases Pi was right in{" "}
              <b className="bad">{diag.pi_correct}/{diag.pi_cases}</b>, with one wrong “different” adopted. A fixed,
              scripted check got more out of the same cases with {diag.totals.fixed.gemma} Gemma calls and no Nemotron.{" "}
              <a href={`${archHref("v52")}#agent-value`}>Compare all 21 →</a>
            </span>
          )}
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

      <div className={`picker${ver.runs.length > 6 ? " many" : ""}`} role="group" aria-label="Choose an attempt">
        {ver.runs.map((r) => (
          <a key={r.bundle} className={`runcard${r.goal_correct ? " good" : ""}`} href={runHref(r.bundle)}
             aria-current={r.bundle === name ? "page" : undefined}>
            <span className="rc-top">
              <b>{vkey === "v52" ? r.clip_id : r.attempt}</b>
              {r.bundle === ver.featured && <span className="pill cite">featured</span>}
              {r.investigation && <span className="pill o-agent">agent</span>}
            </span>
            <span className="rc-clip">{clipLabel(r.clip_id, r.expected_count)}</span>
            <span className="rc-ans">answered {r.reported_count ?? "–"}{r.colors.length ? `: ${compact(r.colors)}` : ""}</span>
            {r.repeats && <span className="rc-rep">{r.identical_answers ? `same in ${r.repeats}/${r.repeats}` : "varied"}{r.underdescribed ? " · colour under-described" : ""}</span>}
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
      {current && oracle && current.bundle_version === "5.2" && (
        <RunView52 key={current._dir} bundle={current as Loaded52} oracle={oracle} startStage={startStage} />
      )}
    </main>
  );
}
