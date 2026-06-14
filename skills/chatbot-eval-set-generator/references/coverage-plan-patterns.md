# Coverage Plan Patterns

Use this reference when building or auditing `evalSetCoveragePlan`.

## Purpose

`evalSetCoveragePlan` translates the Arena Spec into an eval set structure.

It decides:

- which dimensions are scored;
- which dimensions are diagnostic only;
- which dimensions are baseline-only competitive insights;
- what case scale is appropriate;
- what case mix should be generated;
- why this coverage is enough for the current product decision;
- what coverage gaps should be shown to the user after generation.

The coverage plan is not a generic dimension list. It is the bridge between product decision and executable eval cases.

## Dimension States

Do not only use enabled/disabled dimensions. Use these states:

### `scoredDimensions`

Dimensions that affect the overall score and winner decision.

Use when:

- the dimension is central to the product decision;
- the user expects the challenger to compete on it;
- the evidence available is sufficient to judge it fairly.

### `diagnosticDimensions`

Dimensions that are reviewed but do not determine the overall winner.

Use when:

- the dimension helps explain failures;
- evidence is partial;
- the challenger is not expected to optimize it yet;
- the dimension is useful for roadmap suggestions.

### `baselineInsightDimensions`

Dimensions used to record what the baseline does well, without scoring the challenger against it.

Use when:

- the baseline product has a strong product experience or behavior worth learning from;
- the challenger is not yet trying to compete on that dimension;
- scoring it would unfairly punish the challenger, but ignoring it would lose product insight.

### `disabledDimensions`

Dimensions intentionally excluded.

Use when:

- the dimension is irrelevant to the task;
- the evidence is unavailable;
- the user explicitly turns it off;
- scoring it would distort the product decision.

## Default Dimensions

Start from six dimensions, then assign each one to a state:

- `intentUnderstanding`
- `outcomeQuality`
- `trajectoryControl`
- `evidenceGrounding`
- `riskHandling`
- `productExperience`

Do not blindly force every dimension into the score.

## Dimension Selection Rules

Increase or score `intentUnderstanding` when:

- user constraints are subtle;
- hidden needs matter;
- the product must ask good clarifying questions;
- the task often begins underspecified.

Increase or score `outcomeQuality` when:

- the final recommendation, answer, or plan determines product value;
- the user must make a real decision from the output;
- the product's value proposition is "better answer/result".

Increase or score `trajectoryControl` when:

- the task is naturally multi-turn;
- users refine constraints;
- early misunderstandings are common;
- the product claims to manage conversation state or long-context user goals.

Increase or score `evidenceGrounding` when:

- the task depends on real-time, local, factual, financial, health, legal, or changing information;
- unsupported claims can mislead the user;
- the product may imply it has verified facts.

Increase or score `riskHandling` when:

- wrong answers can waste money, time, trust, or create safety/compliance risk;
- the model may overpromise, fabricate verification, or avoid needed pushback;
- the user may act directly on the recommendation.

Use `productExperience` carefully:

- If the user explicitly wants to score tone, persona, emotional fit, or product feel, put it in `scoredDimensions`.
- If it is useful but not central, put it in `diagnosticDimensions`.
- If the baseline is notably strong but the challenger is not ready to compete there, put it in `baselineInsightDimensions`.
- If irrelevant or explicitly out of scope, put it in `disabledDimensions`.

## Audience Fit Is Not Always Product Experience

Do not automatically treat target-audience/style/domain fit as `productExperience`.

If the user says the product should win for a specific audience, source context, taste system, or domain workflow, that fit can be part of the task outcome itself.

Examples:

- restaurant recommendation for Xiaohongshu mainstream 18-35 first/second-tier city users;
- shopping guidance for high-income skincare users who care about ingredient tradeoffs;
- customer-support recommendations for a specific SaaS role;
- coding help for a repo's internal architecture conventions.

Coverage policy:

- If audience/source/domain fit is central to the user's evaluation goal, represent it inside scored dimensions such as `intentUnderstanding` and `outcomeQuality`, or as a task-space-specific scored dimension if the harness supports one.
- If it helps explain behavior but should not decide the winner, put it in `diagnosticDimensions`.
- If it is only useful as a baseline lesson, put it in `baselineInsightDimensions`.
- If the user explicitly disables conversation persona/product feel, do not score `productExperience`; still allow audience fit to affect outcome quality when it is part of the task goal.
- If the user's goal does not mention audience/source/domain fit, do not invent it.

When a challenger may have native source or ecosystem advantage, add a confirmation item unless the user already specified the policy.

Recommended default:

- Reward useful target-user fit, style fit, domain fit, or native-context fit when it improves the user's decision.
- Penalize unsupported live facts, source certainty, recency, ranking, queue, booking, price, availability, or safety claims.

Represent this as a separate `taskFitModule`, not as product experience.

```json
{
  "status": "disabled | scored | diagnostic_only | baseline_insight_only | needs_user_confirmation",
  "relationshipToProductExperience": "task_value_not_product_experience | product_experience | not_applicable",
  "fitSignals": ["target audience expectations", "domain taste", "workflow fit"],
  "sourceContextSignals": ["native content ecosystem", "domain corpus", "internal workflow context"],
  "scoredThroughDimensions": ["intentUnderstanding", "outcomeQuality"],
  "rewardPolicy": "Reward fit only when it improves task success or decision quality.",
  "penaltyPolicy": "Penalize unsupported live, recency, source-certainty, availability, price, safety, or verification claims.",
  "rationale": "...",
  "confirmationBacklogRefs": []
}
```

Default:

- If the user's goal clearly includes audience/source/domain fit, set `status` to `scored` or `diagnostic_only`.
- If product experience/persona is disabled but task fit matters, set `relationshipToProductExperience` to `task_value_not_product_experience`.
- If the user's goal does not imply fit, set `status` to `disabled` and `relationshipToProductExperience` to `not_applicable`.
- Do not score through `productExperience` when `productExperience` is disabled.

## Optional Product Experience / Persona Module

Represent this module explicitly:

```json
{
  "status": "scored | diagnostic_only | baseline_insight_only | disabled | needs_user_confirmation",
  "rationale": "...",
  "confirmationBacklogItemId": "..."
}
```

Default policy:

- If user turns it on, score it.
- If user turns it off, do not score it for the challenger.
- If the task is consumer-facing and experience may change perceived value, add a confirmation backlog item.
- If the challenger is not positioned around product experience, default to diagnostic or baseline insight, not scored.

## Scale Presets

The skill should understand four scale presets, but the current SBS MVP should not exceed `mvp` by default.

### `smoke`

4-6 cases.

Use for:

- quick demo;
- prompt debugging;
- validating that the flow works;
- early product exploration.

### `mvp`

12-20 cases.

Use for:

- current product default;
- manageable human review;
- first real SBS comparison;
- demo-quality run.

This is the short-term upper bound unless the user explicitly overrides.

### `formal`

30-60 cases.

Use later for:

- more serious evaluation;
- broader coverage;
- a team with enough review capacity.

Do not use as the default in the current MVP. If requested, add a confirmation backlog item warning about review burden.

### `regression`

Variable size.

Use for:

- known failures;
- historical bad cases;
- cases promoted from production or manual review.

Regression size is governed by failure history, not generic scale.

## Case Mix Defaults

For `mvp`, target 12-20 cases:

- 4-6 single-turn cases;
- 4-6 multi-turn cases;
- 3-5 capability probes;
- 2-4 boundary/risk cases;
- 1-3 regression-like cases.

Use fewer, higher-signal cases for early product work. Do not inflate case count with shallow variants.

## Case Mix Derivation Rules

Derive case mix from the Arena Spec.

Increase evidence uncertainty and risk/boundary cases when:

- task depends on live, local, or changing facts;
- unsupported claims are easy;
- user action has cost or risk.

Increase multi-turn and drift cases when:

- the task is naturally conversational;
- users commonly refine constraints;
- state tracking is a differentiator;
- early misunderstanding is likely.

Increase constraint satisfaction and tradeoff cases when:

- the task is recommendation, shopping, travel, planning, or advice;
- the user must choose among imperfect options;
- hidden constraints matter.

Increase negative / should-not-do cases when:

- overuse of a capability is risky;
- the product may overpromise;
- there are cases where asking a clarifying question is better than answering.

Increase regression-like cases when:

- the user provides known failures;
- previous runs revealed recurring bad cases;
- the product is close to launch and needs stability checks.

## Coverage Types

Include a mix when useful:

- positive / normal success cases;
- negative or "should not do" cases;
- boundary/risk cases;
- multi-turn drift cases;
- constraint-conflict cases;
- evidence uncertainty cases;
- regression-like cases based on known or likely failures.

## Confirmation Backlog Rules

The coverage plan should not stop generation.

If uncertain, generate a draft coverage plan and add items to `confirmationBacklog`.

Common confirmation items:

- whether to score product experience/persona;
- whether scale should be `smoke` or `mvp`;
- whether multi-turn should be included;
- whether the task is high-risk enough to increase risk cases;
- whether official seed cases exist;
- whether the user wants baseline-only insights.

If the user skips a non-blocking item, preserve it in `coverageGaps`, `knownUnknowns`, and report caveats. Do not block generation.

## Required Fields

The plan should include:

- `defaultDimensions`
- `scoredDimensions`
- `diagnosticDimensions`
- `baselineInsightDimensions`
- `disabledDimensions`
- `enabledDimensions`
- `dimensionWeights`
- `scalePreset`
- `caseMix`
- `caseCountTarget`
- `caseTypeRationale`
- `difficultyMix`
- `riskMix`
- `singleTurnRatio`
- `multiTurnRatio`
- `optionalExperiencePersonaModule`
- `coverageGaps`
- `confirmationBacklogRefs`
- `coverageRationale`
- `requiresUserConfirmation`

## Good And Bad Examples

### Bad Example

```json
{
  "enabledDimensions": ["intentUnderstanding", "outcomeQuality"],
  "caseCountTarget": 10
}
```

Problems:

- no scored vs diagnostic distinction;
- no case mix;
- no rationale;
- no product experience/persona decision;
- no risk or evidence coverage;
- no confirmation backlog.

### Better Example

```json
{
  "defaultDimensions": [
    "intentUnderstanding",
    "outcomeQuality",
    "trajectoryControl",
    "evidenceGrounding",
    "riskHandling",
    "productExperience"
  ],
  "scoredDimensions": ["intentUnderstanding", "outcomeQuality", "evidenceGrounding", "riskHandling"],
  "diagnosticDimensions": ["trajectoryControl"],
  "baselineInsightDimensions": ["productExperience"],
  "disabledDimensions": [],
  "enabledDimensions": [
    "intentUnderstanding",
    "outcomeQuality",
    "trajectoryControl",
    "evidenceGrounding",
    "riskHandling",
    "productExperience"
  ],
  "dimensionWeights": {
    "intentUnderstanding": 0.25,
    "outcomeQuality": 0.35,
    "evidenceGrounding": 0.2,
    "riskHandling": 0.2
  },
  "scalePreset": "mvp",
  "caseCountTarget": 16,
  "caseMix": {
    "single_turn": 5,
    "scripted_multi_turn": 5,
    "capability_probe": 3,
    "boundary_risk": 2,
    "regression_like": 1
  },
  "caseTypeRationale": {
    "single_turn": "Covers common search-like chatbot usage.",
    "scripted_multi_turn": "Covers constraint refinement and state tracking.",
    "boundary_risk": "Covers overpromising live availability and unverifiable facts."
  },
  "optionalExperiencePersonaModule": {
    "status": "baseline_insight_only",
    "rationale": "Useful to learn from Doubao, but not scored against the challenger unless user opts in.",
    "confirmationBacklogItemId": "confirm-product-experience-scoring"
  },
  "coverageGaps": [
    "No official seed set provided.",
    "Exact city/user segment still broad."
  ],
  "confirmationBacklogRefs": ["confirm-product-experience-scoring"],
  "coverageRationale": "MVP-sized set balances single-turn search-like usage, multi-turn decision refinement, evidence uncertainty, and risk handling."
}
```

## Self-Critique Checklist

Before accepting a coverage plan, ask:

- Are scored dimensions aligned with the Arena Spec decision question?
- Are diagnostic dimensions useful for report and roadmap?
- Are baseline-only insight dimensions separated from challenger scoring?
- Is the scale realistic for human review?
- Does the current MVP avoid accidentally generating formal-scale work?
- Does case mix reflect risk, evidence dependency, and multi-turn needs?
- Are coverage gaps recorded?
- Are unresolved choices in `confirmationBacklog` instead of hidden?
