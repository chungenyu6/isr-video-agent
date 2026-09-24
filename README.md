# ISR Video Agent

**Live: https://chungenyu6.github.io/isr-video-agent/**

A demo of a video agent answering surveillance queries over fixed camera footage.

The query: **which vehicles, if any, are travelling against traffic flow?**

The agent gets a clip and a set of tools, and nothing else. It decides where to
look, pulls frames, sends them to a vision model, and either reports the vehicles
it can back with evidence or abstains. It never sees ground truth.

This site replays one run at a time so you can watch it work:

- the video, with the agent's regions of interest drawn on it
- the windows it chose, against the windows it needed
- the frames it actually sent, and what the vision model said about each one
- its frame budget as it spends it
- its tool calls and full reasoning trace, step by step
- what it finally reported, and how the verifier judged it

Pick a clip and a seed at the top of the page.

## What is running

| Role | Model |
|---|---|
| Orchestrator | `nvidia/NVIDIA-Nemotron-3.5-Lightning-30B-A3B-NVFP4` |
| Perception | `google/gemma-4-26B-A4B-it` (sparse MoE, ~4B active per token) |

The agent now looks in two ways. It **sweeps** a window as video — up to 32 frames
in one call, about one a second over a 35-second clip — and then **inspects**
narrow windows as full-resolution stills. Sweeping is cheap enough to cover the
whole clip; inspecting is precise enough to judge what a sweep raised. Each has
its own frame budget, so covering the video does not compete with looking closely
at part of it.

Both served locally on vLLM, on A40s. The agent harness is Pi; the twelve clips
are fixed synthetic traffic scenes.

## Reading it honestly

These are engineering runs, not a measured study: no preregistration, no signed
report. The site publishes the runs themselves and no aggregate figures, and runs
that failed or timed out are shown as such rather than hidden. Don't read success
rates or model comparisons off it.

## Data

The viewer reads static JSON; nothing touches an experiment directory at runtime.

```bash
export EXPERIMENT_ROOT=/home/isr-video-agent
python3 tools/export_oracle.py                 # content/oracle/<clip_id>.json
python3 tools/export_run.py --run-dir <dir>    # bundles/<name>/bundle.json
python3 tools/build_experiment.py              # content/experiment.json
```

`export_run.py` scrubs host paths to placeholders and refuses outright to write a
bundle still containing a credential-shaped string or an unrefused reference to the
label directory. That guard is load-bearing; do not relax it to publish a run.

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
