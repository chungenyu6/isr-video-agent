# AGENTS.md

This is the ISR line's run viewer, forked from the Wrong-Way Failure Discovery demo
site. The source site at `/home/video-agent-failure-demo` is READ-ONLY.

Scope: ONE page, the run replay. The Overview page, the live page and the
"Every run on this clip" grid were deliberately removed -- do not reintroduce them.

The experiment it reads is `/home/isr-video-agent` (`EXPERIMENT_ROOT`), which has no
preregistered campaign and no signed report. The site therefore publishes runs only,
never aggregate claims.

---

## Inherited notes from the source site

# AGENTS.md

## Purpose

Public replay site and lab-only live demo for the Video-Agent Failure Discovery MVP.
It presents results the experiment already produced; it never produces experiment
evidence. Communicate with the researcher in Traditional Chinese; keep technical
terms in English. Site copy and `README.md` are English. Internal planning documents
live in `docs/plan/` in Traditional Chinese.

## Authorities

- Experiment (read-only): `/home/video-agent-failure-discovery-mvp`. Its
  `docs/report/final-analysis.json` is the source of every number on the site.
- Build plan: `docs/plan/2026-09-14_build-plan.zh-TW.html`.
- Visual and structural predecessor (read-only): `/home/video-code-harness/video-harness-demo`.

## Hard rules

1. Never write to the experiment repository: no files, no commits, no `__pycache__`
   (tools set `sys.dont_write_bytecode`), and never call its `run_pi.sh` or
   `new_run.py`. Verify with `git -C /home/video-agent-failure-discovery-mvp status`.
2. Never modify the Phase 0 demo repository.
3. Publish only formal runs: the 36 discovery and 20 confirmation matrix rows.
   Pilot and pre-freeze runs stay out.
4. The exporter is an allowlist. Nothing from a run directory is published unless
   `tools/export_run.py` names it; `auth.json`, `environment.txt`, workspace git
   objects and source videos never leave the lab machine.
5. A figure may appear on the site only if `tools/build_experiment.py --check`
   reproduces it from the bundles and it equals `final-analysis.json`.
6. Frame 0 is never motion evidence. `frames.jsonl` row index is the video frame.
   Clips share three layouts; never describe them as twelve independent scenes.
7. Live runs are demonstrations: written under `live/runs/`, gitignored, never
   published, labelled as not experiment evidence, and run with the frozen prompt,
   tools, model and decoding whose hashes match the experiment's `freeze.json`.
8. The live server binds `127.0.0.1` by default. It starts agent runs.
9. Report honestly. The confirmation result is negative (0/4); say so.

## Engineering rhythm

Make a bounded change, then run the smallest applicable check:

```bash
python3 tools/validate_bundle.py bundles/*/
python3 tools/build_experiment.py --check
cd app && npm run build
```

Report what changed, what was checked, and what is still unverified.
