// Every frame the vision model received, with what it said about it and what the
// frame was actually good for.

import type { Loaded, Oracle } from "../types";
import { frameProgress, frameRole, frameUrl } from "../data";

interface Props { bundle: Loaded; oracle: Oracle; t: number; frame: number; onFrame: (n: number) => void; prefix?: string }

export default function Observations({ bundle, oracle, t, frame, onFrame, prefix }: Props) {
  const { sent } = frameProgress(bundle, t);
  const rows = bundle.frames
    .filter((f) => f.inspected && f.frame_id !== null && sent.has(f.frame_id))
    .sort((a, b) => (a.frame_id ?? 0) - (b.frame_id ?? 0));

  if (!rows.length) return <p className="pending">No frame has been sent to the vision model yet.</p>;

  return (
    <ol className="obs">
      {rows.map((f) => {
        const role = frameRole(oracle, f.frame_id);
        return (
          <li key={f.key} className={f.frame_id === frame ? "cur" : undefined}>
            <button className="thumb" onClick={() => onFrame(f.frame_id!)} aria-label={`Show frame ${f.frame_id}`}>
              {f.file ? <img src={frameUrl(bundle._dir, f.file, prefix)} alt="" loading="lazy" /> : <span className="empty">missing</span>}
            </button>
            <div>
              <div className="ohead">
                <span className="mono">frame {f.frame_id} · {f.t.toFixed(1)} s</span>
                {f.frame_id === 0 && <span className="pill st-na">frame 0</span>}
                {role?.kind === "pairable" && <span className="pill st-pass">usable for {role.target.color_name}</span>}
                {role?.kind === "visible" && <span className="pill st-unknown">{role.target.color_name} visible, not pairable</span>}
                {f.cited && <span className="pill cite">cited</span>}
              </div>
              <p>{f.observation ?? <span className="dim">no observation recorded for this frame</span>}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
