// Stage 5. The cases the program proposed (or a diagnostic packet assigned),
// and, when Pi started, every Nemotron turn: either the one tool call it made
// (whether the Runtime Verifier let it through, what text came back, the images
// Gemma was shown on its behalf) or the text it answered with instead of a tool
// call. When Pi stops without a legal finish, the host sends one continuation
// prompt in the same session; that row is the host speaking, not Nemotron.

import { useEffect, useState } from "react";
import type { AgentStep, Loaded53 } from "./types";
import { bundleFile } from "../data";
import { STAGE } from "./derive";
import type { Focus53 } from "./RunView";

interface Props { bundle: Loaded53; stage: number; focus: Focus53 }

function argText(args: Record<string, unknown>): string {
  const parts = Object.entries(args).map(([k, v]) => {
    if (Array.isArray(v) && v.length > 6 && v.every((x) => typeof x === "number")) {
      const n = v as number[];
      return `${k}: [${n[0]}…${n[n.length - 1]}] (${n.length})`;
    }
    if (typeof v === "string" && /^o[0-9a-f]{32}$/.test(v)) return `${k}: ${v.slice(0, 9)}…`;
    if (Array.isArray(v)) return `${k}: [${v.map((x) => (typeof x === "string" && /^o[0-9a-f]{32}$/.test(x) ? `${x.slice(0, 9)}…` : JSON.stringify(x))).join(", ")}]`;
    return `${k}: ${JSON.stringify(v)}`;
  });
  return parts.join(", ");
}

const OUTCOME: Record<AgentStep["outcome"], string> = {
  accepted: "accepted",
  refused: "refused by the Runtime Verifier",
  pi_error: "rejected by Pi before it left the sandbox",
  message: "Nemotron answered in text instead of calling a tool",
  nudge: "the host's continuation prompt (not a model call)",
};

const PILL: Record<AgentStep["outcome"], [string, string]> = {
  accepted: ["st-pass", "ok"],
  refused: ["st-fail", ""],
  pi_error: ["st-fail", "Pi error"],
  message: ["st-warn", "text reply"],
  nudge: ["", "host prompt"],
};

export default function Investigation({ bundle, stage, focus }: Props) {
  const ag = bundle.agent;
  const steps = ag?.steps ?? [];
  const [cur, setCur] = useState(steps.length - 1);
  const [open, setOpen] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => { setCur(steps.length - 1); setOpen(null); }, [bundle._dir, steps.length]);
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setCur((c) => { if (c >= steps.length - 1) { setPlaying(false); return c; } return c + 1; });
    }, 1100);
    return () => window.clearInterval(id);
  }, [playing, steps.length]);

  const vIdx = new Map(bundle.vehicles.map((v, i) => [v.ref, i]));
  const tVeh = new Map(bundle.tracking.tracks.map((t) => [t.alias, t.vehicle]));
  const pick = (ref: string) => {
    const v = ref.startsWith("T") ? tVeh.get(ref) : ref;
    const i = v ? vIdx.get(v) : undefined;
    if (i !== undefined) { focus.setVeh(i); focus.setFrame(bundle.vehicles[i].observed[0]); }
  };

  if (stage < STAGE.look) return <p className="pending">Cases are proposed after the Look stage, from what the rule and Gemma left uncertain.</p>;
  if (bundle.cases.length === 0) {
    return (
      <p className="pending">
        No case: nothing left uncertain could change the answer and be settled by a new look. Pi was not started;
        0 Nemotron calls. (This is the path for 44 of the 48 stability attempts.)
      </p>
    );
  }
  const done = stage >= STAGE.investigate;
  const shownUpTo = done ? cur : -1;
  return (
    <div className="investigation">
      {bundle.cases.map((c) => (
        <div key={c.case_ref} className={`casecard st-${done ? c.status : "pending"}`}>
          <div className="cc-head">
            <b>{c.case_ref}</b> <span className="pill">{c.type}</span>
            {c.refs.map((r) => <button key={r} className="glink" onClick={() => pick(r)}>{r}</button>)}
            <span className="pill">{c.assigned ? "assigned by the diagnostic packet" : "proposed by the program"}</span>
            <span className={`pill ${done && c.status === "resolved" ? "st-pass" : done ? "st-warn" : ""}`}>
              {done ? c.status : "pending"}
              {done && c.result?.finding ? ` · ${c.result.finding}` : ""}
            </span>
          </div>
          {c.question && <p className="cc-q">{c.question}</p>}
          {c.impact && <p className="fine">{c.impact}</p>}
          {done && c.result && (
            <p className="fine mono">
              investigation_finish → outcome {c.result.outcome}{c.result.finding ? `, finding ${c.result.finding}` : ""}
              {c.result.observation_refs?.length ? `, citing ${c.result.observation_refs.map((o) => `${o.slice(0, 9)}…`).join(", ")}` : ""}
            </p>
          )}
        </div>
      ))}

      {!ag ? (
        <p className="pending">The case was settled without starting Pi.</p>
      ) : !done ? (
        <p className="pending">Pi starts in stage {STAGE.investigate} (Investigate).</p>
      ) : (
        <>
          <div className="pl-controls" role="group" aria-label="Step through Nemotron's calls">
            <button className="primary" onClick={() => {
              if (playing) { setPlaying(false); return; }
              if (cur >= steps.length - 1) setCur(0);
              setPlaying(true);
            }}>{playing ? "❚❚ pause" : "▶ replay calls"}</button>
            <button onClick={() => { setPlaying(false); setCur(Math.max(0, cur - 1)); }} aria-label="previous call">◀</button>
            <button onClick={() => { setPlaying(false); setCur(Math.min(steps.length - 1, cur + 1)); }} aria-label="next call">▶</button>
            <span className="clock">
              call {cur + 1} / {steps.length} · {steps[cur]?.t_result.toFixed(1)} s after Pi started ·
              {" "}{ag.calls} Nemotron calls · {ag.refused} refused{ag.pi_errors ? ` · ${ag.pi_errors} rejected by Pi` : ""}
              {ag.continuations ? ` · ${ag.continuations} host continuation` : ""}
            </span>
          </div>
          <ol className="agentsteps">
            {steps.map((s) => {
              const later = s.i > shownUpTo;
              return (
                <li key={s.i} className={`as-${s.outcome} k-${s.kind}${s.i === cur ? " cur" : ""}${later ? " later" : ""}`}>
                  <button className="as-row" onClick={() => { setPlaying(false); setCur(s.i); setOpen(open === s.i ? null : s.i); }}
                          aria-expanded={open === s.i}>
                    <span className="as-n">{s.i + 1}</span>
                    <code className="as-tool">{s.tool ?? (s.kind === "nudge" ? "host →" : "Nemotron says")}</code>
                    <span className="as-args">{s.kind === "tool" ? argText(s.args) : `“${s.text.slice(0, 140)}${s.text.length > 140 ? "…" : ""}”`}</span>
                    <span className={`pill ${PILL[s.outcome][0]}`}>{s.outcome === "refused" ? s.code : PILL[s.outcome][1]}</span>
                    {s.budget_before && (
                      <span className="as-budget mono dim">
                        {s.budget_before.main_remaining} calls ·{" "}
                        {s.budget_before.case_ref
                          ? `${s.budget_before.case_ref} Gemma ${s.budget_before.case_gemma_remaining}/${s.budget_before.case_gemma_cap}`
                          : `${s.budget_before.gemma_remaining} Gemma`} left
                      </span>
                    )}
                  </button>
                  {s.visuals.length > 0 && !later && (
                    <div className="as-vis">
                      {s.visuals.flatMap((v) => bundle.appearance[v].media.map((m) => (
                        <button key={`${v}-${m.frame}`} className="thumb" onClick={() => focus.setFrame(m.frame)}
                                aria-label={`Gemma image, frame ${m.frame}`}>
                          <img src={bundleFile(bundle._dir, m.crops[0]?.path ?? m.full)} alt={`Crop sent to Gemma, frame ${m.frame}`} loading="lazy" />
                          <span className="mono">{m.targets[0]?.track_ref}@{m.frame}</span>
                        </button>
                      )))}
                    </div>
                  )}
                  {open === s.i && (
                    <div className="as-detail">
                      <div className="fine">{OUTCOME[s.outcome]}{s.detail ? `: ${s.detail}` : ""} · {s.text_chars} characters{s.kind === "tool" ? " returned to the agent" : ""}</div>
                      <pre className="as-text">{s.text}</pre>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
          <details className="rawtext">
            <summary>the instruction Pi started with</summary>
            <pre className="as-text">{ag.initial_user}</pre>
          </details>
          <p className="fine">
            Each row is one Nemotron call: a tool call, or a text reply instead of one. Refusals come from the Runtime
            Verifier (unknown references, a used-up Gemma budget, media already seen, a finish whose fields do not fit
            the case) and cost a call. The budget column is what the agent saw before that call; since V5.3 it includes
            the active case's own Gemma budget. Click a row to read the full text.
          </p>
        </>
      )}
    </div>
  );
}
