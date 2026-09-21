# ISR Video Agent — run viewer

A single-page replay of one agent run: what the agent looked at, what it reported,
and how the verifier judged it. One page, one run, a clip picker and a seed picker.

Forked from the Wrong-Way Failure Discovery demo site and cut down: the Overview
page, the live-run page and the bottom-of-page "Every run on this clip" grid were
removed. What remains is the run replay.

## Data

The viewer reads static JSON. Nothing touches an experiment directory at runtime.

```bash
export EXPERIMENT_ROOT=/home/isr-video-agent        # default
python3 tools/export_oracle.py                      # content/oracle/<clip_id>.json
python3 tools/export_run.py <run-dir>               # bundles/<name>/bundle.json
python3 tools/build_experiment.py                   # content/experiment.json
```

`build_experiment.py` normally cross-checks every figure against the experiment's
`docs/report/final-analysis.json` and refuses to publish a number the experiment did
not produce. The ISR line has no preregistered campaign and no such report, so the
tool publishes the run list alone and says so on stdout. Do not read aggregate claims
off this site.

## Develop

```bash
cd app
npm install
npm run dev        # http://0.0.0.0:5173  (predev syncs bundles/ and content/ into public/)
npm run build      # tsc -b && vite build -> app/dist
npm run preview    # http://0.0.0.0:4173
```

`BASE_PATH` sets the base href for subdirectory hosting; it defaults to `/`.
