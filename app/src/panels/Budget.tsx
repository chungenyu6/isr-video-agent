// Frame budget, depleting on the run clock. A refused reservation is a hard limit
// visibly biting.

import type { Bundle } from "../types";
import { budgetAt } from "../data";

const LABEL: Record<string, string> = {
  coarse_frames: "coarse frames",
  dense_frames: "window frames",
  vlm_inspected_frames: "sent to vision model",
};

export default function Budget({ bundle, t }: { bundle: Bundle; t: number }) {
  const spent = budgetAt(bundle, t);
  const denied = bundle.events.filter((e) => e.t <= t && e.type === "budget.spend" &&
    (e.detail as { granted?: boolean }).granted === false).length;
  return (
    <div>
      {Object.entries(bundle.budget.limits).map(([k, lim]) => {
        const used = spent[k] ?? 0;
        const p = lim > 0 ? Math.min(100, (used / lim) * 100) : 0;
        return (
          <div className="gauge" key={k}>
            <div className="gauge-lab"><span>{LABEL[k] ?? k}</span><span>{used} / {lim}</span></div>
            <div className="bar-bg"><div className={`bar-fg${p >= 100 ? " full" : ""}`} style={{ width: `${p}%` }} /></div>
          </div>
        );
      })}
      {denied > 0 && <div className="denied">{denied} reservation{denied > 1 ? "s" : ""} refused — budget exhausted</div>}
    </div>
  );
}
