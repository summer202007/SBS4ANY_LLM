# Package Generation And Import Sprint

Date: 2026-06-11

## Goal

Connect evaluation task setup to Package creation.

The user should be able to create an arena task, open the Package page, and either:

1. call local Codex with the `chatbot-eval-set-generator` skill to generate a structured RuntimeEvalPackage; or
2. download a local spreadsheet-style template, fill eval cases manually, upload it, and let SBS convert it into the same RuntimeEvalPackage flow.

Both paths must land in the same Package Overview, Cases, Collect, Review, and Report workflow.

## Product Principles

- Generated packages are drafts, not final evaluation truth.
- Local Codex usage must be explicit: the UI should say that local Codex and the SBS eval-set-generator skill are required, and that generation may take 1-3 minutes.
- Failure must be recoverable: show the error, preserve artifacts when available, and allow retry.
- 15 cases is the default MVP size. More than that makes semi-manual collection too costly.
- Manual import exists because users may already have a task bank or may want to avoid model generation.
- Manual import should not force one overloaded CSV. Different case types need different fields, so the template should be multi-sheet / multi-section.

## Storage Standard

Move toward task-scoped package storage:

- `data/tasks/<taskId>/package/current.json`
- `data/tasks/<taskId>/package/current.validation.json`
- `data/tasks/<taskId>/package/artifacts/*`
- `data/tasks/<taskId>/curation/current.json`
- `data/tasks/<taskId>/runs/current.json`
- `data/tasks/<taskId>/reports/current.md`

Global `data/packages/current.json`, `data/curation/current.json`, and `data/runs/current.json` can remain as compatibility caches for existing code, but new package generation/import should write task-scoped first and mirror to global only for legacy readers.

Red line: creating or selecting a task must never delete another task's package, curation, run, report, or adapter artifacts.

## Phase 1: Task-Scoped Storage

Tasks:

- Add helper functions for active task workspace paths.
- Update current-state reads to prefer task-scoped files.
- Update package writes to save task-scoped files and mirror to global compatibility paths.
- Add non-destructive migration/read fallback from current global files.

Acceptance:

- Existing restaurant package still loads.
- Creating a new task does not hide or delete another task's files.
- New package generation/import persists under the active task.

## Phase 2: Local Codex Package Generation

Tasks:

- Add `server/packageGenerator.mjs`.
- Build normalized generator intake from active task:
  - challenger/baseline/product surfaces;
  - task space;
  - concrete scenario;
  - target audience;
  - winning criteria;
  - capabilities;
  - risk areas;
  - native-context policy;
  - generator focus flags;
  - case count target.
- Invoke local Codex:
  - `codex exec --cd <repo> --sandbox workspace-write`;
  - instruct it to use `chatbot-eval-set-generator`;
  - require strict JSON package output;
  - preserve stdout/stderr/last-message artifacts.
- Validate with `validate_eval_package.mjs --mode local`.
- Save package, validation, curation draft statuses, and run shell.

Acceptance:

- `POST /api/package/generate` returns Package Overview state.
- Failures are visible and retryable.
- Generated package has 15 cases by default.

## Phase 3: Package Page UI

Tasks:

- Replace empty state with a task-aware Package Builder panel.
- Show local Codex requirement and expected wait time.
- Add controls:
  - Generate Eval Package;
  - case count preset: 12 / 15 / 20, default 15;
  - Download Manual Template;
  - Upload Filled Template.
- Show loading state during generation/import.
- On success, render Package Overview automatically.
- On failure, show a compact error and a retry path.

Acceptance:

- New task opens Package page with clear next actions.
- User understands local Codex dependency before clicking generate.
- Success goes directly to package overview.

## Phase 4: Manual Template Download / Upload

Template approach:

- Use an Excel-compatible XML workbook with multiple worksheets. This keeps the MVP dependency-free while supporting separate tabs/sections for case types.
- Worksheets:
  - `single_turn`
  - `scripted_multi_turn`
  - `adaptive_multi_turn`
  - `capability_probe`
  - `boundary_risk`
  - `regression_like`
  - `README`
- Each sheet includes common columns plus type-specific guidance columns.

Parser approach:

- Parse only the SBS-generated XML workbook format in MVP.
- Later: support real `.xlsx` via a library or a Python helper if needed.

Acceptance:

- User can download template.
- User can upload a filled SBS XML workbook.
- Backend converts filled rows into a RuntimeEvalPackage skeleton and validates/saves it.

## Phase 5: Verification

Checks:

- `node --check` for modified server modules.
- Browser smoke:
  - new task empty Package page;
  - generate button loading state;
  - template download link exists;
  - upload parser rejects empty/bad file with useful error.
- Data check:
  - active task has scoped package files after generation/import;
  - existing restaurant package remains recoverable.

## Deferred

- Persisted generation jobs across server restarts.
- Rich generation trace viewer beyond the compact progress monitor.
- True `.xlsx` binary parser.
- API-key provider generation.
- Regenerate rejected cases from the Package/Cases page.

## 2026-06-12 Update: Background Generation Progress

Implemented a first version of task-aware background package generation:

- `POST /api/package/generate-job` starts local Codex package generation as a background job.
- `GET /api/package/generation-job?jobId=...` returns current status, phase, recent compact logs, and current app state.
- Package page now shows a small local Codex monitor while generation is running.
- The monitor intentionally shows curated progress lines instead of raw Codex stderr/stdout, because raw output includes unrelated skill-loader warnings and huge prompt echoes.
- On local Codex failure, the job installs a fallback draft package and marks the result as `fallback` so the user can review/retry rather than losing the task.
- Package install now writes to the task that started the generation job, not whatever task is active when the job finishes.

Remaining follow-up:

- Persist job status/logs to disk so progress survives server restart.
- Add a richer artifact viewer for full local Codex stdout/stderr/last-message when debugging is needed.

## 2026-06-12 Update: Validator Repair And Timeout

Follow-up after the first successful local Codex generation for the `装修规划` task:

- Local Codex generated a real 15-case package, but validation initially failed on consistency-only issues.
- Timeout was increased from 10 minutes to 20 minutes because the full 15-case structured package took about 9m35s and was too close to the old timeout.
- Generation prompt now includes explicit validator reminders for:
  - required multi-turn `preSendValidation` checks, including `no_unapproved_exposure`;
  - exact alignment between `rubric.appliesToCaseTypes` and the case types represented by `rubric.caseRefs`;
  - advisory-only human sampling language;
  - scored dimension weight normalization.
- Added deterministic post-generation contract repair:
  - fills missing required `preSendValidation` checks;
  - aligns rubric `appliesToCaseTypes` to actual `caseRefs`;
  - softens over-strong human sampling language.
- The repair writes `contract-repair.json` as a trace artifact and annotates `generationTrace.postGenerationRepairs`.

Validation:

- Running the repair on the real `装修规划` generated package changed validation from `ok: false` to `ok: true` without changing eval case intent or model-facing prompts.
