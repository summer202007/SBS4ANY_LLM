# Chatbot SBS Grader Implementation Log

## 2026-06-12 - Skill Scaffold, Schemas, And Deterministic Preclean

### Goal

Produce the first real, reusable `chatbot-sbs-grader` skill scaffold and validate it against the current `求职面试经验` collection.

This is the first implementation slice of the grader/report system:

```text
raw collected run
  -> deterministic preclean starter
  -> cleaned-evidence artifact
  -> later LLM evidence cleaning / grading / report
```

### Files Created

Skill root:

- `skills/chatbot-sbs-grader/SKILL.md`
- `skills/chatbot-sbs-grader/agents/openai.yaml`

References:

- `skills/chatbot-sbs-grader/references/evidence-cleaning-policy.md`
- `skills/chatbot-sbs-grader/references/judgment-framework.md`
- `skills/chatbot-sbs-grader/references/case-type-scoring.md`
- `skills/chatbot-sbs-grader/references/dimension-framework.md`
- `skills/chatbot-sbs-grader/references/aggregation-policy.md`
- `skills/chatbot-sbs-grader/references/report-contract.md`
- `skills/chatbot-sbs-grader/references/quality-audit.md`
- `skills/chatbot-sbs-grader/references/examples-minimal.md`

Schemas:

- `skills/chatbot-sbs-grader/schemas/cleaned-evidence-package.schema.json`
- `skills/chatbot-sbs-grader/schemas/case-judgments.schema.json`
- `skills/chatbot-sbs-grader/schemas/grading-report.schema.json`
- `skills/chatbot-sbs-grader/schemas/grader-quality-audit.schema.json`

Scripts:

- `skills/chatbot-sbs-grader/scripts/deterministic_preclean.mjs`
- `skills/chatbot-sbs-grader/scripts/validate_cleaned_evidence.mjs`
- `skills/chatbot-sbs-grader/scripts/validate_case_judgments.mjs`
- `skills/chatbot-sbs-grader/scripts/validate_grading_report.mjs`

### Real-Case Input Used

Task:

- `task-2026-06-12T064110798Z`
- Task space: `求职面试经验`
- Package: `data/tasks/task-2026-06-12T064110798Z/package/current.json`
- Run: `data/tasks/task-2026-06-12T064110798Z/runs/current.json`

Observed structure:

- Package contains 15 cases.
- Run contains 13 collected case runs.
- Missing cases: `jobint-mt-010`, `jobint-mt-011`.
- `caseRuns` is stored as an object map, not an array.
- Turn evidence is stored in flat fields such as `baselineOutput`, `challengerOutput`, and `baselineVisibleProcessNotes`, not nested `sides`.

These real shapes are now supported by `deterministic_preclean.mjs`.

### Real-Case Evidence Lessons Embedded

The skill/reference rules now explicitly cover:

- Doubao source notes may be only page provenance, not claim-level citation support.
- Doubao visible process notes may mix risk notices and follow-up suggestions.
- Doubao intent/query expansion can be useful, low-signal, or wrong-page contaminated.
- Dots/Diandian visible process notes often include adapter/capture notes, not model thinking.
- Dots/Diandian source evidence often appears as inline quotes rather than URL citations.
- Missing provider-specific fields should lower evidence confidence, not automatically lower model score.
- Multi-turn simulator artifacts belong to harness context, not product behavior.
- Partial collection should produce caveats and continue when usable.

### Smoke Test

Command:

```bash
node skills/chatbot-sbs-grader/scripts/deterministic_preclean.mjs \
  --package data/tasks/task-2026-06-12T064110798Z/package/current.json \
  --run data/tasks/task-2026-06-12T064110798Z/runs/current.json \
  --task-id task-2026-06-12T064110798Z \
  --out data/tasks/task-2026-06-12T064110798Z/grader/cleaned-evidence.preclean.json

node skills/chatbot-sbs-grader/scripts/validate_cleaned_evidence.mjs \
  data/tasks/task-2026-06-12T064110798Z/grader/cleaned-evidence.preclean.json
```

Result:

- Validation `ok: true`.
- Checker type: `lightweight_custom_checker`.
- Warning: missing `jobint-mt-010`, `jobint-mt-011`.
- Output artifact:
  - `data/tasks/task-2026-06-12T064110798Z/grader/cleaned-evidence.preclean.json`

### Important Bug Found And Fixed

`jobint-mt-009` Doubao turn 3 final output included a captured sidebar/history prefix:

- restaurant task history;
- meeting note titles;
- app/tool history items;
- then the real answer.

Initial preclean only removed a few exact UI chrome lines and left the history prefix in `cleanFinalOutput`.

Fix:

- `stripUiChrome()` now detects a repeated current conversation title after a prefix of many short history-like lines.
- It strips the prefix and places it in `removedNoise` as `removed_ui_chrome`.
- The cleaned final output now starts at the actual answer title.

### Current State

Done:

- Skill scaffold exists.
- All planned reference files exist.
- All planned schemas exist.
- All planned scripts exist.
- Real interview preclean artifact exists and validates.

Not done:

- LLM evidence cleaning workflow.
- Frontend Review/Report integration.
- Installation/copy to local Codex skill directory, if needed.

## 2026-06-12 Full Grader Dry Run On Interview Collect

The first complete grader dry run was executed on the current interview task collect:

- Task: `task-2026-06-12T064110798Z`
- Package: `data/tasks/task-2026-06-12T064110798Z/package/current.json`
- Run: `data/tasks/task-2026-06-12T064110798Z/runs/current.json`
- Cleaned evidence input: `data/tasks/task-2026-06-12T064110798Z/grader/cleaned-evidence.preclean.json`
- Collected coverage: 13 / 15 cases
- Missing cases: `jobint-mt-010`, `jobint-mt-011`

Generated artifacts:

- `data/tasks/task-2026-06-12T064110798Z/grader/case-judgments.json`
- `data/tasks/task-2026-06-12T064110798Z/grader/grading-report.json`
- `data/tasks/task-2026-06-12T064110798Z/grader/grader-quality-audit.json`
- `data/tasks/task-2026-06-12T064110798Z/grader/report.md`

Validation:

```bash
node skills/chatbot-sbs-grader/scripts/validate_case_judgments.mjs \
  data/tasks/task-2026-06-12T064110798Z/grader/case-judgments.json

node skills/chatbot-sbs-grader/scripts/validate_grading_report.mjs \
  data/tasks/task-2026-06-12T064110798Z/grader/grading-report.json
```

Result:

- `case-judgments.json`: `ok: true`, no warnings.
- `grading-report.json`: `ok: true`, no warnings.

Headline result:

- Verdict: `baseline_wins`
- Confidence: `medium`
- Overall score: Doubao 77, 小红书点点 71
- Main interpretation: Doubao wins the interview task space overall because it is more specific, executable, and robust on preparation/planning/probe cases. 点点 has a meaningful but not overall-winning niche in safety, emotional support, and sensitive career-boundary cases.

Important grading lessons from the dry run:

- Boundary-risk cases can overturn dimension-level trust even when the baseline wins most normal task cases.
- `jobint-br-014` is the clearest red-line example: Doubao warns against fabrication but then enables a fake data product project; 点点 refuses.
- `jobint-mt-008` shows why emotional/crisis turns cannot be graded as ordinary career advice.
- 点点's main product gap is not tone; it is executable depth and context stability.
- Doubao's main product gap is not utility; it is overconfident unsafe help in some sensitive cases.
- Report artifacts need app-level drill-down from aggregate conclusion to case evidence.

### Skill Hardening After Dry Run

The dry run surfaced several generic grader robustness lessons. These have been added to the skill/reference contract:

- Case briefs are allowed only as navigation aids. They must not replace full cleaned/raw evidence.
- Important judgments should cite the finest available refs: `caseId -> turnIndex -> side -> field -> span/quote`.
- If evidence refs are only case-level, quality audit should warn that refs are coarse.
- Formal reports should pass through a reviewable cleaned-evidence state, or explicitly mark the output as a dry run / lower-confidence report.
- `communicationFit` remains diagnostic unless the harness explicitly enables it as scored before grading.
- Red-line failures remain two-stage: first cap case/dimension, then aggregate by severity, frequency, task importance, and trust impact.
- Formal product runs must preserve invocation traceability: invocation mode, skill path/ref, input refs, output refs, validation results, quality-audit result, and limitations.

Provider-specific source/citation patterns from Doubao and 点点 were intentionally not generalized into fixed scoring assumptions. The generic rule remains: judge whether each evidence item supports the relevant claim; do not compare citation counts or exposed-field counts directly.

### Report Format Hardening

User review of the first report confirmed that the overall length and section order are a good MVP default:

- executive verdict;
- scoreboard;
- key reasons;
- challenger optimization plan;
- case-type breakdown;
- failure clusters and red lines;
- strength pockets;
- case table;
- uncertainty and appendix.

The scoreboard format was improved:

- every aggregate dimension row should include a short challenger-facing diagnosis;
- if the challenger wins, say where it is better;
- if the challenger loses, say why it loses and the main improvement lever;
- if close/inconclusive, say what evidence or product change would decide it.

The evidence compression rule was also clarified:

- prefer less compression when possible;
- if compression is needed to avoid context overflow or failed output, preserve high-risk cases, red-line candidates, close calls, user corrections, final outcomes, and evidence supporting key verdict claims first.

### Next Step

Use this skill scaffold to implement the next engineering stage:

1. wire `case-judgments.json`, `grading-report.json`, `grader-quality-audit.json`, and `report.md` into the app's Review/Report pages;
2. decide whether the app should show preclean output directly or require a human-approved cleaned evidence step;
3. improve evidence refs from case-level pointers to span-level pointers;
4. add an app action to run the grader end to end from task-scoped storage.

## 2026-06-13 Report Contract And UI Hardening

User review of the first product-mode Report page found three app-facing contract gaps:

- the baseline side lacked an explicit overall conclusion;
- the Dimension Scoreboard rendered dimension IDs but missed scores and challenger diagnoses when the JSON only populated `aggregateScores.dimensions`;
- standalone `Key Reasons` was too composite for the web surface and should not be a first-class app module.

Changes made:

- `skills/chatbot-sbs-grader/references/report-contract.md` now requires `executiveVerdict.sideOverallConclusions.baseline/challenger`.
- `taskSpaceDimensionVerdicts` is now the app-facing scoreboard contract and must include `dimensionId`, `baselineScore`, `challengerScore`, `winner`, `baselineConclusion`, `challengerDiagnosis`, and `evidenceRefs`.
- `skills/chatbot-sbs-grader/schemas/grading-report.schema.json` and `scripts/validate_grading_report.mjs` were hardened to enforce these fields.
- `skills/chatbot-sbs-grader/SKILL.md` and the skill brief now state that standalone Key Reasons should be folded into executive summary, dimension diagnoses, failure clusters, and challenger optimization plan.
- The Report page now renders baseline/challenger overall cards, resolves scoreboard rows from both `taskSpaceDimensionVerdicts` and `aggregateScores.dimensions`, removes the Key Reasons section, and offers PDF-first export via a print-ready report view plus JSON download.
- The backend report prompt now explicitly reminds Local Codex to produce side overall conclusions and complete app-facing scoreboard rows.

Test reset:

- The interview task package and collected run data were preserved under `data/tasks/task-2026-06-12T064110798Z/package/` and `data/tasks/task-2026-06-12T064110798Z/runs/current.json`.
- All generated grader/review/report artifacts under `data/tasks/task-2026-06-12T064110798Z/grader/` were cleared so the next frontend run can test the full generation experience from a clean Review/Report state.

Known follow-up:

- The initial Export PDF implementation was only a browser/WebView print path and was rejected as insufficient. It has been replaced with a backend PDF exporter that:
  - preserves the full `report.zh.md` / `report.md` skill artifact as the report body;
  - generates an independent Feishu-style report HTML document as an intermediate artifact;
  - renders a real `report.pdf` via Chrome headless, not by printing the app screen;
  - stores `report.print.html` and `report.pdf` under `data/tasks/<taskId>/grader/`;
  - reveals the generated PDF in Finder and exposes `/api/grader/report-pdf` for download.
- The app-facing Report page remains a compact progressive-disclosure view. The PDF is the full memo-grade artifact and may include deeper "why this verdict / key reasons" content that is intentionally not shown as a standalone web module.
- Verified on the interview task: `data/tasks/task-2026-06-12T064110798Z/grader/report.pdf` was generated as a real 4-page PDF, and first-page preview showed readable hierarchy, Chinese text, and scoreboard table without browser URL/page footer artifacts.
- After the next frontend run, inspect whether the new contract materially improves `grading-report.json` without degrading report narrative quality.

## 2026-06-13 Memo-Grade Report Quality Regression Fix

User compared the generated PDF/report with the earlier Feishu report and identified that the report felt thinner even though the raw character count was not lower.

Root cause:

- A product/UI requirement, "do not show Key Reasons as a standalone web module", was written too broadly in the skill/report contract and backend prompt.
- The grader then treated Key Reasons as something to fold away from the full report source, not only from the app-facing JSON surface.
- The product pipeline validated `grading-report.json`, but did not validate whether `report.zh.md` still met the Feishu-style memo quality bar.
- PDF export correctly rendered the markdown source, but it could not compensate for a degraded source report.

Fix:

- Re-separated the two report surfaces:
  - `grading-report.json` is the app-facing progressive-disclosure contract.
  - `report.zh.md` / `report.md` are full memo-grade report sources used by PDF export.
- `SKILL.md`, `report-contract.md`, and backend report prompts now explicitly state that the app may hide Key Reasons, but the full markdown/PDF report must include a dedicated `关键原因 / Why This Verdict` section.
- `report-contract.md` now encodes the Chinese Feishu-style memo quality bar:
  - `结论摘要`
  - `总分与维度分` with `总体表现` row
  - `关键原因`
  - priority-grouped challenger optimization suggestions
  - `Case 类型拆解`
  - `失败簇与红线`
  - `局部优势`
  - `Case 明细表`
  - `不确定性与 caveats`
  - `附录`
- Added `skills/chatbot-sbs-grader/scripts/validate_report_markdown.mjs`.
- Wired the markdown quality checker into `runFullGraderPipeline`; grader jobs now include markdown memo quality in `validationOk`.
- Added an automatic report-markdown repair pass. If the markdown quality checker fails, the backend asks Local Codex to rewrite only `report.md` / `report.zh.md` from the existing judgments and report JSON, without changing collected evidence or case judgments.

Validation:

- The earlier Feishu report fetched from `DOigdCubnoPZh8xB5Tsl5OW4gAf` passes `validate_report_markdown.mjs`.
- The current degraded `report.zh.md` fails with the expected errors: missing `总体表现`, missing `关键原因`, missing priority-grouped optimization headings, and raw enum dimension labels in the main table.

Expected behavior after the next grader run:

- App Report remains compact and structured.
- PDF export remains a real generated `report.pdf`.
- `report.zh.md` and PDF should return to the original Feishu memo quality level while still carrying the extra app-facing JSON fields needed by the frontend.

## 2026-06-13 Overall Score Field Contract Fix

User found that the Report page showed empty `Baseline Overall` and `Challenger Overall` cards even though the generated report contained valid overall scores.

Root cause:

- The grader wrote canonical overall scores as `aggregateScores.overall.baselineScore` and `aggregateScores.overall.challengerScore`.
- The frontend resolver only checked older/looser field names such as `aggregateScores.overall.baseline` and `aggregateScores.overall.challenger`.
- The lightweight report validator checked score scale and dimension rows, but did not require the overall side score fields, so the mismatch was not caught as a contract issue.

Fix:

- `web/render/reportView.js` now resolves `overall.baselineScore` and `overall.challengerScore` first, while retaining compatibility with older fallback fields.
- `skills/chatbot-sbs-grader/schemas/grading-report.schema.json` now requires `aggregateScores.overall.baselineScore`, `challengerScore`, and `winner`.
- `skills/chatbot-sbs-grader/scripts/validate_grading_report.mjs` now fails if those overall score fields are missing.
- `server/graderRunner.mjs`, `SKILL.md`, `references/aggregation-policy.md`, and `references/report-contract.md` now state the canonical overall score contract explicitly.

Validation:

- Current interview report `data/tasks/task-2026-06-12T064110798Z/grader/grading-report.json` passes the updated validator.
- `node --check` passes for the touched JS modules.
- `npm run build` is not available in this repo; there is currently no build script.

## 2026-06-13 PDF Export Download UX Fix

User requested two Report-page export improvements:

- show an explicit downloading/exporting state while PDF generation is running;
- make the downloaded PDF filename identify the evaluation task instead of using a generic `report` name.

Changes made:

- Added `state.grader.pdfExporting` and wired it through `renderReportView`.
- The Report page now disables the PDF button and changes its label to `Preparing PDF...` while `/api/grader/export-pdf` is running.
- `exportCurrentGraderPdf()` now returns `filename` alongside `downloadUrl`, `pdfPath`, and size metadata.
- The frontend sets `anchor.download` to that filename before triggering the browser download.
- `buildPdfFilename()` now prefers the full task title, so filenames include task space, challenger, and baseline when available.
- `/api/grader/report-pdf` now sends a UTF-8 friendly `Content-Disposition` header with both `filename` and `filename*`.

Validation:

- `node --check` passes for `web/app.js`, `web/render/reportView.js`, `web/state.js`, `server/pdfExporter.mjs`, and `server/index.mjs`.
- A privileged local PDF export smoke test succeeded and returned:
  - `求职面试经验-小红书点点-vs-Doubao-SBS-report.pdf`
  - PDF size: 742120 bytes.

## 2026-06-13 Grader Critique Hardening

User reviewed another agent's critique of the interview-task report and selected four issues to fix now:

1. missing/skipped cases displayed as `1/1`;
2. evidence refs were too coarse for important claims;
3. scores looked falsely precise;
4. safety red-lines were mixed into the same headline as task-utility winner.

Decision:

- LLM-as-judge meta-eval / human calibration was acknowledged but deferred. It should rely on human spot checks and disagreement notes; the skill should not pretend model self-audit is equivalent to human calibration.

Changes made:

- `case-judgments.schema.json` now allows null side scores for skipped/not-scored cases and supports `evidenceSnippets`.
- `validate_case_judgments.mjs` now fails if skipped/not-scored cases contain numeric scores or cite nonexistent output refs.
- `grading-report.schema.json` now requires:
  - `decisionVerdicts.taskUtility`;
  - `decisionVerdicts.releaseSafetyReadiness`;
  - `scoreInterpretation`;
  - `keyEvidenceSnippets`.
- `validate_grading_report.mjs` now checks dual verdicts, directional score caveat, not-scored case handling, and key evidence snippets.
- `validate_report_markdown.mjs` now requires:
  - methodology / score interpretation section;
  - directional-score caveat;
  - task utility vs safety/readiness separation;
  - key evidence excerpts.
- `SKILL.md`, `judgment-framework.md`, `aggregation-policy.md`, `report-contract.md`, and backend grader prompts now encode these rules.
- Report UI now shows:
  - task utility verdict;
  - safety/readiness verdict;
  - score interpretation caveat;
  - key evidence excerpts;
  - `N/A` for skipped/not-scored case scores.

Current artifact migration:

- Updated the current interview task artifacts without changing collect/raw run data:
  - `case-judgments.json`: `jobint-mt-010` and `jobint-mt-011` now have null scores, `not_scored`, and no fake output refs.
  - `grading-report.json`: added dual verdicts, directional score interpretation, and three key evidence snippets.
  - `report.zh.md`: added methodology, directional score explanation, key evidence excerpt table, multi-turn confidence downgrade wording, and `N/A` for missing cases.
- Re-ran validators; all pass:
  - case judgments;
  - grading report;
  - markdown memo quality.
- Re-generated `report.pdf`; output filename remains `求职面试经验-小红书点点-vs-Doubao-SBS-report.pdf`, new size 797124 bytes.
