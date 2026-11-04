import { useEffect, useState } from "react";
import type { Experiment } from "./types";
import { loadExperiment } from "./data";
import { archHref, runHref, useRoute, versionOf } from "./router";
import RunPage from "./pages/RunPage";
import ArchitecturePage53 from "./v53/ArchitecturePage";
import DiagnosticPage from "./v53/DiagnosticPage";
import SearchSite from "./search/SearchSite";
import ArchitecturePage42 from "./v42/ArchitecturePage";

export default function App() {
  const route = useRoute();
  const [exp, setExp] = useState<Experiment | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    loadExperiment().then(setExp).catch((e) => setErr(String(e)));
  }, []);

  useEffect(() => { window.scrollTo(0, 0); }, [route.page, route.page === "search" ? route.view : "", route.page === "search" ? route.id : ""]);

  // The version on screen: the bundle's for a run, the page's for architecture.
  const shownVersion = route.page === "architecture"
    ? route.version
    : route.page === "case" ? "v53"
    : (route.page === "run" && route.bundle && versionOf(route.bundle)) || exp?.current || "v53";
  const ver = exp?.versions[shownVersion];
  const featured = exp ? exp.versions[exp.current].featured : "";
  return (
    <>
      <div className="lanebar" aria-hidden="true" />
      <div className="shell">
        <header className="mast">
          <a className="brand" href="#/">ISR <span className="ver">Falsification Search</span></a>
          <nav className="nav" aria-label="Main pages">
            {[["overview","Overview",""],["system","Video Agent","system"],["properties","Properties","properties"],["forge","Scenario Forge","forge"],["samplers","Samplers","samplers"]].map(([view,label,path])=><a key={view} href={`#/${path}`} aria-current={route.page === "search" && route.view === view ? "page" : undefined}>{label}</a>)}
          </nav>
        </header>
        <nav className="search-deeper" aria-label="Explore deeper"><span>Explore deeper</span><a href="#/how-it-works">How it works</a><a href="#/traces">Run traces</a><a href="#/previous-studies">Previous studies</a><a href="#/archive/v4.2">Architecture archive</a><a href="#/evidence">Evidence & scope</a></nav>
        {route.page !== "search" && <div className="search-breadcrumb"><a href="#/previous-studies">Previous studies</a> / {ver?.label} · Historical capability study, separate from Round 2 · <a href={runHref(ver?.featured ?? featured)}>Run replay</a> · <a href={archHref(shownVersion)}>Full architecture</a></div>}
        {route.page === "search" && <SearchSite view={route.view} id={route.id}/>}


        {route.page !== "search" && err && <div className="error">{err}</div>}
        {route.page !== "search" && !exp && !err && <div className="loading">loading…</div>}
        {exp && route.page === "run" && (
          <RunPage exp={exp} bundleName={route.bundle} startT={route.t} startStage={route.stage} />
        )}
        {exp && route.page === "case" && <DiagnosticPage exp={exp} bundleName={route.bundle} startStage={route.stage} />}
        {exp && route.page === "architecture" && route.version === "v53" && <ArchitecturePage53 exp={exp} />}
        {exp && route.page === "architecture" && route.version === "v42" && <ArchitecturePage42 exp={exp.versions.v42} />}
      </div>
    </>
  );
}
