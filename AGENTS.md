# AGENTS.md

Public replay site for the video agent study. Current version: **V5.3**
(program-first: detector + tracker, host grouping and a fixed traffic rule, Gemma
colour checks, program-proposed investigation cases for Pi + Nemotron with a
suggested first step and a visible per-case Gemma budget, host-assembled answer).
The previous version, **V4.2** (Nemotron agent with six tools), stays on the site.
V5.0, V5.1 and V5.2 are not on the site (researcher decisions, 2026-10-19); they
are git tags.
The site presents results the study already produced; it never produces evidence.
Communicate with the researcher in Traditional Chinese; keep technical terms in
English. Site copy and `README.md` are English. Internal planning documents live in
`docs/plan/` in Traditional Chinese.

## Scope

The landing page presents Round 2 falsification search over frozen V5.3.
Main pages: Overview, Verifiable Video Agent, Properties, Scenario Forge and Samplers.
Explore deeper links to How it works, Run traces, Previous studies, Architecture
archive and Evidence & scope. V4.2 and the A48/B28 studies remain readable on the
site, labelled with their original scope; old hash routes remain supported.

Authority: docs/plan/2026-11-04_round02-falsification-site.zh-TW.md, explicitly
approved for implementation by the researcher. This replaces the old two-page
scope and no-overview rule. On 2026-11-04 the researcher explicitly approved
publishing the existing Round 2 ground-truth evidence and pushing this static
site to GitHub Pages. Live-demo changes remain out of scope. Controls browse
recordings, never start runs.

Round 2 sources (read-only): experiments/falsification-search/rounds/round-02/
RESULTS.zh-TW.md and the parent/extension campaigns named by tools/export_round02.py.
The separate exporter permits exactly four named source videos, their simulator
target boxes and visual_request media for publication (approved 2026-11-04). Existing exporters keep
their original exclusions. New JSON must pass publish_guard without relaxing it.
Before reading private sources, export_round02.py requires root-owned content/
mode 700, umask 077 and an absolute-path agent boundary check. Keep .git/, app/public/
and app/dist/ mode 700; check absolute paths after every sync/build. Relative
paths are unsafe here because agent_user.sh changes its working directory.

The new summary data has its own schema, source/asset hash manifest and validator.
Do not label these records as A48 or treat their SUT freeze as 476ef72.
Round 2: 288 formal runs (96 per arm), FN 1/2/0 and FP 7/10/7 for Random/CE/
Thompson; 14 smoke runs excluded. No independent confirmation or superiority claim.

Earlier sites are git tags: `v52-site` (V5.2 + V4.2), `v50-site` (V5.0 + V4.2),
`v42-site` (V4.2 only) and
`legacy-isr-agent-site` (archived ISR agent, 12 runs); do not mix earlier bundle
formats back in.

## Authorities (all read-only)

| Version | Runs | Figures (`tools/build_experiment.py` `VERSIONS[*]["report"]`) | Architecture |
|---|---|---|---|
| V5.3 | study `runs/20261019-03-eval-12x2x2-v5.3-stability` (one bundle per clip: pass 1, Q1; the clip's four attempts as `stability`) and `runs/20261019-04-diagnostic-7x4-v5.3-investigation-value` (B2/B4/B7 pi-cap2 attempts; the other three arms as `siblings`) | `reports/sut-v5.3-results-20261019.zh-TW.md` (`DIAGNOSTIC` in `build_experiment.py`) | `video-agent/docs/sut-v5/v5.3.zh-TW.md` at SUT `476ef72`, `config/runtime_v5_3.json`, `inspection/gateway_v5_3.py`, `store/vehicles_v5.py` |
| V4.2 | study `runs/20261015-06-eval-6-v4.2-direction-first` | `reports/sut-v4.2-six-video-20261015-resumed.zh-TW.md` | `video-agent/docs/sut-v4/v4.2.zh-TW.md` at SUT `93d0e5b` |

The study is `/workspace/experiments/video-agent-capability`. `--check` fails on any
figure that differs from the report. The site renders the implemented runtime,
not a successful strategy. Plans and decisions: `docs/plan/`.

## Hard rules

1. Never write to `video-agent`, the study repository or `model-serving`: no files,
   no commits, no `__pycache__` (run tools with `python3 -B`; they also set
   `sys.dont_write_bytecode`). Never start models or runs from here.
2. The exporters are allowlists (`tools/export_v53_run.py`, `tools/export_v4_run.py`,
   shared helpers in `tools/export_common.py`). They must not open
   `agent-command.json`, `worker-request.json`, `requests/`, `TRACE*`, `audit.json`,
   `stability-analysis.json`, review images, source videos or `data/`. Service
   endpoints in the configuration event, packet `sources` and Pi's provider error
   message are dropped. Do not relax `tools/publish_guard.py`.
3. Ground truth and scores may appear only on cards labelled as ground truth /
   Property Evaluator (automatic score; source review), after the run. Site copy
   still says "study scorer" until the study's P2 rename plan updates it. Published ground truth covers the
   twelve Against-Traffic clips: six public since 2026-09-14, six more since
   2026-10-19 (researcher decisions). Their video SHA-256 must match every
   exported run.
4. Keep the Runtime Verifier, Post-hoc Verifier and the two Property Evaluator
   cards (automatic score, source review) visually separate. Names follow
   `/workspace/experiments/video-agent-capability/docs/naming-conventions.zh-TW.md`. Neither verifier evaluates traffic truth; a verifier pass is
   not correctness. In V5.3 the traffic rule is a separate host component, not
   the Runtime Verifier and not a model judgement. Gateway refusals of agent
   calls are Runtime Verifier refusals.
5. Report honestly. Keep each version's batch line visible:
   - V5.3: **44/48 count** (V5.2 48/48), 40/48 colour words (Property Evaluator
     v1), 28/48 exact colour strings, 4 vehicles matching no labelled object,
     count_complete 8 true-and-right / 36 false-but-right / 4 false-and-wrong,
     agent started 4/48 and each time split one car into two, 45 Nemotron / 62
     Gemma, not promoted; and separately the diagnostic: Pi right in **5/6** at cap
     2 and cap 4 (V5.2 1/6), B7 still a wrong "different".
   - V4.2: 6/6 accepted, 1/6 supported, 0/6 complete, not promoted; a002 is the
     best of six.
6. Show both sides of V5.3: the agent improved in controlled cases (5/6) and
   made the main answer worse in the natural case (count 3 for 2). Never present
   one without the other. Diagnostic replays are labelled "controlled, saved
   state, not a natural trigger"; only Pi's cells carry a verdict, none/fixed are
   described. Show Nemotron's text replies verbatim and mark the host's
   continuation prompt as the host speaking; thinking is off, so do not invent
   reasoning. Reviews are coding-agent reviews, not independent blind ones; say so.
7. Detector confidence scores are never presented as something a model saw
   (V5.3 bundles do not carry them). Property Evaluator v2 (the L0-L6 outcome
   vector Y) comes from the study's `evaluations/20261019-02-property-eval-v2/`,
   allowlisted; never export the visible-colour labels behind it. Figures:
   `OUTCOME_VECTOR` in `build_experiment.py` (report
   `property-eval-v2-outcome-vector-20261019.zh-TW.md` §2). GPU memory is the study's sampling; always
   say that vLLM reserves 90% of each GPU, so its nvidia-smi figure is flat. Kalman predictions are drawn only as
   "prediction, not observed".
8. After adding or changing published data, run
   `bash /workspace/video-agent/sandbox/agent_user.sh --check "$PWD/bundles" "$PWD/content" "$PWD/app/public" "$PWD/app/dist"`.
9. No auto-push. Pushing `main` deploys the public site; ask first.

## Engineering rhythm

```bash
python3 -B tools/validate_bundle.py bundles/*/
python3 -B tools/build_experiment.py --check
python3 -B tools/validate_round02.py
cd app && npm run build
```

Then check the site in a browser at desktop and 400 px widths, light and dark.
Report what changed, what was checked, and what is still unverified.

## System presentation terminology

Use Verifiable Video Agent as the presentation name. Explicitly show the
Runtime Verifier as part of the frozen SUT. This is not a proof of traffic
correctness. Inspect Runtime/Post-hoc outcomes separately from oracle-based
properties; do not imply verifier status is a Round 2 sampler reward.
