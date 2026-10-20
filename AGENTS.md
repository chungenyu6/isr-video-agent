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

Two pages per version, the **run replay** and **How it works** (`#/architecture`
= V5.3, `#/architecture/v4.2`), plus the V5.3 **diagnostic case replay**
(`#/case/v53-diag-B<n>-pi-cap2`, three scenarios; researcher decision 2026-10-19).
The replay picks its view from the bundle name (`v53-*` stage stepper, `v42-*` run
clock); `v50-*` and `v52-*` links land on the V5.3 run of the same clip. The 7×4 diagnostic
matrix is a table on How it works, not a grid of replays. Do not add an
overview/leaderboard page, a live-run page or an "every run on this clip" grid.
Live mode is out of scope until a runner for the current SUT exists.

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
   `bash /workspace/video-agent/sandbox/agent_user.sh --check bundles content app/public`.
9. No auto-push. Pushing `main` deploys the public site; ask first.

## Engineering rhythm

```bash
python3 -B tools/validate_bundle.py bundles/*/
python3 -B tools/build_experiment.py --check
cd app && npm run build
```

Then check the site in a browser at desktop and 400 px widths, light and dark.
Report what changed, what was checked, and what is still unverified.
