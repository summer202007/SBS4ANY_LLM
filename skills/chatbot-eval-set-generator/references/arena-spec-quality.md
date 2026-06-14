# Arena Spec Quality

Use this reference when building or auditing `arenaEvalSpec`.

## Purpose

`arenaEvalSpec` is the product decision contract for eval generation.

It is not intro copy. It tells the generator, UI, harness, grader handoff, and report builder what decision this eval package is supposed to support.

If the Arena Spec is weak, more cases only make the evaluation more confidently wrong.

## Arena Spec As Decision Contract

A good Arena Spec answers:

- What decision is the user trying to make?
- Which task space is being evaluated?
- What concrete evaluation scenario inside that task space matters?
- Who is the target user?
- What user jobs should the product complete?
- Which product is the challenger?
- Which product is the baseline?
- What does it mean to beat the baseline?
- What facts are known, and what assumptions are being made?
- Which uncertainties affect generation, grading, or reporting?
- What risks or evidence limits should shape the case set?

## Task Space vs Evaluation Scenario

`taskSpace` may be a broad label selected by the user, such as:

- restaurant recommendation;
- shopping guide;
- travel planning;
- career advice;
- document research;
- customer support.

This is usually not enough to generate high-signal cases.

The UI/harness should also collect or derive a more specific `evaluationScenario` or `decisionContext`, such as:

- "restaurant recommendation for users choosing real venues under budget, location, atmosphere, and reservation uncertainty";
- "shopping guide for users comparing high-priced consumer electronics with hidden tradeoffs";
- "travel planning for families balancing elderly-friendly constraints, weather risk, and itinerary feasibility".

Policy:

- If only a broad `taskSpace` is provided, the skill may generate a draft but must mark scenario specificity as a `knownUnknown`.
- If the broad task space could expand into materially different eval packages, still generate the best draft or skeleton possible and add a confirmation item asking for a more specific evaluation scenario.
- The UI should treat broad task-space selection as a starting point, not a complete Arena Spec.

## Field Groups

### Decision Fields

- `taskSpace`
- `evaluationScenario` or `decisionContext`
- `decisionQuestion`
- `successDefinition`
- `failureDefinition`

These fields define what the eval is for.

### Product Fields

- `baseline`
- `challenger`
- `productSurface`
- `baselineUseMode`
- `challengerUseMode`

These fields define what is being compared and under what usage mode.

### User And Job Fields

- `targetUsers`
- `userJobs`
- `primaryUseCases`
- `nonGoals`
- `audienceFitSignals`
- `sourceOrNativeContextAdvantage`

These fields prevent generic chatbot cases.

## Audience Fit And Native Context Advantage

Some evaluations are partly about whether a challenger understands a target audience, taste system, domain context, or native content ecosystem better than the baseline.

Examples:

- "Xiaohongshu mainstream users aged 18-35 in first/second-tier cities";
- "B2B sales reps using CRM workflows";
- "new parents buying high-consideration baby products";
- "senior engineers reviewing migration plans".

When the user's stated evaluation goal includes this kind of target-user, style, content-source, or domain-context fit, extract it into the Arena Spec.

Recommended fields:

- `audienceFitSignals`: what fit means in this arena, such as aesthetic taste, local lifestyle fit, workflow fit, decision style, risk tolerance, or domain expectations.
- `sourceOrNativeContextAdvantage`: any challenger-native source/context advantage the user wants to test, such as Xiaohongshu content signals, company-internal workflow context, or domain-specific corpus fit.
- `sourceAdvantagePolicy`: how to reward useful native-context fit while avoiding unsupported factual certainty.

Policy:

- Reward audience/style/domain fit only when it is stated or strongly implied by the user's measurement goal.
- If it is not present, do not invent it and do not add it as a scored dimension.
- Do not confuse target-audience fit with general conversation persona. A user may disable `productExperience` while still wanting output quality to reflect target-user fit.
- If the challenger appears to have a native source/context advantage, reward useful fit only when it improves the user's decision. Still penalize unsupported live facts, recency claims, source certainty, or verification claims.
- If the policy is ambiguous, generate the package with a recommended default and add a `confirmationBacklog` item.

### Evidence And Risk Fields

- `riskBoundaries`
- `evidenceAssumptions`
- `allowedInformationSources`
- `evidenceLevelExpected`
- `timeSensitivity`

These fields define what claims are allowed and what uncertainty should be surfaced.

### Uncertainty Fields

- `assumptions`
- `knownUnknowns`
- `confidence`
- `requiresUserConfirmation`
- `clarificationQuestions`
- `confirmationBacklog`

These fields make generator uncertainty visible to the UI and reviewer.

## Required Minimum Fields

The minimum viable Arena Spec should include:

- `taskSpace`
- `evaluationScenario` or `decisionContext`
- `decisionQuestion`
- `targetUsers`
- `userJobs`
- `baseline`
- `challenger`
- `productSurface`
- `successDefinition`
- `failureDefinition`
- `riskBoundaries`
- `evidenceAssumptions`
- `assumptions`
- `knownUnknowns`
- `confidence`
- `requiresUserConfirmation`
- `clarificationQuestions`

If the schema used by the current harness does not yet include `evaluationScenario`, `baselineUseMode`, `challengerUseMode`, or `confidence`, include them as additional properties. They should be promoted into the schema later.

## Quality Gates

A good Arena Spec must:

- state the product decision the eval supports;
- define what "beats the baseline" means;
- identify a concrete scenario inside the broad task space;
- identify target users and realistic jobs;
- distinguish facts from assumptions;
- state what information the evaluated products are allowed to use;
- state the expected evidence level;
- state risk boundaries and severe failure types;
- expose uncertainty instead of hiding it;
- list missing information that should be shown in the UI.

## Confidence And Clarification Policy

Use three confidence levels.

### `high`

Use when:

- task space and evaluation scenario are concrete;
- target users and user jobs are clear;
- baseline/challenger and usage mode are clear;
- success/failure definitions are actionable;
- evidence and risk assumptions are clear enough for generation.

Behavior:

- Generate the package.
- Preserve assumptions in trace.

### `medium`

Use when:

- the package can be generated;
- some assumptions may affect interpretation or later scoring;
- missing details are not severe enough to block a draft.

Behavior:

- Generate the package.
- Set `requiresUserConfirmation` if the UI should show assumptions before approval.
- Put unresolved details in `knownUnknowns`.

### `low`

Use when:

- the broad task space could produce materially different eval packages;
- target user or user job is unknown and important;
- success/failure definition is too vague;
- risk sensitivity changes case design;
- baseline/challenger usage mode is unknown and important.

Behavior:

- Generate a low-confidence draft or skeleton when possible.
- Add structured questions to `clarificationQuestions` and aggregate them into top-level `confirmationBacklog`.
- Mark whether each unresolved point should block the eval run through `blocksEvalRun`.
- Return without a draft only when the inputs are too empty to produce a meaningful skeleton.

## Clarification Question Shape

Each clarification question should include:

- `id`
- `question`
- `whyItMatters`
- `recommendedDefault`
- `blocksGeneration`

Keep questions high-impact. Prefer aggregating them into `confirmationBacklog` for one post-generation review step instead of asking them interactively during generation.

## Confirmation Backlog Flow

The generator should not behave like a strong-gate interviewer.

Default flow:

1. Generate the full draft eval package, or at least a low-confidence skeleton if inputs are weak.
2. Record every uncertainty in `confirmationBacklog`.
3. Show the generated package and the backlog to the user after generation.
4. User answers or edits the backlog in one review round.
5. Revise the eval package using the user's answers.
6. Start SBS collection/eval only after the package is approved or the user explicitly skips remaining items.

If the user skips a non-blocking item, preserve it in `knownUnknowns`, `generationTrace`, and the report caveats. Do not block the workflow.

If the user skips a blocking item, the UI may still allow manual override, but the package should mark the risk clearly before eval starts.

## UI / Harness Contract

This section is for the frontend and coding agent that build the SBS Workbench.

### UI Should Collect

- task-space label;
- specific evaluation scenario or decision context;
- challenger product name;
- baseline product name, default Doubao for chatbot;
- target user segment;
- top user jobs;
- whether the eval should include product-experience/persona scoring;
- risk sensitivity;
- evidence mode, such as final output only or visible transcript;
- desired scale, such as quick draft or formal package.

### Harness Should Normalize

The harness should convert UI fields into a normalized request that includes:

- `taskSpace`
- `evaluationScenario` or `decisionContext`
- `decisionQuestion`
- `baseline`
- `challenger`
- `targetUsers`
- `userJobs`
- `productSurface`
- `generationSettings`
- `optionalModules`
- `knownUserInputs`

### Skill Should Return

The skill should return:

- a complete `arenaEvalSpec` when confidence is high or medium;
- `clarificationQuestions` and top-level `confirmationBacklog` when confidence is low or required fields are missing;
- `knownUnknowns` for assumptions that do not block generation;
- `requiresUserConfirmation` when the UI should display assumptions before approval.

### UI Should Display

The UI should show:

- Arena Spec summary;
- confidence level;
- assumptions;
- known unknowns;
- clarification questions;
- confirmation backlog;
- whether generation proceeded or returned only a skeleton;
- trace link or Generation Trace panel.

Clarification is not a strong gateway by default. The product should generate first, ask in one review step, revise once from the user's answers, and then proceed. Blocking should apply to starting the eval run, not to draft generation, unless even a skeleton would be misleading.

## Good And Bad Examples

### Bad Example

```json
{
  "taskSpace": "restaurant recommendation",
  "decisionQuestion": "See which product is better"
}
```

Problems:

- no concrete evaluation scenario;
- no target user;
- no user job;
- no baseline/challenger use mode;
- no success definition;
- no risk or evidence boundary;
- cannot guide case generation.

### Better Example

```json
{
  "taskSpace": "restaurant recommendation",
  "evaluationScenario": "Users choosing real restaurants under location, budget, atmosphere, occasion, and reservation uncertainty constraints.",
  "decisionQuestion": "Does Xiaohongshu Diandian beat Doubao when helping consumers choose restaurants for real dining decisions?",
  "targetUsers": ["urban consumer users who want restaurant recommendations"],
  "userJobs": [
    "choose a restaurant under constraints",
    "compare options and tradeoffs",
    "avoid unreliable or overhyped recommendations"
  ],
  "baseline": {
    "name": "Doubao",
    "role": "ceiling chatbot baseline",
    "useMode": "default chatbot mode"
  },
  "challenger": {
    "name": "Xiaohongshu Diandian",
    "role": "evaluated product",
    "useMode": "default product mode"
  },
  "productSurface": "chatbot",
  "successDefinition": "The product gives specific, decision-useful recommendations that satisfy user constraints, explain tradeoffs, and mark uncertainty around live facts.",
  "failureDefinition": "The product gives generic lists, ignores key constraints, fabricates verification, overpromises live availability, or fails to help the user decide.",
  "riskBoundaries": [
    "do not guarantee no queue, open status, or reservation availability without evidence",
    "do not invent having checked a restaurant"
  ],
  "evidenceAssumptions": [
    "MVP may only collect final output and visible transcript",
    "live availability may not be verifiable"
  ],
  "assumptions": [
    "Doubao is treated as the chatbot ceiling baseline",
    "manual output collection is acceptable"
  ],
  "knownUnknowns": [
    "city coverage and exact user segment may need later refinement"
  ],
  "confidence": "medium",
  "requiresUserConfirmation": true,
  "clarificationQuestions": [
    {
      "id": "scenario_specificity",
      "question": "Should this eval focus on everyday nearby dining, date/business occasions, travel dining, or all of them?",
      "whyItMatters": "Different scenarios produce different case mix and risk boundaries.",
      "recommendedDefault": "Cover everyday nearby dining plus occasion-based dining in the first draft.",
      "blocksGeneration": false
    }
  ]
}
```

## Self-Critique Checklist

Before accepting an Arena Spec, ask:

- Is this more specific than a broad task-space label?
- Can this spec generate cases without guessing the user's real evaluation goal?
- Is "beat the baseline" defined in product terms?
- Are target users and jobs concrete?
- Are evidence limits explicit?
- Are risk boundaries explicit?
- Are assumptions and known unknowns separated?
- Should any missing information be shown to the UI?
- Would two different agents generate roughly the same eval package from this spec?
