import { useEffect, useState } from "react";
import type { Experiment } from "./types";
import { loadExperiment } from "./data";
import { ARCH_HREF, runHref, useRoute } from "./router";
import RunPage from "./pages/RunPage";
import ArchitecturePage from "./pages/ArchitecturePage";

export default function App() {
  const route = useRoute();
  const [exp, setExp] = useState<Experiment | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    loadExperiment().then(setExp).catch((e) => setErr(String(e)));
  }, []);

  useEffect(() => { window.scrollTo(0, 0); }, [route.page]);

  const featured = exp?.featured ?? "";
  return (
    <>
      <div className="lanebar" aria-hidden="true" />
      <div className="shell">
        <header className="mast">
          <a className="brand" href={runHref(featured)}>ISR Video Agent <span className="ver">V4.2</span></a>
          <nav className="nav" aria-label="Pages">
            <a href={runHref(featured)} aria-current={route.page === "run" ? "page" : undefined}>Run replay</a>
            <a href={ARCH_HREF} aria-current={route.page === "architecture" ? "page" : undefined}>How it works</a>
          </nav>
        </header>

        {err && <div className="error">{err}</div>}
        {!exp && !err && <div className="loading">loading…</div>}
        {exp && route.page === "run" && (
          <RunPage exp={exp} bundleName={route.bundle || featured} startT={route.t} />
        )}
        {exp && route.page === "architecture" && <ArchitecturePage exp={exp} />}
      </div>
    </>
  );
}
