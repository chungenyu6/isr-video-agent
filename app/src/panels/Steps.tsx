// The normalized trace. Errors, faults and retries stay inline; raw payloads are
// one click away.

import { useEffect, useRef } from "react";
import type { Bundle, HEvent } from "../types";
import { stepLabel } from "../data";

const SHOWN: HEvent["type"][] = [
  "agent.say", "tool.call", "tool.error", "tool.fault", "budget.spend",
  "frames.ready", "observe.done", "answer.submit", "verify.result",
];

export default function Steps({ bundle, t }: { bundle: Bundle; t: number }) {
  const rows = bundle.events.filter((e) => e.t <= t && SHOWN.includes(e.type));
  const box = useRef<HTMLDivElement | null>(null);
  const last = useRef(0);

  useEffect(() => {
    if (rows.length > last.current && box.current) box.current.scrollTop = box.current.scrollHeight;
    last.current = rows.length;
  }, [rows.length]);

  return (
    <div className="steps" ref={box}>
      {rows.length === 0 && <div className="step"><span className="tt">—</span><span className="say">waiting…</span></div>}
      {rows.map((e, i) => {
        const bad = e.type === "tool.error" || e.type === "tool.fault" ||
          (e.type === "budget.spend" && (e.detail as { granted?: boolean }).granted === false);
        const payload = e.args ?? e.detail;
        return (
          <div key={i} className={`step e-${e.type.replace(".", "-")}${i === rows.length - 1 ? " cur" : ""}`}>
            <span className="tt">{e.t.toFixed(1)}</span>
            {e.type === "agent.say" ? (
              <span className="say">{e.text}</span>
            ) : (
              <span>
                <span className={`lab${bad ? " bad" : ""}`}>{stepLabel(e)}</span>
                {e.type === "tool.call" && e.tool && <span className="dim"> · {e.tool}</span>}
                {payload !== undefined && (
                  <details>
                    <summary>raw</summary>
                    <pre>{typeof payload === "string" ? payload : JSON.stringify(payload, null, 1)}</pre>
                  </details>
                )}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
