// One attempt, end to end, for either version. The version comes from the bundle
// name. A V5.0 or V5.2 link lands on the V5.3 run of the same clip (both left the
// site with V5.3: same clips, same main pipeline); any other unknown name falls back
// to the current featured run with a one-line notice instead of an error.

import { useEffect, useState } from "react";
import type { Experiment, Loaded, Oracle, VersionKey } from "../types";
import type { Loaded53 } from "../v53/types";
import { clipLabel, loadAnyBundle, loadOracle, type AnyLoaded } from "../data";
import { archHref, runHref, upgradeLink, versionOf } from "../router";
import { RUN_NOTES_V42 } from "../v42/notes";
import { RUN_NOTES_V53 } from "../v53/notes";
import Run42 from "../v42/Run42";
import RunView53 from "../v53/RunView";

interface Props { exp: Experiment; bundleName: string | null; startT: number | null; startStage: number | null }

const compact = (colors: string[]) =>
  [...new Set(colors)].map((c) => {
    const n = colors.filter((x) => x === c).length;
    return n > 1 ? `${c} ×${n}` : c;
  }).join(", ");

const VERSION_TAG: Record<VersionKey, string> = { v53: "current", v42: "previous" };
const VERSION_SUB: Record<VersionKey, string> = {
  v53: "program-first; agent only for a case",
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
  const note = summary ? (vkey === "v53" ? RUN_NOTES_V53[summary.clip_id] : RUN_NOTES_V42[summary.attempt]) : null;
  // The same clip in the other version, when it exists.
  const sibling = (k: VersionKey) => {
    const other = name.replace(/^v(42|52)-/, `${k}-`);
    return exp.versions[k].runs.some((r) => r.bundle === other) ? other : exp.versions[k].featured;
  };
  const diag = exp.versions.v53.diagnostic;

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
          That link was to an earlier version. V5.0 and V5.2 have been replaced on this site by V5.3, which keeps the same
          main pipeline. Showing the V5.3 run of the same clip. Earlier sites are kept as the git tags{" "}
          <code>v50-site</code> and <code>v52-site</code>.
        </div>
      )}

      <div className="versions" role="group" aria-label="System version">
        {(["v53", "v42"] as VersionKey[]).map((k) => (
          <a key={k} href={runHref(k === vkey ? name : sibling(k))} aria-current={k === vkey ? "page" : undefined}>
            <b>{exp.versions[k].label}</b> · {VERSION_TAG[k]}
            <span>{VERSION_SUB[k]}</span>
          </a>
        ))}
      </div>

      {vkey === "v53" ? (
        <div className="batchline">
          <span className="eyebrow">V5.3 measurement · 12 clips × two wordings × two passes = {f.attempts} attempts</span>
          <span>
            <b className="bad">{f.count_correct}/{f.attempts}</b> right count (V5.2: 48/48) ·{" "}
            <b>{f.color_tokens_matched}/{f.attempts}</b> colour words match · <b>{f.count_and_exact_colors}/{f.attempts}</b> exact
            colour strings · <b className="bad">{f.false_positive_vehicles}</b> reported vehicles match no labelled one ·{" "}
            count_complete <b>{f.count_complete_true}</b> true and right, {f.count_complete_conservative_false} false
            though right, <b className="bad">{f.count_complete_false_and_wrong}</b> false and wrong · agent started{" "}
            <b>{f.natural_investigations}/{f.attempts}</b> (one clip), and each time it split one car into two ·{" "}
            {f.nemotron_calls} Nemotron / {f.gemma_calls} Gemma calls · not promoted
          </span>
          {diag && (
            <span className="fine">
              Separately, in {diag.pi_cases} saved-state cases Pi was right in{" "}
              <b>{diag.pi_correct["pi-cap2"]}/{diag.pi_cases}</b> with a per-case Gemma cap of 2 and{" "}
              <b>{diag.pi_correct["pi-cap4"]}/{diag.pi_cases}</b> with 4 (V5.2: {diag.pi_correct.v52_pi}/{diag.pi_cases}).
              The better guidance helped the agent, and the same eagerness hurt the main answer.{" "}
              <a href={`${archHref("v53")}#agent-value`}>Compare all 28 →</a>
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
              <b>{vkey === "v53" ? r.clip_id : r.attempt}</b>
              {r.bundle === ver.featured && <span className="pill cite">featured</span>}
              {r.investigation && <span className="pill o-agent">agent</span>}
            </span>
            <span className="rc-clip">{clipLabel(r.clip_id, r.expected_count)}</span>
            <span className="rc-ans">answered {r.reported_count ?? "–"}{r.colors.length ? `: ${compact(r.colors)}` : ""}</span>
            {r.repeats && (
              <span className="rc-rep">
                {r.identical_answers ? `same in ${r.repeats}/${r.repeats}` : `varied over ${r.repeats}`}
                {r.changed_from_v52 ? " · changed from V5.2" : ""}
                {r.false_positive_vehicles?.length ? " · extra vehicle" : ""}
              </span>
            )}
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
      {current && oracle && current.bundle_version === "5.3" && (
        <RunView53 key={current._dir} bundle={current as Loaded53} oracle={oracle} startStage={startStage} />
      )}
    </main>
  );
}
