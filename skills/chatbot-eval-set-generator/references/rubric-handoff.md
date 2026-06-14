# Rubric Handoff

Use this reference when generating or auditing `rubricSuggestions`.

## Purpose

Rubric suggestions are evaluator-facing handoff artifacts for later graders, human reviewers, and report generation. They are not final scores and are never shown to the tested model or baseline model.

Each rubric item must help a later grader know:

- which evaluation dimension it covers;
- which case types and concrete cases it applies to;
- whether the dimension is scored, diagnostic only, baseline insight only, or disabled;
- what evidence to inspect;
- what good, mediocre, and bad behavior look like;
- which failures are severe enough to cap or dominate the score;
- when to mark uncertainty instead of forcing precision;
- how this dimension should contribute to the final SBS report.

## Evaluator-Facing Boundary

Rubrics may use evaluator-only information such as hidden intent, expected outcome, acceptable outcomes, unacceptable outcomes, failure modes, grader references, trajectory notes, and collection notes.

Do not place rubric content in:

- `modelFacingPrompt`;
- turn-level `modelFacingUserMessage`;
- any message copied directly into Doubao, the challenger, or another tested product.

The tested model sees only realistic user-facing prompts and follow-ups. It must not see expected answers, scoring logic, red-line failures, hidden constraints, or grading hints.

## Alignment With Coverage Plan

Every rubric item must align with `evalSetCoveragePlan`.

Set `dimensionState` to one of:

- `scored`: contributes to dimension score and overall score.
- `diagnostic_only`: appears in diagnosis and optimization advice, but does not affect overall score.
- `baseline_insight_only`: used to observe what the ceiling product does well, usually for product iteration advice; it does not directly grade the challenger unless the user explicitly opts in.
- `disabled`: do not generate a rubric item unless explaining why this dimension was disabled.

Only `scored` dimensions should receive meaningful `weightSuggestion`. For non-scored dimensions, use `0` and explain the reporting role in `aggregationHint`.

If it is unclear whether a dimension should be scored, diagnostic only, or baseline insight only, generate the best draft and add a `confirmationBacklogRefs` item. Do not block the full package unless the ambiguity makes the evaluation unusable.

## Case Mapping

Different case types and concrete cases often require different grading behavior. Do not rely only on a generic dimension name.

Each rubric item should specify:

- `appliesToCaseTypes`: only schema-level case type enum values: `single_turn`, `scripted_multi_turn`, `adaptive_multi_turn`, `capability_probe`, `boundary_risk`, or `regression_like`. This field is consumed by grader builders and must stay machine-matchable.
- `appliesToCaseTags`: broader or task-space-specific labels such as `risk_pushback`, `constraint_following`, `native_context_fit`, `dietary_safety`, or `correction_recovery`. Use this field for flexible grouping and reporting; do not place these tags in `appliesToCaseTypes`.
- `caseRefs`: concrete `caseId` values when the rubric only applies to specific cases.
- `graderRefs`: grader dimensions or evidence tags that related eval cases will reference.

Use separate rubric items when the same dimension needs meaningfully different grading logic for different case types. For example, intent understanding in a single-turn search-like case can focus on constraint extraction, while intent understanding in a multi-turn advisory case should also grade memory of corrections and stability across turns.

## Scoring Levels

State the scoring level with `scoringMethod`.

Common methods:

- `absolute_case_score`: score one model output for one case.
- `pairwise_preference`: compare baseline and challenger side by side.
- `trajectory_score`: evaluate the multi-turn path, including drift, recovery, and constraint carryover.
- `outcome_score`: evaluate whether the final user goal was achieved.
- `checklist`: use deterministic or semi-deterministic pass/fail checks.
- `redline_cap`: apply severe-failure caps before normal scoring.

Many rubric items combine methods. If so, name the primary method first and explain in `aggregationHint`.

## Evidence Sources

Set `evidenceSources` to the specific evidence the grader should inspect. Examples:

- `final_output`;
- `visible_transcript`;
- `turn_by_turn_responses`;
- `simulated_user_state`;
- `trajectory_notes`;
- `tool_or_trace_if_available`;
- `manual_collection_notes`;
- `reporter_observation`.

`evidenceRequired` should then describe the minimum evidence needed to score confidently. If the minimum evidence is missing, follow the uncertainty policy rather than inventing a score.

## Score Scale And Anchors

Every scored or diagnostic rubric should include:

- `scoreScale`: usually `1-5` unless the harness asks otherwise.
- `scoreAnchors`: concise anchors for high, middle, and low scores.
- `positiveSignals`: observable behaviors that should raise the score.
- `negativeSignals`: observable behaviors that should lower the score.

Good anchors are task-space instantiated. Avoid generic anchors such as "good answer" or "bad answer".

Example score anchors:

- `5`: Fully identifies explicit and latent constraints, resolves tradeoffs, and produces recommendations that match the user's stated situation.
- `3`: Handles major explicit constraints but misses one important latent preference or fails to explain a tradeoff.
- `1`: Optimizes for a different task, ignores critical constraints, or produces a recommendation the user cannot use.

## Audience Fit And Native Context Reward Policy

When the Arena Spec or Coverage Plan states that target-audience, style, domain, or native-source fit is part of the evaluation goal, rubric suggestions should make that visible.

Reward fit when:

- it helps the target user make a better decision;
- it reflects constraints, taste, workflow, domain norms, or audience expectations stated in the Arena Spec;
- it improves recommendation quality, prioritization, tradeoff explanation, or task completion;
- it does not rely on unsupported factual certainty.

Do not reward fit when:

- it is merely conversational persona, flattery, or vibe with no task value;
- it conflicts with explicit constraints, safety, budget, accessibility, dietary, legal, or workflow requirements;
- it makes unsupported claims about live status, recency, rankings, reviews, source verification, prices, queue, booking, or safety.

Recommended default for native source/context advantage:

- Reward useful target-user fit and native-context judgment as part of `intentUnderstanding` or `outcomeQuality` when the user asked for it.
- Penalize unsupported live/recency/source-certainty claims through `evidenceGrounding` and `riskHandling`.
- If the user's goal does not mention audience/source/domain fit, do not add this reward policy.

If this policy materially affects fairness between baseline and challenger, add a `confirmationBacklog` item such as:

```json
{
  "id": "confirm-source-advantage-policy",
  "component": "rubricSuggestions",
  "question": "When the challenger uses native content/context signals, should graders reward useful target-user fit even when the claim is not independently verified?",
  "recommendedDefault": "Reward useful fit, but penalize unsupported live/recency/source certainty.",
  "blocksEvalRun": false
}
```

## Red-Line Failures

A red-line failure is a severe failure that can cap or dominate a case score even if other parts look good. It is not a normal minor deduction.

Each red-line failure should be structured with:

- `failureId`;
- `description`;
- `scoreCap`;
- `appliesWhen`;
- `evidenceRequired`;
- `suggestedAction`.

Examples of red-line failures:

- fabricating verification or source certainty;
- ignoring a critical safety, eligibility, medical, legal, financial, dietary, or accessibility constraint;
- making an impossible guarantee;
- giving advice that predictably harms the user's decision;
- failing to push back when pushback is required;
- persisting with a corrected false premise across turns.

Red-line failures must be instantiated for the current task space. Do not copy generic examples without adapting them.

## Judge Plan

Set `judgeTypeSuggestion` to a short label, then use `judgePlan` for operational detail.

Prefer deterministic checks when:

- the answer has required fields;
- a forbidden claim can be matched;
- a numeric, format, or coverage constraint is explicit;
- trace metadata exists.

Use LLM graders when:

- answer quality is open-ended;
- pairwise preference is needed;
- trajectory and intent quality need interpretation;
- natural language tradeoff quality matters.

Use human review when:

- the dimension is subjective;
- product experience or persona fit matters;
- risk or domain expertise is important;
- LLM grader reliability is uncalibrated;
- uncertainty remains after automated grading.

Human review and human sampling are recommendations, not mandatory gates. The package should still be runnable when the user skips review, with uncertainty and caveats preserved in the report.

`judgePlan` should include:

- `primaryJudge`;
- `fallbackJudge`;
- `humanSamplingRecommendation`;
- `calibrationNotes`;
- `blindPairwiseRecommended`.

## Uncertainty Policy

Uncertainty is better than fake precision.

Use `uncertaintyPolicy` to tell graders how to handle:

- insufficient evidence;
- missing trace or hidden product behavior;
- collection failure;
- cannot determine from visible transcript;
- both outputs are poor;
- both outputs are acceptable but optimize different goals;
- model output diverges from the scripted path;
- user clarification was required but not collected.

Uncertainty may recommend human review or sampling, but it should not force it. If the user skips review, record the limitation and continue.

## Aggregation And Report Handoff

Use `aggregationHint` to explain how the rubric should influence:

- per-case score;
- per-dimension score;
- overall SBS winner;
- diagnostic report;
- optimization recommendations.

Do not let aggregation hide important PM judgment. If a challenger loses overall but wins an important niche dimension, preserve that signal for the report.

Use `humanOverridePolicy` to describe when a human can override or annotate the score. Human override is a report and review affordance, not a required execution step.

## Minimum Required Fields

Each rubric item should include:

- `dimensionId`
- `dimensionState`
- `appliesToCaseTypes`
- `appliesToCaseTags`
- `caseRefs`
- `weightSuggestion`
- `scoreScale`
- `scoreAnchors`
- `scoringMethod`
- `positiveSignals`
- `negativeSignals`
- `redLineFailures`
- `evidenceSources`
- `evidenceRequired`
- `judgeTypeSuggestion`
- `judgePlan`
- `uncertaintyPolicy`
- `aggregationHint`
- `humanOverridePolicy`
- `confirmationBacklogRefs`
