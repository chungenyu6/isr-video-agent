# ISR Video Agent

**Live: https://chungenyu6.github.io/isr-video-agent/**

A replay site for a video system that answers a traffic question about a fixed
camera clip:

> How many vehicles, if any, move opposite to the prevailing nearby traffic in the
> same roadway area? List their colours, and state if the total count remains uncertain.

Two versions of the system are on the site, each measured once on the same six clips.

| | V5.0 (current) | V4.2 (previous) |
|---|---|---|
| Design | Program-first. The host tracks every vehicle, joins broken tracks into vehicle records, applies a fixed traffic rule, asks Gemma only for each candidate's colour, and writes the answer. Pi + Nemotron start only for an investigation case. | A Nemotron agent in a sandbox reads track facts as text, picks what Gemma should look at through six tools, and writes the answer. |
| Nemotron calls (six clips) | 0 (no case arose; the branch was not exercised live) | 98 |
| Right count | 6/6 | 3/6 |
| Count and colours supported by the frames | 6/6 | 1/6 |
| Exact colour strings | 4/6 | – |
| Complete answers | **0/6** | **0/6** |
| Promoted | no | no |

The comparison describes two designs; it is not a controlled experiment. In V5.0
every answer keeps `count_complete = false` because some detections were never
assigned to a vehicle record. The six clips are a known regression set, not new scenes.

## The site

- **Run replay.** Pick a version and one of six attempts.
  - V5.0 steps through the host pipeline (Track → Group → Traffic rule → Look →
    Assemble → Verify). You can watch boxes change from tracker IDs to vehicle
    records, see which tracker IDs were joined and why, where ungrouped boxes are,
    the traffic rule as a compass, what Gemma was shown and said, and the answer.
  - V4.2 replays the agent on its own run clock: every tool call, the track facts
    it read, the Gemma crops it asked for.
  - The answer is kept separate from the Runtime Verifier, the Post-hoc Verifier,
    the study's scorer and the source review.
- **How it works.** For each version: components and trust zones, the call
  sequence (the general V5.0 flow; one real V4.2 run), what each stage hands to the next, and illustrated
  explainers (grouping and the traffic rule for V5.0; detector and tracker for V4.2).

## What is running

| Role | Model |
|---|---|
| Detector + tracker | YOLO26s (ultralytics 8.4.176) + ByteTrack, no ReID |
| Vision | `google/gemma-4-26B-A4B-it`, stateless, temperature 0.1 |
| Orchestrator / investigator | `nvidia/NVIDIA-Nemotron-3.5-Lightning-30B-A3B-NVFP4`, thinking off |
| Agent harness | Pi: V4.2 extension with six tools; V5.0 extension with five investigation tools |

All of them are served locally on A40s. The six clips are synthetic traffic scenes,
960×540 at 10 fps and 20 s long.

## Data

The viewer reads static JSON. Nothing touches an experiment directory at runtime.

```bash
B=/workspace/experiments/video-agent-capability/runs
python3 -B tools/export_v50_run.py --batch $B/20261015-09-eval-6-v5.0-program-first
python3 -B tools/export_v4_run.py  --batch $B/20261015-06-eval-6-v4.2-direction-first
python3 -B tools/build_experiment.py           # content/experiment.json, both versions
python3 -B tools/validate_bundle.py bundles/*/
python3 -B tools/build_experiment.py --check   # site figures == each study report's
```

Both exporters are allowlists. The V5.0 exporter reads only:

- the tracking JSON and the gateway ledger (vehicle snapshot, Gemma requests and
  replies, the host's final answer; service endpoints dropped);
- `run.json`, the verdict and score files, and one row of the source review;
- the two images per Gemma call.

They never open agent commands, raw model requests, audit or review files, the
source video or labels. Every bundle passes `tools/publish_guard.py`, which forbids
host paths, loopback URLs, credential-shaped strings and label paths, before it is
written. `tools/validate_bundle.py` re-checks bundles on disk against
`schema/bundle-v50.schema.json` or `schema/bundle-v42.schema.json`.

Two inputs are reused from an earlier site rather than re-exported:

- **Ground-truth files.** `content/oracle/*.json` was exported earlier by
  `tools/export_oracle.py`.
- **Video proxies.** `app/public/video/*.mp4` were made by `tools/make_proxies.sh`.

Both are for the same six clips; their video SHA-256 matches both batches.

## Develop

```bash
cd app
npm install
npm run dev        # http://0.0.0.0:5173  (predev syncs bundles/ and content/ into public/)
npm run build      # tsc -b && vite build -> app/dist
npm run preview    # http://0.0.0.0:4173
```

`BASE_PATH` sets the base href for subdirectory hosting and defaults to `/`; the
Pages workflow sets it to `/<repo name>/`.

Earlier sites are preserved as git tags: `v42-site` (V4.2 only) and
`legacy-isr-agent-site` (the archived ISR agent).
