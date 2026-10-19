import { useEffect, useState } from "react";
import type { Experiment } from "./types";
import { loadExperiment } from "./data";
import { archHref, runHref, useRoute, versionOf } from "./router";
import RunPage from "./pages/RunPage";
import ArchitecturePage52 from "./v52/ArchitecturePage";
import DiagnosticPage from "./v52/DiagnosticPage";
import ArchitecturePage42 from "./v42/ArchitecturePage";

export default function App() {
  const route = useRoute();
  const [exp, setExp] = useState<Experiment | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    loadExperiment().then(setExp).catch((e) => setErr(String(e)));
  }, []);

  useEffect(() => { window.scrollTo(0, 0); }, [route.page]);

  // The version on screen: the bundle's for a run, the page's for architecture.
  const shownVersion = route.page === "architecture"
    ? route.version
    : route.page === "case" ? "v52"
    : (route.bundle && versionOf(route.bundle)) || exp?.current || "v52";
  const ver = exp?.versions[shownVersion];
  const featured = exp ? exp.versions[exp.current].featured : "";
  return (
    <>
      <div className="lanebar" aria-hidden="true" />
      <div className="shell">
        <header className="mast">
          <a className="brand" href={runHref(featured)}>
            ISR Video Agent <span className="ver">{ver?.label ?? "V5.2"}</span>
          </a>
          <nav className="nav" aria-label="Pages">
            <a href={runHref(ver?.featured ?? featured)} aria-current={route.page === "run" || route.page === "case" ? "page" : undefined}>Run replay</a>
            <a href={archHref(shownVersion)} aria-current={route.page === "architecture" ? "page" : undefined}>How it works</a>
          </nav>
        </header>

        {err && <div className="error">{err}</div>}
        {!exp && !err && <div className="loading">loading…</div>}
        {exp && route.page === "run" && (
          <RunPage exp={exp} bundleName={route.bundle} startT={route.t} startStage={route.stage} />
        )}
        {exp && route.page === "case" && <DiagnosticPage exp={exp} bundleName={route.bundle} startStage={route.stage} />}
        {exp && route.page === "architecture" && route.version === "v52" && <ArchitecturePage52 exp={exp} />}
        {exp && route.page === "architecture" && route.version === "v42" && <ArchitecturePage42 exp={exp.versions.v42} />}
      </div>
    </>
  );
}
