---
name: chatbot-sbs-grader
description: Use only when invoked by the SBS workbench, local harness, or another explicit product workflow to clean collected chatbot SBS evidence, grade baseline-vs-challenger outputs, and generate task-space decision reports. This skill consumes an approved RuntimeEvalPackage, collected RunState artifacts, rubric suggestions, exposure contracts, and provider/capture profiles, then produces a CleanedEvidencePackage, case-level judgments, aggregate SBS verdict, quality audit, and report-ready Markdown/JSON. Do not use for eval-set generation, ordinary brainstorming, requirement clarification, website capture adapter building, or grading outputs that were not collected through an explicit SBS task.
---

# Chatbot SBS Grader

Turn collected SBS chatbot outputs into cleaned evidence, case-level judgments, task-space verdicts, and PM-ready reports.

This skill is an internal grading/report engine for the SBS workbench. It is not a generic LLM judge and not a normal conversational advice workflow.

## Hard Boundaries

- Do not generate new eval cases.
- Do not simulate user turns.
- Do not build website capture adapters.
- Do not rewrite or delete raw collected evidence.
- Do not score hidden facts unless they were visible to the tested product, reasonably inferable from output behavior, or are general safety/trust norms.
- Do not treat adapter/capture notes as model reasoning.
- Do not equate citation count with grounding quality.
- Do not punish a product merely because its UI does not expose a provider-specific field.
- Do not let one red-line failure automatically decide the whole task-space verdict unless severity, frequency, and core-scenario importance warrant it.
- Do not treat case briefs, summaries, or compressed views as sufficient evidence for scoring. They are navigation aids only.
- Do not return final judgments whose important claims cannot be traced back to raw or cleaned evidence.
- Do not output prose-only reports; important fields must be structured.
- Do not output number-only scorecards; product judgment narrative is required.

## Input Contract

Expect task-scoped inputs from the SBS workbench:

- approved `RuntimeEvalPackage`;
- collected `RunState` / `current.json`;
- case curation state when available;
- provider/capture capability profiles when available;
- optional review notes;
- optional grader settings, especially whether `communicationFit` is `scored` or `diagnostic_only`.

Handle both historical run shapes:

- map-style `caseRuns` object;
- array-style `caseRuns` list.

Handle both turn field shapes:

- flat fields such as `baselineOutput`, `challengerOutput`, `baselineVisibleProcessNotes`;
- nested side objects if future harness versions add them.

## Output Contract

Produce two distinct report surfaces. Do not collapse one into the other:

- `GradingReport` JSON: app-facing structured data for progressive-disclosure UI.
- `report.md` / `report.zh.md`: complete memo-grade report sources for PDF export.

Produce JSON-first artifacts plus complete memo-grade report sources:

1. `CleanedEvidencePackage`
2. `CaseJudgmentSet`
3. `GradingReport`
4. `GraderQualityAudit`
5. `report.md`
6. validation results and trace refs

In product mode, store under:

```text
data/tasks/<taskId>/grader/
```

When invoked by the SBS frontend/backend, the app may provide explicit `outputRefs`.
Write the complete artifacts to those exact paths. The final assistant message should be a compact JSON manifest that points to the artifacts; it must not be the only place where the full report or JSON outputs exist.

In debug mode, store under:

```text
artifacts/grading/<timestamp>-<task-slug>/
```

Every product-mode or debug-mode run must preserve an invocation trace:

- invocation mode, such as `product_job`, `debug_dry_run`, or `manual_skill_run`;
- skill path and version/ref when available;
- input artifact refs;
- output artifact refs;
- validation command results;
- quality-audit result;
- known limitations of the run.

## Workflow

1. Load package, run, curation, provider profiles, and grader settings.
2. Verify package/run alignment and collection coverage.
3. Run deterministic pre-cleaning when file access is available:
   - `scripts/deterministic_preclean.mjs`
4. Load `references/evidence-cleaning-policy.md`.
5. Produce `CleanedEvidencePackage`.
   - You may produce a grader-friendly case brief, but it must link back to full cleaned/raw evidence and must not replace that evidence.
   - In product mode, also write a concise `cleaning-summary.md` when the provided output refs request it, so the Review UI can explain what changed without reading the full artifact.
6. Validate cleaned evidence:
   - `scripts/validate_cleaned_evidence.mjs`
7. If evidence is partial but usable, continue with caveats. Hard-block only when scoring would be actively misleading.
8. Before final scoring, check whether a human-reviewed evidence state exists. If not, continue only as a dry run or mark report confidence/caveats accordingly.
9. Load references needed for grading:
   - `references/judgment-framework.md`
   - `references/dimension-framework.md`
   - `references/case-type-scoring.md`
10. Produce `CaseJudgmentSet`.
    - Important dimension rationales must cite inspectable evidence refs at the finest available granularity: `caseId`, `turnIndex`, `side`, `field`, and span/quote when possible.
11. Validate case judgments:
    - `scripts/validate_case_judgments.mjs`
12. Load aggregation/report references:
    - `references/aggregation-policy.md`
    - `references/report-contract.md`
13. Produce `GradingReport` and `report.md`.
14. Run quality audit using:
    - `references/quality-audit.md`
15. Produce `GraderQualityAudit`.
16. Validate report:
    - `scripts/validate_grading_report.mjs`
17. Validate memo-grade markdown report quality:
    - `scripts/validate_report_markdown.mjs`
18. Apply one safe revision pass when the audit or markdown quality checker finds fixable issues that do not require new collection or user preference.
19. Return artifact refs, verdict summary, caveats, recommended human spot checks, and invocation trace refs.

## Reference Selection

Load only what is needed:

- Evidence cleaning: `references/evidence-cleaning-policy.md`
- Grader conceptual model: `references/judgment-framework.md`
- Case type behavior: `references/case-type-scoring.md`
- Dimensions and scoring states: `references/dimension-framework.md`
- Aggregation and verdicts: `references/aggregation-policy.md`
- Report structure: `references/report-contract.md`
- Quality audit and meta-eval: `references/quality-audit.md`
- Minimal examples: `references/examples-minimal.md`

Schemas:

- `schemas/cleaned-evidence-package.schema.json`
- `schemas/case-judgments.schema.json`
- `schemas/grading-report.schema.json`
- `schemas/grader-quality-audit.schema.json`
- `scripts/validate_report_markdown.mjs`

## Core Grading Frame

Use a four-layer reasoning model:

1. `evaluationValidity`: does the run support a decision?
2. `caseLevelJudgment`: how did each side perform on each case?
3. `capabilityInference`: what repeated strengths/failures can be inferred?
4. `taskSpaceProductVerdict`: does the challenger beat or meaningfully challenge the baseline?

For each judgment, separate:

- `observed`: directly visible in collected output or trace;
- `inferred`: reasonably inferred from output behavior;
- `normative`: expected by rubric, task, or safety/trust standards.

## Scoring Policy

- Case-level dimension scores use `1-5`.
- Aggregate task-space dimension scores use `0-100`.
- Overall task-space side scores use `0-100` and must be written to `aggregateScores.overall.baselineScore` and `aggregateScores.overall.challengerScore`, with `aggregateScores.overall.winner`.
- Treat scores as directional PM-eval scores unless the run includes explicit human calibration, repeated trials, or confidence interval methodology. Do not imply false precision.
- `communicationFit` is scored only when the UI/harness explicitly enables it; otherwise keep it diagnostic.
- `targetAudienceExperienceFit` is a plus factor, not mandatory and not dominant.
- Red-line failures cap case/dimension scores first; aggregate impact depends on severity, frequency, and task importance.
- Missing/skipped cases must use `null` / `N/A` / `not_scored`, never `1/5`.
- Separate task utility from release/safety readiness whenever red-line failures are present.

## Report Style

The final report should be:

```text
quantified evidence + product judgment narrative
```

Always include:

- headline verdict taxonomy;
- baseline and challenger overall conclusions;
- score interpretation explaining directional score limits;
- separate task utility and release/safety readiness verdicts;
- dimension scoreboard;
- complete scoreboard rows with baseline score, challenger score, winner, and challenger diagnosis;
- why-this-verdict / key reasons in the full markdown reports;
- key evidence snippets/excerpts for the most important claims;
- challenger optimization plan;
- case type breakdown;
- failure clusters and red lines;
- strength pockets and non-scored insights;
- uncertainty/caveats;
- appendix refs.

Do not create a standalone `Key Reasons` app module in `GradingReport` for the web UI. However, the full `report.md` / `report.zh.md` must include a dedicated Why This Verdict / Key Reasons section. The PDF export is generated from the full markdown report source, not from the app UI cards.

`report.md` and `report.zh.md` remain source artifacts, and product download should be PDF-first from those complete memo-grade sources.
