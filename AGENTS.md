# AGENTS.md

Public replay site for the video agent study. Current version: **V5.0**
(program-first: detector + tracker, host grouping and a fixed traffic rule, Gemma
colour checks, host-assembled answer; Pi + Nemotron only for investigation cases).
The previous version, **V4.2** (Nemotron agent with six tools), stays on the site.
The site presents results the study already produced; it never produces evidence.
Communicate with the researcher in Traditional Chinese; keep technical terms in
English. Site copy and `README.md` are English. Internal planning documents live in
`docs/plan/` in Traditional Chinese.

## Scope

Two pages, each per version: the **run replay** and **How it works**
(`#/architecture` = V5.0, `#/architecture/v4.2`). The replay picks its view from
the bundle name (`v50-*` stage stepper, `v42-*` run clock). Do not add an
overview/leaderboard page, a live-run page or an "every run on this clip" grid.
Live mode is out of scope until a runner for the current SUT exists.

Earlier sites are git tags: `v42-site` (V4.2 only) and `legacy-isr-agent-site`
(archived ISR agent, 12 runs); do not mix the archived bundle format back in.

## Authorities (all read-only)

| Version | Runs | Figures (`tools/build_experiment.py` `VERSIONS[*]["report"]`) | Architecture |
|---|---|---|---|
| V5.0 | study `runs/20261015-09-eval-6-v5.0-program-first` | `reports/sut-v5.0-six-video-20261015.zh-TW.md` | `video-agent/docs/sut-v5/v5.0.zh-TW.md` at SUT `5ff6b8a`, `config/runtime_v5.json`, `store/vehicles_v5.py` |
| V4.2 | study `runs/20261015-06-eval-6-v4.2-direction-first` | `reports/sut-v4.2-six-video-20261015-resumed.zh-TW.md` | `video-agent/docs/sut-v4/v4.2.zh-TW.md` at SUT `93d0e5b` |

The study is `/workspace/experiments/video-agent-capability`. `--check` fails on any
figure that differs from the report. The site renders the implemented runtime,
not a successful strategy. Plans and decisions: `docs/plan/`.

## Hard rules

1. Never write to `video-agent`, the study repository or `model-serving`: no files,
   no commits, no `__pycache__` (run tools with `python3 -B`; they also set
   `sys.dont_write_bytecode`). Never start models or runs from here.
2. The exporters are allowlists (`tools/export_v50_run.py`, `tools/export_v4_run.py`,
   shared helpers in `tools/export_common.py`). They must not open
   `agent-command.json`, `worker-request.json`, `requests/`, `TRACE*`, `audit.json`,
   review images, segment frames, source videos or `data/`. Service endpoints in
   the configuration event are dropped. Do not relax `tools/publish_guard.py`.
3. Ground truth and scores may appear only on cards labelled as ground truth /
   study scorer / source review, after the run. Published ground truth is limited
   to the six clips already public since 2026-09-14 (researcher decision); their
   video SHA-256 must match the runs (both versions use the same six clips).
4. Keep the Runtime Verifier, Post-hoc Verifier, study scorer and source review
   visually separate. Neither verifier evaluates traffic truth; a verifier pass is
   not correctness. In V5.0 the traffic rule is a separate host component, not
   the Runtime Verifier and not a model judgement.
5. Report honestly. Keep each version's batch line visible:
   - V5.0: 6/6 valid, 6/6 count, 6/6 count + frame-supported colours, 4/6 exact
     colour strings, **0/6 complete**, 0 Nemotron calls, not promoted.
   - V4.2: 6/6 accepted, 1/6 supported, 0/6 complete, not promoted; a002 is the
     best of six.
6. V5.0's investigation branch (Pi + Nemotron, five tools) is drawn only as
   "implemented, not exercised live". Never imply Nemotron reasoned in V5.0.
   The source review is a coding-agent review, not an independent blind one; say so.
7. Detector confidence scores are never presented as something a model saw
   (V5.0 bundles do not carry them). Kalman predictions are drawn only as
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
