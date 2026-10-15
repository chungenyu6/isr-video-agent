// The agent's trace. Nemotron ran with thinking off and emitted no prose, so the
// trace IS the tool calls, the host's replies, and the submitted uncertainty.

import { useEffect, useRef } from "react";
import type { Loaded, Step } from "../../types";
import { stepTrack } from "../../data";
import type { Focus } from "./RunView";

interface Props {
  bundle: Loaded;
  t: number;
  focus: Focus;
  aliasIdx: Map<string, number>;
  onSeek: (t: number) => void;
}

function argLine(s: Step): string {
  const a = s.args;
  if (s.tool === "evidence_submit") {
    return `count ${a.reported_count ?? "–"} · colours [${(a.colors as string[] | undefined)?.join(", ") ?? ""}] · complete ${a.count_complete}`;
  }
  return Object.entries(a).map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`).join(" ");
}

export default function Steps({ bundle, t, focus, aliasIdx, onSeek }: Props) {
  const box = useRef<HTMLDivElement | null>(null);
  const visible = bundle.steps.filter((s) => s.t_call <= t);

  // Collapse runs of observation_get: in these runs they re-read facts already shown.
  const groups: Step[][] = [];
  for (const s of visible) {
    const last = groups[groups.length - 1];
    if (last && s.tool === "observation_get" && last[0].tool === "observation_get") last.push(s);
    else groups.push([s]);
  }

  useEffect(() => {
    const el = box.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [visible.length]);

  const row = (s: Step) => {
    const ref = stepTrack(s);
    const running = t < s.t_result;
    return (
      <div key={s.i} className={`step${running ? " cur" : ""}`}>
        <button className="tt" onClick={() => { onSeek(s.t_result); if (ref) { const i = aliasIdx.get(ref); if (i !== undefined) focus.setTrack(i); } }}
                aria-label={`jump to step ${s.i + 1}`}>
          {s.t_call.toFixed(1)}s
        </button>
        <div>
          <span className="toolname">{s.tool}</span>{" "}
          <span className="args">{argLine(s)}</span>{" "}
          {running ? <span className="pill st-na">waiting</span>
            : s.accepted ? <span className="pill st-pass">accepted</span>
            : <span className="pill st-fail">rejected</span>}
          {s.visual !== undefined && !running && <span className="pill cite">Gemma</span>}
          {!running && (
            <details>
              <summary>host reply · {s.agent_text_chars} chars</summary>
              <pre>{s.agent_text}{s.agent_text_chars > s.agent_text.length ? "\n…" : ""}</pre>
            </details>
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      <p className="fine top">
        Nemotron ran with thinking off and wrote no free text. Each line below is one model call that produced one
        tool call; nothing is hidden. Click a time to jump there.
      </p>
      <div className="steps" ref={box}>
        {groups.map((g) => g.length < 3 ? g.map(row) : (
          <details key={g[0].i} className="stepgroup">
            <summary>
              <span className="tt">{g[0].t_call.toFixed(1)}s</span>
              <span><span className="toolname">observation_get</span> ×{g.length}{" "}
                <span className="args">{g.map(stepTrack).join(", ")}</span>{" "}
                <span className="pill st-unknown">re-reads, no new information</span></span>
            </summary>
            {g.map(row)}
          </details>
        ))}
        {visible.length === 0 && <div className="step"><span /><span className="dim">the task has been sent; waiting for the first call</span></div>}
      </div>
      {t >= bundle.steps[bundle.submission.step].t_result && (
        <div className="uncert">
          <span className="eyebrow">Submitted uncertainty, verbatim</span>
          <blockquote>{bundle.submission.uncertainty}</blockquote>
        </div>
      )}
      <details className="rawtext">
        <summary>system prompt and the six tool descriptions the agent was given</summary>
        <pre>{bundle.task.system}</pre>
        {Object.entries(bundle.task.tools).map(([k, v]) => <pre key={k}><b>{k}</b>{"\n"}{v}</pre>)}
      </details>
    </div>
  );
}
