# Chatbot Eval-Set Generator Implementation Log

Created: 2026-06-07

## Restart Protocol

If context is compacted or a future agent resumes this work, read these first:

1. `docs/eval-set-generator-sprint.md`
2. `docs/chatbot-eval-set-generator-skill-brief.md`
3. `docs/chatbot-eval-set-generator-implementation-log.md`
4. `skills/chatbot-eval-set-generator/SKILL.md`

Then inspect:

- `skills/chatbot-eval-set-generator/references/`
- `skills/chatbot-eval-set-generator/schemas/`
- `skills/chatbot-eval-set-generator/scripts/validate_eval_package.mjs`

## Accepted Rules From User

- The skill is invoked by the future SBS Web App / harness / product workflow, not ordinary chat.
- The UI collects form-like inputs; the harness normalizes them into the generation request.
- Clarification is allowed only when truly necessary, and should return structured questions to UI. It must not become a strong gateway by default.
- Global confirmation policy: generate the full draft package first when possible, record all uncertainty in a confirmation backlog, ask the user after generation, revise once from the user's answers, then proceed to SBS collection/eval.
- If the user skips a non-blocking confirmation item, preserve it as a known unknown and report caveat. Do not block the workflow.
- `SKILL.md` should contain the stable workflow and routing instructions, not all quality details.
- Self-critique is a required structured loop, not vague self-review.
- Trace preservation is mandatory in every invocation.
- In debugging mode, traces are saved under local artifacts and linked for human review.
- In product mode, traces are saved in the app generation artifact store and exposed through a Generation Trace / Why this eval set? panel.
- Each quality reference file must be reviewed one by one before treated as fully accepted skill knowledge.
- The restaurant recommendation example is only a complete-package few-shot example, not the eval set itself and not a domain rule.

## Current Implementation State

Created repo-local skill source:

```text
skills/chatbot-eval-set-generator/
├── SKILL.md
├── agents/openai.yaml
├── references/
├── schemas/
└── scripts/validate_eval_package.mjs
```

Reference draft files created:

1. `arena-spec-quality.md`
2. `coverage-plan-patterns.md`
3. `case-quality-checklist.md`
4. `turn-script-policy.md`
5. `rubric-handoff.md`
6. `self-critique.md`
7. `example-complete-runtime-eval-package.md`

Schemas created:

- `schemas/runtime-eval-package.schema.json`
- `schemas/eval-generation-critique.schema.json`

Validator created:

- `scripts/validate_eval_package.mjs`

Installed local Codex skill copy:

- `/Users/bytedance/.codex/skills/chatbot-eval-set-generator/`

Synced repo-level schemas for harness/app use:

- `schemas/runtime-eval-package.schema.json`
- `schemas/eval-generation-critique.schema.json`

## Validation Done

- Parsed both schema JSON files successfully with Node.
- Ran validator without args and confirmed it returns usage.
- Ran repo-local validator against `/private/tmp/minimal-runtime-eval-package.json`: passed.
- Ran installed validator against `/private/tmp/minimal-runtime-eval-package.json`: passed.
- After revising `arena-spec-quality.md`, updated `runtime-eval-package.schema.json` to require `evaluationScenario` and `confidence`, updated the minimal fixture, and reran repo-local and installed validators: passed.

## Reference Review Status

- `arena-spec-quality.md`: first review completed on 2026-06-07.
  - Key accepted principle: broad task-space labels such as "restaurant recommendation" are not enough for high-signal eval generation.
  - Arena Spec should include a more specific `evaluationScenario` or `decisionContext`.
  - UI should collect task-space label plus specific evaluation scenario; harness should normalize both.
  - Confidence uses `high` / `medium` / `low`, not a 0-1 score.
  - Global confirmation flow added: generator should produce the full draft package first when possible, aggregate all questions into `confirmationBacklog`, let the user answer in one review round, revise the package, and only then start SBS collection/eval.
  - `confirmationBacklog` is now a required top-level package field in `runtime-eval-package.schema.json`.
- `coverage-plan-patterns.md`: first review completed on 2026-06-07.
  - Key accepted principle: coverage plan translates Arena Spec into scored dimensions, diagnostic dimensions, baseline-only insights, case scale, and case mix.
  - Dimension states now include `scoredDimensions`, `diagnosticDimensions`, `baselineInsightDimensions`, and `disabledDimensions`.
  - Product experience/persona can be scored, diagnostic only, baseline insight only, disabled, or need user confirmation.
  - Scale presets are `smoke`, `mvp`, `formal`, and `regression`, but current SBS MVP should not exceed `mvp` by default.
  - `mvp` scale is 12-20 cases and is the short-term upper bound unless explicitly overridden.
  - `formal` scale is future-facing and should add a confirmation warning about human review burden.
  - Coverage plan now records `coverageGaps` and `confirmationBacklogRefs`.
  - Updated `runtime-eval-package.schema.json` and minimal fixture; repo-local and installed validators passed.
- `case-quality-checklist.md`: first review completed on 2026-06-07.
  - Key accepted principle: eval cases are synthetic, executable user-task simulation units; generator can construct cases but must not present constructed details as real user research facts.
  - Added user/evaluator distinction: `userFacingIntent`, `evaluatorIntent`, and `hiddenIntent`.
  - Added `scenarioArchetype`, `collectionMode`, `estimatedUserEffort`, and `confirmationBacklogRefs`.
  - `adaptive_multi_turn` remains in schema, but MVP only generates driver policy and turn guidance; it does not promise automatic simulation.
  - Case quality now includes discriminative signal, manual collection feasibility, duplicate/shallow-variant rules, positive/negative/boundary/contrast/adversarial-but-realistic case patterns.
  - Added principle: schema is a thinking scaffold, not a content template; prefer fewer high-signal realistic cases over fully populated artificial cases.
  - Added model-facing vs evaluator-facing split: `modelFacingPrompt`, `collectionInstructions`, and `doNotRevealToModel`.
  - Updated `runtime-eval-package.schema.json` and minimal fixture; repo-local and installed validators passed.
- `turn-script-policy.md`: first review completed on 2026-06-07.
  - Key accepted principle: multi-turn scripts must reference and preserve upstream Arena Spec, Coverage Plan, and Eval Case information.
  - Turn scripts are conversation driver policies, not only fixed messages.
  - Added model-facing vs evaluator-facing split at turn level: `modelFacingUserMessage` and `evaluatorInstruction`.
  - Added `scriptMode`: `fixed`, `guided_adaptive`, or `hybrid`.
  - Added `maxTurns`, `stateToTrack`, `fairnessPolicy`, `branchRules`, `ifModelOverpromises`, `trajectoryNotesToCollect`, and `collectionBurden`.
  - MVP supports adaptive multi-turn as manual/agent-followable driver policy, not automatic user simulation.
  - Runtime guarantee added: during actual multi-turn eval, local models must not rely on chat memory. Harness must pass an explicit `turnExecutionState` packet every turn.
  - Added `runtimeStateTemplate` to turn scripts so the harness knows which cursor, upstream context, transcript, decision, safety, and output fields to pass.
  - The runtime state packet includes `caseIndex`, `caseCount`, `caseId`, `currentTurnIndex`, `maxTurns`, `progressLabel`, upstream Arena/Coverage/Case summaries, prior turns, last model response, branch rules, tracked state, and do-not-reveal fields.
  - Added approved package binding: runtime simulator must be bound to `evalPackageId` and `evalPackageVersion`; harness owns cursor and lookup of `evalCases[caseId]` and `turnScripts[caseId]`.
  - Added runtime prompt assembly contract: every local-model simulator prompt is assembled from the approved package plus current run state, never from remembered chat context or unrelated eval sets.
  - Added runtime guardrails: validate same case/turn, branch rule existence, stop consistency, tracked state changes, and no leakage of hidden/evaluator-only information before sending a simulated user message to the tested product.
  - Updated `runtime-eval-package.schema.json`; repo-local and installed validators passed.
- `rubric-handoff.md`: first review completed on 2026-06-07.
  - Key accepted principle: rubric suggestions are evaluator-facing handoff artifacts, not final grading results and never model-facing prompts.
  - Different case types and concrete cases may need different grading logic; rubric items now include `appliesToCaseTypes`, `caseRefs`, and `graderRefs`-style alignment.
  - Rubric items align with coverage-plan dimension states: `scored`, `diagnostic_only`, `baseline_insight_only`, and `disabled`.
  - Only `scored` dimensions should carry meaningful overall-score weight. Diagnostic and baseline-insight rubrics should keep `weightSuggestion` at 0 and explain report usage through `aggregationHint`.
  - Added explicit score design fields: `scoreAnchors`, `scoringMethod`, positive/negative signals, and evidence sources.
  - Red-line failures are now structured evaluator-facing score caps with `failureId`, `description`, `scoreCap`, `appliesWhen`, `evidenceRequired`, and `suggestedAction`.
  - Human review and human sampling can be recommended for subjective, risky, or uncertain cases, but are not mandatory gates. If skipped, uncertainty/caveats should be preserved in the report.
  - Added `judgePlan`, `uncertaintyPolicy`, `aggregationHint`, `humanOverridePolicy`, and `confirmationBacklogRefs`.
  - Validator now checks rubric case references, dimension states, red-line failure structure, scored/non-scored weight mismatches, and overly strong human-sampling language.
  - Updated `runtime-eval-package.schema.json` and minimal fixture; repo-local and installed validators passed with no warnings.
- `self-critique.md`: first review completed on 2026-06-07.
  - Key accepted principle: self-critique evaluates the generated eval package itself, not Doubao or the challenger.
  - Self-critique is a required evaluator-mode quality loop after full draft generation and before final package handoff.
  - It should not become a strong interactive gateway; non-blocking uncertainty should be visible in `confirmationBacklog`, known unknowns, trace, or report caveats.
  - Added evaluator-mode questions around package executability, grader usability, model/evaluator separation, report readiness, and unresolved assumptions.
  - Added component quality gates for Arena Spec, Coverage Plan, Eval Cases, Turn Scripts, Rubric Suggestions, Report Metadata, Trace, and Confirmation.
  - Added structured `qualityGateResults` with gate statuses `pass`, `warn`, `fail`, and `not_applicable` so UI/harness can display self-critique status without parsing prose.
  - Findings now include `confirmationBacklogRef`, `affectedCaseRefs`, and `affectedDimensionRefs`.
  - Added one-pass revision policy: fix issues that do not require new user preference; move user-dependent choices into `confirmationBacklog`.
  - Added `revisionPasses`, `unresolvedConfirmationBacklogRefs`, `traceArtifactRefs`, and `overallReadiness`.
  - `overallReadiness` values are `ready_to_run`, `ready_with_caveats`, `needs_user_confirmation`, and `blocked`.
  - Validator now checks quality gate shape, readiness value, unresolved confirmation refs, revision passes, and trace artifact refs.
  - Updated `eval-generation-critique.schema.json` and minimal fixture; repo-local and installed validators passed with no warnings.
- `example-complete-runtime-eval-package.md`: first review completed on 2026-06-07.
  - Key accepted principle: the complete example is a compact few-shot for package structure, not a permanent restaurant recommendation eval set or domain rule.
  - Updated the example to include all nine top-level runtime package objects, including `confirmationBacklog`.
  - Example now demonstrates model-facing vs evaluator-facing separation, one single-turn case, one scripted multi-turn case, runtime state template, branch rules, structured rubric, report metadata, generation trace, self-critique quality gates, revision pass, and unresolved confirmation backlog.
  - The example explicitly warns that it is smaller than real MVP scale; real MVP should normally expand to 12-20 cases.
  - Extracted the JSON block from the Markdown example into `/private/tmp/example-runtime-eval-package.json` and validated it with repo-local and installed validators: passed with no warnings.
  - Updated `SKILL.md` wording from "Self-Critique Loop" to "Self-Critique And Revision Loop" so future agents understand the loop should critique and then revise the eval package when possible.

## Next Steps

1. All seven reference files have completed first review.
2. Restaurant recommendation regression test completed on 2026-06-07 for Diandian vs Doubao.
   - Artifact folder: `artifacts/eval-generation/20260607-restaurant-diandian-vs-doubao/`
   - Generated a revised MVP package with 15 cases, 4 turn scripts, and 5 rubric suggestions.
   - Saved `input.json`, `draft-package.json`, `self-critique.json`, `revised-package.json`, `validation.json`, `summary.md`, `case-index.md`, and `make-package.mjs`.
   - Draft and revised packages both passed `scripts/validate_eval_package.mjs`; revised package passed with no warnings.
   - Key open confirmation: how to reward Diandian's Xiaohongshu-native content advantage when useful but not independently verified.
   - Follow-up accepted principle: if target-audience/style/domain/native-context fit is present in the user's evaluation goal, the skill should reward useful fit as task value. If it is not present, do not invent it.
   - Follow-up accepted principle: useful native-context fit should not excuse unsupported live facts, recency, source certainty, queue/booking, price, availability, safety, or verification claims.
   - Follow-up accepted principle: every debug/product generation run should include a human-readable `case-index.md` with Arena core conclusion, Coverage core conclusion, multi-turn evaluation note, case table, scored/diagnostic/disabled dimensions, and open confirmation items.
   - Follow-up accepted principle: prohibit performative critique. The draft package must be the generator's best first attempt; do not intentionally under-generate, omit obvious cases, or stage fixable gaps to make self-critique look useful.
   - Follow-up fix: `scripts/validate_eval_package.mjs` is now a two-stage validator. It first validates against `runtime-eval-package.schema.json` including the referenced `eval-generation-critique.schema.json`, then runs custom consistency checks for cross-object rules such as case references, turn script coverage, rubric refs, and confirmation backlog refs.
   - Validation output now separates `schemaErrors` and `consistencyErrors` so "passed validation" no longer means only lightweight custom checks passed.
   - Follow-up fix: added `evalSetCoveragePlan.taskFitModule` as a required sidecar module so target-audience/style/domain/native-context fit can be scored or diagnosed without being confused with `productExperience`.
   - `taskFitModule` records status, relationship to product experience, fit/source signals, scored-through dimensions, reward policy, penalty policy, rationale, and confirmation refs.
   - Validator now rejects active `taskFitModule` configurations that score through or masquerade as `productExperience` when `productExperience` is disabled.
   - Follow-up fix: validator now enforces dimension consistency. `dimensionWeights` must only include scored dimensions, every scored dimension must have a weight, scored weights must sum to 1, `enabledDimensions` must equal scored + diagnostic + baselineInsight dimensions, and disabled dimensions must not overlap with enabled/scored/diagnostic/baselineInsight sets.
   - Follow-up fix: separated `rubricSuggestions[].appliesToCaseTypes` from flexible rubric tags. `appliesToCaseTypes` is now restricted to schema case type enums only; broader/task-space-specific labels such as `risk_pushback`, `constraint_following`, and `native_context_fit` belong in `appliesToCaseTags`.
   - Validator now checks that each rubric item's declared `appliesToCaseTypes` exactly matches the case types implied by its `caseRefs`, preventing grader builders from silently dropping cases during enum-based routing.
   - Follow-up fix: trace artifact preservation is now validated at the file layer in debug/local-file mode. `generationTrace.artifactRefs` and `selfCritiqueTrace.traceArtifactRefs` must point to existing local files relative to the package directory, may not escape that directory, and the combined trace artifact set must include `case-index.md`.
   - The schema now requires `generationTrace.generationRunId`, non-empty `generationTrace.artifactRefs`, and non-empty `selfCritiqueTrace.traceArtifactRefs`; the validator adds existence and `case-index.md` checks because JSON Schema alone cannot verify local files.
   - Follow-up fix: validator artifact checks are now mode-aware. `--mode local` keeps strict local relative-path existence checks and requires `case-index.md`; `--mode product` allows artifact IDs, store-scoped refs, and URLs, but still requires a case-index/audit-index artifact ref. Product-mode existence resolution is delegated to the future app harness/artifact store.
   - Follow-up fix: added an explicit multi-turn `harnessExecutionContract` to each `turnScript`. It records runtime mode, harness-owned cursor, side-blind simulation, branch-rule-only decision policy, fallback policy, pre-send validation checks, replay-log fields, planner/drafter split status, and human-review fallback.
   - Validator now rejects multi-turn scripts that omit required runtime state fields (`evalPackageId`, `evalPackageVersion`, `caseId`, `currentTurnIndex`, `sideLabel`, `priorTurns`, `lastModelResponse`), omit required simulator output fields, fail side-blind/harness-owned/branch-only rules, omit required pre-send validations, omit replay-log fields, or define branch rules without stable `branchRuleId`.
   - Follow-up fix: renamed the simulator-visible runtime field from `side` to `sideLabel` to avoid conflicting with `sideBlind=true`. The harness may know the real side internally, but the simulator state packet should only expose neutral labels such as `Side A` or `Side B`.
   - Follow-up fix: relaxed `harnessExecutionContract.decisionPolicy` from one-size-fits-all `branch_rules_only` to mode-aware policies. `fixed` scripts must use `fixed_sequence` with `branchFallbackPolicy=not_applicable`; `guided_adaptive` and `hybrid` scripts still require `branch_rules_only` with `allowed_adaptive_moves_or_needs_human_review`.
   - Follow-up fix: synchronized `turn-script-policy.md` with the current schema and validator. Required-field checklists and the worked example now include `runtimeStateTemplate`, `harnessExecutionContract`, `sideLabel`, simulator output fields, mode-aware decision policy, and stable `branchRuleId` values.
   - Follow-up fix: updated the restaurant regression artifact's `selfCritiqueTrace.qualityGateResults` to include `coverageRepresentativeness`. It is intentionally `warn` because the package covers important PM decision slices but is synthetic and not based on real user logs, seed cases, or a sampling frame.
   - MVP interpretation: multi-turn cases are executable as manual guided scripts until the web harness implements guarded LLM simulation. Automated runtime simulation should not be claimed unless package binding, side blindness, branch selection, pre-send validation, and replay logging are actually enforced.
3. Use regression findings to tighten references, schema, or validator before building the SBS workbench UI around this skill.
