// What the run spent against its caps, revealed by stage, and the GPU memory the
// study sampled while it ran. Nemotron is used only inside investigation cases.

import type { Loaded53 } from "./types";
import { gemmaUsedAt, STAGE } from "./derive";

function Gauge({ label, used, limit, unit = "" }: { label: string; used: number; limit: number; unit?: string }) {
  const pct = Math.min(100, (100 * used) / limit);
  return (
    <div className="gauge">
      <div className="gauge-lab"><span>{label}</span><span>{used}{unit} / {limit}{unit}</span></div>
      <div className="bar-bg"><div className={`bar-fg${used >= limit ? " full" : ""}`} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

export default function Budget({ bundle, stage }: { bundle: Loaded53; stage: number }) {
  const b = bundle.budget;
  const inv = bundle.task.investigation;
  const rt = bundle.runtime;
  const caseCap = bundle.diagnostic?.visual_cap ?? rt.case_visual_limit;
  const gpu = bundle.run.gpu;
  const pct = (x: number | null) => (x === null ? "–" : `${(x * 100).toFixed(1)}%`);
  return (
    <div>
      <Gauge label="Nemotron calls" used={stage >= STAGE.investigate ? b.nemotron.used : 0} limit={b.nemotron.limit} />
      <Gauge label="Gemma calls" used={gemmaUsedAt(bundle, stage)} limit={b.gemma.limit} />
      <Gauge label="tool text delivered to the agent" used={stage >= STAGE.investigate ? b.tool_text.limit - b.tool_text.remaining : 0} limit={b.tool_text.limit} unit=" ch" />
      <div className="invest">
        <span className="eyebrow">Investigation branch · {inv.used ? "started in this run" : "not started in this run"}</span>
        <p>
          When a doubt could change the answer and a new look could settle it (which records are one car, an unreadable
          colour), the program opens a case and starts Pi with Nemotron: up to {String(rt.case_limit)} cases,
          {" "}{String(caseCap)} new Gemma calls each (shown to the agent after every result). Nemotron closes a case; it never writes the count.
          {" "}{inv.used
            ? "Every call it made, and every refusal, is in the Investigate panel."
            : "In the stability batch this happened in 4 of 48 attempts, all on one clip."}
        </p>
        <details className="rawtext">
          <summary>the five tools {inv.used ? "it had" : "it would get"}</summary>
          <ul className="toollist">
            {Object.entries(inv.tools).map(([k, v]) => <li key={k}><code>{k}</code> {v}</li>)}
          </ul>
        </details>
      </div>
      {gpu && (
        <div className="invest gpu">
          <span className="eyebrow">GPU memory · sampled every {gpu.interval_sec} s by the study</span>
          <ul className="gpulist">
            {gpu.tracking_job && (
              <li><b>tracking job</b> peak {gpu.tracking_job.peak_allocated_mib.toFixed(0)} MiB allocated,
                {" "}{gpu.tracking_job.peak_reserved_mib.toFixed(0)} MiB reserved, {gpu.tracking_job.seconds.toFixed(1)} s</li>
            )}
            {Object.entries(gpu.services).filter(([, v]) => v.kv_cache_usage_max !== null).map(([name, v]) => (
              <li key={name}><b>{name}</b> {(v.nvidia_smi_used_max_mib / 1024).toFixed(1)} of {(v.total_mib / 1024).toFixed(0)} GB
                {" "}per GPU · KV cache in use: max {pct(v.kv_cache_usage_max)}, mean {pct(v.kv_cache_usage_mean)}</li>
            ))}
          </ul>
          <p className="fine">
            vLLM reserves 90% of each GPU when it starts, so the Gemma and Nemotron figures barely move between runs; what
            changes with a request is the KV-cache share. The tracking peak is that job's own use. Short Gemma requests can
            fall between two samples.
          </p>
        </div>
      )}
    </div>
  );
}
