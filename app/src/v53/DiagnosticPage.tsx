// A V5.2 controlled diagnostic: one saved-state scenario run three ways, once
// each. No controller saw another's new Gemma replies. Shown: the scenario, the
// three outcomes side by side, then the Pi attempt replayed in full. This is not
// a natural trigger: the state was saved from earlier runs and, for some
// scenarios, a join was held back or a case assigned so that a case would open.

import { useEffect, useState } from "react";
import type { Controller, Experiment, Oracle } from "../types";
import type { Loaded52 } from "./types";
import { loadBundle52, loadOracle } from "../data";
import { archHref, caseHref, runHref } from "../router";
import { DIAG_NOTES_V52 } from "./notes";
import { STAGE } from "./derive";
import RunView from "./RunView";

interface Props { exp: Experiment; bundleName: string | null; startStage: number | null }

const CTL_LABEL: Record<Controller, string> = {
  none: "No follow-up",
  fixed: "Fixed check (scripted)",
  pi: "Pi + Nemotron",
};

export default function DiagnosticPage({ exp, bundleName, startStage }: Props) {
  const diag = exp.versions.v52.diagnostic!;
  const replays = Object.entries(diag.replays);
  const hit = replays.find(([, n]) => n === bundleName);
  const [scen, name] = hit ?? replays[0];
  const [bundle, setBundle] = useState<Loaded52 | null>(null);
  const [oracle, setOracle] = useState<Oracle | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setErr(null);
    loadBundle52(name)
      .then(async (b) => { const o = await loadOracle(b.clip_id); if (alive) { setBundle(b); setOracle(o); } })
      .catch((e) => alive && setErr(String(e)));
    return () => { alive = false; };
  }, [name]);
  const cur = bundle && bundle._dir === name ? bundle : null;
  const cells = diag.cells[scen];
  const note = DIAG_NOTES_V52[scen];
  const sib = (c: Controller) => cur?.diagnostic?.siblings.find((s) => s.controller === c);

  return (
    <main className="runpage">
      {bundleName !== null && !hit && (
        <div className="notice">No diagnostic replay named <code>{bundleName}</code>. Showing {scen}.</div>
      )}
      <div className="batchline">
        <span className="eyebrow">V5.2 controlled diagnostic · saved state, not a natural trigger</span>
        <span>
          Seven scenarios, each run once three ways: no follow-up, a fixed scripted check, and Pi with Nemotron.
          Pi's case results were right in <b className="bad">{diag.pi_correct}/{diag.pi_cases}</b>.{" "}
          <a href={`${archHref("v52")}#agent-value`}>All 21 results →</a>{" "}
          <a href={runHref(exp.versions.v52.featured)}>The natural case →</a>
        </span>
      </div>

      <div className="versions" role="group" aria-label="Diagnostic scenario">
        {replays.map(([s, n]) => (
          <a key={s} href={caseHref(n)} aria-current={s === scen ? "page" : undefined}>
            <b>{s}</b> · Pi replay<span>{diag.scenarios[s]}</span>
          </a>
        ))}
      </div>

      <div className="casenote">
        <b>{scen}: {note.title}</b>
        <p>{note.note}</p>
        {cur?.diagnostic && (
          <p className="fine">
            Source clip <code>{cur.clip_id}</code>. Tracking and saved Gemma replies are imported from earlier measured
            runs of that clip; no new tracking job.{" "}
            {cur.diagnostic.packet.case ? `Case assigned by the packet: ${cur.diagnostic.packet.case.type} of ${cur.diagnostic.packet.case.refs.join(" / ")}.` : "The program proposed the case from the saved state."}
            {cur.diagnostic.packet.deferred_links.length ? ` Join held back: ${cur.diagnostic.packet.deferred_links.map((l) => l.join("–")).join(", ")}.` : ""}
            {" "}Caps for this item: {cur.diagnostic.limits.main} Nemotron, {cur.diagnostic.limits.visual} Gemma calls.
          </p>
        )}
      </div>

      <div className="tablewrap">
        <table className="diag3">
          <thead>
            <tr><th />{(["none", "fixed", "pi"] as Controller[]).map((c) => <th key={c}>{CTL_LABEL[c]}</th>)}</tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">calls</th>
              {(["none", "fixed", "pi"] as Controller[]).map((c) => <td key={c} className="mono">{cells[c].nemotron} Nemotron · {cells[c].gemma} Gemma</td>)}
            </tr>
            <tr>
              <th scope="row">case</th>
              {(["none", "fixed", "pi"] as Controller[]).map((c) => <td key={c}>{cells[c].case ?? "none"}</td>)}
            </tr>
            <tr>
              <th scope="row">answer</th>
              {(["none", "fixed", "pi"] as Controller[]).map((c) => {
                const s = c === "pi" ? cur?.answer.submission : sib(c)?.submission;
                return <td key={c}>{s ? `${s.reported_count ?? "–"}${s.colors.length ? `: ${s.colors.join(", ")}` : ""}` : "…"}</td>;
              })}
            </tr>
            <tr>
              <th scope="row">what happened</th>
              {(["none", "fixed", "pi"] as Controller[]).map((c) => (
                <td key={c}>
                  {cells[c].note}
                  {cells[c].correct !== undefined && (
                    <span className={`pill ${cells[c].correct ? "st-pass" : "st-fail"}`}>review: {cells[c].correct ? "right" : "wrong"}</span>
                  )}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">new Gemma text</th>
              {(["none", "fixed", "pi"] as Controller[]).map((c) => {
                const texts = c === "pi"
                  ? (cur?.appearance.filter((a) => a.origin !== "imported").map((a) => a.text) ?? [])
                  : (sib(c)?.gemma_texts ?? []);
                return (
                  <td key={c}>
                    {texts.length === 0 ? <span className="dim">none</span> : texts.map((t, k) => <blockquote key={k} className="small">{t}</blockquote>)}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="fine">
        Only Pi's results carry a verdict (the coding-agent case review). The none and fixed columns are described as
        the report describes them, not scored. By design the fixed check never turns free Gemma text into “same”.
      </p>

      {err && <div className="error">{err}</div>}
      {!cur && !err && <div className="loading">loading replay…</div>}
      {cur && oracle && (
        <RunView key={cur._dir} bundle={cur} oracle={oracle} startStage={startStage ?? STAGE.investigate} />
      )}
    </main>
  );
}
