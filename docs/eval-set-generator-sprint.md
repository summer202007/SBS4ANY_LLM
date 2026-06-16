# Chatbot Eval-Set Generator Skill Sprint

Created: 2026-06-07

## Goal

Turn the one-off restaurant recommendation eval package into a reusable skill that can reliably generate systematic chatbot eval sets for many task spaces.

The skill should help an Agent PM move from:

```text
"I want to evaluate chatbot capability in this task space"
```

to:

```text
structured arena spec
coverage plan
case set
turn scripts
rubric handoff
report skeleton
self-critique trace
```

The skill is not only a prompt. It is an eval-set generation workflow with structured output, quality gates, self-critique, and trace artifacts.

## Product Constraint

This sprint must serve the SBS workbench MVP, but the skill should also be valuable as a standalone Agent PM portfolio artifact.

Design priorities:

1. Make the generator reliable across chatbot-style eval needs.
2. Preserve enough structure for the local web app to display and validate output.
3. Preserve enough reasoning trace for humans to review how the eval set was generated.
4. Avoid overbuilding multi-agent infrastructure before the MVP needs it.

## Skill Architecture Principles

The skill should follow progressive disclosure:

```text
SKILL.md
  -> short trigger description
  -> core workflow
  -> when to ask user
  -> where to load references

references/
  -> arena-spec-quality.md
  -> coverage-plan-patterns.md
  -> case-quality-checklist.md
  -> rubric-handoff.md
  -> self-critique.md
  -> example-complete-runtime-eval-package.md

schemas/
  -> runtime-eval-package.schema.json
  -> self-critique.schema.json

scripts/
  -> validate_eval_package.*
  -> summarize_generation_trace.*
```

Rationale:

- `description` must be precise enough to trigger for chatbot eval-set generation, not for all eval work.
- `SKILL.md` should stay lean and procedural.
- Detailed patterns, examples, and quality rubrics should live in `references/`.
- Deterministic checks should become scripts or harness validators, not prose-only reminders.
- Regression examples should be saved as artifacts so future changes can be compared against previous behavior.

## Six-Piece Output Contract

Every generated runtime eval package must include six top-level objects.

| Component | Main Consumer | Must Be Structured? | UI Display? | Notes |
|-|-|-|-|-|
| `arenaEvalSpec` | generator, user, harness, report builder | Yes | Yes | Highest priority quality gate. If weak, ask user before generating cases. |
| `evalSetCoveragePlan` | generator, user, evaluator | Yes | Yes | Defines dimensions, case mix, scale, risk coverage, optional modules. |
| `evalCases` | collection workflow, user simulator, grader | Yes | Yes | Executable case objects, not just prompts. |
| `turnScripts` | collection workflow, user simulator, human reviewer | Yes | Yes | Must handle scripted and drift-aware multi-turn replay. |
| `rubricSuggestions` | grader builder, human reviewer | Yes | Yes | Handoff to grader, not final authority. |
| `reportSkeletonMetadata` | report builder | Yes | Partly | Ensures later report can aggregate by arena, dimensions, risks, and case clusters. |

The skill may also output prose explanation, but prose must never be the only carrier of important information.

## Structured Fields To Preserve

### 1. Arena Eval Spec

Required fields:

- `taskSpace`
- `decisionQuestion`
- `targetUsers`
- `userJobs`
- `baseline`
- `challenger`
- `productSurface`
- `assumptions`
- `knownUnknowns`
- `successDefinition`
- `failureDefinition`
- `riskBoundaries`
- `evidenceAssumptions`
- `requiresUserConfirmation`
- `clarificationQuestions`

Quality gate:

- It must say what product decision the eval supports.
- It must define what "beat the baseline" means.
- It must separate known assumptions from facts.
- It must expose uncertainty instead of hiding it.
- If target user, task boundary, risk sensitivity, or baseline usage mode is unclear, it must ask the user.

### 2. Eval Set Coverage Plan

Required fields:

- `defaultDimensions`
- `enabledDimensions`
- `disabledDimensions`
- `dimensionWeights`
- `caseMix`
- `caseCountTarget`
- `difficultyMix`
- `riskMix`
- `singleTurnRatio`
- `multiTurnRatio`
- `optionalExperiencePersonaModule`
- `coverageRationale`
- `requiresUserConfirmation`

Default dimensions:

- `intentUnderstanding`
- `outcomeQuality`
- `trajectoryControl`
- `evidenceGrounding`
- `riskHandling`
- `productExperience`

Dimension policy:

- Do not blindly force all dimensions into every eval.
- Increase risk and evidence dimensions when the task depends on factual, local, financial, health, legal, or time-sensitive information.
- Increase trajectory when the product is used multi-turn or users commonly refine constraints.
- Ask whether to evaluate conversation experience, persona, tone, and emotional fit.
- If the user says not to evaluate challenger experience/persona, do not include it in challenger score. It may still be reported as a baseline competitive insight.

### 3. Eval Cases

Required fields:

- `caseId`
- `caseType`
- `capabilityCluster`
- `scenario`
- `userPersona`
- `userGoal`
- `hiddenIntent`
- `constraints`
- `initialPrompt`
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
- `graderRefs`

Quality gate:

- A case must be executable.
- A case must be specific to the task space.
- A case must have a realistic user job, not a generic chatbot prompt.
- A case must be gradeable.
- A case must have at least one expected failure mode.
- A case set must avoid duplicates and shallow variants.
- A case set must include both positive and negative/boundary cases where appropriate.

### 4. Turn Scripts

Required fields:

- `caseId`
- `turns`
- `turnIndex`
- `userMessage`
- `progressLabel`
- `intentionToPush`
- `expectedStateAfterTurn`
- `allowedAdaptiveMoves`
- `ifModelDrifts`
- `ifModelAsksClarifyingQuestion`
- `ifModelRefusesOrCannotAnswer`
- `stopCondition`

Policy:

- Turn scripts are conversation driver policies, not only fixed scripts.
- If the evaluated product does not expose trace, collect visible transcript and final output.
- If the model response diverges from the script, the human or simulator should push the original intention forward without overfitting to one preferred path.
- The grader should evaluate outcome and trajectory, not punish every path deviation.

### 5. Rubric Suggestions

Required fields:

- `dimensionId`
- `appliesToCaseTypes`
- `weightSuggestion`
- `scoreScale`
- `positiveSignals`
- `negativeSignals`
- `redLineFailures`
- `evidenceRequired`
- `judgeTypeSuggestion`
- `uncertaintyPolicy`

Policy:

- Rubrics are handoff artifacts for graders and human reviewers.
- They should be aligned to cases and dimensions.
- They should state when deterministic checks, LLM graders, or human review are appropriate.
- They should give the grader a way to mark uncertainty.

### 6. Report Skeleton Metadata

Required fields:

- `reportAudience`
- `decisionMode`
- `scoreboardDimensions`
- `caseClusters`
- `riskSections`
- `baselineInsightSections`
- `recommendedAppendices`
- `rawArtifactLinks`
- `humanOverrideFields`

Policy:

- The report is a PM decision artifact, not only a scorecard.
- It must support overall verdict, dimension verdict, evidence caveats, failure clusters, strength pockets, and optimization suggestions.

## Generator vs Evaluator vs Harness Responsibilities

| Responsibility | Generator Skill | Self-Critique / Evaluator | Harness / Product |
|-|-|-|-|
| Ask missing arena questions | Yes | Check if missing questions remain | UI form should surface unresolved questions |
| Produce six-piece package | Yes | Check completeness and consistency | Schema validates required objects |
| Decide default dimensions | Yes | Challenge dimension fit | UI lets user override |
| Decide whether persona/experience applies | Ask user when unclear | Check if assumption is explicit | UI should expose as optional module |
| Generate cases | Yes | Check quality, diversity, duplication, discriminative value | UI supports edit/approve/reject |
| Generate turn scripts | Yes | Check drift handling | Collection UI shows progress and adaptive guidance |
| Generate rubric suggestions | Yes | Check case-rubric alignment | Grader consumes as draft config |
| Preserve trace | Yes | Summarize critique and revisions | Store prompt, raw output, normalized output, warnings |
| Approve eval set | No | No | Human approval required |

## Self-Critique Mechanism

The first version can be single-agent self-critique rather than true multi-agent.

Required loop:

1. Generate draft package.
2. Switch into evaluator mode.
3. Review Arena Spec quality.
4. Review Coverage Plan fit.
5. Review case set diversity, realism, discriminative value, and gradeability.
6. Review turn scripts for drift handling.
7. Review rubric alignment.
8. Produce critique findings.
9. Revise the package once.
10. Save generation trace and critique trace.

The critique trace should be structured:

- `findingId`
- `severity`
- `component`
- `issue`
- `whyItMatters`
- `recommendedFix`
- `fixApplied`
- `remainingRisk`

## Case Scale Guidance

Default MVP scale:

- 12-20 cases total.
- 4-6 single-turn cases.
- 4-6 scripted or adaptive multi-turn cases.
- 3-5 capability probes.
- 2-4 boundary/risk cases.
- 1-3 regression-like cases.

The generator should adjust scale based on:

- task complexity;
- user time budget;
- whether this is demo, MVP, or formal eval;
- risk sensitivity;
- whether the user has official/seed cases.

For early product work, fewer high-signal cases are better than many generic cases.

## Sprint Plan

### Sprint 1: Principle And Contract Consolidation

Deliverables:

- This sprint document.
- Update `docs/eval-generation-dev-plan.md` with structured six-piece contract and self-critique requirements.
- Update project memory so future sessions know this skill is now a first-class direction.

Done when:

- Generator/evaluator/harness responsibilities are separated.
- Structured output requirements are explicit.
- User-confirmation points are explicit.

### Sprint 2: Skill Architecture Brief

Deliverables:

- Draft skill architecture for user confirmation before implementation.
- Proposed skill name, trigger description, directory structure, references, schemas, scripts, examples, and safety boundaries.
- Clear distinction between `SKILL.md` content and reference/schema/script content.
- Current brief: `docs/chatbot-eval-set-generator-skill-brief.md`.

Done when:

- User confirms the skill architecture.
- Open questions are resolved or explicitly deferred.

### Sprint 3: Schema And Harness Contract

Deliverables:

- `schemas/runtime-eval-package.schema.json`
- `schemas/eval-generation-critique.schema.json`
- Schema update plan for the web app.

Done when:

- The six-piece package can be validated structurally.
- The UI can know what to display and what remains unresolved.

### Sprint 4: Skill Implementation

Deliverables:

- Local skill folder, likely `chatbot-eval-set-generator`.
- `SKILL.md`
- `references/`
- `schemas/`
- optional validator script.

Done when:

- The skill can be triggered by a user request to generate a chatbot eval set.
- It asks clarifying questions when Arena Spec confidence is too low.
- It produces the six-piece package and self-critique trace.

Reference review rule:

- Each quality reference file must be drafted and reviewed one by one before being treated as accepted skill knowledge.
- Review order should be:
  1. `arena-spec-quality.md`
  2. `coverage-plan-patterns.md`
  3. `case-quality-checklist.md`
  4. `turn-script-policy.md`
  5. `rubric-handoff.md`
  6. `self-critique.md`
  7. `example-complete-runtime-eval-package.md`
- Do not treat the restaurant recommendation example as the eval set itself. It is only a worked example showing what a complete generated runtime eval package should look like.

### Sprint 5: Restaurant Recommendation Regression Test

Deliverables:

- A new generated package for "restaurant recommendation capability: Xiaohongshu Diandian vs Doubao".
- Saved raw generation trace.
- Saved self-critique trace.
- A comparison note against the previous one-off Feishu document.

Done when:

- We can inspect not only the final eval set quality, but also the generator's key thinking and revision path.
- The new package is visibly stronger on risk handling, case scale, turn-script drift, and structured grader handoff.

## Open Questions For Skill Brief

1. Should the first skill output be JSON-first, Markdown-first with JSON blocks, or both?
2. Should the skill default to asking one clarification question at a time, or produce a low-confidence draft with explicit assumptions?
3. Should case scale be user-selected in every run, or inferred from task complexity and time budget?
4. Should the optional product-experience/persona module default off, ask every time, or default on for consumer chatbot products?
5. Which parts should become deterministic scripts in the first implementation versus reference checklists?

## Current Recommendation

Use a hybrid output:

- JSON-first for the six-piece package and critique trace.
- Markdown summary for human review.
- Save both raw and revised artifacts during regression tests.

For interaction:

- Ask the user only when Arena Spec confidence is low or when optional experience/persona evaluation materially changes the scoring.
- Otherwise generate a draft with explicit assumptions and self-critique warnings.
