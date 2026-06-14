# Turn Script Policy

Use this reference when generating or auditing `turnScripts`.

## Purpose

Turn scripts solve the operational difficulty of multi-turn evaluation.

Once an eval case becomes multi-turn, the evaluated model may ask clarification questions, drift, prematurely conclude, refuse, or overpromise. The script must help a human reviewer, UI, or collection agent fairly push the same user intention through both products without improvising inconsistently.

Turn scripts are conversation driver policies, not only fixed user messages.

## Upstream Inputs

Turn scripts must reference and preserve information from earlier generation layers.

From `arenaEvalSpec`, use:

- `taskSpace`
- `evaluationScenario`
- `decisionQuestion`
- `targetUsers`
- `userJobs`
- `riskBoundaries`
- `evidenceAssumptions`

From `evalSetCoveragePlan`, use:

- `scoredDimensions`
- `diagnosticDimensions`
- `caseMix`
- `riskMix`
- `optionalExperiencePersonaModule`
- `coverageGaps`

From `evalCases`, use:

- `caseId`
- `caseType`
- `scenarioArchetype`
- `scenario`
- `userPersona`
- `userFacingIntent`
- `evaluatorIntent`
- `hiddenIntent`
- `modelFacingPrompt`
- `collectionInstructions`
- `doNotRevealToModel`
- `exposureContract`
- `expectedOutcome`
- `mustDo`
- `mustNotDo`
- `failureModesToProbe`
- `evidenceRequired`
- `collectionMode`
- `estimatedUserEffort`

Do not invent a new multi-turn goal that conflicts with the case. The turn script should operationalize the case, not rewrite it.

## Runtime Execution State

Generating turn scripts is only the first job. During the actual SBS eval run, a local model may also be used to decide or draft the next user turn. That runtime model must not rely on conversation memory to know where it is.

The harness must pass an explicit `turnExecutionState` packet on every runtime step.

The harness owns the cursor. The runtime model never decides which package, case, side label, or turn is being executed.

This is the guarantee mechanism:

1. The eval package contains stable `caseId`, `scriptMode`, `maxTurns`, `turnIndex`, branch rules, and upstream references.
2. The harness owns the run cursor, not the model.
3. Before every local-model runtime call, the harness constructs a fresh state packet.
4. The local model generates only from that packet.
5. The harness writes the model's decision, selected branch, and produced user message back into run artifacts.

Do not rely on the model remembering prior turns from chat context.

## Approved Package Binding

The runtime user-simulator must be bound to one approved eval package.

Guarantee mechanism:

1. The human approves a specific `evalPackageId` and `evalPackageVersion`.
2. The harness starts an `evalRunId` from that approved package only.
3. For each case, the harness stores `caseIndex`, `caseId`, and the package version used.
4. For each turn, the harness looks up the exact `evalCases[caseId]` and `turnScripts[caseId]`.
5. The local model never chooses which eval set or case to use.
6. If `caseId` or package version does not match, the runtime call must fail closed and ask the harness/UI to repair state.

This prevents the local model from accidentally using a stale eval set, a different task space, or a remembered case from chat context.

## Harness Execution Contract

Every multi-turn `turnScript` must include a `harnessExecutionContract`. This is how the generated package tells the future UI/harness what level of execution support is required.

Required fields:

- `runtimeModelMode`: `manual_driver`, `llm_single_step_guarded`, `llm_two_stage_planner_drafter`, or `future_automated`.
- `cursorOwner`: must be `harness`.
- `sideBlind`: must be `true`; the simulator sees "Side A" or equivalent neutral labels, not Doubao/challenger names.
- `decisionPolicy`: use `fixed_sequence` for fixed/manual cases that should simply follow pre-authored turns; use `branch_rules_only` for `guided_adaptive`, `hybrid`, or LLM-simulated cases.
- `branchFallbackPolicy`: use `not_applicable` with `fixed_sequence`; use `allowed_adaptive_moves_or_needs_human_review` with `branch_rules_only`.
- `preSendValidation`: hard checks the harness must run before sending a generated user message to the tested product.
- `replayLogFields`: runtime evidence that must be recorded for audit and report diagnostics.
- `plannerDrafterSplit`: `not_applicable`, `recommended`, or `required`.
- `humanReviewFallbackRequired`: must be `true`.

MVP rule:

- If the web app does not implement guarded LLM simulation, it may still run multi-turn cases as `manual_driver`: show fixed or guided turns and evaluator instructions to the human, collect visible transcripts, and record that runtime simulator guardrails were not used.
- A fixed manual script should use `decisionPolicy=fixed_sequence`; a manual guided script may still use `decisionPolicy=branch_rules_only` when the human is choosing from branch rules.
- Do not label a run as LLM-simulated or automated unless the harness enforces package binding, side blindness, branch selection, pre-send validation, and replay logging.
- If a generated package requires `llm_two_stage_planner_drafter`, the MVP UI should block automated execution and offer manual execution or downgrade the package after human review.

## Runtime Prompt Assembly Contract

When the local model simulates the user during eval execution, the harness must assemble the prompt from the approved package and the current run state.

The prompt must include:

- package identity: `evalPackageId`, `evalPackageVersion`, `evalRunId`;
- cursor: `caseIndex`, `caseCount`, `caseId`, `currentTurnIndex`, `maxTurns`, `sideLabel`; the runtime model should see a side-blind label such as `Side A`, not the product name or `baseline`/`challenger`;
- upstream Arena fields: task space, evaluation scenario, decision question, risk boundaries, evidence assumptions;
- upstream Coverage fields: scored dimensions, diagnostic dimensions, risk mix, optional modules;
- upstream Case fields: user-facing intent, evaluator intent, hidden intent, model-facing prompt, collection instructions, do-not-reveal fields, expected outcome, must-do/must-not-do, failure modes;
- current Turn Script fields: script mode, state to track, branch rules, fairness policy, stop condition;
- runtime transcript: prior turns, latest model response, trajectory notes so far;
- required output schema for the runtime model.

The prompt must not include unrelated eval sets, old cases, or previous package drafts.

The runtime model should receive a narrow instruction:

> Based only on this `turnExecutionState`, choose the next model-facing user message or stop. Do not invent a new case, do not change the evaluation goal, and do not reveal evaluator-only information.

The state packet must include at least:

- `evalPackageId`
- `evalPackageVersion`
- `caseId`
- `currentTurnIndex`
- `sideLabel`
- `priorTurns`
- `lastModelResponse`

## Runtime Guardrails

The harness should validate the runtime model output before sending anything to the tested product.

Validate:

- output references the same `caseId`;
- output references the same `currentTurnIndex`;
- output references the same `evalPackageVersion`;
- `modelFacingUserMessage` does not contain hidden intent, evaluator intent, expected outcome, rubric, or failure modes;
- selected branch rule exists in `availableBranchRules`, unless the script allows free-form adaptive moves;
- if no branch rule matches, output must choose an allowed adaptive move or return `needsHumanReview`;
- the generated message does not add new constraints beyond the case/script unless an allowed adaptive move permits it;
- `newlyExposedFacts` only contains facts from the current turn's `allowedNewFactsToExpose` or the selected branch rule's model-facing reply;
- `shouldStop` is consistent with `stopCondition` or max turns;
- updated tracked state only changes allowed state fields.

If validation fails:

- do not send the generated message to the tested product;
- record a runtime simulator error;
- either retry with the same state packet or fall back to a human reviewer.

Recommended `preSendValidation` check ids:

- `package_binding`
- `branch_rule_exists`
- `no_evaluator_leakage`
- `no_unapproved_exposure`
- `no_unapproved_constraints`
- `tracked_state_whitelist`
- `max_turns_stop_condition`

Each runtime state packet should include:

- `evalRunId`
- `caseIndex`
- `caseCount`
- `caseId`
- `caseType`
- `scriptMode`
- `sideLabel`: side-blind runtime label such as `Side A` or `Side B`
- `currentTurnIndex`
- `maxTurns`
- `progressLabel`, such as `Case 3 of 16 / Turn 2 of 4`
- `arenaSummary`
- `coverageSummary`
- `caseSummary`
- `userFacingIntent`
- `evaluatorIntent`
- `hiddenIntent`
- `stateToTrack`
- `trackedState`
- `priorTurns`
- `lastModelResponse`
- `availableBranchRules`
- `allowedAdaptiveMoves`
- `exposedFactsSoFar`
- `currentTurnExposureDelta`
- `doNotRevealToModel`
- `stopCondition`
- `trajectoryNotesSoFar`

The UI should also display the same progress label so the human reviewer knows exactly which case and turn is being executed.

## Runtime Execution Packet Template

Each multi-turn `turnScript` should include a `runtimeStateTemplate` that tells the harness which fields to pass into the local model at runtime.

The template is not filled with actual runtime values during eval-set generation. It is a contract for the evaluator/harness.

Required template sections:

- `cursorFields`: fields that identify case and turn position;
- `upstreamContextFields`: Arena, Coverage, and Case fields that must be included;
- `transcriptFields`: prior turns and latest model response;
- `decisionFields`: branch rules and allowed next actions;
- `safetyFields`: do-not-reveal fields and risk boundaries;
- `outputFields`: what the runtime model must return.

The runtime model's output should be structured:

- `selectedAction`
- `selectedBranchRuleId`
- `modelFacingUserMessage`
- `evaluatorNote`
- `newlyExposedFacts`
- `updatedTrackedState`
- `shouldStop`
- `stopReason`
- `trajectoryNotes`

This makes the runtime multi-turn generator auditable and keeps it aligned with the generated eval set.

## Two-Stage LLM Simulation

For high-risk or highly adaptive multi-turn cases, prefer a two-stage runtime.

Stage 1: Planner

- Sees evaluator-only state, hidden intent, branch rules, last model response, and tracked state.
- Selects `selectedBranchRuleId`, `selectedAction`, `shouldStop`, and an evaluator-facing plan.
- Does not produce the final user message sent to the tested product.

Stage 2: Message Drafter

- Sees only the selected branch's model-facing reply template, allowed model-facing context, side-blind transcript, and style constraints.
- Produces `modelFacingUserMessage`.
- Does not see hidden intent, expected outcome, rubric, or failure modes.

Final Gate:

- Runs the pre-send validation checks.
- Either sends the message, asks the model to repair from the same state packet, or returns `needsHumanReview`.

This split is safer than asking one LLM to read hidden evaluator intent and directly write the user message.

## Replay Log

Every runtime step should record enough evidence to replay and audit simulator behavior.

Minimum `replayLogFields`:

- `state_packet`
- `simulator_output`
- `validator_result`
- `final_user_message`

Recommended additional fields:

- `selected_branch_rule_id`
- `pre_send_validation_errors`
- `human_override`
- `simulator_deviation_note`

The report should be able to say whether a multi-turn case followed the approved script, used allowed adaptation, required human review, or deviated from simulator guardrails.

## Model-Facing vs Evaluator-Facing Content

Every turn must separate:

- what the tested model sees;
- what the evaluator or collection agent sees.

Model-facing:

- `modelFacingUserMessage`

Evaluator-facing:

- `evaluatorInstruction`
- `intentionToPush`
- `expectedStateAfterTurn`
- `stateToTrack`
- `branchRules`
- `trajectoryNotesToCollect`
- `doNotRevealToModel`

Never reveal evaluator-only fields to the tested product.

## Script Modes

### `fixed`

Use when:

- reproducibility matters most;
- the case is short;
- both products should receive identical turns;
- adaptive behavior is not the thing being tested.

Contract default:

- `runtimeModelMode`: usually `manual_driver`
- `decisionPolicy`: `fixed_sequence`
- `branchFallbackPolicy`: `not_applicable`
- `branchRules`: may be empty

### `guided_adaptive`

Use when:

- the model may ask useful clarification questions;
- the user intention should adapt based on model response;
- drift handling is part of the evaluation;
- a human or collection agent can follow branch rules.

MVP can support this as a manual driver policy without automatic simulation.

Contract default:

- `runtimeModelMode`: `manual_driver` for MVP, or guarded LLM modes later
- `decisionPolicy`: `branch_rules_only`
- `branchFallbackPolicy`: `allowed_adaptive_moves_or_needs_human_review`
- `branchRules`: should have stable `branchRuleId` values

### `hybrid`

Use when:

- the first turns should be identical;
- later turns may branch if the model asks relevant clarification or drifts;
- fairness and realism both matter.

Contract default:

- `decisionPolicy`: `branch_rules_only`
- first turns may be fixed by instruction, but any adaptive turn should still route through branch rules or human review

## Required Fields

Each turn script should include:

- `caseId`
- `scriptMode`
- `maxTurns`
- `stateToTrack`
- `fairnessPolicy`
- `doNotRevealToModel`
- `runtimeStateTemplate`
- `harnessExecutionContract`
- `turns`
- `stopCondition`
- `collectionBurden`

Each turn should include:

- `turnIndex`
- `progressLabel`
- `modelFacingUserMessage`
- `evaluatorInstruction`
- `intentionToPush`
- `expectedStateAfterTurn`
- `allowedAdaptiveMoves`
- `branchRules`
- `ifModelDrifts`
- `ifModelAsksClarifyingQuestion`
- `ifModelOverpromises`
- `ifModelRefusesOrCannotAnswer`
- `trajectoryNotesToCollect`

## Branch Rules

Use `branchRules` to keep adaptive multi-turn evaluation fair and repeatable.

Each branch rule should include:

- `branchRuleId`
- `condition`
- `action`
- `modelFacingReply`
- `evaluatorNote`
- `continueToTurn`

For `fixed` scripts using `decisionPolicy=fixed_sequence`, `branchRules` may be an empty array. For `guided_adaptive` or `hybrid` scripts using `decisionPolicy=branch_rules_only`, branch rules should be concrete and stable enough for a human reviewer, collection agent, or guarded runtime simulator to select by `branchRuleId`.

Common conditions:

- model asks relevant clarification;
- model asks irrelevant clarification;
- model ignores a constraint;
- model overpromises;
- model fabricates verification;
- model prematurely concludes;
- model refuses or cannot answer;
- model changes the task direction.

Branch actions should push the original user intention forward without leaking the evaluator intent.

## Fairness Policy

The same case should be fair to both products.

Rules:

- Start both products with the same `modelFacingPrompt` or first `modelFacingUserMessage`.
- Use the same branch rule for equivalent model behavior.
- Do not give one product extra hints unless the same condition would trigger the same hint for the other product.
- Do not reveal hidden intent, expected outcome, rubric, or failure probes.
- Record deviations in trajectory notes.
- Evaluate outcome and trajectory, not exact path matching.

## Stop Conditions

Every script must define when to stop.

Common stop conditions:

- user goal is sufficiently completed;
- model reaches a stable recommendation or answer;
- max turns reached;
- model repeatedly fails to track the task;
- model enters unsupported or unsafe territory;
- evaluator cannot continue fairly with available evidence.

`maxTurns` should usually be small in MVP:

- 2-3 for light multi-turn;
- 3-4 for richer decision tasks;
- avoid high-effort scripts unless explicitly requested.

## Drift Handling

For each multi-turn case, specify how to respond if the model:

- asks a relevant clarification;
- asks an irrelevant clarification;
- prematurely concludes;
- ignores a constraint;
- overpromises;
- fabricates verification;
- refuses or says it cannot help;
- changes the task direction.

Do not punish a model merely for choosing a different valid path. The grader should evaluate outcome and trajectory quality, not exact path matching.

## Trace And Notes To Collect

If full trace is unavailable, collect:

- visible transcript;
- final output;
- visible process notes;
- user-provided observations;
- evidence level;
- branch decisions taken;
- trajectory notes.

`trajectoryNotesToCollect` should be specific enough for later grading.

Examples:

- Did the model preserve the budget constraint?
- Did it ask a useful clarification?
- Did it invent live availability?
- Did it recover after a correction?
- Did it increase user effort unnecessarily?

## Collection Burden

Turn scripts should respect the selected scale preset and manual collection burden.

Suggested `collectionBurden` values:

- `low`
- `medium`
- `high`

For current MVP, avoid many high-burden multi-turn scripts.

If a useful script is high burden, add a `confirmationBacklog` item or mark the case as future/formal-only.

## Good And Bad Examples

### Bad Example

```json
{
  "caseId": "case-001",
  "turns": [
    {"turnIndex": 1, "userMessage": "找家餐厅"},
    {"turnIndex": 2, "userMessage": "还有呢？"}
  ]
}
```

Problems:

- no script mode;
- no evaluator instruction;
- no state tracking;
- no runtime state template;
- no harness execution contract;
- no branch rules;
- no stop condition;
- no do-not-reveal policy;
- no fairness policy.

### Better Example

```json
{
  "caseId": "rest-date-quiet-001",
  "scriptMode": "hybrid",
  "maxTurns": 3,
  "stateToTrack": ["location", "budget", "quietness", "occasion", "liveAvailabilityClaims"],
  "fairnessPolicy": "Both products receive the same first turn. If either asks a relevant clarification, answer using the matching branch rule. Do not reveal hidden intent or evaluator intent.",
  "doNotRevealToModel": ["hiddenIntent", "evaluatorIntent", "expectedOutcome", "failureModesToProbe", "graderRefs"],
  "runtimeStateTemplate": {
    "cursorFields": ["evalRunId", "caseIndex", "caseCount", "caseId", "currentTurnIndex", "maxTurns", "progressLabel", "sideLabel"],
    "packageBindingFields": ["evalPackageId", "evalPackageVersion"],
    "upstreamContextFields": ["arenaEvalSpec.summary", "evalSetCoveragePlan.summary", "evalCases[caseId].summary", "evalCases[caseId].doNotRevealToModel"],
    "transcriptFields": ["priorTurns", "lastModelResponse"],
    "decisionFields": ["branchRules", "allowedAdaptiveMoves", "stateToTrack", "stopCondition"],
    "safetyFields": ["doNotRevealToModel", "forbiddenEvaluatorFields"],
    "outputFields": ["selectedAction", "selectedBranchRuleId", "modelFacingUserMessage", "evaluatorNote", "updatedTrackedState", "shouldStop", "stopReason", "trajectoryNotes"]
  },
  "harnessExecutionContract": {
    "runtimeModelMode": "manual_driver",
    "cursorOwner": "harness",
    "sideBlind": true,
    "decisionPolicy": "branch_rules_only",
    "branchFallbackPolicy": "allowed_adaptive_moves_or_needs_human_review",
    "preSendValidation": ["package_binding", "branch_rule_exists", "no_evaluator_leakage", "no_unapproved_constraints", "tracked_state_whitelist", "max_turns_stop_condition"],
    "replayLogFields": ["state_packet", "simulator_output", "validator_result", "final_user_message"],
    "plannerDrafterSplit": "not_applicable",
    "humanReviewFallbackRequired": true
  },
  "turns": [
    {
      "turnIndex": 1,
      "progressLabel": "Turn 1 of 3",
      "modelFacingUserMessage": "今晚想在上海静安找一家适合约会、安静、预算人均 300 左右的餐厅，最好别太网红吵闹。",
      "evaluatorInstruction": "Copy this message exactly into both products. Do not reveal that this case tests quietness, tradeoff quality, and unsupported live-availability claims.",
      "intentionToPush": "Start a restaurant recommendation task with budget, location, occasion, and atmosphere constraints.",
      "expectedStateAfterTurn": "Model should track location, budget, quietness, and date context; it should avoid guaranteeing no queue or reservation availability without evidence.",
      "allowedAdaptiveMoves": ["answer relevant clarification", "ask for 2-3 options if model is too broad"],
      "branchRules": [
        {
          "branchRuleId": "t1-answer-cuisine-clarification",
          "condition": "model asks what cuisine the user prefers",
          "action": "provide a mild preference without changing core constraints",
          "modelFacingReply": "江浙菜、日料或者轻食都可以，关键是安静、适合聊天。",
          "evaluatorNote": "Relevant clarification. Continue to Turn 2 after replying.",
          "continueToTurn": 2
        }
      ],
      "ifModelDrifts": "Restate quiet/date/budget constraints and ask for options that fit them.",
      "ifModelAsksClarifyingQuestion": "Answer only with prepared constraints; do not add new evaluation goals.",
      "ifModelOverpromises": "Ask how it knows or whether it can mark uncertainty.",
      "ifModelRefusesOrCannotAnswer": "Ask for a best-effort recommendation with uncertainty clearly marked.",
      "trajectoryNotesToCollect": ["constraint tracking", "clarification quality", "unsupported live claims"]
    }
  ],
  "stopCondition": "Stop when the product provides a stable recommendation set with tradeoffs, or when maxTurns is reached.",
  "collectionBurden": "medium"
}
```

## Self-Critique Checklist

Before accepting turn scripts, ask:

- Does each script preserve the case's user-facing and evaluator intent?
- Are model-facing and evaluator-facing contents separated?
- Are hidden intent, expected outcome, rubric, and failure probes protected?
- Is there a fairness policy?
- Is there a runtime state template with package binding, cursor, transcript, decision, safety, and output fields?
- Is there a harness execution contract aligned with `scriptMode`?
- Are branch rules concrete enough for a human or agent to follow?
- Do branch rules have stable `branchRuleId` values when branch routing is used?
- Does the script define stop conditions and max turns?
- Are trajectory notes useful for later grading?
- Is the manual collection burden acceptable for the selected scale preset?
