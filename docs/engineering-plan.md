# Engineering Plan

## Constraints

- Total initial build budget: 4-8 hours.
- Local-first.
- File-based storage.
- Manual collection in MVP.
- Local Codex provider is preferred for eval generation.
- GPT API key provider is optional but supported if feasible.
- Portfolio proof matters more than platform completeness.

## Suggested Stack

Use a lightweight TypeScript web app:

- Vite + React for the frontend.
- Node/Express or a tiny local API server for backend routes.
- Local JSON files for persistence.
- Child process wrapper for `codex exec`.

This keeps the app easy to run locally and easy to extend.

## Repository Layout

```text
.
├── docs/
│   ├── product-spec.md
│   ├── engineering-plan.md
│   ├── mvp-sprint.md
│   └── data-model.md
│   └── portfolio/
├── eval_sets/
│   ├── drafts/
│   └── approved/
├── runs/
├── reports/
├── schemas/
│   └── eval-case.schema.json
├── examples/
│   ├── sample-arena.json
│   ├── sample-eval-set.json
│   └── sample-report.md
├── src/
│   ├── components/
│   ├── lib/
│   ├── providers/
│   └── server/
└── PROJECT_BRIEF.md
```

`examples/` is optional during early coding, but the final portfolio package should include at least one sample arena/eval/report.

## Backend Responsibilities

The local backend should expose a small API:

- `POST /api/arenas`: create or update current arena.
- `POST /api/eval-generation/local-codex`: generate draft eval cases.
- `POST /api/eval-generation/gpt`: generate draft eval cases through API key.
- `GET /api/eval-sets/current`: load current eval set.
- `POST /api/eval-sets/current`: save edits and approvals.
- `POST /api/runs/current`: save collected outputs.
- `GET /api/report/current`: generate report preview.
- `POST /api/report/download`: write report artifact.

Avoid building a generalized backend framework. Keep routes thin and file-backed.

## Optional Portfolio Reference

The LiveCue PGC Skill Agent is a separate completed portfolio project. It is not native context for SBS evaluation, and its PGC rubric/categories should not influence this project's grader design.

It may be referenced only for engineering patterns:

- schema-validate generated artifacts before they enter the UI;
- isolate provider-specific parsing behind a shared interface;
- preserve raw provider responses and normalized artifacts when feasible;
- test negative cases and malformed provider outputs, not only happy paths.

## Local Codex Provider

Use the Codex CLI:

```bash
/Applications/Codex.app/Contents/Resources/codex exec \
  --ephemeral \
  --output-schema schemas/eval-case.schema.json \
  -C /path/to/repo \
  "Generate eval cases..."
```

Provider behavior:

- Build a deterministic prompt from arena settings.
- Optionally include whitelisted project context.
- Require JSON output matching schema.
- Parse and save generated cases as drafts.
- Preserve raw provider output when feasible.
- If Codex fails, surface the error and allow manual retry.

Whitelisted context for this repo:

- `PROJECT_BRIEF.md`
- `AGENTS.md`
- `docs/`
- `eval_sets/`

Provider prompt should explicitly ask for PM-grade eval cases:

- task-space-specific, not generic chatbot questions;
- single-turn and scripted multi-turn when appropriate;
- expected outcome, must-do, must-not-do, failure modes, and draft rubric suggestions;
- no final "ground truth" claim without human approval.

For general users, context is optional and should gracefully no-op when files are missing.

## GPT API Provider

Use only after Local Codex provider works.

Requirements:

- User enters API key locally.
- API key should not be written to committed files.
- Provider uses the same JSON schema as Local Codex.

## Frontend State Model

Keep state simple:

- One active arena.
- One active eval set.
- One active run.
- No historical run management.

Use local files as source of truth. Frontend can hold unsaved edits but must make save state obvious.

## Report Generation

MVP report can be generated from templates.

Minimum sections:

- Arena summary.
- Eval set summary.
- Approved cases.
- Collection status.
- Side-by-side outputs.
- Evidence levels.
- Manual review notes.
- Failure mode observations.
- Product implications / next recommended iteration.
- Grader placeholder section.
- Open evaluation questions.

The sample report is a portfolio artifact. It should be readable by an interviewer without running the app.

## Risks

- Codex CLI output may not perfectly match schema.
  - Mitigation: validate, show parse errors, allow retry.
- Codex may generate weak or generic eval cases.
  - Mitigation: include generation reject rules and keep human approval as a hard gate.
- UI scope creep.
  - Mitigation: only build Setup, Eval Builder, Collect, Review, Report.
- Evaluation methodology is not finalized.
  - Mitigation: keep grader fields as placeholders and preserve data for later grading.
- File storage can become messy.
  - Mitigation: one active run and clear folder naming.
- MVP works technically but fails as portfolio proof.
  - Mitigation: ship a sample report, README story, and demo script as first-class deliverables.

## Done Definition

The MVP is done when:

- App starts locally.
- User can generate draft cases.
- User can approve/edit cases.
- User can manually collect both sides' outputs.
- User can review SBS.
- User can download a report.
- Repository includes a sample report or demo data suitable for portfolio review.
