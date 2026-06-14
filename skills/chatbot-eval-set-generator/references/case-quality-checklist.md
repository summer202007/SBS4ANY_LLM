# Case Quality Checklist

Use this reference when generating or auditing `evalCases`.

## Purpose

An eval case is a synthetic, executable user-task simulation unit.

It is not:

- a generic prompt;
- a question in a quiz;
- a rubric item;
- a claim about real user data;
- a hidden truth inferred from unknown users.

The generator may construct personas, intentions, constraints, and failure probes because eval sets are designed test artifacts. But it must not pretend that constructed details are observed facts. When a case uses a synthetic persona or hidden intent, treat it as eval-designed context.

Use the schema as a thinking scaffold, not a content template. Required fields may be concise when the idea is clear. Do not pad fields with verbose text just to satisfy structure.

Prefer fewer high-signal, realistic cases over fully populated but artificial cases.

## Case Object Standard

Each case should include:

- `caseId`
- `caseType`
- `capabilityCluster`
- `scenarioArchetype`
- `scenario`
- `userPersona`
- `userGoal`
- `userFacingIntent`
- `evaluatorIntent`
- `hiddenIntent`
- `constraints`
- `initialPrompt`
- `modelFacingPrompt`
- `collectionInstructions`
- `doNotRevealToModel`
- `exposureContract`
- `expectedOutcome`
- `acceptableOutcomes`
- `unacceptableOutcomes`
- `mustDo`
- `mustNotDo`
- `failureModesToProbe`
- `riskLevel`
- `difficulty`
- `discriminativeSignal`
- `evidenceRequired`
- `collectionMode`
- `estimatedUserEffort`
- `graderRefs`
- `confirmationBacklogRefs`

## Construction Boundary

The generator can construct:

- synthetic user personas;
- realistic jobs-to-be-done;
- hidden intents for testing;
- constraints;
- scenario archetypes;
- failure modes;
- expected outcomes;
- positive, negative, and boundary cases.

The generator must not:

- claim these are real user research findings unless provided by the user;
- overfit to unsupported assumptions about a product's private behavior;
- invent official evaluation standards;
- present speculative user psychology as fact;
- use hidden intent to make a case unfair or impossible.

If a constructed assumption materially affects coverage, record it in `confirmationBacklog` or package `knownUnknowns`.

## Model-Facing vs Evaluator-Facing Content

Every case should separate what the tested product sees from what the evaluator, harness, grader, and reviewer see.

### Model-Facing Content

This is the content copied into Doubao and the challenger product.

- `modelFacingPrompt`
- turn messages from `turnScripts`

Rules:

- It must be directly copyable.
- It should sound like a real user, not a benchmark instruction.
- It must not expose `evaluatorIntent`, `hiddenIntent`, `expectedOutcome`, rubric, or failure modes.
- For single-turn cases, `modelFacingPrompt` may be the same as `initialPrompt`.

### Evaluator-Facing Content

This helps the human reviewer, collection agent, grader, and report builder.

- `scenario`
- `userPersona`
- `userFacingIntent`
- `evaluatorIntent`
- `hiddenIntent`
- `expectedOutcome`
- `mustDo`
- `mustNotDo`
- `failureModesToProbe`
- `collectionInstructions`
- `doNotRevealToModel`
- `graderRefs`

Rules:

- Use it to guide execution and grading.
- Do not paste it into the tested model.
- Keep it concise enough for UI display and human review.
- Do not turn evaluator-only facts into hard scoring requirements unless the tested model could see them, reasonably infer them from the model-facing prompt, ask to clarify them, or safely caveat uncertainty.

### Grading Fairness Boundary

The evaluator may see more context than the tested model, but the grader must not punish a model for failing to satisfy private facts it never received.

Use this rule:

- If a persona detail, constraint, preference, or hidden intent is required for a high score, include it in `modelFacingPrompt` or a later model-facing turn.
- If a persona detail stays evaluator-only, use it only to judge realism, interpret the case, or diagnose whether the model asked useful clarifying questions.
- A hidden intent can test whether a model clarifies or caveats ambiguous needs, but it cannot require the model to magically know an unstated fact.
- `expectedOutcome`, `mustDo`, and `mustNotDo` should be checked against the information available to the model at that turn.
- If evaluator-only context materially changes scoring, either revise the model-facing prompt or record a confirmation/backlog item.

### Exposure Contract

Every case must include `exposureContract`. This is the machine-readable boundary between model-visible context and evaluator-only context.

Required fields:

- `modelVisibleFactsAtStart`: facts exposed in the initial `modelFacingPrompt`.
- `evaluatorOnlyFacts`: persona, hidden intent, expected outcome, rubric, or diagnostic context not shown to the tested model.
- `hardScoringRequirements`: requirements the grader may treat as eligible for hard scoring, each with:
  - `requirement`;
  - `source`: `model_facing_prompt`, `turn_exposed_fact`, `reasonable_inference`, or `general_safety_norm`;
  - `eligibleFromTurn`;
  - optional `relatedFields`.
- `inferenceTargets`: unstated needs the model may be rewarded for clarifying, inferring carefully, or caveating.
- `nonScoringContext`: evaluator-only context that should not directly affect score.
- `fairnessNotes`: concise explanation of why this case is fair.

For single-turn cases:

- `modelVisibleFactsAtStart` is the only explicit user-state source.
- Any hard requirement based on persona, budget, location, dietary need, style, or occasion must either be present in `modelFacingPrompt`, be a reasonable inference, or be a general safety norm.
- If the generator wants to grade against a persona detail, rewrite `modelFacingPrompt` to expose it.

For multi-turn cases:

- `exposureContract.modelVisibleFactsAtStart` covers turn 1.
- Each turn in `turnScripts` must include `exposureDelta`.
- A requirement should become hard-gradable only at or after the turn where it is exposed.
- The simulator may reveal only facts listed in the current turn's `allowedNewFactsToExpose` or selected branch rule model-facing reply.

### Collection Instructions

`collectionInstructions` should tell the human or collection agent:

- what to copy into each product;
- what evidence to collect;
- whether this is single-turn or multi-turn;
- what not to reveal;
- whether visible transcript/process notes should be copied back;
- when to stop.

`doNotRevealToModel` should list fields or notes that must stay hidden from the tested products.

## User Intent vs Evaluator Intent

A good case separates:

- `userFacingIntent`: what the user appears to want;
- `evaluatorIntent`: what the case is designed to test;
- `hiddenIntent`: realistic unstated user needs or constraints that should be inferred or clarified.

Example:

- User-facing intent: "Find a quiet restaurant for a date tonight."
- Evaluator intent: "Test constraint tracking, tradeoff explanation, and avoidance of unsupported live-availability guarantees."
- Hidden intent: "Quietness and decision confidence matter more than trendy popularity."

This separation helps graders understand why the case exists without exposing the test intent in the user prompt.

## Case Types

### `single_turn`

Use when:

- users may treat the chatbot like search or one-shot advice;
- the task can be meaningfully evaluated from one response;
- collection cost should stay low.

Good single-turn cases still need a clear expected outcome and failure modes.

### `scripted_multi_turn`

Use when:

- reproducibility matters;
- the task requires constraint refinement;
- the evaluator needs comparable turns across products.

The turns should be fixed, but the grader should not punish valid alternate solution paths.

### `adaptive_multi_turn`

Use when:

- the product may ask clarifying questions;
- the user intention needs to be pushed forward based on the model response;
- drift handling is part of the evaluation.

MVP policy:

- Keep `adaptive_multi_turn` in the schema.
- Generate driver policy and turn guidance.
- Do not promise automatic user simulation in the first product version.

### `capability_probe`

Use when:

- one ability needs isolated testing;
- the case should reveal a precise weakness.

Examples:

- constraint tracking;
- uncertainty marking;
- pushback;
- evidence grounding.

### `boundary_risk`

Use when:

- the model may overpromise;
- evidence is insufficient;
- a user request is ambiguous, risky, or asks for a guarantee.

Boundary/risk cases should be realistic, not artificial jailbreaks.

### `regression_like`

Use when:

- there is a known failure pattern;
- a likely failure should be preserved for future comparison;
- a previous generated package or manual review revealed a bad case.

## Case Generation Ladder

Generate cases by expanding the coverage plan in this order:

1. `capabilityCluster`
2. `caseType`
3. `scenarioArchetype`
4. concrete user persona/job
5. prompt or turn script
6. expected outcome
7. failure modes
8. grader refs
9. collection and evidence requirements

This ladder prevents the generator from producing a flat list of prompts.

## Good Case Criteria

A good case is:

- specific to the task space and evaluation scenario;
- realistic for the target user;
- clearly synthetic when not based on provided user data;
- executable in the collection workflow;
- gradeable from available evidence;
- likely to distinguish a strong baseline from a weaker challenger;
- tied to at least one failure mode;
- clear about success and failure;
- fair to both products;
- mapped to coverage plan dimensions and rubric refs;
- split cleanly between model-facing prompt and evaluator-facing guidance.

## Audience Fit And Native Context Cases

If the Arena Spec includes `audienceFitSignals`, `sourceOrNativeContextAdvantage`, or an equivalent user-stated goal, include cases that probe whether the challenger better fits that audience or context.

Good audience-fit cases:

- make the target user concrete without stereotyping;
- turn the audience signal into a real task constraint or decision criterion;
- test whether the model improves the user's outcome, not whether it flatters the user;
- separate audience/style/domain fit from conversation persona;
- include failure modes where the model overfits style and loses practicality, evidence, or risk calibration.

Examples of audience-fit probes:

- a restaurant recommendation that must balance Xiaohongshu-style aesthetics with actual food quality, crowding, and booking uncertainty;
- a shopping guide that must balance trend fit with ingredient, durability, or price tradeoffs;
- a workflow assistant that must follow a role's real operating constraints rather than generic best practices.

Do not add these cases if the user's evaluation target does not imply audience/source/domain fit.

If native context advantage is being tested, add a failure mode such as:

- "useful style fit but unsupported factual certainty";
- "aesthetic/source-context fit overwhelms practical task success";
- "claims source recency or verification that is not visible."

## Discriminative Signal

Every case must explain why it can distinguish product quality.

Good discriminative signals can separate:

- true intent understanding from fluent generic answering;
- grounded recommendations from unsupported claims;
- robust constraint tracking from shallow keyword matching;
- calibrated risk handling from overconfident compliance;
- healthy multi-turn convergence from drift.

Reject or revise a case if you cannot explain why the baseline and challenger might differ on it.

## Collection Feasibility

The case must be practical for the current SBS workbench.

Check:

- Can a human copy the prompt into both products?
- Is the multi-turn length reasonable?
- Does the case require login, private data, paid tools, or real-time environment access?
- Can the output be pasted back into the app?
- Is the expected evidence level realistic?
- Is the case too tedious for manual collection?
- Are the copyable model-facing prompt and evaluator-only notes clearly separated?

Suggested `collectionMode` values:

- `manual_single_prompt`
- `manual_multi_turn`
- `manual_with_visible_transcript`
- `future_automated`

Suggested `estimatedUserEffort` values:

- `low`
- `medium`
- `high`

For the current MVP, avoid large numbers of high-effort cases.

## Positive, Negative, Boundary, And Contrast Cases

Do not hardcode universal positive/negative examples.

Generate task-space-specific cases from reusable rules:

### Positive Case

Tests a normal or high-value success path.

Example rule:

- The user has clear constraints and a realistic job.
- A good product should satisfy constraints and provide useful tradeoffs.

### Negative Case

Tests what the product should not do.

Example rule:

- The user asks for something that should not be answered confidently.
- A good product should ask, qualify, refuse, or narrow scope.

### Boundary Case

Tests ambiguity, conflicting constraints, insufficient evidence, risk, or likely failure.

Example rule:

- The user's request is plausible but underspecified or risky.
- A good product should avoid overclaiming.

### Contrast Pair

Two cases differ by one meaningful condition.

Use when:

- you need to test whether the model tracks a key constraint rather than pattern-matching.

Example:

- "quiet date restaurant" vs "lively birthday restaurant";
- "budget phone for parents" vs "flagship phone for photography";
- "travel plan for elderly parents" vs "travel plan for friends who like nightlife".

### Adversarial-But-Realistic Case

Tests realistic诱导, overtrust, overpromise, or unsafe convenience.

It should not be a jailbreak. It should be something a real user might ask.

## Bad Case Smells

Reject or revise cases that are:

- generic chatbot questions;
- only checking world knowledge unrelated to product value;
- duplicates or shallow variants;
- impossible to grade;
- impossible for either product to answer under allowed evidence;
- biased toward one product's private affordance unless that is the explicit evaluation goal;
- overly scripted in a way that punishes valid alternate paths;
- constructed from unsupported assumptions but presented as factual;
- too expensive or tedious for manual collection.

## Duplicate And Shallow Variant Rules

Shallow variants include:

- same structure, different city;
- same constraint, different budget number;
- same risk, different product name;
- same prompt, different persona label;
- same expected failure, different surface wording.

Keep a variant only when the changed detail materially changes the capability being tested.

Examples:

- Different city is meaningful if local information quality is part of the eval.
- Different budget is meaningful if the budget changes tradeoff behavior.
- Different persona is meaningful if persona changes constraints, risk, or expected tone.

Otherwise merge or remove.

## Case Set Criteria

A good case set has:

- coverage across scored dimensions;
- useful diagnostic cases;
- baseline insight cases when relevant;
- a sensible difficulty gradient;
- both single-turn and multi-turn cases when the product is used conversationally;
- enough risk/boundary cases to expose overconfidence;
- no obvious duplicates or shallow variants;
- clear links from cases to rubric suggestions;
- collection effort consistent with the selected scale preset.

## Confirmation Backlog Rules

Case generation should not stop for non-blocking uncertainty.

Add confirmation backlog items when:

- a case depends on an unconfirmed user segment;
- the scenario archetype may be out of scope;
- high-effort multi-turn collection may burden the user;
- a case assumes a risk sensitivity level;
- a constructed hidden intent may be too speculative;
- the case should be promoted to regression only if the user confirms it is a known failure.

Do not block generation unless even a low-confidence case would be misleading.

## Self-Critique Checklist

Before accepting the case set, ask:

- Does every case map to the coverage plan?
- Does every case have a user-facing intent and evaluator intent?
- Is constructed user context labeled as synthetic/eval-designed?
- Is there a directly copyable model-facing prompt?
- Are evaluator-only details hidden from the tested model?
- Are collection instructions clear enough for a human or agent to follow?
- Does every case have a discriminative signal?
- Can each case be collected manually in the current MVP?
- Are multi-turn cases reasonable in length?
- Are risk/boundary cases realistic rather than artificial?
- Are there duplicates or shallow variants?
- Are grader refs present?
- Are unresolved assumptions in `confirmationBacklog`?
