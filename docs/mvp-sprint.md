# MVP Sprint

## Sprint Goal

Build a lightweight local SBS evaluation workbench that proves the core loop:

`task space -> generated eval draft -> human approval -> manual SBS collection -> report download`

Implementation approach: fixture-first. The first working UI should load the existing restaurant recommendation runtime eval package and prove package review, case curation, collection, SBS review, and report export before wiring live generation.

## Time Budget

Target: 4-8 hours.

## Work Plan

### 1. Scaffold App

Timebox: 45-60 minutes.

Tasks:

- Create Vite/React app.
- Add local backend route layer.
- Add basic navigation: Setup, Eval Builder, Collect, Review, Report.
- Add file folders for `eval_sets/`, `runs/`, `reports/`, `schemas/`.

Acceptance:

- App runs locally.
- Navigation works.

### 2. Runtime Package Model And File Storage

Timebox: 45-60 minutes.

Tasks:

- Define TypeScript types around `RuntimeEvalPackage`, not the old case-only model.
- Add package validation using `schemas/runtime-eval-package.schema.json` and `skills/chatbot-eval-set-generator/scripts/validate_eval_package.mjs --mode local`.
- Implement read/write helpers.
- Load the restaurant regression fixture as the first package source.
- Create one active package/run file convention.

Acceptance:

- App can load and validate the restaurant fixture.
- Active package and run state can be saved and reloaded.

### 3. Package Overview

Timebox: 60-90 minutes.

Tasks:

- Render Arena Spec.
- Render Coverage Plan, dimension states, and task fit module.
- Render self-critique quality gates, including `coverageRepresentativeness`.
- Render confirmation backlog and known limitations.
- Render trace artifact refs.

Acceptance:

- User can understand what the package is evaluating and why it is caveated.
- Validation status is visible.

### 4. Eval Builder

Timebox: 60-90 minutes.

Tasks:

- Render draft cases.
- Support edit.
- Support approve/reject.
- Support single-turn and multi-turn display.
- Show evaluator-only fields separately from model-facing prompts.
- Show turn-script contract summary for multi-turn cases without exposing unnecessary complexity.

Acceptance:

- Approved cases are saved and appear in Collect view.

### 5. Manual Collection

Timebox: 60-90 minutes.

Tasks:

- Show case and turn progress: `Case X / Turn Y of Z`.
- Copy prompt button.
- Textareas for Doubao and challenger outputs.
- Textareas for visible process notes.
- Evidence level selector.
- Save per-turn outputs.
- Mark multi-turn execution as `manual_driver`; do not imply guarded simulator automation.

Acceptance:

- User can collect and save both sides for approved cases.

### 6. Review And Report

Timebox: 60-90 minutes.

Tasks:

- Side-by-side case/turn review.
- Generate Markdown report.
- Add download button.
- Include grader placeholder section.
- Include manual winner/rationale and failure observations.
- Include product implication / next-step section.

Acceptance:

- Report downloads locally and contains collected data.
- Report is readable as a portfolio artifact.

### 7. Portfolio Packaging

Timebox: 45-60 minutes.

Tasks:

- Add sample demo data or a sample report.
- Draft README with product thesis, local setup, demo flow, and roadmap.
- Add one resume/interview bullet draft.

Acceptance:

- A reviewer can understand why the project matters without reading the full planning docs.

## Post-Fixture Integration

After package consumption, curation, collection, and report export work:

- Implement Local Codex provider wrapper.
- Build generation prompt from arena settings.
- Save provider artifacts and validation output.
- Load generated package into the same Package Overview / Eval Builder flow.
- GPT API provider remains stretch.

## Explicitly Deferred

- Automated Doubao runner.
- Automated challenger runner.
- Historical run management.
- Rich dashboards.
- Full grader.
- Official task-space library.
- Coding-agent arena.

## Minimum Test Plan

Tests should cover rules and failure paths:

- generated cases match `schemas/eval-case.schema.json`;
- weak or malformed provider output is rejected with a visible error;
- approved cases cannot include missing turns;
- multi-turn cases preserve `turnIndex` and `totalTurns`;
- report output includes arena metadata, evidence levels, and collected outputs;
- provider parsing can handle plain JSON and fenced JSON when needed.

## Demo Script

1. Open local app.
2. Load restaurant recommendation package fixture.
3. Review Arena, Coverage, Self-Critique, and confirmation backlog.
4. Approve three cases.
5. Paste sample Doubao/challenger outputs.
6. Review side by side.
7. Add manual winner/rationale and failure observations.
8. Download report.
9. Use the report to explain product implications.

## Sprint Review Questions

- Did eval generation feel like the strongest part of the product?
- Was manual collection low-friction enough?
- Did the report look portfolio-worthy?
- What should be improved before grader design?
- Does the README make the user's Agent PM positioning legible?

## Current Status Snapshot - 2026-06-11 End Of Day

The product has moved beyond the original fixture-only shell. The strongest working slice is now:

`existing restaurant package -> approve cases -> collect Doubao/Diandian outputs with assisted capture -> multi-turn local simulator -> collection quality audit`

### Working Now

- Local macOS app shell around the web app.
- Local Node server and file storage.
- Evaluation task list and `New Evaluation` arena setup modal.
- Task fields for challenger, baseline, task space, scenario, target audience, risk areas, native-context policy, and generator hints.
- Package Overview for an already-loaded runtime eval package.
- Restaurant package fixture restored and usable with 15 approved cases.
- Case curation:
  - inspect case details;
  - approve/reject;
  - edit selected model-facing/evaluator-facing fields.
- Collect workflow:
  - single-turn and multi-turn cases;
  - shared user message per turn;
  - required/optional collection fields;
  - evidence level;
  - manual paste fallback.
- Doubao read-only current Chrome capture:
  - final answer;
  - query expansion;
  - citation/reference materials;
  - risk notice when visible;
  - follow-up suggestions when visible;
  - source/tool/capture notes.
- Challenger website capture:
  - dots.ai / Diandian adapter;
  - first-time setup flow using local Codex adapter-builder skill;
  - adapter registry;
  - task-level challenger capture-template binding after accepted capture.
- Runtime user simulator:
  - local Codex call;
  - side-blind state packet;
  - writes next shared user message;
  - now redacts fixed-sequence wording so Local Model Reply is not just script playback.
- Basic report markdown generation/download endpoint.
- Collection quality audit was manually produced for 5 collected restaurant cases and recorded in Feishu.
- Data-loss guard:
  - `New Evaluation` no longer physically deletes current package/curation/run files;
  - mismatched task workspace data is hidden at read time instead of deleted.
- Package creation entry:
  - Package empty state now offers Local Codex generation;
  - default case count is 15 with 12 / 15 / 20 presets;
  - manual template download/upload is available through an Excel-compatible XML workbook;
  - generated/imported packages install into the normal Package Overview -> Cases -> Collect flow.
- Task-scoped storage foundation:
  - new package writes prefer `data/tasks/<taskId>/...`;
  - global current files remain as compatibility mirrors.

### Not Yet Working / Known Gaps

- `New Evaluation -> generate N cases` is wired but needs real-product QA.
  - `POST /api/package/generate` exists.
  - Package page has a Generate Eval Package control.
  - Local Codex generation is synchronous and may need a background job/polling flow if it feels blocked.
  - The generated package still must be reviewed by a human before collection.
- Generic package import is partially wired.
  - The supported MVP format is the SBS-generated Excel-compatible XML template.
  - Arbitrary `.xlsx`, CSV, or external eval package import is not yet supported.
- `Generate More Cases` is a UI placeholder.
- Review page is not implemented as a real SBS review workbench.
- Grader is not implemented.
- Final report is a basic markdown export, not dimension-scored analysis.
- Storage is in transition.
  - New package installs write task-scoped files and mirror to global current files.
  - Some older code paths still rely on global compatibility paths.
  - Need a cleanup pass after Review/Grader are stable.
- Website adapter builder is not yet truly generic executable automation for arbitrary websites.
  - It can draft/QA templates and dots.ai is implemented.
  - Future arbitrary sites still need a safe adapter runner or provider-specific implementation.
- Collection quality gate is not productized.
  - Need per-case/side/turn quality summary before Review/Grader.

## Next Sprint - Recommended Order

### 1. Stabilize Task-Scoped Workspace Storage

Goal: prevent another package/run disappearance and support multiple evaluation tasks safely.

Status: partially implemented.

Tasks:

- Add task-owned paths, for example:
  - `data/tasks/<taskId>/package.json`
  - `data/tasks/<taskId>/curation.json`
  - `data/tasks/<taskId>/run.json`
  - `data/tasks/<taskId>/report.md`
- On task open, load that task's files instead of relying on global `current.*`.
- Keep global current files only as compatibility cache or remove them after migration.
- Add a non-destructive migration for the current restaurant task.

Acceptance:

- Creating a new task never affects an existing task's package/run.
- Switching tasks restores the correct package/curation/run.
- No code path physically deletes another task's current artifacts.

### 2. Implement Eval Package Generation Entry

Goal: make `New Evaluation -> generate case set` real.

Status: implemented for Local Codex generation and SBS XML template import; needs real generation QA.

Tasks:

- Add Package page empty-state controls:
  - `Generate Eval Set`;
  - case count preset, initially MVP 12-20 only;
  - options for multi-turn, boundary risk, evidence/recency stress.
- Add backend endpoint:
  - `POST /api/package/generate`.
- Build generator input from active task.
- Invoke local Codex with `chatbot-eval-set-generator` skill.
- Save:
  - package JSON;
  - generation artifacts;
  - validation output;
  - curation draft statuses.
- Show loading, success, validation errors, and generation trace references.

Acceptance:

- A newly created task can produce a runtime eval package without manually loading the restaurant fixture.
- Generated case count matches user-selected target/preset.
- Cases appear in Cases view for approval.

### 3. Build Review Page MVP

Goal: make Review a real grader-prep workspace.

MVP content:

- Case list with:
  - case type;
  - collection status;
  - both sides collected or missing;
  - evidence level;
  - quality/caveat indicator.
- Case detail:
  - side-by-side Doubao vs Challenger final output;
  - turn-by-turn view for multi-turn;
  - collapsed evidence sections for query, sources, follow-up suggestions, visible process, risk notices, tool/capture notes.
- Human review fields:
  - reviewer notes;
  - `Ready for grading` / `Needs collection fix`;
  - optional rough preference.

Acceptance:

- The user can inspect all 15 collected restaurant cases without returning to Collect.
- The page makes missing/unsupported evidence obvious before grading.

### 4. Productize Collection Quality Gate

Goal: prevent bad or asymmetric collection fields from silently feeding graders.

Tasks:

- Compute per side/turn:
  - required final output present;
  - evidence level;
  - source/citation presence and type;
  - unsupported fields;
  - capture notes;
  - risk-case red-line evidence readiness.
- Show the summary in Review.
- Include gate results in report metadata.

Acceptance:

- Review page distinguishes missing data, unsupported fields, and valid product differences.
- Diandian missing query expansion is not treated as automatic model failure.

### 5. Grader / Report Design And Implementation

Goal: move from collection/review to decision-grade SBS output.

Tasks:

- Define scored dimensions for chatbot restaurant task:
  - intent understanding;
  - outcome quality;
  - evidence grounding;
  - risk handling;
  - trajectory control for multi-turn.
- Add red-line caps for boundary risk cases.
- Build first LLM/human-assisted grader interface.
- Generate report with:
  - per-case winner/preference;
  - dimension summaries;
  - uncertainty/caveats;
  - product optimization suggestions.

Acceptance:

- The report answers whether challenger meaningfully beats Doubao in the task space and why.

## Red Lines For Future Work

- Do not physically delete package, curation, run, report, or adapter artifacts when creating/selecting a task.
- Any reset action must:
  - be explicit in the UI or command;
  - name exactly what it resets;
  - create a backup first;
  - not affect other tasks.
- Unsupported product fields are not model failures. They are capture/provider capability caveats unless the product explicitly exposes the capability and fails.
- Local Model Reply is runtime simulation, not fixed script playback.
