# Self-Critique

Use this reference after generating a draft runtime eval package and before returning the final package to the harness or UI.

## Purpose

The self-critique pass is a required evaluator-mode quality loop. It exists to catch weak eval-set generation before the user spends time collecting model outputs.

It should:

- test whether the package can actually support SBS collection, grading, and reporting;
- detect vague task definitions, shallow coverage, duplicate cases, unusable turn scripts, weak rubrics, and hidden assumptions;
- preserve a reviewable trace of what the generator considered and changed;
- aggregate unresolved questions into `confirmationBacklog`;
- avoid pretending the draft is better than it is.

The self-critique is not a separate final grader for Doubao or the challenger. It evaluates the eval package itself.

## Anti-Performative Critique Rule

The draft package must be the generator's best first attempt.

Do not intentionally under-generate, omit obvious cases, leave easy-to-fix gaps, or stage a weaker draft to make the critique/revision loop appear useful.

The critique must evaluate the actual draft, not a deliberately weakened version. If the critique finds no major issues, that is acceptable. Record a `note` finding or an empty/low-severity critique honestly rather than manufacturing problems.

Good critique behavior:

- catch problems the generator genuinely missed;
- identify tradeoffs that became visible only after seeing the full package;
- make uncertainty explicit;
- revise meaningful issues that can be fixed without new user input.

Bad critique behavior:

- leaving planned cases out of the draft so they can be "discovered" later;
- adding superficial findings just to show activity;
- claiming a revision happened when the generated package did not actually change;
- using hidden knowledge of the pilot test to make the trace look cleaner than it was.

## Required Loop

1. Generate the full draft package first.
2. Switch to evaluator mode.
3. Review the draft against component quality gates.
4. Produce structured critique findings.
5. Apply one revision pass for issues that can be fixed without new user input.
6. Move unresolved, user-dependent issues into `confirmationBacklog`.
7. Preserve the critique trace, revision summary, and remaining risks.

Do not use self-critique as a strong interactive gateway. If the issue is not blocking, keep the package runnable and make the uncertainty visible.

## Evaluator Mode Rules

When switching to evaluator mode, inspect the package as if you were the next agent responsible for running collection and grading.

Ask:

- Can a collection operator or harness run this package without reading the generator's mind?
- Can a grader know what to inspect and what not to inspect?
- Can the tested model avoid seeing hidden/evaluator-only information?
- Can the report explain both overall winner and dimension-level pockets of strength?
- Are unresolved assumptions visible enough for a user review step?

Do not reward yourself for having many fields. Prefer concise, high-signal, executable content.

## Coverage Representativeness Humility

Synthetic eval packages cannot prove that a task space is statistically represented unless the user provides real traffic data, user logs, production bad cases, or an explicit sampling frame.

The self-critique must separate:

- `decision coverage`: whether the generated cases cover the product decision, target users, major jobs, risks, and failure modes described in the Arena Spec;
- `sample representativeness`: whether the cases represent the true distribution of real user traffic or production requests.

Default policy:

- Treat MVP-scale generated sets as decision-support coverage, not as statistically representative benchmarks.
- Do not claim that 12-20 synthetic cases represent the whole task space.
- If no real logs, seed cases, or sampling frame were provided, mark representativeness as a limitation in `coverageGaps`, `knownUnknowns`, `generationTrace`, `selfCritiqueTrace`, and report caveats.
- If the user provides logs, bad cases, or seed examples, check whether the case mix reflects them and whether any important slices are missing.
- If a generated set over-focuses on the generator's imagined scenarios, create a finding and add a confirmation item asking for seed cases, traffic slices, or priority user jobs.
- Preserve useful high-signal synthetic cases, but do not inflate confidence because the package is structurally complete.

## Finding Shape

Each finding should include:

- `findingId`
- `severity`: `blocker`, `major`, `minor`, or `note`
- `component`
- `issue`
- `whyItMatters`
- `recommendedFix`
- `fixApplied`
- `remainingRisk`
- `confirmationBacklogRef`
- `affectedCaseRefs`
- `affectedDimensionRefs`

Severity guidance:

- `blocker`: package cannot be run, or would produce invalid/contaminated eval results.
- `major`: package can run, but a meaningful part of coverage, grading, or reporting would be misleading.
- `minor`: useful improvement, but not likely to invalidate results.
- `note`: caveat, future improvement, or intentional limitation.

If `fixApplied` is `false`, `remainingRisk` must be explicit. If the fix requires user input, link or create a `confirmationBacklogRef`.

## Quality Gate Results

In addition to findings, record a compact `qualityGateResults` object so UI and harness code can show pass/fail/warn status without parsing prose.

Use gates such as:

- `arenaSpecSpecificity`
- `coverageBalance`
- `coverageRepresentativeness`
- `caseExecutability`
- `caseDiversity`
- `modelEvaluatorSeparation`
- `multiTurnRuntimeReadiness`
- `rubricCaseMapping`
- `reportReadiness`
- `confirmationBacklogCompleteness`
- `traceCompleteness`

Gate statuses:

- `pass`
- `warn`
- `fail`
- `not_applicable`

Each gate should include a short reason.

## Component Checks

### Arena Spec

Check:

- Is the decision question specific enough to guide case generation?
- Is `evaluationScenario` more specific than a broad task-space label?
- Are target users, jobs, product surfaces, baseline, and challenger clear?
- Are facts separated from assumptions?
- Are confidence and known unknowns honest?
- Are missing confirmations reflected in `confirmationBacklog`?
- If target-audience, style, source, or domain fit matters, is it explicitly captured rather than silently assumed?

Blocker examples:

- no usable decision question;
- no baseline or challenger;
- task space too broad and no evaluation scenario;
- core product surface unknown.

### Coverage Plan

Check:

- Are scored, diagnostic, baseline-insight, and disabled dimensions separated?
- Are dimension weights plausible and limited to scored dimensions?
- Is product experience/persona scoring configurable rather than assumed?
- Does the case mix match task complexity, risk, and MVP scale?
- Does the package distinguish decision coverage from true traffic/user representativeness?
- If no logs, seed cases, or sampling frame were provided, are representativeness limits visible rather than hidden?
- Are coverage gaps stated instead of hidden?
- Are formal-scale or high-burden choices marked for confirmation?
- If audience/source/domain fit is central to the product decision, is it represented in scored or diagnostic dimensions without confusing it with disabled `productExperience`?

### Eval Cases

Check:

- Is each case realistic, task-specific, and executable?
- Is each case synthetic but not falsely presented as real user research?
- Does each case have user-facing, evaluator-facing, and hidden intent separated where needed?
- Is each case gradeable with expected outcomes, unacceptable outcomes, discriminative signal, and grader refs?
- Are cases diverse rather than duplicates or shallow variants?
- Are positive, negative, boundary, contrast, risk, and multi-turn needs represented when relevant?
- Do cases cover the Arena Spec's most important decision slices without pretending to mirror real traffic distribution?
- Is manual collection burden reasonable for the requested scale?
- If audience/source/domain fit is part of the Arena Spec, are there cases that probe it as task value rather than persona preference?

### Turn Scripts

Check:

- Do multi-turn cases have matching turn scripts?
- Are scripts driver policies, not brittle fixed transcripts, unless fixed mode is intentional?
- Does each turn separate `modelFacingUserMessage` from `evaluatorInstruction`?
- Are branch rules available for drift, clarification, refusal, and overpromise?
- Does `runtimeStateTemplate` tell the harness what context to pass each turn?
- Is package/case/turn cursor state explicit enough to prevent the local model from relying on chat memory?
- Are do-not-reveal fields protected?

### Rubric Suggestions

Check:

- Are rubrics evaluator-facing only?
- Do rubric items map to case types and concrete cases?
- Do rubric items align with coverage-plan dimension states?
- Are score anchors task-space instantiated?
- Are red-line failures structured and meaningful where needed?
- Does judge planning allow deterministic, LLM, and human review paths without forcing human review?
- Is uncertainty allowed and reportable?
- If native context or target-audience fit is rewarded, does the rubric also penalize unsupported live, recency, source-certainty, or verification claims?

### Report Metadata

Check:

- Can the report produce an overall SBS verdict?
- Can it explain dimension wins and loss patterns?
- Can it preserve cases where a challenger loses overall but wins an important niche dimension?
- Can it report risk failures, baseline insight, uncertainty, and recommended optimizations?
- Are raw artifacts and trace links represented?

### Trace And Confirmation

Check:

- Does `generationTrace` include artifact refs that the local validator or product artifact resolver can actually open?
- Does `selfCritiqueTrace` include findings, quality gates, revision summary, and remaining risks?
- Does the combined trace artifact set include a human-readable `case-index.md`?
- Are user-dependent decisions captured in `confirmationBacklog`?
- Are non-blocking skipped confirmations preserved as known unknowns or caveats?

## Revision Policy

Apply exactly one revision pass by default.

Apply fixes when:

- the fix follows directly from the generated package;
- the fix improves executability, case diversity, rubric mapping, or report readiness;
- no new user preference is required.

Do not apply fixes when:

- the choice depends on PM judgment;
- the product UI needs to ask the user;
- the change would silently narrow or expand scope;
- the generator is guessing domain facts it does not know.

When a user-dependent issue remains, add or link a `confirmationBacklog` item and explain the remaining risk.

## Revision Summary

`revisionSummary` should describe:

- what was changed in the revision pass;
- which components were improved;
- which issues remain;
- which unresolved items should be shown to the user.

Do not hide remaining weaknesses. A useful critique trace is allowed to admit that the package is MVP-quality, partial, or dependent on future confirmation.

## Trace Artifacts

In debug mode, save or reference:

- input;
- draft package before critique;
- self-critique findings;
- revised package after critique;
- validation result;
- human-readable summary;
- `case-index.md`;
- unresolved confirmation backlog.

In product mode, store the same logical artifacts in the app's generation artifact store and expose them in a Generation Trace or "Why this eval set?" panel.

Use `traceArtifactRefs` inside `selfCritiqueTrace` when paths or artifact IDs are available.

Validation modes:

- `--mode local`: refs must be local relative file paths that exist beside the runtime package, and the trace set must include `case-index.md`.
- `--mode product`: refs may be artifact IDs, store-scoped refs, or URLs. The validator checks that a case-index/audit-index artifact ref is present, but the harness must resolve it and verify artifact-store existence.

## Minimum Output Shape

`selfCritiqueTrace` should include:

- `findings`
- `qualityGateResults`
- `revisionPasses`
- `revisionSummary`
- `unresolvedConfirmationBacklogRefs`
- `traceArtifactRefs`
- `overallReadiness`

`overallReadiness` should be one of:

- `ready_to_run`
- `ready_with_caveats`
- `needs_user_confirmation`
- `blocked`
