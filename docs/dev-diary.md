# Development Diary

## 2026-06-16

### DeepSeek Multi-Turn Capture Scoping Fix

Context:

- User reported Doubao capture still works, but DeepSeek capture still fails after clicking capture twice.
- Active failing task: `中文行业研究与职业讨论：deepseek vs Doubao`.
- Active failing case/turn: `case-006-ev-brand-channel-strategy`, turn 2.
- Runtime capture session failed with `Final answer is missing or too short.`

Root cause:

- The DeepSeek page raw visible text contained the correct second-turn user prompt and the full answer.
- The same user prompt also appeared again at the bottom input composer.
- The old turn scoping helper always selected the latest matching user prompt, so it selected the composer duplicate rather than the real conversation turn.
- That produced a scoped text containing only the prompt and no answer.
- DeepSeek DOM candidate containers were also viewport-biased and mostly represented the first-turn answer, so they were unsafe as the primary source for this multi-turn case.

Implemented:

- `scopeVisibleTextToCurrentTurn()` now uses `findUserMessageIndexForScope()`.
- When the same user prompt appears multiple times, the scoper chooses the occurrence that is followed by substantial answer text instead of blindly choosing the last occurrence.
- Repeated composer duplicates now act as the end boundary for the real turn.
- `extractDeepseekFinalAnswer()` now prefers current-turn raw scoped text when it can produce a substantial answer, and uses DOM answer containers only as fallback.

Validation:

- Replayed the latest failing DeepSeek snapshot:
  - `2026-06-16T022113908Z-chat.deepseek.com-adapter-snapshot.json`
  - scoped current-turn text length: about 1672 chars;
  - extracted answer length: about 1562 chars;
  - extracted answer starts with the expected second-turn response: `理解了，这恰恰是大多数新品牌最现实的困境...`
- `node --check server/websiteAdapters.mjs` passed.

Risk:

- This is a general turn-scoping improvement and should help other web chatbots whose composer repeats the current prompt.
- Doubao and dots.ai provider-specific adapters do not depend on DeepSeek final-answer extraction, but they may benefit from the safer generic scoping helper if they ever use raw visible text fallback.

### Website Capture Skill Generalization From DeepSeek Failures

Goal:

- Turn the DeepSeek debugging experience into reusable guidance for future unseen web chatbot capture adapters.
- Improve first-time website setup success rate without hardcoding only DeepSeek.

Captured lessons:

- Many chatbot pages repeat the current prompt in the bottom composer/input/sidebar/history. Turn scoping must not blindly choose the last prompt occurrence.
- The correct prompt occurrence is the one followed by substantial assistant answer text; later prompt echoes should be treated as chrome or as an end boundary.
- DOM/message containers can be viewport-biased, stale, or partial. If raw visible text clearly contains the current prompt followed by the answer, raw-line scoping can be more trustworthy than visible markdown/container nodes.
- Source/citation expansion must be restricted to read-only interactive evidence controls with clear source/reference hints. Ordinary answer words must not be clicked.
- QA should distinguish wrong-turn duplicate prompt capture from a simple empty answer.

Skill updates:

- Updated `skills/chatbot-website-capture-adapter-builder/SKILL.md`.
- Updated `references/visual-recon.md`, `references/extraction-plan.md`, and `references/qa-gate.md`.
- Updated `server/adapterBuilder.mjs` prompt so Local Codex receives these constraints during first-time website setup.
- Synced the repo-local skill into the mac app runtime skill directory.
- Synced the same skill into `/Users/bytedance/.codex/skills/chatbot-website-capture-adapter-builder`.

Backups:

- Runtime skill backup: `/Users/bytedance/Library/Application Support/SBS 4 Any Agent/runtime/skills/chatbot-website-capture-adapter-builder.bak-20260616-deepseek-lessons`
- Global skill backup: `/Users/bytedance/.codex/skills/chatbot-website-capture-adapter-builder.bak-20260616-deepseek-lessons`

## 2026-06-13

### UI Productization Pass - Workbench To Product Feel

Context:

- The user reviewed the full interview-task flow and asked for a first pass that makes the app feel less like an MVP/debug workbench and more like a user-facing product.
- Constraint: preserve current capabilities and do not degrade Local Codex, assisted capture, simulator, grader, or PDF export behavior.

Safety / rollback:

- Created rollback backup: `artifacts/backups/ui-productization/20260613-before-ui-productization.tar.gz`.
- Scope was limited to `web/render/*`, `web/styles.css`, and documentation.
- No `server/*`, skill, capture extraction, simulator, grader, or persisted collection data was changed.

Implemented:

- Tasks page:
  - converted task cards into a dashboard-like summary;
  - added cases, collected progress, report readiness, and next-step CTA;
  - active interview task now shows `13/15 collected` and `Continue Collecting`.
- Package page:
  - added a `Package Readiness` summary with cases, case types, multi-turn count, open questions, and scored dimensions;
  - moved self-critique gates and trace artifacts behind collapsible disclosure sections;
  - kept confirmation backlog visible because it can affect interpretation.
- Cases page:
  - added a `Case Brief` block before editable fields;
  - brief shows scenario, model-facing prompt, what the case tests, and expected discriminative signal;
  - existing edit/approve/reject/save behavior is unchanged.
- Collect page:
  - added active collection progress panel with case number, case id, type, turn count, and completion progress bar;
  - reorganized prompt area into a compact prompt panel with copy action;
  - preserved supported auto-capture chips under the prompt;
  - kept side-by-side Doubao/Challenger capture buttons visible;
  - folded optional evidence fields into `Evidence details`, default closed but marked when captured;
  - improved capture preview containers without changing extraction/storage.
- Review page:
  - added clearer readiness copy;
  - auto-opens missing/low-confidence cases and provides a small action hint;
  - no workflow rewrite or new user-editing model.
- Report page:
  - replaced raw JSON blocks for case-type breakdown and failure clusters with readable insight cards;
  - kept quality audit available but collapsed;
  - existing structured scores, verdicts, optimization plan, evidence snippets, case table, PDF export, and JSON download remain available.

Validation:

- `node --check` passed for all modified render modules.
- Playwright screenshot regression covered Tasks, Package, Cases, Collect, Review, and Report.
- Found and fixed one Tasks runtime null-access bug during screenshot regression.

Remaining product polish:

- Tasks page currently shows detailed collection/report progress only for the active task; non-active task progress still depends on task index metadata and may show `Open to view`.
- Review remains intentionally light; a future pass can turn it into a true QA review workbench.
- Collect still has many fields by necessity, but the main workflow is now visibly separated from advanced evidence details.

Follow-up fix:

- Review/Report background polling previously re-rendered the whole page every 3 seconds even when grader data had not changed.
- This reset `<details>` disclosure state, so user-opened sections could close again and user-closed low-confidence sections could reopen.
- Added a grader bundle signature check in `web/app.js`; Review/Report now re-render only when cleaned evidence/report data actually changes.
- Browser regression confirmed `jobint-mt-008` stays closed after manual close across the polling interval.

PDF export filename fix:

- The API already returned a task-aware filename, but the desktop flow revealed the physical compatibility file `grader/report.pdf`, so Finder still showed `report.pdf`.
- `server/pdfExporter.mjs` now writes the primary PDF to a task-aware filename such as `求职面试经验-小红书点点-vs-Doubao-SBS-report.pdf`.
- A compatibility copy is still written to `grader/report.pdf` for older paths.
- Verified `POST /api/grader/export-pdf` returns:
  - `filename: 求职面试经验-小红书点点-vs-Doubao-SBS-report.pdf`
  - `pdfPath: data/tasks/task-2026-06-12T064110798Z/grader/求职面试经验-小红书点点-vs-Doubao-SBS-report.pdf`

Visual style rollback point:

- Before starting any higher-polish visual style pass, saved the current working UI state to `artifacts/backups/ui-visual-style/20260613-before-visual-style-pass.tar.gz`.
- Backup includes `web/`, relevant sprint/diary docs, and `server/pdfExporter.mjs`.

## 2026-06-11

### Package Generation And Manual Import Sprint

Goal:

Connect `New Evaluation` task setup to real Package creation.

Implemented:

- Added sprint document: `docs/package-generation-and-import-sprint.md`.
- Added task-scoped workspace path helpers in `server/storage.mjs`.
  - New writes prefer `data/tasks/<taskId>/...`.
  - Legacy global `data/packages/current.json`, `data/curation/current.json`, and `data/runs/current.json` remain as compatibility mirrors.
  - Creating/selecting tasks still must never delete another task's artifacts.
- Added `installRuntimePackage()` as the single package installation path for fixture, generated, and imported packages.
  - Writes package, validation, active project metadata, curation draft state, and run shell.
  - Auto-creates `case-index.md` when needed so local package validation has a human-readable audit artifact.
- Added local Codex package generation service:
  - `server/packageGenerator.mjs`
  - New endpoint: `POST /api/package/generate`
  - Uses local Codex with repo-local `chatbot-eval-set-generator` skill.
  - Default case count is 15; UI supports 12 / 15 / 20.
- Added manual template import/export:
  - `server/packageTemplate.mjs`
  - New endpoint: `GET /api/package/template`
  - New endpoint: `POST /api/package/import-template`
  - Template is an Excel-compatible XML workbook with separate sheets for `single_turn`, `scripted_multi_turn`, `adaptive_multi_turn`, `capability_probe`, `boundary_risk`, and `regression_like`.
  - Import converts filled rows into a structurally valid RuntimeEvalPackage skeleton.
- Updated Package empty state:
  - Shows active task context.
  - Explains local Codex requirement and expected wait time.
  - Adds Generate Eval Package button.
  - Adds Download Template and Upload Filled Template actions.
  - Success automatically renders Package Overview.

Validation:

- `node --check` passed for modified server modules.
- Manual template smoke produced a package with 6 cases and 2 turn scripts.
- The imported skeleton passed `validate_eval_package.mjs --mode local`.
- Existing restaurant package remained intact: 15 cases, 15 approved.

Known limitations:

- Local Codex generation is currently a synchronous request with a long timeout. If the UI feels blocked, upgrade this to a persisted background job with polling.
- Template upload supports the SBS-generated XML Spreadsheet format, not arbitrary `.xlsx` yet.
- Generated package quality still depends on the eval-set generator skill and should be reviewed in Package/Cases before collection.

### Local Codex Package Generation Failure Handling

Observed from real use:

- The first Package generation attempt failed with a huge red UI error because the backend surfaced raw Codex stderr/stdout.
- Codex emitted unrelated global skill/plugin warnings, including an invalid `hive-sql-query/agents/openai.yaml` warning.
- Removing `--output-schema` avoided hard schema-level exit, but full `codex exec` + skill generation still spent several minutes reading skill/schema/reference files and sometimes exited without writing `--output-last-message`.
- The workflow is too heavy for a synchronous request as the only path.

Fixes:

- `server/packageGenerator.mjs` now:
  - removes CLI-level `--output-schema`;
  - writes stdout/stderr even on non-zero exit;
  - returns a compact error message with debug artifact paths;
  - uses a longer timeout;
  - asks Codex to ignore unrelated global skills and work efficiently.
- `web/app.js` truncates long status messages to avoid a full-page red stderr dump.
- `server/packageTemplate.mjs` now provides `buildFallbackRuntimePackage()`.
- `/api/package/generate` now tries Local Codex first and, if it fails, installs a structurally valid 15-case fallback scaffold package with explicit confirmation backlog warnings.

Current state:

- The active `奢侈品种草：小红书点点 vs Doubao` task has a fallback scaffold package installed.
- The fallback package has 15 cases, 5 turn scripts, and passes local package validation.
- Source type is `fallback_scaffold_after_local_codex_failure`.

Next engineering improvement:

- Replace synchronous package generation with a background generation job and polling UI.
- Add a compact purpose-built generator prompt/path that does not require the Codex agent to inspect the entire skill/reference tree every time.

## 2026-06-09

### Product Architecture And Web App Flow Doc

Created a new Feishu document for frontend implementation planning:

- Feishu: https://bytedance.larkoffice.com/docx/Q2tfdZWt8oTTHvxaUucltVnGg2b
- Local source: `docs/product-architecture-and-webapp-flow-20260609.xml`

The document covers:

- product architecture for the desktop local Web App;
- package-first / fixture-first product decision;
- why MVP should be Web App rather than mobile app;
- system layers, data objects, local file conventions, API design;
- the full detailed user flow for one SBS eval run;
- detailed Package, Cases, Collect, Review, and Report interactions;
- manual single-turn and multi-turn collection rules;
- Local Codex generation as post-fixture integration;
- explicit MVP non-goals and development order.

### Fixture-First Web App Implementation

Built the first runnable local desktop Web App slice.

Goal of this slice:

`restaurant runtime eval package -> package overview -> case curation -> editable human overlay -> runtime simulator branch prep`

This is still not the full SBS run loop. Collect, Review, Report, Local Codex generation, and grader execution remain later phases.

#### Implementation Shape

Chose a zero-dependency local stack for the MVP:

- Node built-in HTTP server.
- Static browser-native HTML/CSS/JS under `web/`.
- Local JSON state under `data/`.
- Existing eval-package validator invoked from the server.

No React/Vite/dependency install yet. The reason is to validate product flow before adding frontend framework weight.

#### Files Added

- `package.json`
  - Adds `npm run dev`.

- `server/index.mjs`
  - Serves static Web App files.
  - Exposes JSON APIs.
  - Listens on `127.0.0.1:3000`.

- `server/storage.mjs`
  - Owns local `data/` paths.
  - Loads the restaurant fixture.
  - Copies trace artifacts referenced by the runtime package.
  - Runs package validation in local mode.
  - Initializes active project, curation state, and run state.
  - Saves case curation updates.

- `server/report.mjs`
  - First placeholder Markdown report builder.
  - Not yet the final PM-grade report.

- `server/simulator.mjs`
  - Prepares the future runtime user simulator branch.
  - Builds `turnExecutionState` from package + run cursor + prior turns + latest model response.
  - Builds a local-model prompt for next-turn user simulation.
  - Includes a lightweight simulator-output validator.
  - Does not call any model yet.

- `web/index.html`
  - App shell and left navigation.

- `web/styles.css`
  - Quiet workbench-style desktop UI.
  - Responsive enough for narrow screens, but Web App remains desktop-first.

- `web/api.js`
  - Client API wrapper.

- `web/state.js`
  - Minimal frontend state store.

- `web/app.js`
  - App initialization, view routing, fixture load, curation save flow.

- `web/render/packageView.js`
  - Renders Package Overview.

- `web/render/casesView.js`
  - Renders case table, filters, case detail, editable fields, status actions, and multi-turn script summary.

- `docs/frontend-technical-architecture.md`
  - Technical architecture for this zero-dependency Web App slice.

- `docs/frontend-implementation-sprint.md`
  - Phase-by-phase frontend sprint and checkpoints.

- `docs/runtime-user-simulator-branch.md`
  - Runtime simulator branch contract for future Collect page integration.

#### Files Updated

- `.gitignore`
  - Added `data/` so local package/run/report artifacts do not get committed accidentally.

- `docs/frontend-implementation-sprint.md`
  - Marked Phases 1-3 complete.
  - Added case editing overlay tasks.
  - Added approve/reject auto-advance behavior.
  - Added multi-turn manual guided and LLM-suggested simulator branch notes.
  - Added replacement-case generation backlog.

#### Local State Created At Runtime

These are generated and ignored by git:

- `data/packages/current.json`
- `data/packages/current.validation.json`
- `data/packages/input.json`
- `data/packages/draft-package.json`
- `data/packages/self-critique.json`
- `data/packages/revised-package.json`
- `data/packages/validation.json`
- `data/packages/summary.md`
- `data/packages/case-index.md`
- `data/active-project.json`
- `data/curation/current.json`
- `data/runs/current.json`
- `data/reports/current.md` when report download is used later

Important detail:

The first implementation copied only `revised-package.json` into `data/packages/current.json`, which caused local validation to fail because trace artifact refs such as `case-index.md` no longer resolved relative to the copied package. This was correct validator behavior. Fixed by copying referenced local trace artifacts into `data/packages/` during fixture load.

#### APIs Implemented

- `GET /api/health`
  - Returns server status and project root.

- `POST /api/package/load-fixture`
  - Copies the restaurant regression package.
  - Copies trace artifacts.
  - Runs local validator.
  - Initializes active project, curation, and run state.

- `GET /api/package/current`
  - Returns package, validation, active project, curation, and run state.

- `POST /api/curation/current`
  - Saves case status, reviewer notes, and editable-case overlay.
  - Allowed statuses: `draft`, `approved`, `rejected`.
  - Editable fields are allowlisted.
  - Original runtime package is not mutated.

- `POST /api/simulator/turn-packet`
  - Packet-only simulator prep endpoint.
  - Inputs: `caseId`, `currentTurnIndex`, `sideLabel`, `priorTurns`, `lastModelResponse`, optional tracked state and notes.
  - Outputs: `turnExecutionState` and a local-model prompt.
  - Does not call Local Codex/GPT yet.

- `GET /api/report/current`
  - Returns placeholder Markdown report preview.

- `POST /api/report/download`
  - Writes placeholder Markdown to `data/reports/current.md`.

#### Package Overview State

Implemented and verified:

- Validation status.
- Arena decision question.
- Task space, baseline, challenger, product surface.
- Target users, user jobs, known unknowns.
- Coverage case count, case mix, dimensions, weights.
- Task fit module.
- Self-critique quality gates.
- Confirmation backlog.
- Trace artifact refs.

Current checkpoint:

- Package Overview is usable and validated.
- It is intentionally information-dense because it is the audit entry point.

#### Case Curation State

Implemented and verified:

- 15 imported cases render in Cases view.
- Filters:
  - case type;
  - status.
- Case detail separates:
  - model-facing prompt/instructions;
  - evaluator-facing fields;
  - read-only evaluator intent / hidden intent / grader refs.
- Editable fields:
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
- Human edits are stored as `curation.caseStatuses[caseId].editedCase`.
- `Approve` and `Reject` save then auto-advance to the next draft case.
- `Save Notes` saves without auto-advancing.
- Auto-advance now hard-resets browser scroll to the top of the page instead of only the workbench area.
- Multi-turn cases show a script summary:
  - script mode;
  - max turns;
  - runtime mode;
  - decision policy;
  - MVP execution note.
- UI now warns that anything the tested model is strictly judged on must be visible in model-facing content.
- `User Persona` is labeled as evaluator context, not automatically a hard scoring fact.
- Added `exposureContract` to every case in the runtime package schema and restaurant fixture.
- `exposureContract` records:
  - `modelVisibleFactsAtStart`;
  - `evaluatorOnlyFacts`;
  - `hardScoringRequirements`;
  - `inferenceTargets`;
  - `nonScoringContext`;
  - `fairnessNotes`.
- Single-turn hard scoring requirements must be eligible from turn 1 and cannot use `turn_exposed_fact`.

Current limitation:

- Direct `turnScripts` editing is intentionally not implemented.
- Full structured case editing is not implemented.
- `caseId`, `caseType`, and `graderRefs` are read-only to avoid breaking references.
- Evaluator-only fields still need final grader implementation to enforce this fairness boundary programmatically.

#### Runtime Simulator Branch State

The eval-set generator skill already produces multi-turn contracts, not an executor.

Current Web App/harness state:

- `server/simulator.mjs` can build a side-blind `turnExecutionState`.
- `turnExecutionState` now includes `exposureContract`, `exposedFactsSoFar`, and current turn `exposureDelta`.
- The harness owns package/case/turn cursor.
- Runtime packet includes:
  - package id/version/run id;
  - case index/count;
  - `caseId`;
  - `currentTurnIndex`;
  - `sideLabel`;
  - arena summary;
  - coverage summary;
  - case summary;
  - evaluator/hidden intent;
  - state to track;
  - prior turns;
  - latest tested model response;
  - branch rules;
  - allowed adaptive moves;
  - do-not-reveal fields;
  - stop condition;
  - harness execution contract.
- Prompt builder asks the local model to return structured JSON for next user turn.
- Lightweight validator checks package/case/turn binding, branch rule existence, and rough evaluator leakage.
- Lightweight validator also rejects unapproved `newlyExposedFacts`.
- Multi-turn `turnScripts.turns[]` now include `exposureDelta`, and harness contracts include `no_unapproved_exposure`.

Current limitation:

- No Local Codex/GPT call is wired yet.
- No pre-send UI exists yet.
- No replay log is persisted yet.
- Collect page still needs to implement manual guided multi-turn first, then LLM-suggested next turn.

Decision:

- Cases page should not run the simulator.
- Collect page should own multi-turn execution because it has tested model replies and prior transcript.

#### Collect Page State

Implemented the first manual collection workflow.

Case Curation to Collect transition:

- `Start Collection` appears when all cases are processed, meaning no `draft` case remains.
- `approved` cases enter collection.
- `rejected` cases are skipped and do not block starting.
- If there are no approved cases, collection cannot start.
- `Generate More Cases` is present as a frontend placeholder and not connected to the eval generator yet.

Run storage/API:

- `POST /api/run/start-collection`
- `GET /api/run/current`
- `POST /api/run/current/case`

Run data now stores:

- `caseRuns[caseId].status`
- `executionStrategy`
- `collectionMode`
- `plannedMaxTurns`
- `actualTurns`
- `turns[]`
- `stopReason`
- `collectionNotes`

Single-turn collection:

- Approved single-turn cases show one shared prompt.
- User can copy the prompt.
- User pastes baseline and challenger outputs side by side.
- Per side fields:
  - final output / response;
  - evidence level;
  - visible process notes;
  - source/citation notes;
  - toolcall/execution notes;
  - collection caveat.

Evidence level interpretation:

- L0: final output only.
- L1: visible process / transcript.
- L2: sources / citations / visible tool calls / execution traces.
- L3: full replayable trace.

Multi-turn collection:

- Implemented `shared_user_turns`.
- Both products receive the same user message each turn.
- First turn is prefilled from `turnScript` or `modelFacingPrompt`.
- User can save transcript, mark complete, add one next turn, or delete extra turns.
- Added-turn user message seeding is turn-index specific: turn 2+ only uses the matching planned turn message; if no matching planned turn exists, the field stays blank and never falls back to the first prompt.
- Turn script guidance is shown behind a details control.
- `Local Model Reply` button is displayed next to the shared user message input but disabled; it is the reserved entry point for later local-model next-turn prefill.
- Future requirement: this button should support one-click diagnostics and explain that local Codex plus the SBS chatbot eval-set-generator skill must be installed.
- Mark Complete validates required fields, scrolls to the first failing field, and shows an inline error.
- Copy User Message shows a toast.
- Collection caveat is collected before normal answer fields; if a side is caveated, only the caveat reason is required for that side.
- Required and optional fields now use explicit visual badges.
- `Local Model Reply` has a nearby `?` help icon with hover text explaining that future use requires local Codex plus the SBS chatbot eval-set-generator skill.
- The advanced model-visible facts panel now shows a structured summary:
  - newly exposed fact count;
  - allowed-by-script fact count;
  - source label such as `script-derived`;
  - editable raw newly exposed facts.
- `Local Model Reply` appears beside the shared user message input for every multi-turn turn, including newly added turns.

## 2026-06-10

### Context

Today the product direction shifted from continuing deeper into manual collection toward building the full upstream task-creation flow. The reason is that the app cannot reliably obtain real collected Doubao/challenger data yet, so over-investing in Review/Report before task creation and eval generation are connected would create an empty downstream shell.

The better next slice is:

`Tasks -> Arena Setup -> task-space confirmation -> sample/generate eval package -> Cases -> Collect`

### Rollback

Before changing the app shell, a rollback snapshot was created at:

- `/private/tmp/sbs-rollback-20260610/`

It contains the previous `server/`, `web/`, `docs/`, `package.json`, and `PROJECT_BRIEF.md`.

### Product Decisions

1. The app should start from an evaluation task list, not directly from Package Overview.
2. Existing Package/Cases/Collect pages now belong to an active evaluation task.
3. The upper setup page is named `Arena Setup`.
4. `Mode` was removed as a user-facing label because it was ambiguous.
5. Product access is expressed as `surface/access`:
   - Web chat;
   - Mobile app;
   - Desktop app;
   - API;
   - Other.
6. Challenger setup should not default to Product URL. URL is optional and mainly relevant for Web chat/API access.
7. Baseline stays preset-first. For chatbot MVP, Doubao is the baseline ceiling.
8. Challenger stays flexible. The user can enter a product name and choose mobile/web/API access.
9. Task-space setup fields are split into:
   - Required: task space, concrete scenario, target audience, decision question;
   - Recommended: winning criteria, must-cover capabilities, risk areas, native-context/audience-fit policy;
   - Optional: URL/access notes, expected advantage, supplemental notes.
10. The restaurant package is now a sample package loaded under an active task, not the product's default world.

### Engineering Changes

Server:

- Added local task storage:
  - `data/tasks/index.json`;
  - `data/tasks/active-task.json`.
- Added task APIs:
  - `GET /api/tasks`;
  - `POST /api/tasks/create`;
  - `POST /api/tasks/select`.
- Added task sanitizer for arena and task-space fields.
- `loadRestaurantFixture()` now records the sample package summary on the active task.
- Creating a new task clears the current package/validation/curation/run/report workspace so an old package cannot be silently attached to a new task.

Frontend first pass:

- Added `Tasks` navigation item and `Arena Setup` navigation item. This was superseded later the same day: Arena Setup is now a creation modal, not a task-execution tab.
- Added `web/render/tasksView.js`.
- Added `web/render/setupView.js`.
- App now starts on `Tasks`.
- `Load Sample Package` originally created a default restaurant task if no task existed, then loaded the sample package. This was superseded later the same day: the user-facing sample package action was removed.
- Arena setup form includes sample restaurant values that clear on first focus.
- Package Overview displays active evaluation task context above the package arena.

Known limitation:

- This is not yet true per-task package/run persistence. The active task list exists, but the current package/curation/run files are still single-active-workspace files. This is acceptable for the current MVP skeleton and should be upgraded before historical task switching becomes important.

### Verification

Ran syntax checks:

- `node --check server/storage.mjs`
- `node --check server/index.mjs`
- `node --check web/app.js`
- `node --check web/render/setupView.js`
- `node --check web/render/tasksView.js`
- `node --check web/render/packageView.js`

Ran browser smoke against `http://127.0.0.1:3000` for the first pass:

- Tasks page loads as the first view.
- Navigation includes Tasks, Arena Setup, Package, Cases, Collect, Review, Report. This was later changed so Tasks and task execution are separate page systems.
- Arena setup shows Required / Recommended / Optional field levels.
- Sample values clear on first field focus.
- Creating a new task clears the current package workspace and shows the Package empty state.
- Loading Sample Package under the active task shows Package Overview, task context, and validation passed. This was a first-pass smoke only; the user-facing sample package action was later removed.
- Tasks list shows one active clean demo task after local test cleanup:
  - `餐厅推荐：小红书点点 vs 豆包`
  - 15 cases.

### Next Engineering Steps

1. Decide whether to implement true per-task storage now or defer until after generator integration.
2. Add a `Generate Eval Package` placeholder state after task creation.
3. Connect the New Evaluation modal output to the local `chatbot-eval-set-generator` skill.
4. Keep the restaurant package only as a dev/demo fixture, not a primary user action.
5. Continue Case/Collect only after the task creation and package generation path feels coherent.

### Follow-up Fixes

After reviewing the first task-shell version, two interaction corrections were made:

1. `Tasks` is now a true first-step selection page. The app hides task-scoped navigation while on Tasks, so Package/Cases/Collect/Review/Report are not visible before the user creates or opens a task.
2. `Decision question` is no longer a manual user input in Arena Setup. The skill requires `arenaEvalSpec.decisionQuestion` in the generated package, but the product can derive it from challenger, baseline, and task space:
   - `<challenger> 在「<taskSpace>」任务空间里，是否整体胜出 <baseline>？`

Additional implementation note:

- Setup sample values are treated as examples only. If a field still equals its sample value, the form reader does not submit it as a user-authored optional value.

### UI Cleanup

The user-facing `Load Sample Package` button was removed from both the header and Arena Setup. The restaurant package still exists as a development/demo fixture and API endpoint, but it should not sit in the primary flow because it always loads the Xiaohongshu restaurant eval cases regardless of the user's selected challenger or task space.

The backend decision-question fallback remains intentionally:

```text
<challenger> 在「<taskSpace>」任务空间里，是否整体胜出 <baseline>？
```

This is only a sanitizer/API compatibility fallback. The product UI should not ask the user to write the decision question manually.

### Task Flow Separation

The app shell was adjusted again after user review:

- Task list/creation and task execution are now treated as two separate page systems.
- `New Evaluation` opens a large modal from the task list instead of navigating to an `Arena Setup` page.
- Creating the arena creates the task and immediately enters the task execution flow.
- The execution flow no longer has an Arena Setup tab.
- The execution flow only shows Package, Cases, Collect, Review, and Report.
- Returning to the task list uses a dedicated `Back to Tasks` button in the top-left navigation area.
- The return action asks for confirmation and relies on local auto-save for the current task state.

### Arena Optional Fields Clarification

The Arena creation modal's optional section was revised after user review:

- Removed the ambiguous shared `Web chat URL` and shared `Access / collection notes`.
- Added side-specific fields:
  - Baseline chat URL;
  - Baseline access / evidence notes;
  - Challenger URL / entry;
  - Challenger access / evidence notes.
- Kept `Expected challenger advantage` and `Supplemental generation notes` under an explicit `Eval generator hints` group.
- Added UI copy explaining how optional fields are used:
  - side-specific access fields support collection workflow/harness instructions;
  - challenger advantage and supplemental notes support eval generation coverage, source-advantage probes, confirmation backlog, and report caveats;
  - optional hints should not automatically become scoring rules unless the generated rubric explicitly encodes them.

Follow-up polish:

- Text examples are now placeholders, not prefilled values.
- All text examples are prefixed with `i.e.`.
- Placeholders are gray, disappear while focused, and reappear on blur if the field remains empty.
- Evidence availability and evidence notes are explicitly described as inputs that will be passed to the local eval-set generator once package generation is connected. The generator should use them as evidence assumptions, collection feasibility constraints, and report caveats.
- Optional free-text fields were reduced where possible:
  - evidence availability is a select per side;
  - expected challenger advantage is a checkbox group;
  - generator focus is a checkbox group.

Layout:

- Case list panel height now aligns better with the right-side workbench.
- Case list scrolls internally instead of appearing as a small widget with unused space below.

#### Verification Performed

Validation:

```bash
node -e "import('./server/storage.mjs').then(m=>m.loadRestaurantFixture())"
```

Final clean fixture state after tests:

- validation ok: true
- cases: 15
- approved: 0
- edited: 0

Syntax checks:

```bash
node --check server/index.mjs
node --check server/storage.mjs
node --check server/report.mjs
node --check server/simulator.mjs
node --check web/app.js
node --check web/render/casesView.js
```

Playwright smoke tests:

- Opened `http://127.0.0.1:3000`.
- Verified Package Overview validation text:
  - `Validation Passed`
  - `0 schema / 0 consistency / 0 warnings`
- Verified Cases view:
  - 15 rows render.
  - editing `modelFacingPrompt` saves as overlay.
  - approve auto-advances to `rest-st-002`.
  - multi-turn case shows script/runtime summary.

Simulator packet smoke test:

```bash
POST /api/simulator/turn-packet
```

With:

- `caseId=rest-mt-001`
- `currentTurnIndex=1`
- `sideLabel=Side A`
- latest model response: asks location/budget/cuisine

Returned:

- `mode=packet_only`
- `progress=Case 6 of 15 / Turn 1 of 3`
- one branch rule
- prompt includes `turnExecutionState`

Additional exposure hardening verification:

- New schema/validator accepted the migrated restaurant package:
  - 15 cases
  - 4 turn scripts
  - 0 schema errors
  - 0 consistency errors
  - 0 warnings
- Simulator validator accepted approved `newlyExposedFacts`.
- Simulator validator rejected an unapproved new fact:
  - `unapproved newlyExposedFacts: secret persona detail that was not allowed`

Collect polish smoke test:

- Required/optional badges render.
- Local model help icon renders.
- Advanced exposure summary renders:
  - `1 newly exposed`
  - `4 allowed by script`
  - `script-derived`
- Adding a new multi-turn turn also shows `Local Model Reply`.
- Delete Turn appears for added turns.

#### Current Running App

Dev server:

```bash
npm run dev
```

URL:

- `http://127.0.0.1:3000`

Note:

In this sandbox, starting/stopping the local server required escalated permission because binding `127.0.0.1:3000` was blocked in the default sandbox.

#### Next Engineering Steps

1. Finish Case Curation UX polish:
   - clearer saved/advanced feedback;
   - filters for risk/capability cluster;
   - optional diff view for edited vs original.
   - optional diff view for edited vs original.
2. Improve Collect page:
   - add clearer incomplete/needs-review path.
   - decide whether completed case should auto-advance only to not-started or also in-progress cases;
   - add richer copy/save toast variants if needed.
3. Add LLM-suggested next-turn prototype:
   - use `/api/simulator/turn-packet`;
   - wire Local Codex/GPT provider later;
   - require human confirmation before sending/copying.
4. Add replay log storage:
   - state packet;
   - simulator output;
   - validation result;
   - final user message;
   - human override.
5. Add replacement-case generation later:
   - when many cases are rejected, compute coverage gaps;
   - send approved/rejected context to eval generator;
   - generate replacement cases as draft only.

## 2026-06-07

### Context

Today focused on tightening the `chatbot-eval-set-generator` skill after the restaurant recommendation regression run. The main goal was to turn several "looks safe in prose" eval-generation assumptions into concrete package contracts, validator checks, and future harness handoff rules.

This was still pre-Web-App engineering. We did not start the SBS MVP UI yet. The work stayed inside the eval generation engine, its schemas, references, validator, installed skill copy, and restaurant regression artifacts.

### What We Fixed

1. Upgraded validator confidence.
   - `validate_eval_package.mjs` is no longer only a lightweight custom checker.
   - It now runs schema-style checks plus cross-object consistency checks.
   - Validation output separates `schemaErrors` and `consistencyErrors`.

2. Clarified task fit vs product experience.
   - Added `evalSetCoveragePlan.taskFitModule`.
   - This keeps audience/source/native-context fit separate from `productExperience`.
   - Xiaohongshu-style/native fit can be rewarded as task value only when it improves the user's concrete outcome.
   - Unsupported live/recency/source certainty still gets penalized.

3. Hardened dimension consistency.
   - `dimensionWeights` must only include scored dimensions.
   - Every scored dimension needs a weight.
   - Scored weights must sum to 1.
   - Enabled/disabled/scored/diagnostic/baselineInsight sets cannot silently conflict.

4. Fixed rubric case-type/tag contract.
   - `appliesToCaseTypes` is now schema enum only.
   - Flexible labels moved to `appliesToCaseTags`.
   - Validator checks that rubric case refs and declared case types match.

5. Made trace preservation real.
   - Local mode requires trace refs to resolve to existing files.
   - Trace refs cannot escape the package directory.
   - Local packages must include `case-index.md`.
   - Added validator mode: `--mode local` and `--mode product`.
   - Product mode allows artifact IDs/store refs/URLs, but still requires a case-index/audit-index artifact ref.

6. Added multi-turn harness contract.
   - Each multi-turn `turnScript` now includes `harnessExecutionContract`.
   - Contract records runtime mode, harness-owned cursor, side blindness, decision policy, fallback policy, pre-send validation, replay-log fields, planner/drafter split, and human fallback.
   - MVP can still run manual guided scripts; it must not claim automated simulator safety unless guardrails are actually implemented.

7. Resolved side-blind state packet conflict.
   - Simulator-visible `side` was renamed to `sideLabel`.
   - The harness may know baseline/challenger internally.
   - The runtime simulator should only see neutral labels such as `Side A` / `Side B`.

8. Relaxed decision policy for fixed/manual scripts.
   - `fixed` scripts use `decisionPolicy=fixed_sequence`.
   - `guided_adaptive` and `hybrid` scripts still require `branch_rules_only`.
   - This avoids forcing branch-rule machinery onto simple fixed/manual multi-turn cases.

9. Synchronized `turn-script-policy.md`.
   - Required-field lists now include `runtimeStateTemplate` and `harnessExecutionContract`.
   - Branch rules now include stable `branchRuleId`.
   - The worked example now matches the current schema and validator.

10. Updated regression artifact self-critique.
    - Added `coverageRepresentativeness` to the restaurant regression package.
    - It is intentionally `warn`: this eval set covers important PM decision slices, but it is synthetic and not based on real logs or a sampling frame.

### Key Files Changed

- `skills/chatbot-eval-set-generator/SKILL.md`
- `skills/chatbot-eval-set-generator/references/self-critique.md`
- `skills/chatbot-eval-set-generator/references/turn-script-policy.md`
- `skills/chatbot-eval-set-generator/references/rubric-handoff.md`
- `skills/chatbot-eval-set-generator/references/example-complete-runtime-eval-package.md`
- `skills/chatbot-eval-set-generator/schemas/runtime-eval-package.schema.json`
- `skills/chatbot-eval-set-generator/schemas/eval-generation-critique.schema.json`
- `skills/chatbot-eval-set-generator/scripts/validate_eval_package.mjs`
- `schemas/runtime-eval-package.schema.json`
- `schemas/eval-generation-critique.schema.json`
- `artifacts/eval-generation/20260607-restaurant-diandian-vs-doubao/`
- `docs/chatbot-eval-set-generator-implementation-log.md`
- `PROJECT_BRIEF.md`

The installed skill copy was also synced to:

- `/Users/bytedance/.codex/skills/chatbot-eval-set-generator/`

### Verification

Repeatedly validated the restaurant regression package:

```bash
node skills/chatbot-eval-set-generator/scripts/validate_eval_package.mjs --mode local artifacts/eval-generation/20260607-restaurant-diandian-vs-doubao/revised-package.json
```

Final status:

- 15 cases
- 4 turn scripts
- 5 rubric suggestions
- 0 schema errors
- 0 consistency errors
- 0 warnings

Also ran targeted negative checks during the session:

- invalid `appliesToCaseTypes` free tag fails;
- rubric case-type mismatch fails;
- missing `case-index.md` fails in local mode;
- missing artifact file fails in local mode;
- path escaping fails in local mode;
- product artifact refs pass in product mode but fail in local mode;
- product mode without case/audit index fails;
- `sideBlind=false` fails;
- missing `branchRuleId` fails;
- missing `sideLabel` fails;
- `guided_adaptive` with `fixed_sequence` fails;
- `fixed` with `fixed_sequence` passes.

### Product/Engineering Decision Captured

Multi-turn eval is still valuable, but automation must not be overstated.

For MVP:

- run multi-turn as manual guided scripts;
- show the user progress and evaluator instructions;
- collect visible transcript;
- record that guarded runtime simulation was not used.

For future automated simulator:

- harness owns cursor;
- simulator is side-blind;
- simulator chooses from branch rules or returns human review;
- pre-send validation is mandatory;
- replay logs are mandatory;
- two-stage planner/drafter is recommended for high-risk adaptive cases.

### Next Step

Move from eval-generator hardening back to the engineering mainline:

1. Review current engineering plan/data model.
2. Scaffold local Web App MVP.
3. Build arena creation and eval package viewing.
4. Add case approval/editing.
5. Add manual SBS output collection.
6. Add simple report download.

Do not start with final graders or automated multi-turn simulator yet.

## 2026-06-10 Late Update: Local Desktop-Assisted Capture Route

### Trigger

While exploring Doubao Web capture for the first restaurant single-turn case (`rest-st-001`), a fresh automated Chrome/profile flow triggered human verification. This makes full automated prompt sending a poor MVP direction for Doubao.

### Capture Findings

- Doubao can expose more than the final answer:
  - expanded search keywords;
  - referenced web materials;
  - risk or AI-generated answer notices;
  - follow-up suggestion chips.
- These should be captured when visible and saved as structured fields.
- They may not appear in every run/browser context, so absence should be recorded as `not exposed in this run`, not as a product impossibility.

### Decision

Switch collection automation to:

`user manually sends prompt in real browser -> local helper reads current page -> SBS previews normalized capture -> user accepts/edits -> run state saves`

This keeps SBS inside the safe black-box eval boundary:

- no auto-sending prompts into Doubao;
- no verification bypass;
- manual paste fallback remains available;
- assisted capture is read-only and user-triggered.

### New Sprint

Created:

- `docs/local-desktop-capture-sprint.md`

The sprint covers:

- capture session UI;
- local capture API;
- Doubao Web normalized fields;
- Chrome `.command` helper first;
- optional macOS `.app`;
- later desktop shell;
- local Codex next-turn draft for multi-turn cases.

### Product Direction Update

Updated:

- `PROJECT_BRIEF.md`
- `docs/frontend-implementation-sprint.md`

Key new principle:

> Human sends, helper captures.

## 2026-06-10 Late Update: Desktop Dev Shell

### Trigger

The next implementation direction is to move the current Web App into a local app surface and use a hot-test workflow rather than repeatedly packaging/installing a `.dmg`.

### Decision

Use a native macOS dev shell first:

- Swift/AppKit executable;
- AppKit app lifecycle;
- WKWebView embedding the existing Web App;
- shell starts or reuses the current Node server;
- no Electron/Tauri dependency for this slice.

This keeps the current browser-hosted Web App as the UI source of truth while creating a place for desktop-only capture/helper capabilities.

### Files Added/Changed

- `desktop/Package.swift`
- `desktop/Sources/SBSDesktop/main.swift`
- `scripts/desktop/build_dev.sh`
- `scripts/desktop/run_dev.sh`
- `scripts/desktop/open_dev_app.sh`
- `docs/desktop-app-migration-sprint.md`
- `package.json`
- `PROJECT_BRIEF.md`
- `docs/frontend-technical-architecture.md`

### Commands

```bash
npm run dev
npm run desktop:dev
npm run desktop:run
npm run desktop:build
```

`npm run desktop:dev` builds a temporary `.app` under `.build/desktop-dev/` and opens it. The app reads `repo-root.txt` from its bundle resources, starts the Node server if `/api/health` is not already available, and loads `http://127.0.0.1:3000` in WKWebView.

`npm run desktop:run` runs the same binary in the foreground for terminal logs/debugging.

Implementation note:

- SwiftPM build failed on this machine because the active Command Line Tools installation does not support `xcrun --show-sdk-platform-path`.
- The dev scripts therefore compile with direct `swiftc`, an explicit SDK path, and a project-local clang module cache under `.build/module-cache`.

### Hot-Test Rule

- No `.dmg` needed during development.
- Web changes can be tested by reloading the desktop window with `Cmd+R`.
- Swift shell changes require restarting `npm run desktop:dev`.
- If a separate `npm run dev` server is already running, the shell reuses it.

### Web/Mac Parity Fix

The Mac App exposed the `Tasks` nav item inside task execution even though the Web App logic intended to hide it. Root cause: CSS for `.nav-item` set `display: block`, which can override the native HTML `[hidden]` behavior.

Fix:

- Added global `[hidden] { display: none !important; }` in `web/styles.css`.

Expected behavior:

- Task list mode shows only the `Tasks` entry/page.
- Task execution mode hides `Tasks` and shows `Back to Tasks` plus `Package`, `Cases`, `Collect`, `Review`, and `Report`.

### Back To Tasks WKWebView Fix

The `Back to Tasks` button appeared unresponsive in the Mac App because it depended on `window.confirm`, which is not reliable in the current WKWebView shell.

Fix:

- Added an app-owned `<dialog id="confirmDialog">` to `web/index.html`.
- Replaced `window.confirm` usage in `web/app.js` with an async `confirmAction(...)` helper.
- Added minimal `.confirm-modal`, `.confirm-message`, and `.modal-actions` styles.

Expected behavior:

- Clicking `Back to Tasks` opens an in-app confirmation dialog in both browser and Mac App.
- Confirming returns to the task list.
- Canceling stays on the current task execution page.

## 2026-06-10 Late Update: First Doubao Assisted Capture Implementation

### Scope

Implemented the first semi-automated capture slice for Doubao baseline only.

Boundary remains:

`human sends prompt in Chrome -> SBS reads current active Chrome tab -> SBS previews normalized capture -> human accepts/discards -> run state updates`

No prompt auto-send, no verification bypass, challenger remains manual.

### Backend Changes

- Added `server/chromeCapture.mjs`.
  - Uses AppleScript to read Google Chrome front window active tab.
  - Executes read-only page JavaScript to collect URL, title, visible body text, anchors, and button/chip text.
  - Normalizes Doubao-visible artifacts into:
    - `finalAnswer`;
    - expanded search queries;
    - reference materials;
    - risk notices;
    - follow-up suggestions;
    - visible process notes;
    - source notes;
    - toolcall notes;
    - raw visible text;
    - capture notes.
- Added capture session storage in `server/storage.mjs`.
  - States: `active`, `pending`, `accepted`, `discarded`, `failed`.
  - Pending capture is saved under `run.captureSession.pendingCapture`.
  - Accepted capture is preserved under `run.captureArtifacts[captureId]`.
  - Accepted Doubao capture maps into current turn baseline fields:
    - `baselineOutput`;
    - `baselineEvidenceLevel`;
    - `baselineVisibleProcessNotes`;
    - `baselineSourceNotes`;
    - `baselineToolcallNotes`.
- Added API routes in `server/index.mjs`:
  - `POST /api/capture/session/start`;
  - `POST /api/captures/doubao/current-chrome`;
  - `POST /api/capture/session/accept`;
  - `POST /api/capture/session/discard`.

### Frontend Changes

- Added Doubao-only assisted capture block inside the baseline side card on Collect.
- Manual fields remain visible and editable.
- The capture block includes:
  - current Chrome tab capture button;
  - pending preview;
  - URL/search/reference/follow-up/risk summaries;
  - final answer preview;
  - accept/discard controls;
  - failure fallback message.
- Capture failures update both the inline capture panel and the top status bar.

### Current UX

For each case/turn:

1. User copies the shared user message.
2. User opens Doubao in Chrome, sends the message manually, and waits for the response.
3. User returns to SBS and clicks `Capture Current Chrome Tab`.
4. User reviews the pending capture.
5. User accepts it into Doubao fields or discards and pastes manually.

For multi-turn cases, this implementation captures whichever turn is currently shown. Next-turn local simulator generation remains a later branch.

### Known Follow-Ups

- Real Doubao-page QA is still needed because Chrome permission and Doubao DOM/page variants can affect extraction.
- Chrome may require `View > Developer > Allow JavaScript from Apple Events`.
- `GET /api/capture/session` is deferred because the current app refreshes capture state through package/run state.
- A future native helper should add a one-click Chrome permission diagnostic.
- A future capture adapter can support challenger web surfaces after Doubao baseline is stable.

### Verification

```bash
node --check server/chromeCapture.mjs
node --check server/storage.mjs
node --check server/index.mjs
node --check web/render/collectView.js
node --check web/app.js
npm run desktop:build
```

All passed.

### Follow-Up Fix

A later real capture showed `namedChunks` and `data` in `Intent / query expansion notes`, which means the parser had fallen back to page-internal hidden state instead of user-visible Doubao evidence.

Additional fix:

- Removed whole-page `textContent` from query extraction.
- Evidence candidate extraction now uses visible `innerText` plus nearby visible ancestor/sibling text only.
- Query parser now filters obvious technical/page-state tokens such as `namedChunks`, `data`, `props`, `state`, and pure ASCII identifiers.
- Source/citation extraction still requires numbered rows after a valid quoted query line inside the search/reference block.

Parser check:

- bad hidden-state sample returns no query terms;
- normal Doubao quoted query sample returns the three intended query terms and numbered references.

Additional follow-up:

- Virtual expansion now also clicks the visible `搜索 N 个关键词，参考 M 篇资料` header itself, not only `button` / `role=button` / `summary` nodes.
- Follow-up suggestion capture now reads from:
  - visible button/role-button text;
  - visible DOM candidates near the bottom of the answer;
  - tail text after markers such as `相关视频`, `猜你想问`, or similar.
- This covers gray Doubao suggestion chips that are not implemented as normal buttons.

## 2026-06-11 End Of Day: Single-Turn Assisted Capture Passed

### Status

Single-turn Doubao assisted capture passed manual QA for the restaurant recommendation case flow.

The working path is:

1. User sends the eval prompt to Doubao manually in Chrome.
2. User returns to SBS and clicks `Capture Current Chrome Tab`.
3. SBS captures the current Doubao page.
4. SBS separates:
   - final answer;
   - intent/query expansion;
   - source/citation references and URLs;
   - risk notices;
   - follow-up suggestions;
   - raw visible text.
5. User reviews pending capture and accepts into Doubao baseline fields.

### Issues Fixed Today

- `Shared user message` now hydrates from the eval case prompt/turn script.
- Chrome permission guidance is shown in the capture card.
- Doubao sidebar/history/navigation text is filtered from final output and references.
- Citation/search block parsing was corrected:
  - query expansion comes from quoted terms after the search/reference header;
  - citations come from the numbered list below query terms;
  - answer-body numbered recommendations are not treated as citations.
- Multiple `Accept Into Doubao Fields` actions now overwrite the previous import instead of appending duplicate notes.
- Query extraction no longer reads page-internal hidden state such as `namedChunks` / `data`.
- Follow-up suggestions are captured from gray chip-like DOM/text, not only normal buttons.
- Current-turn scoping prevents a later unrelated Doubao answer from polluting the current case capture.

### Current Confidence

Single-turn assisted capture is good enough for MVP continuation. It is heuristic and Doubao-DOM-dependent, but the fallback remains manual paste and capture preview lets the user inspect errors.

### Tomorrow

Next test focus: multi-turn collection.

Open questions for multi-turn QA:

- Whether shared user message per turn feels fair to both sides.
- Whether Doubao capture attaches to the correct `caseId + turnIndex`.
- Whether next-turn UI should stay manual first or expose the reserved local model suggestion button.
- Whether per-turn query/citation/suggestion notes should accumulate cleanly across turns.
- Whether `newlyExposedFacts` / grader eligibility copy needs UI renaming before multi-turn use.

## 2026-06-11 Multi-Turn Capture QA Start

### Issues Found

During multi-turn Doubao collection, a single Doubao page can contain multiple user/assistant turns and therefore multiple `搜索 N 个关键词，参考 M 篇资料` evidence blocks.

Problems observed:

- The parser could pick the first evidence block on the page instead of the latest/current-turn block.
- Query expansion from a later turn appeared in the final answer preview but was not parsed into `Intent Expansion Queries`.
- Citation URLs could be partially present but not aligned with the intended turn.
- `Local Model Reply` appeared on turn 1, even though turn 1 is fixed by the eval script and should not require local model generation.

### Fix

- `server/chromeCapture.mjs`
  - Evidence block selection now prefers the last matching search/reference header in the scoped visible text, which better matches the current/latest turn on a multi-turn Doubao page.
  - Final answer extraction now filters query expansion lines and rank-only citation rows such as `1.` / `2.`.
  - Verified against current raw capture: second-turn query terms can be extracted from raw visible text.
- `web/render/collectView.js`
  - Hides `Local Model Reply` on multi-turn turn 1.
  - Keeps the reserved button only for turn 2+.

### Verification

```bash
node --check server/chromeCapture.mjs
node --check web/render/collectView.js
node --check server/storage.mjs
```

All passed.

## 2026-06-11 Update: Doubao Query/Citation Boundary Fix

### Issue

The Doubao evidence parser misread the search/citation block:

- The line `搜索 N 个关键词，参考 M 篇资料` is only the block header.
- The following quoted line contains intent/query expansion terms.
- The numbered list below that line contains citation/reference materials.

The previous parser looked for quoted queries only in the header line and stopped citation parsing when it saw the long query line, so query/citation extraction became inaccurate.

### Fix

- `server/chromeCapture.mjs`
  - Search/query extraction now finds the search-reference header, then scans the next few lines for quoted query terms.
  - Citation extraction now skips quoted query lines and starts collecting only numbered lines below the query line.
  - Numbered lines are only treated as citations inside the Doubao search/reference block.
  - Added `__testHooks` for lightweight parser checks.

### Verification

Ran a parser sample based on the real Doubao screenshot:

- queries extracted:
  - `上海静安 约会餐厅 人均350 安静 非网红`
  - `上海静安 私密约会餐厅 推荐`
  - `上海静安 优质西餐厅 人均300-400 安静 2026`
- citations extracted from the numbered list below the query line.

Checks:

```bash
node --check server/chromeCapture.mjs
node --check server/storage.mjs
node --check web/render/collectView.js
```

All passed.

## 2026-06-11 Update: Multi-Turn Doubao Follow-Up Suggestions

### Issue

Real QA on a three-turn Doubao chat page showed that the tail suggestion chips are an important visible product artifact and must be collected for both single-turn and multi-turn cases.

Observed on `https://www.doubao.com/chat/38430082190608386`:

- current-turn scoping can isolate the intended later turn by matching the shared user message;
- final answer extraction stays on the current turn;
- tail follow-up suggestions are visible as gray chip-like UI and can be captured from DOM/text;
- the search/reference header can be visible while query/reference details remain collapsed or not readable through AppleScript DOM capture.

### Fix

- `server/chromeCapture.mjs`
  - Follow-up suggestions are now extracted from visible buttons, DOM candidates, and scoped tail text.
  - Capture payload includes `followupSuggestions`.
  - Capture notes now warn when a Doubao search/reference header is visible but query/reference details were not fully expanded or readable.
- `server/storage.mjs`
  - Accepting a Doubao capture writes follow-up suggestions into `baselineFollowupSuggestionNotes`.
- `web/render/collectView.js`
  - Collection forms now include editable `Follow-up suggestion notes`.
  - Capture preview shows the number of follow-up suggestions and lists them in raw checks.
  - Multi-turn turn 1 hides `Local Model Reply`; turn 2+ keeps it as the future next-turn simulator entry.

### Current Boundary

For the tested three-turn page, follow-up suggestions were captured cleanly. Query/reference extraction still depends on whether the evidence block is expanded and readable in page text. If not, the app now warns the user to manually expand the block and capture again when those details matter.

### Verification

```bash
node --check server/chromeCapture.mjs
node --check server/storage.mjs
node --check web/render/collectView.js
```

All passed.

## 2026-06-11 Update: Doubao Search Block DOM Adapter

### Issue

Real QA on `https://www.doubao.com/chat/38429385606413826` exposed another Doubao page variant:

- the search/reference header is rendered by a dedicated `search_query_result_block`;
- generic text-based clicking can fail to expand it;
- query terms and citation rows are only readable after the block is expanded;
- previous citation merging deduplicated repeated titles, so an 18-item Doubao citation list could become 16 items;
- assistant-body follow-up text such as `需要我根据...` could be mixed with actual tail suggestion chips.

### Fix

- `server/chromeCapture.mjs`
  - Preferentially detects `[data-plugin-identifier*="search_query_result_block"]`.
  - Clicks the block's precise `.cursor-pointer` title area before collecting page text.
  - Reads expanded search block text and anchors as first-class evidence candidates.
  - Preserves citation rows by rank, including duplicate titles, and attaches URLs from matching anchors.
  - Filters assistant-body offers such as `需要我...` out of follow-up suggestions.
- `web/render/collectView.js`
  - Capture preview now includes copyable readonly textareas for:
    - intent/query expansion;
    - follow-up suggestions;
    - citation/reference text.
- `web/styles.css`
  - Makes main app text, list content, preview content, and textareas selectable/copyable.

### Verification

Current Chrome page capture produced:

- query expansion:
  - `上海徐汇好吃餐厅推荐 2026`
  - `徐汇区适合晚餐不同菜系热门餐厅`
  - `徐汇性价比高氛围感晚餐餐厅`
- 18 ranked citation rows, each with a URL;
- follow-up suggestions:
  - `徐汇区有哪些适合家庭聚餐的餐厅？`
  - `晶焱上海菜的人均价格是多少？`
  - `推荐一些徐汇区的创意融合菜餐厅`

Checks:

```bash
node --check server/chromeCapture.mjs
node --check server/storage.mjs
node --check web/render/collectView.js
```

All passed.

## 2026-06-11 Update: Local Model Reply Runtime Simulator

### Goal

Start implementing the `Local Model Reply` branch for multi-turn collection.

The product flow is:

1. Human collects both sides' previous-turn outputs.
2. Human adds the next turn.
3. Human clicks `Local Model Reply`.
4. SBS validates that the previous turn has both side outputs or caveats.
5. SBS calls local Codex with a side-blind runtime state packet.
6. Codex returns structured simulator JSON.
7. SBS validates the JSON and fills the current turn's `Shared user message`.
8. Human reviews/copies/sends the message manually.

### Implementation

- Added repo-local skill:
  - `skills/chatbot-runtime-user-simulator/SKILL.md`
  - `skills/chatbot-runtime-user-simulator/references/runtime-user-simulator-policy.md`
  - `skills/chatbot-runtime-user-simulator/schemas/simulator-output.schema.json`
- Installed/synced the skill to:
  - `/Users/bytedance/.codex/skills/chatbot-runtime-user-simulator/`
- `server/simulator.mjs`
  - Adds `suggestNextUserTurnWithLocalCodex`.
  - Calls local Codex CLI with `codex exec --sandbox read-only --output-schema`.
  - Writes raw stdout/stderr/last-message artifacts under a temp run folder.
  - Parses and validates simulator JSON.
  - Adds `latestSideResponses` to `turnExecutionState`.
- `server/index.mjs`
  - Adds `POST /api/simulator/suggest-next-turn`.
  - Validates previous turn completion before calling Codex.
  - Builds side-blind prior turns from baseline/challenger outputs as `Side A` / `Side B`.
- `server/storage.mjs`
  - Adds `applySimulatorSuggestion`.
  - Writes simulator artifacts into `run.simulatorArtifacts`.
  - Fills current turn `userMessage`, `messageSource=local_model_suggested`, branch id, exposed facts, and simulator notes when validation passes.
- `web/render/collectView.js`
  - Enables `Local Model Reply` for turn 2+.
  - Keeps turn 1 hidden.
  - Validates previous-turn side outputs/caveats before calling backend.
  - Shows loading text while generating.
- `web/app.js` / `web/api.js`
  - Save the current collection draft, then call the simulator endpoint.

### Verification

Syntax checks:

```bash
node --check server/simulator.mjs
node --check server/index.mjs
node --check server/storage.mjs
node --check web/render/collectView.js
node --check web/app.js
node --check web/api.js
```

Local Codex smoke test passed with a synthetic restaurant recommendation turn packet:

- selected branch: `t2-provide-budget-location`;
- suggested message: `我在徐汇，人均300，想安静点。`;
- validator result: `ok=true`.

### Boundaries

- SBS still does not send prompts to Doubao or challenger.
- Suggested user turns are inserted for human review and manual sending.
- This is not yet a fully automated guarded simulator; it is a local model suggestion branch with validation and replay artifacts.

## 2026-06-11 Update: Multi-Turn QA Fixes

### Issues

Three problems were found during multi-turn collection QA:

1. Second-turn Doubao capture could recognize follow-up suggestions but miss query expansion and citation details.
2. Text selection and paste inside the macOS desktop shell were unreliable.
3. A `Local Model Reply` output looked like an evaluator challenge rather than a natural restaurant-search continuation.

### Findings

- The simulator output `你怎么确认这个信息是现在有效的？如果不能确认，请明确标注不确定，并告诉我怎么核实。` came from the current eval package's `turnScripts`, not from the runtime simulator inventing a new role. In `rest-mt-002` turn 3, the selected branch was `t3-unsupported-live-status`, because the previous Doubao answer made live availability claims such as tonight availability / current reservation certainty.
- This is valid for an evidence-calibration case, but it can feel jarring when the user expects a normal restaurant-search continuation. The UI now surfaces the simulator's evaluator note and selected branch so the behavior is inspectable.

### Fix

- `server/chromeCapture.mjs`
  - Filters `searchResultBlocks` by the current scoped turn before query/reference parsing.
  - Prevents generic evidence-header clicking from clicking inside Doubao's `search_query_result_block`, avoiding open-then-close behavior after precise virtual click.
  - Fails fast when the current Chrome tab is not a Doubao page, preventing accidental Feishu/other-page capture into Doubao fields.
- `desktop/Sources/SBSDesktop/main.swift`
  - Adds a standard macOS Edit menu with Cut, Copy, Paste, Paste and Match Style, and Select All.
  - This restores normal WKWebView text editing keyboard shortcuts.
- `web/styles.css`
  - Makes main UI text, cards, buttons, lists, status pills, capture panels, inputs, and textareas selectable.
- `web/render/collectView.js`
  - Displays a `Local model note` block with the simulator evaluator note and branch id.
  - Preserves simulator metadata on newly created turns.

### Verification

```bash
node --check server/chromeCapture.mjs
node --check web/render/collectView.js
node --check server/simulator.mjs
node --check server/index.mjs
node --check server/storage.mjs
npm run desktop:build
```

All passed.

## 2026-06-10 Late Update: Shared User Message Hydration Fix

### Issue

The Collect page could show an empty `Shared user message` when the current run/case turn existed but had not been populated with the eval case's `modelFacingPrompt` or turn script message. This made the assisted Doubao capture flow unusable because the user did not know which prompt to send.

### Fix

- `web/render/collectView.js` now hydrates empty displayed turn messages from:
  - turn script `modelFacingUserMessage` for multi-turn cases;
  - eval case `modelFacingPrompt` / `initialPrompt` for single-turn cases.
- `server/storage.mjs` now also backfills an empty turn `userMessage` before starting a capture session, so backend capture answer-splitting receives the correct prompt.
- Restored the local restaurant regression package as the current package, approved all 15 cases, and started a collection run for immediate QA.

### Verification

```bash
node --check server/storage.mjs
node --check web/render/collectView.js
npm run desktop:build
curl -s http://127.0.0.1:3000/api/run/current
```

The active run has 15 case runs, and `rest-st-001.turns[0].userMessage` contains the full restaurant recommendation prompt.

## 2026-06-10 Late Update: Doubao Single-Turn Capture Cleanup

### Issue

The first real Doubao single-turn capture exposed three extraction problems:

1. Doubao side navigation and history text could enter captured content.
2. Search/citation/reference artifacts could be mixed into `finalAnswer` even though they belong in source/process notes.
3. Clicking `Accept Into Doubao Fields` multiple times appended notes repeatedly instead of replacing the previous capture import.

### Fix

- `server/chromeCapture.mjs`
  - Added navigation/UI line blockers for Doubao sidebar items such as `豆包`, `新对话`, `AI 创作`, and `历史对话`.
  - Changed citation extraction so numbered lines are only treated as reference materials when they appear after Doubao's visible `搜索...参考...资料` header.
  - Final answer extraction now filters:
    - navigation lines;
    - search header lines;
    - extracted reference titles;
    - risk notices;
    - follow-up suggestions;
    - repeated user prompt lines.
  - Numbered recommendation lines inside the actual answer are no longer blindly removed.
- `server/storage.mjs`
  - Accepting a capture now overwrites Doubao baseline fields for that turn:
    - `baselineOutput`;
    - `baselineEvidenceLevel`;
    - `baselineVisibleProcessNotes`;
    - `baselineSourceNotes`;
    - `baselineToolcallNotes`.
  - This makes repeated accept behavior idempotent and avoids duplicated old capture notes.

### Verification

```bash
node --check server/chromeCapture.mjs
node --check server/storage.mjs
```

Both passed.

## 2026-06-10 Late Update: Doubao Evidence Expansion And Intent Query Field

### Issue

Doubao may hide useful evidence behind a collapsible citation/search block. The first assisted capture path only read immediately visible text, so it could miss:

- reference materials hidden until the citation block is expanded;
- Doubao's expanded search/query terms;
- query expansion as a distinct product behavior signal.

### Decision

Treat citation/search block expansion as allowed read-only evidence capture. It does not send prompts or bypass verification; it only expands visible answer artifacts on the current user-operated Doubao page.

Query/intent expansion is not a standalone default score dimension, but it is important evidence for:

- `intentUnderstanding`: how the product reformulates the user's need;
- `evidenceGrounding`: what search/query strategy the product appears to rely on;
- later report diagnosis around product harness/search behavior.

### Fix

- `server/chromeCapture.mjs`
  - Runs a two-step Chrome capture:
    1. click visible controls whose label suggests search/reference/query/citation evidence;
    2. wait briefly and then read DOM text, anchors, buttons, hidden text content, and visible text.
  - Adds `intentExpansionQueries` to capture payload.
  - Keeps source/citation materials out of `finalAnswer`.
  - Moves query expansion out of generic visible process notes and into its own structured field.
- `server/storage.mjs`
  - Adds `baselineIntentExpansionNotes` and `challengerIntentExpansionNotes` to turn state.
  - Accepted Doubao capture writes `baselineIntentExpansionNotes` from captured query expansion terms.
- `web/render/collectView.js`
  - Shows `Intent Expansion Queries` in capture preview.
  - Adds editable `Intent / query expansion notes` to both side collection forms.

### Verification

```bash
node --check server/chromeCapture.mjs
node --check server/storage.mjs
node --check web/render/collectView.js
```

All passed.

## 2026-06-11 Update: Doubao Multi-Turn Query/Citation/Suggestion Capture Hardening

### Issue

Real QA on a two-turn Doubao restaurant page showed that multi-turn capture could mis-assign or miss visible artifacts:

- turn 1 preserved query expansion and citations, but no longer had visible follow-up suggestion chips after the user continued the conversation;
- turn 2 showed follow-up suggestions, but query expansion and citations were missed;
- sidebar/history text could re-enter previews if the active tab or turn scope was not located precisely.

### Findings

- The capture helper must scope each turn by the current user message and the next user message, not by the next search/reference header. A search/reference header belongs to the current answer and must not terminate the turn.
- Doubao's second-turn search block can be collapsed even when the answer body is visible.
- The previous `expandedNear` logic inspected ancestor text. Because the answer body contains numbered restaurant recommendations, the helper falsely treated a collapsed search block as already expanded.
- Clicking the bottom `参考 N 篇资料` action can disturb state; the reliable path is to expand the `search_query_result_block` header itself.
- The current Chrome active tab may not be Doubao during testing, so the helper now falls back to the first Doubao tab in the front Chrome window.

### Fix

- `server/chromeCapture.mjs`
  - Accepts `nextUserMessage` and scopes visible text/DOM artifacts from current turn to before the next turn.
  - Filters anchors, buttons, search blocks, evidence candidates, and follow-up candidates by DOM range.
  - Uses a stronger pointer/mouse event sequence on the search block header.
  - Stops clicking the bottom `参考 N 篇资料` entry during normal capture.
  - Fixes expanded detection to inspect the search block itself, not broad ancestors.
  - Falls back from active Chrome tab to the first Doubao tab in the front window.
- `server/index.mjs`
  - Passes the next turn's user message into Doubao capture.
- Added maintenance probes:
  - `scripts/probe-doubao-dom.mjs`
  - `scripts/test-doubao-search-click.mjs`

### Verification

On the current real Doubao page `https://www.doubao.com/chat/38429404223742722`:

- turn 1 capture returned 3 query expansion terms and 16 references;
- turn 2 capture returned 3 query expansion terms, 18 references, and 3 follow-up suggestions.

First-turn follow-up suggestions were not present in the current continued-conversation DOM. This is expected for the current black-box capture boundary; to preserve first-turn suggestions, the user should capture turn 1 before sending turn 2.

## 2026-06-11 Update: Runtime Simulator Stop Recommendation UI

### Issue

The runtime user simulator already returned `shouldStop` and `stopReason`, but the Collect UI did not expose this as a clear product interaction. If the local model judged that the multi-turn case had enough evidence, the app could silently leave an empty next user message and make the user wonder what happened.

### Fix

- `server/storage.mjs`
  - Persists simulator stop fields per turn:
    - `simulatorSelectedAction`;
    - `simulatorShouldStop`;
    - `simulatorStopReason`.
- `web/render/collectView.js`
  - Shows a green stop recommendation panel when `simulatorShouldStop` is true.
  - Explains that the user can mark the case complete or ignore the suggestion and add another turn.
  - Preserves simulator stop fields when saving the transcript.
  - Skips required shared-message/output validation for the simulator stop placeholder turn, so `Mark Complete` works after a stop recommendation.
- `web/styles.css`
  - Adds distinct styling for `simulator-stop-note`.

### Product Decision

Stop remains advisory, not mandatory. High-confidence signals such as `maxTurns` and explicit `stopCondition` should guide the suggestion, but the human evaluator keeps final control.

## 2026-06-11 Planning: Any Website Capture Adapter Builder

### Context

After Doubao assisted capture became usable for single-turn and multi-turn collection, we identified a broader reusable product capability:

> Build read-only capture adapters for new web chatbot products through visual recon, extraction planning, implementation, and QA gating.

The key product insight is that the adapter should be grounded in visible eval evidence rather than selectors alone.

### Sprint Added

Created:

- `docs/website-capture-adapter-builder-sprint.md`

The sprint defines:

- product promise and safety boundary;
- evidence fields;
- lessons from Doubao;
- proposed `chatbot-website-capture-adapter-builder` skill;
- visual recon / extraction plan / developer loop / QA gate workflow;
- engineering tasks;
- first spike recommendation.

### Current Decision

This is a planned spike, not yet a committed MVP dependency. The recommended next step is to try one non-Doubao website with a generic capture snapshot artifact before formalizing the full skill.

### Follow-up Decision

The first spike target is `dots.ai`, starting with single-turn capture.

Important framing: the single-turn spike is not for proving single-turn capture itself and not merely for supporting dots.ai. It is a controlled rehearsal for the future automated website-capture adapter-builder skill. The useful outputs are reusable workflow steps, calibration artifacts, QA criteria, and developer-loop instructions.

## 2026-06-11 Spike: dots.ai Single-Turn Capture

### Context

The user opened a completed dots.ai single-turn restaurant recommendation page and provided an additional screenshot showing a transient thinking/status bubble during generation.

Two provider-specific observations were recorded:

- dots.ai may show transient process text while generating, then hide it after completion;
- one logical assistant turn can be split into multiple consecutive assistant bubbles.

### Added

- `scripts/capture/probe-current-web-chat.mjs`
  - Generic current-Chrome-page calibration snapshot probe.
- `scripts/capture/extract-dots-ai-single-turn.mjs`
  - Temporary dots.ai single-turn extractor for spike validation.
- `artifacts/capture-calibration/2026-06-11T055841957Z-dots.ai-snapshot.json`
  - Calibration snapshot.
- `artifacts/capture-calibration/2026-06-11T060105439Z-dots-ai-single-turn-capture.json`
  - Extracted capture JSON.
- `artifacts/capture-calibration/dots-ai-single-turn-spike-notes.md`
  - Field inventory, extraction plan, QA result, and reusable skill principles.
- `artifacts/capture-calibration/dots-ai-field-mapping.md`
  - Mapping from provider-native dots.ai capture fields to SBS frontend/backend fields.

### Result

The first dots.ai extraction passed for final-state single-turn capture:

- final answer extracted;
- multiple assistant bubbles grouped into one eval turn;
- related note cards and inline quote snippets extracted as reference materials;
- follow-up question extracted;
- `内容由 AI 生成` risk notice extracted.

Known limitation:

- transient thinking/status text is not preserved in final DOM and was not captured automatically. This should become a future best-effort capture-during-generation mode, not a core collect blocker.

### Mapping Decision

The future adapter-builder skill needs a normalization mapper step between extraction and QA.

For this dots.ai capture:

- `finalAnswer` maps to `challengerOutput`;
- `referenceMaterials` and `sourceNotes` map to `challengerSourceNotes`;
- `followupSuggestions` maps to `challengerFollowupSuggestionNotes`;
- risk notices and capture caveats map to `challengerVisibleProcessNotes` until the app has a dedicated risk field;
- missing query expansion maps to an empty `challengerIntentExpansionNotes`, not inferred content;
- missing structured tool trace maps to an explicit `challengerToolcallNotes` caveat.

## 2026-06-11 Update: Capture Adapter Builder Skill And QA Gate

The dots.ai spike result is good enough to promote the method into a reusable skill design.

Added:

- `skills/chatbot-website-capture-adapter-builder/SKILL.md`
- `skills/chatbot-website-capture-adapter-builder/references/visual-recon.md`
- `skills/chatbot-website-capture-adapter-builder/references/extraction-plan.md`
- `skills/chatbot-website-capture-adapter-builder/references/qa-gate.md`
- `skills/chatbot-website-capture-adapter-builder/references/isolation-regression.md`
- `skills/chatbot-website-capture-adapter-builder/schemas/adapter-builder-output.schema.json`
- `skills/chatbot-website-capture-adapter-builder/schemas/adapter-qa-result.schema.json`
- `scripts/capture/qa-capture-result.mjs`
- `artifacts/capture-calibration/dots-ai-single-turn-qa-expectations.json`

Important product/methodology decision:

- The single-turn dots.ai spike is not for dots.ai alone. It is a controlled rehearsal for an automated `chatbot-website-capture-adapter-builder` skill.
- The future product should not depend on multi-turn human correction with Codex. It needs a strong QA gate that blocks adapter readiness when visible evidence is missed, attached to the wrong turn, or polluted into the wrong field.
- Isolation regression must not read the previous dots.ai extractor code. It should use only page evidence artifacts, field contracts, case context, and QA expectations, then compare with the known-good capture afterward.

QA gate behavior:

- `qa-capture-result.mjs` exits non-zero when blocking issues exist.
- The dots.ai known-good capture currently passes:
  - `finalAnswer`
  - `referenceMaterials`
  - `riskNotices`
  - `followupSuggestions`
  - `sourceNotes`
  - `toolcallNotes`
- `intentExpansionQueries` and `visibleProcessNotes` are marked unsupported for final-state dots.ai capture rather than inferred.

### Isolation Regression Result

Ran the new skill-style isolation regression against the same dots.ai single-turn page without reading or reusing the previous dots.ai extractor implementation.

Added temporary regression artifact:

- `artifacts/capture-calibration/isolation-dots-ai-generated-adapter.mjs`
- `artifacts/capture-calibration/2026-06-11T061756654Z-dots-ai-isolation-capture.json`

QA result:

- `qa-capture-result.mjs` passed with `adapterReadiness: ready`.
- Passed fields:
  - current user message;
  - final answer;
  - 8 reference materials;
  - risk notice;
  - follow-up suggestion;
  - source notes;
  - toolcall caveat.
- Unsupported by design:
  - intent/query expansion, because none is visible in final dots.ai page;
  - visible process notes, because transient thinking/status was not preserved in final DOM.

Diff against the conversationally-built known-good capture:

- All structured fields matched exactly except `finalAnswer`.
- `finalAnswer` differed only in whitespace/blank-line formatting.
- After whitespace normalization, `finalAnswer` matched exactly.

Conclusion:

- The skill workflow plus QA gate reproduced the useful capture result for this case.
- The main remaining improvement is paragraph/line-break preservation in generated adapters.

## 2026-06-11 Update: Challenger Website Capture UI And Adapter Registry Seed

Started the engineering closure for "SBS 4 anything" capture.

Implemented:

- `server/websiteAdapters.mjs`
  - Captures current Chrome page snapshot.
  - Detects dots.ai Web as the first challenger website adapter template.
  - Produces normalized capture payload plus QA result.
  - Unknown websites return a blocked capture with snapshot artifact and manual-fallback instructions.
- Generalized capture storage:
  - capture sessions now support `baseline` and `challenger` sides;
  - accepted capture writes into side-specific fields;
  - ready adapter captures can be recorded in a local adapter registry.
- Collect UI:
  - Challenger side now has an experimental `Calibrate Current Website` action;
  - UI explains that the feature is experimental, read-only, not guaranteed, and first capture requires human review;
  - pending capture preview shows adapter info and QA result before accepting into Challenger fields.

Architecture note:

- Provider adapters should be treated as reusable templates, not one-off scripts. Built-in templates and future user-generated local templates need a registry so the app can show which products are already capture-ready and avoid regenerating scripts repeatedly.

### UI Follow-up

Small UX fixes after first hands-on review:

- Aligned Doubao and Challenger capture button language to `Capture Current Chrome Tab`.
- Added `Test First-Time Setup` on the Challenger side.
  - It lets the user rehearse the first-time website capture review flow even when a provider such as dots.ai already has a working template.
  - It marks the adapter source as `first_time_setup_test`.
  - It does not persist/update the reusable adapter registry.
  - It is a UX rehearsal, not proof that a never-seen website can already be automatically adapted without the future Local Codex adapter-builder runner.

### Challenger Capture UX Reset

After hands-on review, the previous Challenger capture card was too noisy and effectively unusable. It exposed setup, capture, QA, adapter state, and engineering terminology all at once.

New interaction principle:

- Default Challenger collection stays manual. No automatic-capture details are shown unless the user opts in.
- Initial state shows only `Try Automated Capture`.
- After opt-in, the user enters a Challenger chat URL.
- If the URL matches an existing ready adapter template, the UI shows a simple `Capture Current Chrome Tab` action.
- If no template matches, the UI shows the first-time template setup path and `Start Template Setup`.
- After a setup/capture result exists, setup controls are hidden and the user reviews the captured fields before accepting.
- This preserves the long-term adapter-template registry direction while keeping the collection UI usable.

### Local Codex Template Setup Boundary

The first-time setup path now has a safer product boundary:

- It asks the user for the Challenger chat URL and verifies that the active Chrome tab matches that host.
- If a built-in/ready template exists, the UI shows the normal `Capture Current Chrome Tab` action without adapter-debug clutter.
- If no ready template exists, `Start Template Setup` invokes local Codex with the `chatbot-website-capture-adapter-builder` skill and a current-page snapshot.
- The local Codex result is treated as a capture-template draft plus QA/readiness report. It is not yet a guaranteed executable adapter for arbitrary websites.
- Approving a template draft can register the provider/template metadata locally, but true automatic capture still requires a concrete provider adapter implementation or a future safe generic adapter runner.
- The UI should therefore avoid promising universal one-click capture. Manual paste remains the fallback until a ready executable template exists.

### Task-Level Challenger Capture Template Binding

Follow-up after hands-on testing:

- In one evaluation task, the Challenger product should have one root capture template.
- Once the user accepts a ready Challenger website capture/template, SBS now binds that template to the active task's Challenger config.
- Other cases in the same task should then behave like Doubao capture: no repeated URL input, no repeated template checking, only `Capture Current Chrome Tab`.
- This keeps the per-case collection loop light after the first successful setup while preserving manual paste as fallback.

Implementation notes:

- `server/storage.mjs` now stores `arena.challenger.captureTemplate` on the active evaluation task when a ready Challenger capture is accepted.
- `web/render/collectView.js` reads the active task binding and switches Challenger capture UI into a compact capture-only mode.
- Collect-page background sync now watches run/task/adapter signatures, not only capture-session signatures, so simulator updates and task template binding changes refresh reliably.

### Runtime User Simulator Refresh Fix

Observed issue:

- `Local Model Reply` could complete and show the local model's note/action, while the shared user-message input did not visibly update.

Root cause and fix:

- The simulator artifact did contain the intended `modelFacingUserMessage`, so the model side was not the main failure.
- Frontend background sync only watched capture-session changes, which could miss run/case updates.
- The backend now also has a fallback that resolves the next user message from the selected branch, current script turn, existing turn seed, or allowed adaptive move if the direct simulator message is missing.
- The frontend sync now refreshes when `run.updatedAt` changes.

### Runtime Simulator Should Not Replay Fixed Sequence

Follow-up after testing multi-turn `Local Model Reply`:

- The simulator was producing the same message as the eval-set generator's prewritten turn because `currentScriptTurn.modelFacingUserMessage` was visible in the runtime state packet.
- Product decision: clicking `Local Model Reply` means the user wants runtime user simulation based on actual prior side outputs, not playback of the prewritten script.

Implemented:

- `server/simulator.mjs` now redacts prewritten fixed-sequence wording from `currentScriptTurn` and `currentTurnExposureDelta` before invoking local Codex.
- The simulator prompt explicitly says Local Model Reply is not a fixed script executor.
- `fixed_sequence` is no longer allowed by the runtime simulator output schema.
- The storage fallback no longer copies `currentScriptTurn.modelFacingUserMessage` into the turn if the simulator omits a message.

Validation:

- A state-packet smoke check for `rest-mt-001` turn 2 confirmed the prompt no longer contains the old fixed message: `我在上海徐汇，人均 250 左右，想安静一点，最好别太辣。`

### Data-Loss Guard For New Evaluation

Incident:

- After creating or experimenting with a new evaluation task, the active restaurant task still existed but the current package, curation, and run files disappeared.
- Root cause: `createEvaluationTask()` called `clearCurrentWorkspaceArtifacts()`, which physically deleted `data/active-project.json`, `data/packages/current.json`, `data/packages/current.validation.json`, `data/curation/current.json`, `data/runs/current.json`, and the current report.
- This was unsafe because the current MVP still uses a global current workspace instead of task-scoped package/run storage.

Fix:

- Removed the destructive clear call from `createEvaluationTask()`.
- Removed the `clearCurrentWorkspaceArtifacts()` function and its `rmSync` import entirely.
- Added a read-time guard in `getCurrentState()`: if `activeProject.activeTaskId` does not match the currently selected task, the API returns no package/curation/run for that task without deleting files.

Implication:

- Creating a new task no longer destroys the previous task's current package/run files.
- New tasks will not accidentally display another task's package because mismatched workspace data is hidden at read time.
- Longer-term fix remains task-scoped storage: each evaluation task should own its package, curation, run, report, and adapter binding paths.

### Package Generation Progress Monitor

Implemented after user asked whether local Codex output should be visible on the Package page:

- Added background package-generation jobs instead of a blocking request.
- Package page now shows a compact loading/progress area with status, phase, elapsed time, recent local Codex progress lines, warning/error, and final success/fallback state.
- The UI does not stream raw Codex output directly. It filters and compacts logs so users see meaningful progress without huge prompt dumps or unrelated skill-loader warnings.
- Local Codex package generation still takes several minutes for 15 cases; the monitor makes that wait legible.
- Added task-bound package installation so a background job writes back to the task it was started from, even if the user switches tasks while it runs.

Validation:

- `node --check` passed for updated server and web modules.

### Package Generation Validator Repair

Observed from the first successful local Codex generation for `装修规划`:

- Generation completed as `local_codex_generation`, not fallback.
- The package had 15 cases, 3 turn scripts, and 7 rubrics.
- Validation initially failed with consistency-only errors:
  - missing `no_unapproved_exposure` in multi-turn `preSendValidation`;
  - rubric `appliesToCaseTypes` included case types not represented by `caseRefs`;
  - one human sampling recommendation sounded too mandatory.

Implemented:

- Increased local Codex package-generation timeout to 20 minutes.
- Added validator contract reminders to the generation prompt.
- Added deterministic post-generation contract repair that fixes these mechanical consistency issues without changing case intent or model-facing prompts.
- Added `contract-repair.json` as a trace artifact.
- Repaired the current `装修规划` package in place; validation is now `ok: true`.

Validation:

- Repair regression on the real generated package produced `0 schemaErrors`, `0 consistencyErrors`, and `0 warnings`.

### Capture Session Lazy CaseRun Initialization

Incident:

- On the `求职面试经验` task, both Doubao and challenger `Capture Current Chrome Tab` failed with `Unknown or unstarted caseId: jobint-st-001`.
- The package and curation were valid and all 15 cases were approved, but `runs/current.json` still had `status: not_started` and no persisted `caseRuns`.
- The frontend Collect page can render display-only case runs from approved cases, while the backend capture endpoint previously required an already persisted `caseRun`.

Fix:

- `startCaptureSession()` now mirrors manual collection updates: it resolves the eval case from the current package and lazily creates the missing `caseRun` before starting capture.
- Capture start now also marks the run `in_progress`.

Validation:

- A direct storage smoke test started and discarded a Doubao capture session for `jobint-st-001`; the user message was seeded correctly from the eval package.

### Runtime Simulator Stop Handling

Incident:

- During a multi-turn interview case (`jobint-mt-006`), clicking `Local Model Reply` on turn 3 produced no visible user prompt.
- The local simulator actually returned `selectedAction: stop` / `shouldStop: true` because the case had `maxTurns: 2`, but its synthetic stop branch id did not exist in `branchRules`.
- The validator rejected the otherwise correct stop output, so storage recorded only a failed artifact and the UI kept an empty prompt without a clear stop message.

Fix:

- Simulator validation now treats `selectedAction: stop` or `shouldStop: true` as a valid terminal result without requiring a real branch rule.
- The server short-circuits simulator requests when `turnIndex > maxTurns`, writes a deterministic stop artifact, and avoids launching local Codex unnecessarily.
- The frontend `Local Model Reply` handler now re-renders in a `finally` block so button/loading state recovers even if the simulator request fails.

Validation:

- A local API smoke test on `jobint-mt-006` turn 3 returned HTTP 200 and wrote `simulatorShouldStop: true` with `stopReason: max_turns_stop_condition_met`.

### Runtime Simulator Extra-Turn Relaxation

Follow-up:

- The hard `maxTurns` stop was too restrictive. If a human evaluator manually adds another turn and clicks `Local Model Reply`, the simulator should treat that as an explicit request to consider continuing the conversation.

Implemented:

- Removed the server-side shortcut that automatically stopped any simulator request beyond planned `maxTurns`.
- `buildTurnExecutionState()` now marks `isHumanRequestedExtraTurn` and adds an `extraTurnPolicy` telling the simulator that `maxTurns` and the original stop condition are guidance, not a hard gate.
- The prompt now instructs the simulator not to stop merely because the planned script ended; it should generate a concise fair follow-up if another turn can still reveal meaningful differences.
- Stop remains valid when the simulator genuinely believes another user message would not improve the evaluation.

Data protection:

- Before this change, the current interview collection was backed up to `artifacts/backups/collection-safe/2026-06-12T0816-interview-collection/` and `artifacts/backups/collection-safe/2026-06-12T0816-interview-collection.tar.gz`.
- The backup manifest records that the current persisted run contains 13/15 case runs and is missing `jobint-mt-010` and `jobint-mt-011` at backup time.

### Chatbot SBS Grader Skill Scaffold

Implemented the first full scaffold for the reusable `chatbot-sbs-grader` skill.

Created:

- `skills/chatbot-sbs-grader/SKILL.md`
- `skills/chatbot-sbs-grader/agents/openai.yaml`
- 8 reference files for evidence cleaning, judgment, dimensions, case-type scoring, aggregation, report contract, quality audit, and examples
- 4 schemas for cleaned evidence, case judgments, grading report, and grader quality audit
- 4 scripts: deterministic preclean plus lightweight validators

Real-case validation:

- Used the current `求职面试经验` task as the first fixture.
- Input package contains 15 cases; current run contains 13 collected cases.
- Missing cases are `jobint-mt-010` and `jobint-mt-011`, preserved as coverage caveats.
- Generated `data/tasks/task-2026-06-12T064110798Z/grader/cleaned-evidence.preclean.json`.
- `validate_cleaned_evidence.mjs` passed with the expected missing-case warning.

Important finding:

- `jobint-mt-009` Doubao turn 3 captured a browser sidebar/history prefix in the final answer. `deterministic_preclean.mjs` now detects repeated conversation-title/history prefixes, strips them from `cleanFinalOutput`, and preserves them in `removedNoise`.

### Grader Frontend Pipeline Integration

Implemented the first app-facing connection for the `chatbot-sbs-grader` skill.

Product decision:

- The user should not click once for evidence cleaning and again for report generation.
- The app now exposes one flow: `Run Review + Report`.
- Backend first produces cleaned evidence for Review, then immediately continues to case judgments, aggregation, quality audit, and report generation in the same background job.
- Review can become useful as soon as `cleaned-evidence.json` is written, while the final report continues running.

Backend added:

- `server/graderRunner.mjs`
  - task-scoped grader paths under `data/tasks/<taskId>/grader/`;
  - deterministic pre-clean invocation;
  - local Codex invocation for evidence cleaning;
  - local Codex invocation for full report generation;
  - validation for cleaned evidence, case judgments, and grading report;
  - input hash / stale-artifact detection;
  - trace files for clean and report stages.
- `server/graderJobs.mjs`
  - in-memory background grader jobs;
  - phase/log tracking;
  - latest logs shown first;
  - `succeeded_with_warnings` status when validation warnings remain.
- New APIs:
  - `GET /api/grader/current`
  - `POST /api/grader/run-job`
  - `GET /api/grader/job`
  - `POST /api/grader/review-notes`

Frontend added:

- `web/render/reviewView.js`
  - cleaned evidence summary;
  - per-case readiness;
  - case/turn/side cleaned evidence;
  - evidence-channel counts;
  - human review hints;
  - local Codex progress/log panel;
  - `communicationFit` scoring selector.
- `web/render/reportView.js`
  - executive verdict;
  - dimension scoreboard;
  - key reasons;
  - challenger optimization plan;
  - case type breakdown;
  - failure/red-line sections;
  - case table;
  - markdown/json download from loaded artifacts.
- `web/app.js`, `web/api.js`, and `web/state.js` now route Review/Report and poll grader jobs.

Skill contract tweak:

- `skills/chatbot-sbs-grader/SKILL.md` now explicitly says product-mode invocations should write complete artifacts to provided `outputRefs`, while the final assistant message returns only a compact manifest.
- This does not change scoring logic; it only makes frontend/backend integration reliable.

Validation:

- `node --check` passed for `server/graderRunner.mjs`, `server/graderJobs.mjs`, `server/index.mjs`, and `web/app.js`.
- Local server started at `http://127.0.0.1:3000`.
- `GET /api/health` passed.
- `GET /api/grader/current` successfully returned the current interview task's existing dry-run report artifacts.
- A fresh product-mode `Run Review + Report` job completed on `task-2026-06-12T064110798Z`.
- The job wrote:
  - `cleaned-evidence.json`
  - `cleaning-summary.md`
  - `case-judgments.json`
  - `grading-report.json`
  - `grader-quality-audit.json`
  - `report.md`
  - `report.zh.md`
  - `validation-results.json`
  - invocation traces for clean and report stages.
- Validators passed:
  - cleaned evidence: OK, with expected missing-case warning for `jobint-mt-010` and `jobint-mt-011`;
  - case judgments: OK;
  - grading report: OK.
- Backend API summary after restart:
  - `hasCleanedEvidence: true`
  - `hasReport: true`
  - `stale: false`
  - `executiveVerdict.verdict: baseline_wins`.
- Follow-up fix: Local Codex log filtering was tightened so frontend progress does not show large JSON/source-code chunks.

Known remaining work:

- Run a fresh product-mode `Run Review + Report` job to produce real `cleaned-evidence.json`.
- Add raw-vs-cleaned toggle and editable review notes in Review.
- Add artifact bundle download.
- Improve exact evidence refs from case-level refs to `caseId/turnIndex/side/field/span` where available.

## 2026-06-13 Visual Style Pass

Intent:

- Make the SBS desktop/web workbench feel more like a polished user product while preserving its utilitarian evaluation-workbench character.
- Keep this pass presentation-only. No task data, capture logic, Local Codex logic, grader logic, PDF export logic, or skill prompts were changed.

Rollback point:

- Before editing, a rollback archive was created at `artifacts/backups/ui-visual-style/20260613-before-visual-style-pass.tar.gz`.
- Contents captured: `web/`, `docs/dev-diary.md`, `docs/frontend-implementation-sprint.md`, and `server/pdfExporter.mjs`.

Files changed:

- `web/styles.css`
  - refreshed global color tokens toward a quieter gray/teal workbench palette;
  - added soft shadows and focus rings;
  - made the app header and left navigation feel more structured;
  - added a left accent marker for active navigation;
  - polished cards, metrics, evidence snippets, case briefs, capture panels, tables, and report blocks;
  - improved form, textarea, and disclosure-section visual consistency.
- `docs/dev-diary.md`
  - recorded rollback point and visual-style work.
- `docs/frontend-implementation-sprint.md`
  - visual polish remains tracked as Phase 8 / productization follow-up.

Validation:

- Local dev server started successfully with `npm run dev`.
- `node --check server/index.mjs` passed.
- Static checks found the intended style hooks in `web/styles.css`, including focus-visible states, active nav indicator, disclosure-section open styling, capture textarea sizing, dark preview blocks, and accent evidence borders.
- Browser screenshot automation was attempted; system Chrome was blocked by macOS process permissions and bundled Playwright browsers were not installed in this environment, so final visual QA should be done manually in the Mac app after refresh/reopen.

## 2026-06-13 Product Logo Pass

Intent:

- Add a lightweight product identity for SBS 4 Any Agent using the user's reference direction: a restrained midpoint between a simple prism-line mark and a more luminous prism/ray image.
- Preserve product behavior and avoid broader visual churn.

Rollback point:

- Before editing, a rollback archive was created at `artifacts/backups/logo-pass/20260613-before-logo-pass.tar.gz`.

Design direction:

- Name: Prism Arena.
- Meaning:
  - left light ray = same task prompt entering the arena;
  - prism = SBS evaluation harness / evidence lens;
  - colored rays = dimension-level outputs such as intent, outcome, evidence, risk, and experience;
  - dark tile = desktop icon contrast and a more memorable portfolio identity.

Files changed:

- `web/assets/sbs-prism-mark.svg`
  - square mark for header and favicon.
- `web/assets/sbs-prism-logo.svg`
  - full horizontal logo asset for future use.
- `scripts/desktop/generate_logo_assets.mjs`
  - dependency-free generator for PNG icon sizes from the same Prism Arena concept.
- `web/assets/generated/*`
  - generated PNG sizes and `SBSPrism.icns` for the desktop development shell.
- `web/index.html`
  - added favicon/apple-touch-icon links and header brand mark.
- `web/styles.css`
  - added minimal header logo styling only.
- `scripts/desktop/open_dev_app.sh`
  - copies `SBSPrism.icns` into the app bundle and writes `CFBundleIconFile`.

Validation:

- `node --check scripts/desktop/generate_logo_assets.mjs` passed.
- `node --check server/index.mjs` passed.
- Generated PNG app icon was visually inspected.
- `web/assets/generated/SBSPrism.icns` was created successfully.
- Reopened the desktop dev app via `npm run desktop:dev`.
- Verified built app bundle contains `Contents/Resources/SBSPrism.icns` and `Info.plist` has `CFBundleIconFile => SBSPrism`.

## 2026-06-13 Desktop DMG Release Packaging

Goal:

- Create a macOS `.dmg` packaging path suitable for local testing now and future GitHub distribution after Developer ID signing/notarization is configured.
- Avoid asking end users to solve signing through terminal workarounds.

Key product/release decision:

- A GitHub-distributed macOS app that opens cleanly after normal double-click installation requires Apple Developer ID signing and notarization.
- This machine currently has no valid Developer ID signing identity, so the generated package is ad-hoc signed and suitable for local/internal testing only.

Engineering changes:

- `desktop/Sources/SBSDesktop/main.swift`
  - Release app can now run from bundled resources.
  - If the bundle contains `Contents/Resources/app`, the app copies that runtime into `~/Library/Application Support/SBS 4 Any Agent/runtime` and starts the local Node server from there.
  - This prevents runtime writes from modifying the signed `.app` bundle.
  - The app can use a bundled Node binary at `Contents/Resources/node/bin/node`.
- `scripts/desktop/build_release_dmg.sh`
  - New release packager.
  - Builds the Swift desktop shell.
  - Bundles Node, web app, server, schemas, skills, safe starter data, and icon assets.
  - Signs nested Node, desktop executable, and `.app`.
  - Creates a `.dmg` with the app and an `/Applications` shortcut.
  - Auto-detects `Developer ID Application` identity when available.
  - Supports `SBS_SIGN_IDENTITY` and `SBS_NOTARY_PROFILE` for formal signing + notarization.
- `package.json`
  - Added `npm run desktop:release`.
- `docs/desktop-release-signing.md`
  - Documents local test mode vs public distribution mode.

Artifacts:

- Generated DMG: `dist/SBS-4-Any-Agent-0.1.0.dmg`
- Size: about 86 MB.

Validation:

- Release script completed successfully when run with system permission for `hdiutil`.
- `codesign --verify --deep --strict` passed for `.build/release/SBS 4 Any Agent.app`.
- DMG mounted successfully.
- Mounted DMG contains:
  - `SBS 4 Any Agent.app`
  - `Applications -> /Applications`
- App bundle contains:
  - `Contents/Resources/node/bin/node`
  - `Contents/Resources/app`
  - `Contents/Resources/SBSPrism.icns`

Known limitation:

- Current DMG is ad-hoc signed because no Developer ID Application certificate exists on this machine. It is not yet a clean public GitHub release artifact.

## 2026-06-13 Icon Sharpening Pass

Intent:

- Replace the first Prism app icon with a cleaner version matching the user's preferred screenshot style.
- Use the same visual direction both inside the product and outside as the desktop app icon.
- Fix the low-resolution feel by generating from a 1024px source instead of relying on a small screenshot or overly blurry glow.

Rollback point:

- `artifacts/backups/logo-pass/20260613-before-icon-sharpen-pass.tar.gz`

Changes:

- `web/assets/sbs-prism-mark.svg`
  - Replaced with a compact dark rounded-square mark, smaller prism, thinner rays, and lighter glow.
- `web/assets/sbs-prism-logo.svg`
  - Updated to the same compact mark style.
- `scripts/desktop/generate_logo_assets.mjs`
  - Adjusted generated PNG icon geometry:
    - transparent rounded-corner tile;
    - smaller prism;
    - less glow;
    - crisper line widths;
    - source rendered at 1024px and downsampled through the iconset pipeline.
- `web/assets/generated/*`
  - Regenerated PNG sizes and `SBSPrism.icns`.

Validation:

- Visually inspected `web/assets/generated/sbs-prism-app-icon.png`.
- Reopened dev desktop app with the updated icon.
- Rebuilt release DMG so `dist/SBS-4-Any-Agent-0.1.0.dmg` also contains the updated icon.
- Confirmed dev app and release app bundles both contain the regenerated `SBSPrism.icns`.
- `codesign --verify --deep --strict` passed for the release app.
- `node --check scripts/desktop/generate_logo_assets.mjs` passed.

## 2026-06-13 Icon Thick-Line Pass

Intent:

- The compact icon looked too low-contrast at header size because the prism and rays were too thin.
- Keep the preferred rounded dark tile composition, but make all meaningful lines much heavier.

Changes:

- `web/assets/sbs-prism-mark.svg`
  - Input ray increased from about 2.2 to 4.1 stroke width.
  - Prism edge increased from 2.7 to 4.5.
  - Internal prism strokes increased from 1.45 to 2.35.
  - Output rays increased from 2.3 to 4.2.
- `web/assets/sbs-prism-logo.svg`
  - Matched the same thicker line system.
- `scripts/desktop/generate_logo_assets.mjs`
  - Generated icon source increased:
    - prism edge from 6 to 11;
    - internal prism lines from 3 to 6;
    - output rays from 5 to 9;
    - input ray from 4 to 8;
    - center node from 12px to 18px at 1024 source scale.
- Regenerated `web/assets/generated/SBSPrism.icns` and PNG icon sizes.
- Reopened dev desktop app.
- Rebuilt `dist/SBS-4-Any-Agent-0.1.0.dmg`.

Validation:

- Inspected regenerated 1024px app icon.
- `node --check scripts/desktop/generate_logo_assets.mjs` passed.
- `codesign --verify --deep --strict` passed for the release app.
- Confirmed dev app and release app bundles both contain the new `SBSPrism.icns`.

## 2026-06-13 Equilateral Icon Apply Pass

Intent:

- Apply the user-approved final icon direction: a shorter, wider near-equilateral prism with much heavier prism lines.
- Keep product visuals and desktop packaging aligned, so the in-app mark, horizontal logo, app bundle icon, and DMG all use the same final brand mark.

Rollback point:

- `artifacts/backups/logo-pass/20260613-before-equilateral-icon-apply.tar.gz`

Approved candidate:

- `artifacts/logo-candidates/equilateral-prism-v1-candidate.png`
- Source SVG: `artifacts/logo-candidates/equilateral-prism-v1.svg`

Changes:

- `web/assets/sbs-prism-mark.svg`
  - Replaced the taller prism with the approved shorter/wider prism.
  - Preserved the dark rounded tile and multi-ray output language.
  - Kept line weights high enough for the header-size icon.
- `web/assets/sbs-prism-logo.svg`
  - Updated the horizontal logo mark to match the final standalone icon.
- `scripts/desktop/generate_logo_assets.mjs`
  - Updated generated desktop icon geometry to the approved near-equilateral prism:
    - prism source points: `512,272`, `232,732`, `792,732`;
    - outer prism edge width: `22` at 1024 source scale;
    - internal prism width: `12`;
    - output rays width: `17`;
    - input ray width: `16`;
    - center node enlarged to `28`.
- `web/assets/generated/*`
  - Regenerated PNG sizes and `SBSPrism.icns`.
- `.build/desktop-dev/SBS 4 Any Agent.app`
  - Reopened dev desktop app with the final icon.
- `dist/SBS-4-Any-Agent-0.1.0.dmg`
  - Rebuilt final DMG with the final icon.

Validation:

- Visually inspected `web/assets/generated/sbs-prism-app-icon.png`.
- `node --check scripts/desktop/generate_logo_assets.mjs` passed.
- `npm run desktop:dev` reopened the desktop app.
- `npm run desktop:release` rebuilt the DMG.
- `codesign --verify --deep --strict --verbose=2 ".build/release/SBS 4 Any Agent.app"` passed.
- Confirmed these files exist and are current:
  - `web/assets/generated/SBSPrism.icns`
  - `.build/desktop-dev/SBS 4 Any Agent.app/Contents/Resources/SBSPrism.icns`
  - `.build/release/SBS 4 Any Agent.app/Contents/Resources/SBSPrism.icns`
  - `dist/SBS-4-Any-Agent-0.1.0.dmg`

Known limitation:

- The DMG is still ad-hoc signed because this machine has no Developer ID Application certificate. It is usable for local testing, but a clean public GitHub distribution still needs Developer ID signing and notarization.

## 2026-06-13 Inner Header Icon PNG Fix

Intent:

- The desktop/Dock icon looked correct, but the in-app header mark rendered as an almost black tile in the macOS app.
- Keep the approved final icon artwork, but make the in-product header use the same verified PNG asset as the desktop icon pipeline instead of the small SVG mark.

Rollback point:

- `artifacts/backups/logo-pass/20260613-before-inner-png-icon-fix.tar.gz`

Changes:

- `web/index.html`
  - Changed the favicon from `/assets/sbs-prism-mark.svg` to `/assets/generated/sbs-prism-app-icon-256.png`.
  - Changed the header `.brand-mark` source from `/assets/sbs-prism-mark.svg` to `/assets/generated/sbs-prism-app-icon-256.png`.

Reasoning:

- The outside app icon uses generated PNG/ICNS and was already visually correct.
- The inside app mark used SVG, which rendered the dark rounded tile but failed to visibly show the prism/rays in the desktop WKWebView context.
- Reusing the generated PNG keeps inside/outside branding visually consistent and avoids SVG filter/small-stroke rendering differences.

Validation:

- Reopened the dev desktop app with `npm run desktop:dev`.
- Rebuilt `dist/SBS-4-Any-Agent-0.1.0.dmg` with `npm run desktop:release`.
- `codesign --verify --deep --strict --verbose=2 ".build/release/SBS 4 Any Agent.app"` passed.

Known limitation:

- DMG remains ad-hoc signed until a Developer ID Application certificate and notarization profile are available.

## 2026-06-14 Guided Demo Decision Layer

Intent:

- Address the product critique that the app exposed too much internal pipeline first: package, curation, capture, grader, artifacts, QA, adapters.
- Make the strongest portfolio/product value visible before the advanced workbench:
  - in a concrete task space, compare a challenger against the strongest baseline;
  - use local Codex to automate high-cost eval-set, capture-assist, simulator, cleaning, grading, and report steps;
  - rely on strong eval-generation and grader/report skills rather than generic prompts.

Branch:

- `codex/guided-demo-layer`

Rollback point:

- `artifacts/backups/product-pass/20260614-before-guided-demo-layer.tar.gz`

Changes:

- `web/render/tasksView.js`
  - Added a top-level decision hero explaining the task-space SBS philosophy.
  - Added a Featured Demo card that surfaces:
    - task space;
    - eval case count;
    - collection progress;
    - report readiness;
    - SBS verdict summary;
    - decision question;
    - baseline and challenger.
  - Added primary `View SBS Verdict` and secondary `Open Workbench` actions for real tasks.
  - Added a static preview state for fresh installs with no task data, so reviewers still see the core product narrative.
  - Kept the existing task list as the Advanced Workbench.
- `web/app.js`
  - Added an `onOpenReport` handler from Tasks so the demo card can jump directly to the Report view.
- `web/styles.css`
  - Added styles for the decision hero, guided flow, capability cards, soft pills, and Featured Demo layout.
- `PROJECT_BRIEF.md`
  - Recorded the new low-friction demo / decision layer as product direction above the internal workbench.
- `dist/SBS-4-Any-Agent-0.1.0.dmg`
  - Rebuilt after the UI change.

Validation:

- `node --check web/render/tasksView.js` passed.
- `node --check web/app.js` passed.
- `npm run desktop:dev` opened the macOS app.
- `npm run desktop:release` rebuilt the release DMG.
- `codesign --verify --deep --strict --verbose=2 ".build/release/SBS 4 Any Agent.app"` passed.

Known limitation:

- This pass does not add a full bundled completed demo dataset. Fresh installs show a static Featured Demo preview plus the existing New Evaluation path. A later pass can ship a safe sample task package/report if we want the demo buttons to open a fully populated report out of the box.

## 2026-06-14 Report Markdown Table Render Fix

Intent:

- Fix exported report PDFs showing raw Markdown table syntax such as `| 类型 | 影响方 | ... |` instead of rendered tables.

Rollback point:

- `artifacts/backups/report-pass/20260614-before-markdown-table-render-fix.tar.gz`

Root cause:

- `server/pdfExporter.mjs` uses a lightweight Markdown-to-HTML renderer for the document-grade PDF source.
- The renderer only recognized table separator rows with at least three dashes, such as `|---|---|`.
- Local LLM reports commonly emitted compact separators such as `|-|-|-|-|` and alignment rows such as `|-|-:|-:|-|-|`.
- Those rows are acceptable enough for many Markdown renderers, but our renderer treated the whole table block as plain paragraphs.

Changes:

- `server/pdfExporter.mjs`
  - Added `isMarkdownTableSeparator()` that parses separator cells and accepts one or more dashes with optional `:` alignment markers.
  - Added `normalizeTableRows()` so rows with missing cells are padded rather than breaking table layout.
  - Existing report markdown now renders into real HTML `<table>` elements without requiring the grader to regenerate the report.
- `skills/chatbot-sbs-grader/scripts/validate_report_markdown.mjs`
  - Added a light malformed-table warning path while accepting compact separator rows.

Validation:

- `node --check server/pdfExporter.mjs` passed.
- `node --check skills/chatbot-sbs-grader/scripts/validate_report_markdown.mjs` passed.
- Regenerated the active 面试 report PDF through `exportCurrentGraderPdf()`.
- Verified `data/tasks/task-2026-06-12T064110798Z/grader/report.print.html` contains real `<table>` markup for:
  - 总分与维度分;
  - 关键证据摘录;
  - Case 类型拆解;
  - 失败簇与红线;
  - Case 明细表.
- Rebuilt `dist/SBS-4-Any-Agent-0.1.0.dmg`.
- `codesign --verify --deep --strict --verbose=2 ".build/release/SBS 4 Any Agent.app"` passed.

Known limitation:

- This fixes PDF/export rendering. It does not rewrite old markdown source files; compact Markdown table syntax remains in source artifacts, but now renders correctly.

## 2026-06-14 Public Release Prep Hygiene

Intent:

- Prepare a public-facing branch without disturbing the local showcase data.
- Address release-review concerns:
  - `package.json` looked private/internal;
  - local runtime data, DMGs, calibration artifacts, backups, and `.DS_Store` should not enter a public repository;
  - installation/runtime requirements still need README/INSTALL documentation in a later pass.

Branch:

- `codex/public-release-prep`

Rollback point:

- `artifacts/backups/public-release/20260614-before-public-release-prep.tar.gz`

Changes:

- `package.json`
  - Removed `"private": true`.
  - Added description, Node engine, macOS OS hint, and keywords.
  - Did not add npm publish config because the product distribution target is currently GitHub Releases / DMG, not npm package publishing.
  - Did not choose a license yet; that remains a product/legal decision before public release.
- `.gitignore`
  - Added `.DS_Store` and `**/.DS_Store`.
  - Added `dist/` so DMG files are released via GitHub Releases instead of committed to source.
  - Added `artifacts/` to keep local calibration logs, backups, generated candidates, and debug outputs private.
  - Kept `data/` ignored so the current 求职 showcase stays local and does not leak into a public repo.
  - Added dependency/cache/log/temp ignores.

Validation:

- `package.json` parsed successfully with Node.
- `git status --short --ignored` confirms:
  - source folders remain visible;
  - `.DS_Store`, `.build/`, `artifacts/`, `context-sync-bundle/`, `data/`, and `dist/` are ignored.

Known limitation:

- No README/INSTALL docs were written in this pass per user request.
- No GitHub remote exists yet in this local repo, so a public repository URL cannot be produced until the repo is created or a remote is configured.

## 2026-06-15 Local Codex Generation Failure In Packaged Runtime

Intent:

- Debug a newly created `deepseek vs Doubao` research-analysis evaluation task whose eval set generated almost instantly with very coarse cases.
- Confirm whether the full `chatbot-eval-set-generator` skill was used.

Finding:

- The generated package was not produced by the skill.
- The active task package had `sourceType: fallback_scaffold_after_local_codex_failure`.
- The package cases used `fallback-...` case IDs and carried a fallback limitation trace.
- The original Local Codex stderr was:
  - `Not inside a trusted directory and --skip-git-repo-check was not specified.`

Root cause:

- The packaged macOS app runs from the copied runtime under `~/Library/Application Support/SBS 4 Any Agent/runtime`.
- That runtime is intentionally not a Git checkout/trusted repo.
- Local Codex refused to run there unless `--skip-git-repo-check` is passed.
- The backend then silently installed a deterministic fallback scaffold, which is structurally valid but much weaker than the full eval generator skill output.

Changes:

- Added `--skip-git-repo-check` to all repo-local Codex invocations:
  - `server/packageGenerator.mjs`
  - `server/graderRunner.mjs`
  - `server/simulator.mjs`
  - `server/adapterBuilder.mjs`
- Also added `--ignore-user-config` and `--ephemeral` to simulator and adapter-builder invocations for consistency with package generation and grader jobs.
- Changed package generation failure handling so Local Codex failure no longer installs a fallback eval package automatically:
  - async generation jobs now end with `status: failed`;
  - existing task data is left unchanged;
  - users should retry after the underlying issue is fixed.
- The older deterministic fallback builder remains available in code for manual/template fallback experiments, but it is no longer used as silent generation success.

Validation:

- `node --check` passed for:
  - `server/packageGenerator.mjs`
  - `server/graderRunner.mjs`
  - `server/simulator.mjs`
  - `server/adapterBuilder.mjs`
  - `server/packageGenerationJobs.mjs`
  - `server/index.mjs`

Follow-up:

- Sync the fixed server files into the current Application Support runtime before testing the already-installed Mac app.
- Regenerate the DeepSeek vs Doubao package; the previous fallback package should not be used for serious collection.

## 2026-06-15 Publish Real Showcase Run As Seed Data

Intent:

- Restore the completed real `求职面试经验：小红书点点 vs Doubao` SBS run in the public GitHub/DMG release.
- Let first-time users see a full end-to-end artifact: generated eval cases, approved curation, real collected outputs, cleaned review artifacts, grader output, and report/PDF.

Decision:

- Do not re-include the entire local `data/` directory in Git.
- Do not convert the run into a synthetic/mock demo.
- Publish only the completed showcase task as explicit seed data under `seed-data/featured-demo/tasks/`.
- Keep the task as a real completed run. The release task index marks it `report_ready` so users can open it directly and inspect the result.

Included showcase artifacts:

- `package/current.json` with 15 real eval cases from local Codex generation.
- `curation/current.json` with all 15 cases approved.
- `runs/current.json` with 13 completed collected case runs.
- Grader artifacts:
  - `cleaned-evidence.json`
  - `cleaning-summary.md`
  - `case-judgments.json`
  - `grading-report.json`
  - `grader-quality-audit.json`
  - `report.md`
  - `report.zh.md`
  - `求职面试经验-小红书点点-vs-Doubao-SBS-report.pdf`

Changes:

- Added `seed-data/featured-demo/tasks/task-2026-06-12T064110798Z/` copied from the real local completed run, excluding `.DS_Store`.
- Added `seed-data/featured-demo/tasks/index.json` containing only the showcase task.
- Added `seed-data/featured-demo/tasks/active-task.json` pointing to the showcase task.
- Updated `scripts/desktop/build_release_dmg.sh` so release builds copy `seed-data/featured-demo/tasks` into the app runtime `data/tasks` when present; otherwise they keep an empty task index.

Validation:

- Seed check:
  - 15 eval cases;
  - 15 approved cases;
  - 13 collected case runs;
  - 13 completed case runs;
  - cleaned evidence, case judgments, grading report, Markdown report, Chinese Markdown report, and PDF report all present.
- `bash -n scripts/desktop/build_release_dmg.sh` passed.

Important future note:

- `seed-data/featured-demo/` is intentional public showcase content, not local runtime data. Do not delete it during public-release hygiene unless replacing it with a better completed showcase run.

## 2026-06-15 Task-Level Codex Model Selector + Task Deletion

Intent:

- Let users choose whether a task should run local Codex on `gpt-5.4` or `gpt-5.5`.
- Let users delete abandoned/failed local evaluation tasks without touching the built-in showcase.

Decision:

- Store the model choice at task level under `arena.localCodexModel`, defaulting to `gpt-5.5`.
- Use the chosen model consistently across all local Codex-backed stages for that task:
  - eval package generation
  - runtime user simulator
  - challenger website capture-template setup
  - grader/report pipeline
- Protect the built-in showcase seed task from deletion.

Changes:

- `web/render/setupView.js`
  - Added a required `Local Codex model` selector with `gpt-5.5` and `gpt-5.4`.
- `server/storage.mjs`
  - Persisted `arena.localCodexModel`.
  - Added `deleteEvaluationTask(taskId)`.
  - Deleting the active task now reselects another task when possible, or clears global workspace mirrors when none remain.
- `server/index.mjs`
  - Added `/api/tasks/delete`.
  - Passed the selected task model into challenger capture setup and simulator routes.
- `web/api.js`
  - Added `deleteTask(taskId)`.
- `web/render/tasksView.js`
  - Surface the selected local Codex model in featured/task cards.
  - Added delete buttons for non-showcase tasks.
- `web/app.js`
  - Added delete confirmation + task refresh flow.
- Codex runner plumbing:
  - `server/packageGenerator.mjs`
  - `server/simulator.mjs`
  - `server/adapterBuilder.mjs`
  - `server/graderRunner.mjs`
  - All now pass `--model <gpt-5.4|gpt-5.5>` explicitly instead of silently relying on the CLI default.

Validation:

- `node --check` passed for all changed server/frontend module files.

Follow-up:

- Sync these repo changes into the installed macOS runtime before QA in the desktop app.
- If we later expose task editing, the same `arena.localCodexModel` field should be editable there instead of only at creation time.

## 2026-06-15 Collect Stability Fixes: AppleScript Buffer + DeepSeek Adapter

Intent:

- Fix release-mode collection regressions where Chrome capture failed with `stdout maxBuffer length exceeded`.
- Close the gap where DeepSeek setup could inspect the page but still could not complete a usable automatic capture path.

Root causes:

- Doubao baseline capture and challenger snapshot capture both serialized large page JSON through AppleScript stdout with the default Node child-process buffer.
- First-time challenger setup for a new site could route through the local adapter-builder skill, but only `dots.ai` had an executable runtime adapter. This made DeepSeek effectively non-runnable even when the page was visible.

Changes:

- `server/chromeCapture.mjs`
  - Increased AppleScript child-process `maxBuffer` to 20 MB.
- `server/websiteAdapters.mjs`
  - Increased AppleScript child-process `maxBuffer` to 20 MB.
  - During first-time setup, if the current page already matches a built-in adapter, run that adapter directly instead of forcing the generic builder path.
  - Added built-in `deepseek_web` adapter support.
  - Added DeepSeek-specific parsing for:
    - current-turn scoped final answer
    - visible search summary (`已阅读 N 个网页`)
    - risk notices / disclaimers
    - minimal QA gating

Expected impact:

- Doubao capture should no longer fail merely because the visible page is long.
- DeepSeek collection should no longer dead-end at “page found but not understandable” for the current visible chat page.

Limitations kept explicit:

- DeepSeek transient thinking is still not claimed unless it remains visible in the final DOM snapshot.
- Generic unknown-site capture is still not fully universal; this fix makes DeepSeek a supported built-in site rather than solving all unseen providers.

## 2026-06-15 Website Capture Refactor: Generic Recon + Refined Snapshot Pass

Intent:

- Stop overfitting first-time website setup to one brittle DOM shape.
- Preserve stable Doubao/dots.ai behavior while making unknown or changing websites reach a usable partial capture path.
- Let the adapter-builder skill influence what the snapshot layer observes, instead of only judging a fixed snapshot after the fact.

Architecture change:

- Keep provider adapters as the normalization layer.
- Upgrade the snapshot layer into a broader recon packet that now includes:
  - raw visible text
  - current-turn visible text candidate
  - explicit message items when known selectors exist
  - generic candidate message containers
  - descendant markdown nodes
  - turn-boundary candidates
  - existing anchors, buttons, and DOM summary
- Extend the adapter-builder skill so it can return:
  - `snapshotRequirements`
  - `selectorHints`
  - `turnBoundaryPlan`
  - `providerUiPatterns`
  - `reconRetryAdvice`

Runtime flow:

1. Capture a generic first-pass snapshot.
2. Ask the local adapter-builder skill for provider understanding and recon hints.
3. If the first snapshot is weak but the skill provides useful hints, rerun a refined snapshot pass with those hints applied.
4. Re-run builder reasoning on the refined snapshot.
5. If a built-in adapter exists, execute it.
6. Otherwise fall back to a conservative generic web-chat adapter when the builder/QA path says the site is understandable enough for partial capture.

Why this matters:

- DeepSeek failed not because the page was unreadable, but because the old snapshot JS only looked for one hardcoded message class family.
- This refactor moves us from “fixed selectors plus after-the-fact QA” toward “generic recon plus skill-guided refinement”.
- Saved builder-approved templates can now be reused by the generic web-chat path even when the site has no dedicated built-in adapter.

Guardrails preserved:

- Existing provider adapters still run for known sites.
- Manual paste remains the universal fallback.
- The generic fallback marks itself as human-review-heavy and partial unless evidence is genuinely strong.

### Follow-up Tuning: Visible Source Panel and Inline Citation Capture

Intent:

- Improve the generic web-chat adapter so that DeepSeek-like pages capture visible references as structured evidence instead of degrading into a loose all-page anchor sweep.

What changed:

- Generic capture now prefers visible source/search-result cards from candidate message containers when they are present.
- It separately captures inline citation links such as numbered markdown cite markers.
- It treats `已阅读 N 个网页` as source summary / visible process evidence, not as full citation evidence.
- It uses builder selector hints for `sourceCards` and `inlineCitations` when available, but still works heuristically when those hints are absent.

Why this matters:

- On the DeepSeek page, the right-side search-result/source panel is already visible without clicking.
- The important product improvement is not “click more”; it is “respect visible source surfaces and map them correctly”.
- Future website capture should only use a single synthetic expansion click when the source panel is clearly collapsed and the action is idempotent.
## 2026-06-16 - DeepSeek multi-turn capture hardening

- Investigated the DeepSeek second-turn failure against the live B2B pricing page artifacts.
- Confirmed the current-turn user message and second-turn assistant answer were already present in `rawVisibleText` and `descendantMarkdownNodes`; the failure was not an empty page problem.
- Identified two structural gaps:
  - the built-in `deepseek_web` adapter still relied too heavily on raw scoped text and did not reuse the stronger generic reference-material extraction path;
  - the snapshot layer had no reusable read-only expansion path for visible citation/source controls such as `参考 N 篇资料` or `已阅读 N 个网页`.
- Hardened `server/websiteAdapters.mjs` so that:
  - DeepSeek capture now prefers the latest structured assistant markdown container for current-turn final-answer extraction, falling back only when that structure is missing;
  - DeepSeek reference capture now reuses the generic visible source-card / inline-citation extractor with built-in DeepSeek selector hints;
  - DeepSeek follow-up suggestions now also consider visible buttons/chips when present;
  - snapshot metadata records whether SBS attempted a one-click visible-evidence expansion pass before capture.
- Updated capture-builder reference guidance to explicitly allow one safe read-only expansion click for visible evidence drawers, without changing conversation state.
- Remaining validation note: the AppleScript `execute javascript` path is still awkward to debug directly from shell, so final verification should continue through the app/runtime capture flow rather than assuming shell parity.
- Follow-up fix: narrowed visible-evidence expansion so SBS only clicks genuinely interactive evidence triggers (`button`, `a`, or `role=button`) with source/citation/reference-like class or exact evidence-label text. This avoids false positives such as clicking ordinary answer words like `盈利来源` inside the generated content.

## 2026-06-16 - Grader report caseRuns shape guard

- Investigated a report-stage Codex log error: `TypeError: r.caseRuns.find is not a function`.
- Root cause: SBS run files store `caseRuns` as an object keyed by `caseId`, while a report-stage temporary Node snippet assumed it was an array.
- Scope: evidence cleaning had already succeeded; the bug risked interrupting the full report/PDF stage when the grader reopened raw run data.
- Minimal fix:
  - strengthened `chatbot-sbs-grader` input contract with explicit `caseRuns` normalization snippets;
  - repeated the hard constraint in full-report and markdown-repair prompts from `server/graderRunner.mjs`;
  - synced the updated grader runner and grader skill files into the Mac App runtime.
- Guardrail: no changes to collected data, cleaned evidence, scoring dimensions, aggregation policy, report layout, or PDF generation logic.

## 2026-06-16 - Review details expansion stability

- Fixed a Review page UX regression where cleaned-evidence case cards reopened or re-collapsed after the user manually toggled them.
- Root cause: polling / rerendering reapplied the default `open` state from case status (`low_confidence`, `needs_human_review`, etc.) on every render.
- Minimal fix: cache per-task, per-case `<details>` expansion state in the review view module and reuse it on rerender.
- Guardrail: no changes to grader data, cleaned evidence, report generation, or Review content rendering.
