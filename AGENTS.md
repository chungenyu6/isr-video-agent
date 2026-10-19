# AGENTS.md

Public replay site for the video agent study. Current version: **V5.2**
(program-first: detector + tracker, host grouping and a fixed traffic rule, Gemma
colour checks, program-proposed investigation cases for Pi + Nemotron, host-assembled
answer). The previous version, **V4.2** (Nemotron agent with six tools), stays on
the site. V5.0 and V5.1 are not on the site: V5.2 keeps V5.0's main pipeline and
covers V5.1's question with a natural case (researcher decision, 2026-10-19).
The site presents results the study already produced; it never produces evidence.
Communicate with the researcher in Traditional Chinese; keep technical terms in
English. Site copy and `README.md` are English. Internal planning documents live in
`docs/plan/` in Traditional Chinese.

## Scope

Two pages per version, the **run replay** and **How it works** (`#/architecture`
= V5.2, `#/architecture/v4.2`), plus the V5.2 **diagnostic case replay**
(`#/case/v52-diag-B<n>-pi`, three scenarios; researcher decision 2026-10-19). The
replay picks its view from the bundle name (`v52-*` stage stepper, `v42-*` run
clock); `v50-*` links land on the V5.2 run of the same clip. The 7×3 diagnostic
matrix is a table on How it works, not a grid of replays. Do not add an
overview/leaderboard page, a live-run page or an "every run on this clip" grid.
Live mode is out of scope until a runner for the current SUT exists.

Earlier sites are git tags: `v50-site` (V5.0 + V4.2), `v42-site` (V4.2 only) and
`legacy-isr-agent-site` (archived ISR agent, 12 runs); do not mix earlier bundle
formats back in.

## Authorities (all read-only)

| Version | Runs | Figures (`tools/build_experiment.py` `VERSIONS[*]["report"]`) | Architecture |
|---|---|---|---|
| V5.2 | study `runs/20261016-06-eval-12x2x2-v5.2-stability` (one bundle per clip: pass 1, Q1; the clip's four attempts as `stability`) and `runs/20261016-07-diagnostic-7x3-v5.2-investigation-value` (B2/B4/B7 Pi attempts; none/fixed as `siblings`) | `reports/sut-v5.2-stability-20261016.zh-TW.md`, `sut-v5.2-investigation-value-20261016.zh-TW.md`, `sut-v5.2-summary-20261016.zh-TW.md` (`DIAGNOSTIC` in `build_experiment.py`) | `video-agent/docs/sut-v5/v5.2.zh-TW.md` at SUT `d55f235`, `config/runtime_v52.json`, `inspection/v52.py`, `store/vehicles_v5.py` |
| V4.2 | study `runs/20261015-06-eval-6-v4.2-direction-first` | `reports/sut-v4.2-six-video-20261015-resumed.zh-TW.md` | `video-agent/docs/sut-v4/v4.2.zh-TW.md` at SUT `93d0e5b` |

The study is `/workspace/experiments/video-agent-capability`. `--check` fails on any
figure that differs from the report. The site renders the implemented runtime,
not a successful strategy. Plans and decisions: `docs/plan/`.

## Hard rules

1. Never write to `video-agent`, the study repository or `model-serving`: no files,
   no commits, no `__pycache__` (run tools with `python3 -B`; they also set
   `sys.dont_write_bytecode`). Never start models or runs from here.
2. The exporters are allowlists (`tools/export_v52_run.py`, `tools/export_v4_run.py`,
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
   not correctness. In V5.2 the traffic rule is a separate host component, not
   the Runtime Verifier and not a model judgement. Gateway refusals of agent
   calls are Runtime Verifier refusals.
5. Report honestly. Keep each version's batch line visible:
   - V5.2: 48/48 count, 48/48 frame-supported colours (8 white-only, purple
     omitted), 28/48 exact colour strings, **8/48 count_complete**, agent started
     4/48 and every case unresolved, 68 Nemotron / 56 Gemma, not promoted; and
     separately the diagnostic: Pi right in **1/6** cases, one wrong "different",
     no gain over the fixed check.
   - V4.2: 6/6 accepted, 1/6 supported, 0/6 complete, not promoted; a002 is the
     best of six.
6. Never imply the agent improved an answer: in the natural case it changed
   nothing, and in the diagnostic it was right once. Diagnostic replays are
   labelled "controlled, saved state, not a natural trigger"; only Pi's cells
   carry a verdict, none/fixed are described. Nemotron wrote no free text
   (thinking off); do not invent reasoning. Reviews are coding-agent reviews, not
   independent blind ones; say so.
7. Detector confidence scores are never presented as something a model saw
   (V5.2 bundles do not carry them). Kalman predictions are drawn only as
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
