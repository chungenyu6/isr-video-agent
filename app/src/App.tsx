import { useEffect, useState } from "react";
import type { Experiment, Featured } from "./types";
import { loadExperiment, loadFeatured } from "./data";
import { useRoute } from "./router";
import RunPage from "./pages/RunPage";

export default function App() {
  const route = useRoute();
  const [exp, setExp] = useState<Experiment | null>(null);
  const [featured, setFeatured] = useState<Featured[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadExperiment(), loadFeatured()])
      .then(([e, f]) => { setExp(e); setFeatured(f); })
      .catch((e) => setErr(String(e)));
  }, []);

  const firstRun = featured[0]?.bundle ?? exp?.runs[0]?.bundle ?? "";

  return (
    <>
      <div className="lanebar" aria-hidden="true" />
      <div className="shell">
        <header className="mast">
          <a className="brand" href="#/">ISR Video Agent &middot; Runs</a>
        </header>

        {err && <div className="error">{err}</div>}
        {!exp && !err && <div className="loading">loading experiment&hellip;</div>}
        {exp && <RunPage exp={exp} featured={featured} bundleName={route.bundle || firstRun} />}
      </div>
    </>
  );
}
