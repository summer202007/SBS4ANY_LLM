# Chatbot SBS Grader Skill Sprint

Created: 2026-06-12

## Goal

Build a reusable `chatbot-sbs-grader` skill and wire it into the SBS workbench so collected SBS outputs can become:

```text
cleaned evidence
  -> case-level judgments
  -> task-space verdict
  -> PM-ready report
```

The first target is the interview task collection, where 13 of 15 cases have collected evidence.

## Non-Goals

- Do not redesign eval-set generation.
- Do not rebuild website capture adapters.
- Do not automate prompt sending into third-party products.
- Do not require perfect collection coverage before producing a caveated report.
- Do not make human review a hard gate for MVP.

## Development Principles

1. Preserve raw evidence.
   - Cleaning creates derived artifacts; it never overwrites collection.
2. Product-mode artifacts are task-scoped.
   - Grader output lives under `data/tasks/<taskId>/grader/`.
3. Report must be structured first, prose second.
   - The UI consumes JSON; downloads can use Markdown/HTML.
4. Continue through partial evidence.
   - Missing cases or weak fields produce caveats, not silent failure.
5. Separate evidence channels from scoring dimensions.
   - Citation/query/process/follow-up are evidence, not dimensions by themselves.
6. Make uncertainty visible.
   - Low confidence is a valid output.
7. Use deterministic checks where cheap.
   - Schema validation, missing fields, case/run alignment, obvious contamination, empty outputs, and known adapter notes should not rely only on LLM judgment.
8. Make the first report portfolio-grade.
   - It should read like a strong Agent PM evaluation memo, not a cold leaderboard.
9. Use briefs as navigation, not evidence replacement.
   - Long answers can be summarized for grader ergonomics, but important judgments must return to full cleaned/raw evidence.
10. Preserve invocation traceability.
   - Product-mode grader runs need job logs, skill refs, input/output artifact refs, validation results, quality-audit result, and known limitations.

## Sprint Stages

### Stage 0 - Alignment

Status: completed

Tasks:

- [x] Write working notes for evidence cleaning and grading direction.
- [x] Draft skill architecture brief.
- [x] Draft implementation sprint.
- [x] Review open questions with user.
- [x] Freeze MVP dimension defaults.

Exit criteria:

- User approves skill architecture and first implementation slice.

### Stage 1 - Schemas

Status: completed

Tasks:

- [x] Create `schemas/cleaned-evidence-package.schema.json`.
- [x] Create `schemas/case-judgments.schema.json`.
- [x] Create `schemas/grading-report.schema.json`.
- [x] Create `schemas/grader-quality-audit.schema.json`.
- [x] Add fixture validation against current interview task.

Exit criteria:

- Empty/minimal valid artifacts can pass schema validation.
- Invalid artifacts fail for missing case IDs, missing verdicts, or invalid dimension IDs.

### Stage 2 - Skill Scaffold

Status: completed

Tasks:

- [x] Create `skills/chatbot-sbs-grader/SKILL.md`.
- [x] Create `agents/openai.yaml`.
- [x] Add references:
  - `evidence-cleaning-policy.md`
  - `judgment-framework.md`
  - `case-type-scoring.md`
  - `dimension-framework.md`
  - `aggregation-policy.md`
  - `report-contract.md`
  - `quality-audit.md`
  - `examples-minimal.md`
- [x] Add validator scripts.
- [x] Keep `SKILL.md` lean and load references by workflow.

Exit criteria:

- A local Codex invocation can read the skill and know which references to load for cleaning vs grading.

### Stage 3 - Deterministic Pre-Cleaner

Status: completed

Tasks:

- [x] Implement `scripts/deterministic_preclean.mjs`.
- [x] Detect empty outputs and missing required fields.
- [x] Detect known adapter-note patterns.
- [x] Detect likely cross-case contamination by matching task/case prompt terms.
- [x] Split obvious risk notices and follow-up suggestions when captured into wrong fields.
- [x] Produce pre-clean findings without deleting raw evidence.
- [x] Strip captured UI/history prefixes from final output when deterministic signals are strong.

Exit criteria:

- Current interview run produces a pre-clean summary with known issues surfaced, especially adapter notes and suspicious wrong-case fields.

Validation:

- `data/tasks/task-2026-06-12T064110798Z/grader/cleaned-evidence.preclean.json` was generated from the current interview package/run.
- `validate_cleaned_evidence.mjs` passed with one expected warning: missing `jobint-mt-010`, `jobint-mt-011`.

### Stage 4 - Evidence Cleaning Workflow

Status: in progress

Tasks:

- [x] Implement local Codex job wrapper for `evidence_cleaning`.
- [x] Pass package, run, review notes, settings, and deterministic pre-clean output to the skill.
- [x] Save product-mode artifacts under `data/tasks/<taskId>/grader/`.
- [x] Add validation for cleaned evidence.
- [x] Add progress logs to backend.
- [ ] Run a fresh product-mode cleaning job on the current interview task.
- [ ] Confirm `cleaned-evidence.json` quality in Review UI.

Exit criteria:

- Review page can show cleaned evidence for current interview task.
- Raw collection remains unchanged.

### Stage 5 - Review Page Integration

Status: in progress

Tasks:

- [x] Add Review page state for cleaned evidence availability.
- [x] Show per-case grade readiness.
- [x] Show suspected contamination and human review hints from cleaned evidence.
- [x] Show missing collection coverage.
- [x] Add a pre-grader option asking whether `communicationFit` should be scored or kept diagnostic.
- [x] Add one-click `Run Review + Report` flow; no second click is required after cleaning.
- [ ] Add raw vs cleaned evidence toggle.
- [ ] Add editable user notes / override markers for later report.

Exit criteria:

- User can inspect whether evidence is grader-ready before running final grading.

### Stage 6 - Case-Level Grading

Status: dry-run completed; product wrapper in progress

Tasks:

- [x] Implement local Codex job wrapper for case-level judgments as part of the full grader pipeline.
- [x] Use rubric suggestions from package in the first interview dry run.
- [x] Apply case-type weighting in the first interview dry run.
- [x] Apply red-line caps at case/dimension level in the first interview dry run.
- [x] Save `case-judgments.json` for the first interview dry run.
- [x] Validate all collected cases have judgments or explicit skipped reasons in the first interview dry run.
- [ ] Run a fresh product-mode full report job and validate artifacts.
- [ ] Upgrade evidence refs from case-level refs to `caseId/turnIndex/side/field/span` where available.

Exit criteria:

- Current interview task has per-case SBS judgments with evidence refs and uncertainty.

Dry-run artifact:

- `data/tasks/task-2026-06-12T064110798Z/grader/case-judgments.json`

### Stage 7 - Aggregation And Report Generation

Status: dry-run completed; product wrapper and UI rendering in progress

Tasks:

- [x] Aggregate case judgments into task-space dimensions in the first interview dry run.
- [x] Generate `grading-report.json` for the first interview dry run.
- [x] Generate `report.md` for the first interview dry run.
- [x] Include coverage, missing cases, caveats, and optimization roadmap in the first interview dry run.
- [x] Preserve non-scored product insights in the first interview dry run.
- [x] Generate `challengerOptimizationPlan` mapped to dimensions, case types, and failure clusters in the first interview dry run.
- [x] Render app report as progressive disclosure: executive verdict, side overall conclusions, scoreboard, optimization plan, breakdowns, evidence appendix.
- [x] Add temporary PDF-ready report preview and JSON export from the local frontend.
- [x] Remove standalone Key Reasons from the app-facing report surface.
- [x] Harden `GradingReport` contract so baseline/challenger overall conclusions and complete dimension scoreboard rows are required.
- [x] Build document-grade PDF exporter with Feishu-style memo quality; browser page print is not acceptable as the final export.
- [x] Restore full Feishu-style memo quality for `report.zh.md` / PDF while keeping app-facing JSON compact.
- [x] Add markdown memo quality checker and automatic markdown repair pass for report regressions.
- [ ] Add artifact bundle download.
- [ ] Run fresh report generation through backend job and inspect UI quality.

Exit criteria:

- Report page can render a task-space verdict, baseline/challenger overall conclusions, complete dimension scoreboard, and document-grade PDF export.

Dry-run artifacts:

- `data/tasks/task-2026-06-12T064110798Z/grader/grading-report.json`
- `data/tasks/task-2026-06-12T064110798Z/grader/report.md`

### Stage 8 - Grader Quality Audit

Status: dry-run completed; product wrapper pending

Tasks:

- [ ] Implement `grader-quality-audit` workflow wrapper.
- [x] Check evidence citations in the first interview dry run.
- [x] Check exposure safety in the first interview dry run.
- [x] Check red-line application in the first interview dry run.
- [x] Check aggregation reasonableness in the first interview dry run.
- [x] Check report actionability in the first interview dry run.
- [x] Save audit artifact for the first interview dry run.
- [ ] Add `briefFidelity` and `invocationTraceability` gates to product-mode audit output.
- [ ] Show audit status in Report page.

Exit criteria:

- Report generation includes an explicit confidence/caveat layer and recommended human spot checks.

Dry-run artifact:

- `data/tasks/task-2026-06-12T064110798Z/grader/grader-quality-audit.json`

### Stage 9 - Regression Fixtures

Status: pending

Tasks:

- [ ] Save interview task grader fixture after first successful run.
- [ ] Save restaurant task grader fixture if useful.
- [ ] Add tiny regression tests for known red-line and contamination cases.
- [ ] Add snapshot comparison for report sections.

Exit criteria:

- Future changes can be tested against known grader behavior.

## First Implementation Slice Recommendation

Build the smallest useful end-to-end slice:

1. schemas;
2. skill scaffold;
3. deterministic pre-cleaner;
4. local Codex evidence cleaning;
5. Review page cleaned evidence display.

The first scoring dry run has now been produced from deterministic preclean output. Before productizing report generation, wire Review/Report surfaces so humans can inspect cleaned evidence and case judgments instead of trusting a hidden grader.

## Key User Decisions Needed Before Scoring

Resolved:

1. `communicationFit`: ask before grader/report generation whether it should be scored; otherwise keep diagnostic.
2. Case-level scores: `1-5`; aggregate dimension/optional total score: `0-100`.
3. Final verdict taxonomy accepted:
   - `challenger_wins`
   - `baseline_wins`
   - `meaningful_niche_win`
   - `tie_or_inconclusive`
   - `insufficient_evidence`
4. `targetAudienceExperienceFit`: plus factor, not mandatory, and should not dominate total score.
5. Post-report human override is not needed for MVP.

Remaining:

- Decide exact UI placement and copy for the communication-fit scoring option.
- Decide whether first implementation needs HTML export or Markdown+JSON artifact bundle is enough.

## Risk Register

| Risk | Why It Matters | Mitigation |
|-|-|-|
| LLM grader overtrusts noisy fields | Produces confident wrong verdicts | deterministic pre-cleaner + quality audit |
| Report becomes too numeric | Fails PM decision need | require product judgment narrative |
| Report becomes too subjective | Loses credibility | evidence refs + dimension scores |
| Red-line over-dominates task verdict | One case can distort product value | cap at case/dimension, aggregate severity/frequency |
| Provider asymmetry is mishandled | Unfairly rewards/penalizes exposed fields | provider capability profile and evidence-channel taxonomy |
| Partial collection blocks report | MVP becomes unusable | coverage caveats + low-confidence verdicts |
| Skill grows too large | Hard to maintain, context-heavy | progressive disclosure and validators |

## Documentation To Keep Updated

- `PROJECT_BRIEF.md`
- `docs/evaluation-framework.md`
- `docs/data-model.md`
- `docs/grader/chatbot-sbs-grader-working-notes.md`
- `docs/grader/chatbot-sbs-grader-skill-brief.md`
- `docs/grader/chatbot-sbs-grader-sprint.md`
- `docs/grader/chatbot-sbs-grader-implementation-log.md`
