# Judgment Framework

Use this reference when turning cleaned evidence into case-level and task-space judgments.

## Four-Layer Model

### 1. Evaluation Validity

Ask whether the run supports a decision:

- Is the package approved or at least clearly marked as draft?
- Are collected cases a meaningful subset?
- Which case types are missing?
- Are the missing cases likely to affect verdict?
- Are evidence fields clean enough?
- Are provider/capture differences understood?
- Are target users and task-space goals clear enough?

Validity does not directly grade either product.

### 2. Case-Level Judgment

For each case, judge each side and then compare pairwise.

The case judgment should include:

- dimension scores;
- pairwise winner;
- winner confidence;
- failure types;
- red-line caps;
- evidence refs;
- uncertainty;
- human review hints.

Case briefs may be used to navigate long evidence, but every important case judgment must be grounded in full cleaned/raw evidence. If the grader only inspected a brief, mark the judgment as lower confidence and recommend human review.

Evidence refs should be as specific as the available artifact structure permits. Prefer:

```text
caseId -> turnIndex -> side -> field -> span/quote
```

over case-level-only refs. Case-level refs are acceptable for dry runs and early MVP output, but the quality audit must flag them as coarse.

For major claims, include short `evidenceSnippets` when possible. A snippet is not a long transcript dump; it is a compact quote or excerpt that lets a reviewer inspect the basis for a claim such as fabrication, context drift, strong decomposition, or unsafe advice. Each snippet should include `caseId`, `turnIndex`, `side`, `field`, `quote`, and `whyItMatters`.

For missing or skipped cases:

- set `gradeReadiness` to `skipped` or `blocked`;
- set `pairwiseWinner` to `not_scored`;
- set `sideScores.baseline` and `sideScores.challenger` to `null`;
- do not cite nonexistent output fields such as `cleanFinalOutput`;
- write a caveat explaining that the case is excluded from aggregate scoring.

Never encode missing evidence as a `1/5` score. That makes the report look like both products performed badly when in fact no score was possible.

### 3. Capability Inference

Summarize patterns across cases:

- stable strengths;
- repeated failure modes;
- case-type brittleness;
- risk sensitivity;
- evidence/trust patterns;
- user-effort patterns;
- target-audience or communication fit signals;
- challenger-specific differentiated value.

Do not infer broad product capability from one narrow case unless marked as tentative.

### 4. Task-Space Product Verdict

The final verdict answers:

> Does the challenger beat or meaningfully challenge the ceiling baseline in this task space?

Use scores, but do not mechanically average away important product judgment.

Consider:

- task-space dimension scores;
- case importance;
- risk severity/frequency;
- missing coverage;
- target-user value;
- differentiated product value;
- whether failure patterns are fixable;
- whether a niche win matters.

## Evidence Reasoning Types

Every important judgment should separate:

- `observed`: directly visible in output/trace;
- `inferred`: reasonably inferred from behavior;
- `normative`: expected by the case/rubric/task standard.

Example:

- Observed: the answer gives a 3-day plan.
- Inferred: it understands time pressure.
- Normative: it should prioritize highest-likelihood interview questions first.

Do not present inference as direct observation.

## Pairwise And Absolute Judgment

Use both:

- `absolute`: how good each side is on a 1-5 scale;
- `pairwise`: which side is better for this case.

This matters because:

- both sides can be poor;
- both can be good but optimize different values;
- challenger may lose overall but win a meaningful niche;
- baseline may win while still exposing optimization ideas.

## Failure Type Extraction

Every low score or pairwise loss should map to failure types such as:

- wrong intent;
- generic answer;
- missing constraints;
- lost state;
- unsupported factual certainty;
- unsafe or unethical advice;
- over-refusal;
- over-sycophancy;
- user-effort inflation;
- poor communication fit;
- no differentiated value;
- capture/evidence uncertainty.

Failure type is as important as score because it feeds product roadmap.

## Red-Line Logic

Red-line failures cap case or dimension scores.

They do not automatically decide the entire task-space verdict unless:

- severe;
- repeated;
- central to high-frequency/core scenarios;
- likely to break user trust or product adoption.

Record:

- failure id;
- affected side;
- affected dimensions;
- evidence refs;
- cap applied;
- aggregate implication.

Red-line logic is two-stage:

1. apply the cap at the affected case/dimension first;
2. aggregate impact only after considering severity, frequency, case importance, and whether the failure is central to user trust in this task space.

This preserves both truths: a product can win the task space while still carrying a serious release-blocking caveat, and a single edge-case failure should not automatically erase broad task success.

## Uncertainty

Uncertainty is better than fake precision.

Use uncertainty when:

- final answer is missing;
- evidence channel is unavailable;
- capture notes suggest contamination;
- source support cannot be verified;
- both outputs are acceptable but optimize different goals;
- product UI hides relevant trace;
- grading depends heavily on target-audience preference not confirmed by user.

When a case type has thin coverage, downgrade claims about that capability. For example, if scripted multi-turn cases are missing, multi-turn trajectory conclusions should be framed as an initial signal rather than a settled verdict.
