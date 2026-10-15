# ISR Video Agent

**Live: https://chungenyu6.github.io/isr-video-agent/**

A replay site for the V4.2 video agent: a language model that answers a traffic
question about a fixed camera clip without ever touching the video itself.

The question: **how many vehicles move against the traffic around them, and what
colour are they?**

The agent (Nemotron, in a sandbox) sees only text. A trusted host owns the clip.
The host runs an object detector and a tracker, measures how each track moves,
gives the agent the result as text, and on request crops one track for a vision
model. The agent compares tracks, decides what to inspect, and answers.

The site has two pages:

- **Run replay.** Pick one of six attempts. You can watch:
  - the YOLO26s + ByteTrack boxes, track trails and movement arrows drawn on the clip;
  - a per-track timeline;
  - the track facts the agent was given;
  - the exact images Gemma was shown and what it said;
  - every tool call;
  - the answer, kept separate from the Runtime Verifier, the Post-hoc Verifier and the study's scorer.
- **How it works.** Covers:
  - the components and their trust zones;
  - the real call sequence of one run, step by step;
  - what each stage hands to the next;
  - the detector and the tracker explained in four pictures.

## What is running

| Role | Model |
|---|---|
| Orchestrator | `nvidia/NVIDIA-Nemotron-3.5-Lightning-30B-A3B-NVFP4`, thinking off |
| Vision | `google/gemma-4-26B-A4B-it`, stateless, temperature 0.1 |
| Detector + tracker | YOLO26s (ultralytics 8.4.176) + ByteTrack, no ReID |
| Agent harness | Pi with the V4.2 extension: six typed tools |

All of them are served locally on A40s. The six clips are synthetic traffic scenes,
960×540 at 10 fps and 20 s long.

## Reading it honestly

These are the six attempts of one bounded measurement, each run once. The six
answers break down as follows:

| Outcome | Attempts |
|---|---|
| Accepted by the host | 6/6 |
| Right count | 3/6 |
| Count and colours supported by the frames | 1/6 |
| Complete | 0/6 |

V4.2 was not promoted. The featured attempt, a002, is the best of the six, not a
typical one, and the site says so. A Post-hoc Verifier pass means the record is
intact, not that the answer is right. Ground truth and scores are shown only on
cards labelled as such; the agent never saw them.

## Data

The viewer reads static JSON. Nothing touches an experiment directory at runtime.

```bash
python3 -B tools/export_v4_run.py --batch <study>/runs/20261015-06-eval-6-v4.2-direction-first
python3 -B tools/build_experiment.py           # content/experiment.json
python3 -B tools/validate_bundle.py bundles/*/
python3 -B tools/build_experiment.py --check   # site figures == the study report's
```

`export_v4_run.py` is an allowlist. It reads only:

- the tracking JSON, the motion index, the gateway ledger and Pi message timestamps;
- the verdict and score files;
- the two images per Gemma call.

It never opens agent commands, raw model requests, review files, the source video or
labels. Every bundle passes `tools/publish_guard.py`, which forbids host paths,
loopback URLs, credential-shaped strings and label paths, before it is written.

Two inputs are reused from the previous site rather than re-exported:

- **Ground-truth files.** `content/oracle/*.json` was exported earlier by
  `tools/export_oracle.py`.
- **Video proxies.** `app/public/video/*.mp4` were made by `tools/make_proxies.sh`.

Both are for the same six clips; their video SHA-256 matches the V4.2 runs.

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

The previous site (the archived ISR agent) is preserved at the git tag
`legacy-isr-agent-site`.
