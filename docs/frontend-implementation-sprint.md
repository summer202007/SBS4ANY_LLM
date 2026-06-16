# Frontend Implementation Sprint

## Sprint Goal

Build the first runnable local desktop Web App shell for SBS 4 Any Agent.

The first slice should make the existing restaurant recommendation runtime eval package visible and usable:

`fixture package -> package overview -> case curation -> manual collection -> SBS review -> Markdown report`

## Phase 0: Documentation And Architecture

Status: complete for first pass.

Artifacts:

- `docs/product-architecture-and-webapp-flow-20260609.xml`
- Feishu doc: https://bytedance.larkoffice.com/docx/Q2tfdZWt8oTTHvxaUucltVnGg2b
- `docs/data-model.md`
- `docs/product-spec.md`
- `docs/mvp-sprint.md`
- `docs/frontend-technical-architecture.md`

## Phase 1: Local App Shell

Status: complete; updated with task-level entry on 2026-06-10.

Tasks:

1. Create `package.json`.
2. Create `server/index.mjs`.
3. Create `web/index.html`, `web/styles.css`, `web/app.js`.
4. Add routes:
   - Tasks
   - Package
   - Cases
   - Collect
   - Review
   - Report
5. Add health endpoint.
6. Add start script.

Acceptance:

- `npm run dev` starts a local server.
- Browser shows navigation and empty states.
- Browser starts at task list, not directly inside a package.

No user checkpoint required unless the app cannot run.

## Phase 1.5: Evaluation Task Creation

Status: complete for first skeleton.

Reason:

The app should not feel like a second-level viewer for one fixed eval package. It needs an upper product layer where users create an evaluation task, choose the challenger and baseline ceiling app, then define the task space before generating or importing an eval package.

Task list/creation and task execution are separate page systems:

- Task list: choose an existing task or create a new one.
- New task: open a large `New Evaluation` modal and fill the arena/task-space form.
- Task execution: after arena confirmation, show only Package, Cases, Collect, Review, and Report for that task.
- Returning to the task list uses a dedicated back button, not a task-list tab inside the execution workflow.

Tasks:

1. Add `Tasks` home view.
2. Add `New Evaluation` modal for arena setup.
3. Add local task index storage:
   - `data/tasks/index.json`;
   - `data/tasks/active-task.json`.
4. Add task APIs:
   - `GET /api/tasks`;
   - `POST /api/tasks/create`;
   - `POST /api/tasks/select`.
5. Capture arena fields:
   - product type;
   - baseline app;
   - baseline surface/access;
   - challenger name;
   - challenger surface/access;
   - side-specific access notes and expected challenger advantage.
6. Capture task-space fields in three levels:
   - required: task space, concrete scenario, target audience;
   - recommended: winning criteria, must-cover capabilities, risk areas, native-context/audience-fit policy;
   - optional: side-specific URLs/access notes, expected advantage, supplemental generation notes.
7. Keep the restaurant package as a development/demo fixture, not a primary user-facing action.

Current implementation notes:

- `Mode` was removed as a user-facing concept because it was ambiguous. The UI now uses `surface/access`, such as Web chat or Mobile app.
- Challenger does not default to a URL. URL is optional and only relevant for Web chat/API-like access.
- Baseline and challenger access fields are separate. The app should never use one shared URL/notes field for both sides because it becomes unclear which product the collection workflow should operate on.
- Optional access fields are used by the collection workflow/harness, not as direct grader criteria.
- Optional challenger-advantage and supplemental notes are eval-generator hints. They can influence coverage, source-advantage probes, confirmation backlog, and report caveats, but they should not automatically become scoring rules unless the generated rubric explicitly encodes them.
- Text examples are placeholders, not prefilled values. Placeholders use gray styling, disappear while the field is focused, and reappear on blur when the field remains empty.
- All text examples are prefixed with `i.e.` so users understand they are examples, not submitted defaults.
- Where possible, optional fields are structured choices:
  - evidence availability is a select per side;
  - expected challenger advantage is a checkbox group;
  - generator focus is a checkbox group;
  - URL/entry and additional notes remain free text because they are inherently product-specific.
- Evidence availability and evidence notes will be passed to the local eval-set generator when package generation is connected. The generator should use them as `evidenceAssumptions`, collection feasibility constraints, and report caveats, in addition to the collection workflow using them as user-facing run instructions.
- The setup form uses sample values for the restaurant scenario. On first focus, a sample value clears so the user can type their own value quickly.
- Creating a new task clears the current package/curation/run workspace to avoid accidentally attaching an old package to a new task.
- This is still a skeleton: packages/runs are not yet stored in per-task directories. Only one active package is supported at a time.
- `Tasks` is a first-step selection page. Task-scoped navigation is hidden on this page to avoid implying execution tabs have meaning before the user chooses or creates a task.
- Arena setup is not a task-execution tab. It appears only as a creation modal from the task list.
- Task execution shows Package, Cases, Collect, Review, and Report only.
- `Back to Tasks` asks for confirmation before returning. Current progress is already saved in local files.
- `Decision question` is not user-entered in the setup form. The app derives it from challenger, baseline, and task space, then passes the generated value to the eval generator because `arenaEvalSpec.decisionQuestion` is still required by the package schema and skill references. The backend sanitizer has the same fallback for API/legacy callers.
- The global `Load Sample Package` action was removed from the user-facing UI because it always loads Xiaohongshu restaurant cases regardless of the selected task.

## Phase 2: Fixture Load And Validation

Status: complete.

Tasks:

1. Implement `POST /api/package/load-fixture`.
2. Copy fixture to `data/packages/current.json`.
3. Run validator in local mode.
4. Initialize:
   - `data/active-project.json`
   - `data/runs/current.json`
5. Implement `GET /api/package/current`.
6. Render validation status.

Acceptance:

- User clicks "Load restaurant fixture".
- Package loads.
- Validation status shows 0 errors / 0 warnings.

Checkpoint 1:

- Stop and ask user to review Package Overview before building deeper curation interactions.

## Phase 3: Package Overview

Status: complete for Checkpoint 1.

Tasks:

1. Render Arena summary.
2. Render Coverage summary.
3. Render dimensions and weights.
4. Render taskFitModule.
5. Render self-critique quality gates.
6. Render confirmation backlog.
7. Render trace artifact refs.

Acceptance:

- User can understand what the package evaluates.
- Caveats are visible, especially `coverageRepresentativeness=warn`.

Checkpoint 1 happens after this phase.

Verification:

- `node --check server/index.mjs`
- `node --check server/storage.mjs`
- `node --check server/report.mjs`
- `node -e "import('./server/storage.mjs').then(m=>m.loadRestaurantFixture())"`
- `npm run dev`
- Playwright smoke test against `http://127.0.0.1:3000`

Checkpoint 1 URL:

- `http://127.0.0.1:3000`

## Phase 4: Case Curation

Status: complete for current MVP pass.

Tasks:

1. Render case table.
2. Add filters:
   - status
   - caseType
   - riskLevel
   - capabilityCluster
3. Render case detail.
4. Separate model-facing and evaluator-facing fields.
5. Add approve/reject.
6. Add reviewer notes.
7. Save curation state.
8. Add manual edit overlay for high-value fields:
   - `modelFacingPrompt`
   - `scenario`
   - `userPersona`
   - `userGoal`
   - `expectedOutcome`
   - `mustDo`
   - `mustNotDo`
   - `failureModesToProbe`
   - `riskLevel`
   - `difficulty`
9. Keep immutable fields read-only in MVP:
   - `caseId`
   - `caseType`
   - `graderRefs`
   - direct `turnScripts` edits
10. On approve/reject, save and auto-advance to the next draft case.
11. After auto-advance, relocate the user to the top of the case review area.
12. Show fairness guidance that hard scoring requirements must be visible in model-facing content.
13. Require `exposureContract` for each case so grader builders can distinguish model-visible facts, evaluator-only context, hard scoring requirements, inference targets, and non-scoring context.

Acceptance:

- User can approve/reject cases.
- Approved case count updates.
- Refresh preserves curation.
- User can modify practical case fields without mutating the original runtime package.
- Approved/rejected flow moves quickly through the case list.
- The UI warns reviewers not to grade against private evaluator-only persona facts.

Checkpoint 2:

- Ask user whether case review is low-friction enough and which fields should become editable first.

Current implementation notes:

- Rejected cases do not block collection.
- `Start Collection` appears once no cases remain in `draft` and at least one case is approved.
- `Generate More Cases` is a frontend-only placeholder.
- Future backend should let the user choose case type, count, and supplemental instruction, then call the eval generator skill with approved/rejected cases and coverage gaps.

## Phase 5: Manual Collection

Status: in progress; single-turn and shared multi-turn manual guided are implemented for MVP review.

Tasks:

1. Show only approved cases.
2. Build single-turn collection flow.
3. Build multi-turn manual-driver flow.
4. Add copy prompt.
5. Add baseline/challenger output textareas.
6. Add visible process notes.
7. Add evidence level selectors.
8. Save run state.
9. Restore progress on reload.
10. For multi-turn cases, show `turnScripts` as manual guided scripts.
11. Prepare runtime simulator branch for later `LLM suggested` next-turn generation:
   - harness owns package/case/turn cursor;
   - local model receives a fresh `turnExecutionState`;
   - runtime is side-blind;
   - branch rule selection and pre-send validation are recorded;
   - generated next user message requires human confirmation in MVP.
12. Require each multi-turn script turn to include `exposureDelta`:
   - facts exposed before the turn;
   - newly exposed facts;
   - model-visible requirements after the turn;
   - allowed new facts the simulator may expose.
13. Add disabled `Local Model Reply` button as the future entry point for local-model next-turn prefill.

Acceptance:

- User can collect both sides for at least one single-turn and one multi-turn case.
- Copy area never includes evaluator-only fields.
- Multi-turn execution mode is explicit: manual guided now, LLM suggested later.
- Runtime simulator validation can reject unapproved new fact exposure.

Current implementation notes:

- Evidence level is a per-side confidence/evidence-strength marker, not a replacement for raw evidence fields.
- Per side fields:
  - final output / response;
  - evidence level;
  - visible process notes;
  - source/citation notes;
  - toolcall/execution notes;
  - collection caveat.
- Multi-turn MVP uses `shared_user_turns`: both products receive the same user message each turn.
- Local model generation is not connected yet; the button is reserved beside the shared user message input.
- Future local-model button requirement: one-click diagnostics for local Codex and the installed SBS chatbot eval-set-generator skill.
- Completion validation must locate the first missing required field and show an inline reason.
- Required/optional fields use visual badges.
- Advanced exposure is intentionally folded; it shows a summary and raw editable facts for future grader/harness use.

Checkpoint 3:

- Ask user whether collection friction is acceptable.

## Phase 5.5: Local Desktop-Assisted Capture

Status: planned; route changed on 2026-06-10.

Reason:

Pure automated browser sending can trigger third-party anti-bot verification. The safer product boundary is:

- user manually operates Doubao/challenger in their real browser;
- SBS manages prompts, case/turn cursor, and capture sessions;
- a local helper reads the active browser page after the user has generated a response;
- the app reviews and accepts extracted fields before saving.

Tasks:

1. Add capture session controls to Collect:
   - active case/turn/side;
   - copy prompt;
   - start assisted capture;
   - paste capture JSON fallback;
   - pending capture preview.
2. Add normalized capture fields:
   - final answer;
   - visible process notes;
   - source/reference notes;
   - toolcall/execution notes;
   - expanded search keywords;
   - reference materials;
   - risk notices;
   - follow-up suggestions;
   - raw visible text;
   - URL;
   - screenshot/artifact refs.
3. Add local capture API:
   - `POST /api/capture/session/start`;
   - `POST /api/captures`;
   - `POST /api/capture/session/accept`;
   - `POST /api/capture/session/discard`.
4. Add first Chrome `.command` helper for Doubao Web.
5. Keep manual paste as fallback for every side and case.

Acceptance:

- User manually sends a prompt in Doubao Web.
- User clicks capture in SBS or runs the helper.
- SBS receives a structured pending capture.
- User can inspect/edit/accept the capture.
- No code path auto-sends prompts to Doubao.

Detailed sprint:

- `docs/local-desktop-capture-sprint.md`

## Phase 6: Review

Tasks:

1. Render completed cases.
2. Render side-by-side outputs.
3. Add turn navigation.
4. Show evidence levels and notes.
5. Show rubric suggestions as read-only hints.
6. Add manual review fields:
   - winner
   - rationale
   - notable failure modes
   - product implication
   - next recommendation
7. Save manual review.

Acceptance:

- User can compare outputs and record PM judgment.

No separate checkpoint unless review design feels heavy.

## Phase 7: Report

Tasks:

1. Generate Markdown preview.
2. Include arena/package/coverage/caveats.
3. Include approved cases and collection status.
4. Include SBS outputs and manual reviews.
5. Include grader placeholder.
6. Include open questions.
7. Add download/write file.

Acceptance:

- `data/reports/current.md` is generated.
- Report is readable as a portfolio artifact.

Checkpoint 4:

- Ask user whether report should be more PM narrative or more audit-heavy.

## Phase 8: Polish And Demo

Tasks:

1. Add README run instructions.
2. Add sample demo script.
3. Add visual polish.
4. Add basic smoke checks.

Acceptance:

- Fresh clone/local folder can run app and load fixture.

## Deferred Until After Fixture Loop

- Local Codex generation.
- GPT API generation.
- Fully automated Doubao/challenger prompt sending.
- Full desktop shell packaging.
- Fully guarded LLM simulator.
- Automatic grader.
- Historical run management.

## Replacement Case Generation Backlog

If a user rejects many generated cases, the app should later support `Generate replacements`.

Future flow:

1. Count coverage gaps caused by rejected cases.
2. Pass approved cases, rejected case reasons, and missing caseType/capability/dimension coverage to the eval-set generator skill.
3. Generate replacement cases as draft only.
4. Require human curation again before collection.

## Current Starting Point

Start with Phase 1 immediately.

## 2026-06-13 UI Productization Sprint

Goal: keep the existing SBS workbench capabilities intact while making the task, package, case, collect, review, and report pages feel closer to a user product instead of an internal artifact browser.

Guardrails:

- A rollback backup was created at `artifacts/backups/ui-productization/20260613-before-ui-productization.tar.gz`.
- Do not change `server/*`, skill prompts, grader logic, simulator logic, capture extraction logic, or persisted collected data in this sprint.
- Treat this as presentation-layer work: UI summaries, disclosure, hierarchy, labels, and reading experience.
- Existing Local Codex, package generation, runtime simulator, assisted capture, grader, and PDF export handlers must keep their current payload contracts.

Scope:

1. Tasks dashboard
   - Keep the task list behavior, but show more useful progress signals.
   - Each task should surface phase, cases, collected progress when available, report readiness, baseline/challenger, and a clearer next action.
2. Package overview
   - Add a compact product summary at the top.
   - Keep existing detailed arena/coverage/self-critique/trace data, but move lower-confidence or developer-facing artifacts behind collapsible advanced sections.
3. Case curation
   - Add a case brief before editable fields: what this case tests, visible prompt, expected signal, and risk.
   - Preserve all existing edit/save/approve/reject behavior.
4. Collect
   - Add active-case progress at the top.
   - Keep prompt area focused on copy and supported capture templates.
   - Make side capture actions visually primary and hide lower-priority collection fields behind details where possible.
   - Improve captured preview readability without changing extraction/storage.
5. Review and Report
   - Review: only improve readability and triage, no major workflow rewrite.
   - Report: reduce raw JSON exposure on the main page, show product-readable breakdowns, and keep debug details collapsible.

Acceptance:

- The app still opens the existing interview task.
- Package, Cases, Collect, Review, and Report render without runtime errors.
- Existing Capture / Local Model Reply / Run Review + Report / Export PDF buttons still exist and call the same handlers.
- The UI makes the user's next action clearer on every page.

## 2026-06-13 Visual Style Pass

Goal: add a more polished, slightly more opinionated visual system on top of the productized MVP UI, without changing product behavior.

Rollback:

- `artifacts/backups/ui-visual-style/20260613-before-visual-style-pass.tar.gz`

Completed:

1. Global visual tokens
   - quieter app background;
   - stronger text hierarchy;
   - reusable soft shadow and focus-ring tokens;
   - restrained teal accent usage.
2. Page shell
   - sticky header refinement;
   - sticky left navigation;
   - active navigation accent marker;
   - clearer page surface separation.
3. Workbench components
   - cards, section bands, metrics, field blocks, case rows, and task cards now share a consistent elevated surface style;
   - form fields and textarea states now feel more deliberate;
   - disclosure sections now have clearer closed/open surface treatment.
4. Collect / Review / Report readability
   - prompt/capture panels, evidence snippets, dark raw-preview blocks, report tables, insight cards, and case briefs received visual polish only.

Non-goals:

- No change to capture behavior.
- No change to Local Codex package generation, simulator, grader, or PDF export behavior.
- No change to persisted task or collect data.

Validation notes:

- Dev server starts.
- `node --check server/index.mjs` passes.
- Full screenshot automation was not available because system Chrome launch was blocked and bundled Playwright browsers were missing; do manual Mac app QA before considering this pass final.
