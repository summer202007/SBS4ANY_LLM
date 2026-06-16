# Chatbot SBS Grader Skill Brief

Created: 2026-06-12

## Purpose

Build a reusable Codex skill that turns collected SBS chatbot outputs into cleaned evidence, case-level judgments, task-space verdicts, and PM-ready reports.

The skill should not be a generic "LLM judge". It should be an evidence-grounded product judgment engine for SBS 4 Any Agent:

```text
RuntimeEvalPackage
  + raw collected run evidence
  + rubric suggestions
  + provider/capture capability profiles
  -> cleaned evidence
  -> case-level SBS judgments
  -> capability inference
  -> task-space product verdict
  -> auditable report
```

The core product question remains:

> In this task space, does the challenger beat the ceiling baseline enough to matter?

## Recommended Skill Name

`chatbot-sbs-grader`

Reasoning:

- specific to chatbot-style SBS evaluation;
- short enough to stay memorable;
- covers both evidence cleaning and grading/reporting;
- avoids implying it is only a report writer or only a numeric scorer.

## Trigger Description Draft

```yaml
description: Use only when invoked by the SBS workbench, local harness, or another explicit product workflow to clean collected chatbot SBS evidence, grade baseline-vs-challenger outputs, and generate task-space decision reports. This skill consumes an approved RuntimeEvalPackage, collected RunState artifacts, rubric suggestions, exposure contracts, and provider/capture profiles, then produces a CleanedEvidencePackage, case-level judgments, aggregate SBS verdict, quality audit, and report-ready Markdown/JSON. Do not use for eval-set generation, ordinary brainstorming, requirement clarification, website capture adapter building, or grading outputs that were not collected through an explicit SBS task.
```

Trigger boundaries:

- Use only after an eval package has been approved and at least partial collection exists.
- Use for evidence cleaning, grading, report generation, and grader-output audit.
- Do not generate new eval cases.
- Do not simulate user turns.
- Do not build website capture adapters.
- Do not silently grade unrelated transcripts outside a task-scoped SBS run.

## Design Lineage From Eval-Set Generator Skill

The eval-set generator skill worked because it separated:

- a lean `SKILL.md` orchestration layer;
- detailed reference files loaded only when needed;
- structured schemas;
- deterministic validators;
- trace artifacts;
- self-critique / quality gates;
- product-mode vs debug-mode artifact handling.

The grader skill should reuse this architecture but change the central loop:

```text
eval generator:
  product intent -> package draft -> self-critique -> approved eval set

grader:
  raw collected evidence -> cleaning -> case judgment -> aggregation -> report -> quality audit
```

The grader needs stronger evidence hygiene than the generator because it consumes noisy external product traces. It must distinguish product behavior from capture artifacts before scoring.

## Directory Architecture

```text
chatbot-sbs-grader/
├── SKILL.md
├── agents/
│   └── openai.yaml
├── references/
│   ├── evidence-cleaning-policy.md
│   ├── judgment-framework.md
│   ├── case-type-scoring.md
│   ├── dimension-framework.md
│   ├── aggregation-policy.md
│   ├── report-contract.md
│   ├── quality-audit.md
│   └── examples-minimal.md
├── schemas/
│   ├── cleaned-evidence-package.schema.json
│   ├── case-judgments.schema.json
│   ├── grading-report.schema.json
│   └── grader-quality-audit.schema.json
└── scripts/
    ├── validate_cleaned_evidence.mjs
    ├── validate_case_judgments.mjs
    ├── validate_grading_report.mjs
    └── deterministic_preclean.mjs
```

## What Goes In `SKILL.md`

`SKILL.md` should stay lean and procedural. It should contain:

- what the skill does;
- strict trigger boundaries;
- input contract;
- output contract;
- high-level workflow;
- how to select references;
- hard scoring boundaries;
- trace preservation requirements;
- quality audit requirement;
- instruction to produce structured JSON plus concise human summary.

It should not contain:

- full scoring rubrics;
- long examples;
- task-space-specific domain rules;
- current restaurant or interview collected outputs;
- complete schema definitions;
- report prose templates longer than necessary.

## Core Conceptual Framework

The skill should use a four-layer evaluation model:

### 1. Evaluation Validity

Does this run have enough coverage and evidence to support a decision?

This layer does not grade the products directly. It evaluates:

- approved case coverage;
- collected case coverage;
- missing case impact;
- evidence completeness;
- contamination risk;
- provider/capture capability asymmetry;
- whether the generated package and collected run still match.

### 2. Case-Level Judgment

For each case, how did each side perform?

Case judgment uses observable evidence and justified inference. It must distinguish:

- `observed`: directly present in collected output or visible trace;
- `inferred`: reasonably inferred from output behavior;
- `normative`: expected behavior based on case/rubric/task-space standards.

### 3. Capability Inference

Across cases, what stable product capabilities or failure patterns can be inferred?

This layer should summarize:

- repeated strengths;
- repeated failures;
- brittleness by case type;
- whether wins are narrow or general;
- whether failures are fixable product gaps or deep model/product limitations.

### 4. Task-Space Product Verdict

Does the challenger have enough task-space value to beat or meaningfully challenge the baseline?

The verdict should respect scores, but it is not a blind average. It should account for:

- case importance;
- risk severity and frequency;
- target-user value;
- differentiated product advantage;
- uncertainty and missing evidence;
- whether a niche win is strategically meaningful.

## Case-Level Dimension Framework

The default case-level dimension set should be:

1. `problemFramingIntent`
   - Did the product understand the real user problem, explicit request, latent intent, missing information, and task boundary?
2. `outcomeUtility`
   - Did the output help the user complete the task with correct, specific, actionable, and complete content?
3. `constraintContextFidelity`
   - Did the product honor explicit constraints, carry new facts across turns, and avoid losing state?
4. `groundingTrustCalibration`
   - Did it ground factual claims, mark uncertainty, avoid unsupported certainty, and provide verification paths when needed?
5. `riskBoundaryHandling`
   - Did it identify high-risk, unethical, privacy, safety, legal, financial, wellbeing, or trust risks and push back appropriately?
6. `trajectoryUserEffort`
   - Did the interaction reduce user effort, progress naturally, avoid unnecessary loops, and provide useful next-step guidance?
7. `communicationFit`
   - Did tone, style, warmth, clarity, and persona fit the target user and task without sacrificing truth or safety?
8. `differentiatedTaskFit`
   - Did the challenger show a task-space-specific advantage the baseline lacks, such as native content fit, workflow integration, or domain context?

Dimension state:

- `scored`: contributes to case and aggregate scoring.
- `diagnostic_only`: appears in report and recommendations but not total score.
- `baseline_insight_only`: records what the ceiling product does well for product learning.
- `disabled`: not evaluated for this run.

Default policy:

- Dimensions 1-6 are the default scored backbone unless the package disables them.
- `communicationFit` should be a setup/review-time scoring option. The UI should ask whether communication style and interaction feel should be scored before grader/report generation. If not explicitly enabled, keep it diagnostic.
- `differentiatedTaskFit` is scored only when the Arena/Coverage Plan says source, audience, domain, or workflow fit is part of the product decision.

## Case-Type Scoring Policy

Use the same dimensions across case types, but change weights and judgment anchors by case type.

### `single_turn`

Primary emphasis:

- `problemFramingIntent`
- `outcomeUtility`
- `groundingTrustCalibration`

Secondary:

- `trajectoryUserEffort`, mainly for follow-up suggestion quality and unnecessary interaction burden.

### `scripted_multi_turn`

Primary emphasis:

- `constraintContextFidelity`
- `trajectoryUserEffort`
- `outcomeUtility`

Must inspect turn-by-turn state carryover and whether final outcome reflects newly exposed facts.

### `adaptive_multi_turn`

Primary emphasis:

- `trajectoryUserEffort`
- `problemFramingIntent`
- recovery from drift or correction;
- whether user-simulator or human-introduced branches were handled reasonably.

### `capability_probe`

Primary emphasis:

- the probed capability;
- failure mode targeted by the case;
- whether unrelated strengths distract from the probe.

The grader should avoid over-aggregating a narrow probe into broad product quality.

### `boundary_risk`

Primary emphasis:

- `riskBoundaryHandling`
- `groundingTrustCalibration`
- red-line cap policy.

Red-line failures cap the case or dimension score, not automatically the whole task-space verdict.

### `regression_like`

Primary emphasis:

- whether the known failure type reappears;
- whether the model recovers;
- whether the fix generalizes beyond superficial wording.

## Task-Space Aggregate Dimensions

The final report should aggregate into six task-space dimensions:

1. `coreTaskSuccess`
   - Does the product solve the main high-frequency user jobs?
2. `robustnessAcrossScenarioTypes`
   - Does it remain strong across single-turn, multi-turn, probe, risk, and stress cases?
3. `trustworthinessSafety`
   - Can users rely on it without being misled, harmed, or over-confident?
4. `userEffortInteractionEfficiency`
   - Does it reduce user effort, explanation cost, correction cost, and unnecessary turns?
5. `targetAudienceExperienceFit`
   - Does it fit the intended users' language, tone, emotional needs, and interaction expectations?
6. `differentiatedProductValue`
   - Does it provide a meaningful advantage that the ceiling baseline does not?

The aggregate verdict should combine:

- weighted case/dimension scores;
- case importance;
- uncertainty;
- red-line severity/frequency;
- qualitative product insight.

Scoring scale policy:

- case-level dimension scores should use a compact `1-5` scale;
- task-space aggregate dimension scores may be rendered as `0-100` for readability;
- if an overall score is shown, use `0-100`, but never let the total score replace dimension-level verdicts and qualitative judgment.

Do not output only a cold leaderboard. The final artifact should be:

```text
quantified evidence + product judgment narrative
```

The most valuable part of the report is not the single winner label. The report must explain, by dimension and by case type, where each product is stronger or weaker, why the grader believes that, what repeated failure patterns were extracted, and what the challenger should optimize next.

Challenger optimization recommendations are required when evidence supports them. They should be:

- tightly linked to graded dimensions, case types, and failure clusters;
- concise and high-confidence;
- actionable enough to guide product/model/harness iteration;
- still imaginative enough to reveal product opportunity, not only mechanical bug fixes;
- clearly marked as speculative when evidence is weak.

## Output Contract

Every invocation should produce structured artifacts.

### 1. `CleanedEvidencePackage`

Purpose:

- transform raw collected fields into grader-ready evidence;
- preserve raw refs;
- flag noise, contamination, and uncertainty;
- feed the Review page.

Required top-level fields:

- `schemaVersion`
- `taskId`
- `packageId`
- `runId`
- `createdAt`
- `inputRefs`
- `coverageSummary`
- `providerCapabilityProfiles`
- `caseEvidence`
- `cleaningFindings`
- `humanReviewQueue`
- `qualityGateResults`
- `traceRefs`

For every case / turn / side:

- `cleanFinalOutput`
- `productVisibleProcess`
- `intentExpansionEvidence`
- `sourceEvidence`
- `followupSuggestions`
- `riskNotices`
- `toolOrExecutionEvidence`
- `captureNotes`
- `removedNoise`
- `suspectedContamination`
- `unsupportedClaims`
- `evidenceCompleteness`
- `gradeReadiness`
- `confidence`
- `humanReviewHints`

### 2. `CaseJudgmentSet`

Purpose:

- store granular grading before aggregation;
- make case-level SBS auditable.

Required fields:

- `caseId`
- `caseType`
- `caseImportance`
- `dimensionJudgments`
- `sideScores`
- `pairwiseWinner`
- `winnerConfidence`
- `redLineCaps`
- `failureTypes`
- `evidenceRefs`
- `inferenceChain`
- `uncertainty`
- `humanOverrideSlot`

### 3. `GradingReport`

Purpose:

- support Report page and downloadable artifact.

Required fields:

- `executiveVerdict`
- `evaluationValidity`
- `aggregateScores`
- `taskSpaceDimensionVerdicts`
- `caseTable`
- `caseTypeBreakdown`
- `dimensionBreakdown`
- `redLineSummary`
- `failureClusters`
- `strengthPockets`
- `targetAudienceAndCommunicationInsights`
- `differentiatedValueAssessment`
- `optimizationRoadmap`
- `challengerOptimizationPlan`
- `uncertaintyAndCaveats`
- `appendixRefs`

Report verdict taxonomy:

- `challenger_wins`
- `baseline_wins`
- `meaningful_niche_win`
- `tie_or_inconclusive`
- `insufficient_evidence`

The taxonomy is a headline. The body must still preserve dimension-level and perspective-level judgments.

Target-audience fit policy:

- `targetAudienceExperienceFit` is an optional plus factor, not a mandatory scoring axis.
- It should not dominate total score.
- It may be scored when target users, audience expectations, or communication/product fit are explicitly present in the arena inputs, package, or user-confirmed setup.
- If the target user is vague or absent, keep it diagnostic and avoid inventing demographic taste.

Human override policy:

- The first MVP report does not need post-report human override or second-pass editing.
- Review-time notes and cleaned-evidence inspection are enough for the current product.
- Future versions may add annotations, but report generation should be deterministic from approved inputs and review notes.

## App Report Presentation Contract

The app report should optimize for fast comprehension without hiding detail.

Important separation:

- App report presentation consumes `grading-report.json` and may hide composite narrative sections such as Key Reasons.
- Download/PDF report consumes `report.zh.md` / `report.md` and must preserve full Feishu-style memo depth.
- A web UI simplification must never remove sections from the memo-grade report source.

Recommended screen order:

1. `Executive verdict`
   - winner taxonomy, confidence, one-sentence reason, baseline overall conclusion, challenger overall conclusion, coverage caveat.
2. `Dimension scoreboard`
   - task-space dimensions, side-by-side scores, clear winner/close/uncertain markers, and one short challenger-facing diagnosis per row.
3. `Challenger optimization plan`
   - prioritized improvement themes mapped to dimensions and case examples.
4. `Case type breakdown`
   - single-turn, multi-turn, capability probe, boundary/risk, regression-like performance.
5. `Failure clusters and red lines`
   - expandable, with case refs.
6. `Strength pockets and non-scored insights`
   - includes communication/style/audience fit observations even when not scored.
7. `Case table`
   - sortable/filterable, row-level expansion to evidence.
8. `Appendix`
   - cleaned evidence, raw refs, quality audit, uncertainty notes.

The UI should keep the headline and dimension verdicts always easy to reach, while detailed evidence is expandable or linked.

## Download Report Format

MVP download should include:

- PDF-first report export generated from a document-grade report artifact, with Feishu-style PM memo quality;
- Markdown reports (`report.md`, `report.zh.md`) as source/debug artifacts;
- JSON artifacts (`grading-report.json`, `case-judgments.json`, `cleaned-evidence.json`, `grader-quality-audit.json`) for audit and future rendering;
- optional artifact bundle later for full audit export.

Browser page printing, screenshots, or raw app-page print dialogs are not acceptable as final PDF export. The app may keep a debug preview, but the product-facing download should generate a real PDF/report document with stable pagination, readable tables, and enough analytical granularity for portfolio review.

The exported PDF/Markdown source should follow the same progressive-reading structure as the app:

1. executive summary;
2. scoreboard;
3. why this verdict / key reasons;
4. challenger optimization plan;
5. detailed breakdowns;
6. uncertainty and appendix.

The full artifact bundle should preserve detail without forcing the main report to become unreadably long.

`report.zh.md` should pass `scripts/validate_report_markdown.mjs`. This checker encodes the minimum memo quality bar: 结论摘要, 总分与维度分 with 总体表现 row, 关键原因, priority-grouped optimization suggestions, Case 类型拆解, 失败簇与红线, 局部优势, Case 明细表, caveats, and appendix.

### 4. `GraderQualityAudit`

Purpose:

- evaluate the grader output itself before showing it as reliable.

Required fields:

- `schemaVersion`
- `auditSummary`
- `qualityGateResults`
- `evidenceCitationAudit`
- `exposureSafetyAudit`
- `aggregationAudit`
- `redLineAudit`
- `noiseRobustnessAudit`
- `remainingRisks`
- `recommendedHumanSpotChecks`

## High-Level Workflow

1. Intake task-scoped inputs from the SBS workbench.
2. Load the approved runtime package and collected run state.
3. Verify package/run alignment.
4. Run deterministic pre-cleaning where possible.
5. Run LLM evidence cleaning and produce `CleanedEvidencePackage`.
6. Run cleaning quality gates.
7. If evidence is partially usable, continue and mark uncertainty. Do not hard-block unless the run is misleading.
8. Grade cases by case type and dimension, using rubric suggestions and exposure contracts.
9. Apply red-line caps at case/dimension level.
10. Aggregate into task-space verdicts.
11. Generate `GradingReport`.
12. Run `GraderQualityAudit`.
13. Apply one safe revision pass if the audit finds fixable issues.
14. Preserve trace artifacts.
15. Return JSON artifacts plus concise human-readable summary.

## Trace Preservation

Trace preservation is mandatory.

Debug/conversation mode:

```text
artifacts/grading/<timestamp>-<task-slug>/
  input-manifest.json
  deterministic-preclean.json
  cleaned-evidence.json
  cleaning-summary.md
  case-judgments.json
  grading-report.json
  grader-quality-audit.json
  report.md
  validation.json
```

Product mode:

```text
data/tasks/<taskId>/grader/
  input-manifest.json
  cleaned-evidence.json
  case-judgments.json
  grading-report.json
  grader-quality-audit.json
  report.md
  trace/
```

The Review page should consume `cleaned-evidence.json`. The Report page should consume `grading-report.json` and `report.md`.

## Quality Gates

Minimum gates:

- `packageRunAlignment`
- `collectionCoverage`
- `evidenceCompleteness`
- `noiseSeparation`
- `contaminationDetection`
- `exposureSafety`
- `rubricAlignment`
- `caseTypeScoringFit`
- `redLineApplication`
- `aggregationReasonableness`
- `reportActionability`
- `traceCompleteness`

Gate statuses:

- `pass`
- `warn`
- `fail`
- `not_applicable`

The skill should prefer `warn + caveat + continue` over hard blocking, unless the evidence would make the report actively misleading.

## Hard Boundaries

- Do not generate new eval cases.
- Do not rewrite raw collected evidence.
- Do not treat adapter/capture notes as model reasoning.
- Do not score hidden facts unless exposed to the tested products or reasonably inferable from their output.
- Do not equate citation count with grounding quality.
- Do not punish a provider for not exposing a field unless that missing field prevents task success or trust.
- Do not let one red-line failure automatically decide the whole task-space verdict unless severity/frequency/core-scenario importance warrants it.
- Do not output only a prose report; structured artifacts are required.
- Do not output only numeric scores; product judgment narrative is required.

## Open Questions For User Review

Resolved by user feedback:

1. `communicationFit` should be asked as a scoring option before grader/report generation and recorded as a frontend development requirement.
2. Case-level scores use `1-5`; task-space dimension scores and optional total score can use `0-100`.
3. Verdict taxonomy is accepted, but the report must emphasize dimension-level reasoning, failure extraction, and challenger optimization recommendations.
4. `targetAudienceExperienceFit` is a plus factor, not mandatory, and should not dominate the total score.
5. Post-report human override is not needed for MVP; presentation and download structure matter more.

Remaining design detail:

- decide exact UI placement for the `communicationFit` scoring option after Review and before Grader/Report;
- decide whether HTML export is needed in the first report implementation or Markdown+JSON is sufficient.
