// Every tool the agent could reach for, always visible; an idle tool is as
// informative as a busy one. The declared procedure is drawn beneath, with any
// step the agent claimed in its tool_trace but never ran marked as such.

import type { Bundle } from "../types";
import { activeScript } from "../data";

const HARNESS_TOOLS = ["bash", "read", "write"];
const SCRIPTS = ["probe_video", "extract_window", "vlm_inspect", "submit_evidence"];

export default function ToolRack({ bundle, t }: { bundle: Bundle; t: number }) {
  const live = activeScript(bundle, t);
  const used = new Map<string, number>();
  for (const e of bundle.events) {
    if (e.t > t) break;
    if (e.type === "tool.call") {
      for (const k of [e.tool, e.script]) if (k) used.set(k, (used.get(k) ?? 0) + 1);
    }
  }
  const claimedOnly = [...new Set(bundle.pipeline.claimed.filter((s) => !bundle.pipeline.actual.includes(s)))];
  const cls = (k: string) => (live === k ? "tool live" : used.has(k) ? "tool used" : "tool idle");

  return (
    <div>
      <div className="rack" title="Harness built-in tools">
        {HARNESS_TOOLS.map((k) => <span key={k} className={cls(k)}>{k}{used.get(k) ? ` ×${used.get(k)}` : ""}</span>)}
      </div>
      <div className="rack" title="Instrumented perception tools">
        {SCRIPTS.map((k) => <span key={k} className={cls(k)}>{k}{used.get(k) ? ` ×${used.get(k)}` : ""}</span>)}
      </div>
      {claimedOnly.length > 0 && (
        <div className="rack">
          <span className="eyebrow">claimed, never run</span>
          {claimedOnly.map((s) => <span key={s} className="tool phantom">{s}</span>)}
        </div>
      )}
    </div>
  );
}
