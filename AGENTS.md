# AGENTS.md

Public replay site for the V4.2 video agent (detector + tracker + Nemotron + Gemma).
It presents results the study already produced; it never produces evidence.
Communicate with the researcher in Traditional Chinese; keep technical terms in
English. Site copy and `README.md` are English. Internal planning documents live in
`docs/plan/` in Traditional Chinese.

## Scope

Two pages: the **run replay** and **How it works** (architecture). Do not add an
overview/leaderboard page, a live-run page or an "every run on this clip" grid.
Live mode is out of scope until a runner for the current SUT exists.

The previous site (archived ISR agent, 12 runs) is preserved at git tag
`legacy-isr-agent-site`; do not mix its bundle format back in.

## Authorities (all read-only)

- Runs: `/workspace/experiments/video-agent-capability/runs/20261015-06-eval-6-v4.2-direction-first`
  (six attempts, one per clip, seed 1).
- Figures: that study's `reports/sut-v4.2-six-video-20261015-resumed.zh-TW.md`.
  `tools/build_experiment.py` holds them as `REPORT` and `--check` fails on any
  difference.
- Architecture: `/workspace/video-agent/docs/sut-v4/v4.2.zh-TW.md` at SUT
  `93d0e5b`, `config/runtime_v42.json`, `model-serving/vision/server.py`.
  The site renders the implemented runtime, not a successful strategy.
- Plan and decisions: `docs/plan/2026-10-15_v4.2-site.zh-TW.md`.

## Hard rules

1. Never write to `video-agent`, the study repository or `model-serving`: no files,
   no commits, no `__pycache__` (run tools with `python3 -B`; they also set
   `sys.dont_write_bytecode`). Never start models or runs from here.
2. The exporter is an allowlist (`tools/export_v4_run.py`). It must not open
   `agent-command.json`, `worker-request.json`, `requests/`, `TRACE*`,
   review images, source videos or `data/`. Do not relax `tools/publish_guard.py`.
3. Ground truth and scores may appear only on cards labelled as ground truth /
   study scorer, after the run. Published ground truth is limited to the six
   clips already public since 2026-09-14 (researcher decision); their video
   SHA-256 must match the runs.
4. Keep the Runtime Verifier, Post-hoc Verifier and study scorer visually separate.
   Neither verifier evaluates traffic truth; a verifier pass is not correctness.
5. Report honestly: show all six attempts, label a002 as the best of six, and keep
   the batch line (6/6 accepted, 1/6 supported, 0/6 complete, not promoted) visible.
6. Detector confidence scores are never presented as something the agent saw.
   Kalman predictions are drawn only as "prediction, not observed".
7. After adding or changing published data, run
   `bash /workspace/video-agent/sandbox/agent_user.sh --check bundles content app/public`.
8. No auto-push. Pushing `main` deploys the public site; ask first.

## Engineering rhythm

```bash
python3 -B tools/validate_bundle.py bundles/*/
python3 -B tools/build_experiment.py --check
cd app && npm run build
```

Then check the site in a browser at desktop and 400 px widths, light and dark.
Report what changed, what was checked, and what is still unverified.
