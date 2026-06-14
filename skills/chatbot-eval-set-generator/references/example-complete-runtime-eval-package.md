# Example Complete Runtime Eval Package

This file is a compact few-shot example of package structure, not a permanent restaurant recommendation eval set.

Use it to learn:

- how the nine top-level objects fit together;
- how model-facing and evaluator-facing fields are separated;
- how cases, turn scripts, rubrics, report metadata, trace, critique, and confirmation backlog connect.

Do not copy the restaurant content into unrelated task spaces. For a real run, generate domain-specific cases from the user's task space, evaluation scenario, product surfaces, and constraints.

## Scenario

Task space: restaurant recommendation capability.

Evaluation scenario: users choosing restaurants under location, budget, atmosphere, social context, and live-availability uncertainty.

Challenger: Xiaohongshu Diandian.

Baseline: Doubao.

Decision question: Does the challenger meaningfully beat Doubao for restaurant recommendation decisions in this scenario?

## Structural Pattern

A complete package includes:

1. `arenaEvalSpec`
2. `evalSetCoveragePlan`
3. `evalCases`
4. `turnScripts`
5. `rubricSuggestions`
6. `reportSkeletonMetadata`
7. `generationTrace`
8. `selfCritiqueTrace`
9. `confirmationBacklog`

## Compact Complete Example

This is intentionally smaller than an MVP eval set. A real MVP package normally uses the `mvp` scale preset and 12-20 cases unless the harness or user chooses a smaller run.

```json
{
  "arenaEvalSpec": {
    "taskSpace": "restaurant recommendation",
    "evaluationScenario": "Users choosing real restaurants under location, budget, atmosphere, social context, and live-availability uncertainty.",
    "decisionQuestion": "Does Xiaohongshu Diandian beat Doubao for restaurant recommendation decisions in this scenario?",
    "targetUsers": ["consumer users seeking restaurants for real near-term occasions"],
    "userJobs": ["choose a restaurant under constraints", "avoid extra research", "understand tradeoffs and uncertainty"],
    "baseline": {
      "name": "Doubao",
      "role": "ceiling chatbot baseline",
      "collectionMode": "manual or semi-automated web/app prompt collection"
    },
    "challenger": {
      "name": "Xiaohongshu Diandian",
      "role": "evaluated chatbot product",
      "collectionMode": "manual prompt collection"
    },
    "productSurface": "chatbot",
    "baselineUseMode": "default consumer chatbot flow",
    "challengerUseMode": "default consumer chatbot flow",
    "assumptions": [
      "Only visible outputs and manually captured conversation transcripts may be available.",
      "Live reservation or queue status should be treated as uncertain unless the product visibly provides evidence."
    ],
    "knownUnknowns": ["Exact target city mix and user segment may need product UI confirmation."],
    "confidence": "medium",
    "successDefinition": "The better product helps users make a usable restaurant decision, respects constraints, explains tradeoffs, and avoids unsupported certainty.",
    "failureDefinition": "The weaker product gives generic popular lists, ignores constraints, fabricates certainty, or fails to recover from user corrections.",
    "riskBoundaries": ["do not fabricate live availability", "do not ignore dietary, allergy, accessibility, or budget constraints"],
    "evidenceAssumptions": ["final output is always collectable", "visible transcript is collectable for multi-turn cases", "full internal trace is not assumed"],
    "requiresUserConfirmation": true,
    "clarificationQuestions": [
      {
        "id": "confirm-city-mix",
        "question": "Should the restaurant eval focus on one city or multiple city tiers?",
        "whyItMatters": "City choice changes what counts as strong local recommendation behavior.",
        "recommendedDefault": "Use one primary city plus one out-of-primary-city boundary case for MVP.",
        "blocksGeneration": false
      }
    ]
  },
  "evalSetCoveragePlan": {
    "defaultDimensions": ["intentUnderstanding", "outcomeQuality", "trajectoryControl", "evidenceGrounding", "riskHandling", "productExperience"],
    "scoredDimensions": ["intentUnderstanding", "outcomeQuality", "evidenceGrounding", "riskHandling"],
    "diagnosticDimensions": ["trajectoryControl"],
    "baselineInsightDimensions": ["productExperience"],
    "enabledDimensions": ["intentUnderstanding", "outcomeQuality", "evidenceGrounding", "riskHandling", "trajectoryControl", "productExperience"],
    "disabledDimensions": [],
    "dimensionWeights": {
      "intentUnderstanding": 0.25,
      "outcomeQuality": 0.35,
      "evidenceGrounding": 0.2,
      "riskHandling": 0.2
    },
    "scalePreset": "smoke",
    "caseMix": {
      "single_turn": 1,
      "scripted_multi_turn": 1
    },
    "caseCountTarget": 2,
    "caseTypeRationale": {
      "single_turn": "Covers search-like one-shot restaurant recommendation behavior.",
      "scripted_multi_turn": "Covers correction handling and constraint carryover across turns."
    },
    "difficultyMix": {
      "medium": 1,
      "hard": 1
    },
    "riskMix": {
      "medium": 1,
      "high": 1
    },
    "singleTurnRatio": 0.5,
    "multiTurnRatio": 0.5,
    "optionalExperiencePersonaModule": {
      "status": "baseline_insight_only",
      "rationale": "Product experience/persona is useful for iteration advice but should not enter overall score unless user opts in."
    },
    "taskFitModule": {
      "status": "scored",
      "relationshipToProductExperience": "task_value_not_product_experience",
      "fitSignals": ["occasion fit", "target-user lifestyle fit", "local discovery fit"],
      "sourceContextSignals": ["local review/source awareness when visibly supported", "recentness uncertainty when not supported"],
      "scoredThroughDimensions": ["intentUnderstanding", "outcomeQuality", "evidenceGrounding"],
      "rewardPolicy": "Reward target-user and local-context fit only when it improves the user's concrete restaurant decision.",
      "penaltyPolicy": "Do not let lifestyle fit excuse unsupported live availability, queue, booking, price, safety, or recency claims.",
      "rationale": "This keeps task fit separate from chatbot persona/product feel while still allowing task-relevant local context to affect scores.",
      "confirmationBacklogRefs": []
    },
    "coverageGaps": ["This compact example omits full city, cuisine, group-size, dietary, and price-tier coverage."],
    "confirmationBacklogRefs": ["confirm-city-mix"],
    "coverageRationale": "Compact example demonstrates one-shot and multi-turn SBS collection mechanics. Real MVP should expand to 12-20 cases.",
    "requiresUserConfirmation": true
  },
  "evalCases": [
    {
      "caseId": "rest-single-001",
      "caseType": "single_turn",
      "capabilityCluster": "constraint_satisfaction",
      "scenarioArchetype": "clear_constraints_recommendation",
      "scenario": "A user wants a quiet date restaurant near Shanghai Jing'an with budget and atmosphere constraints.",
      "userPersona": "consumer planning a near-term date dinner",
      "userGoal": "Choose a suitable restaurant without doing extra research.",
      "userFacingIntent": "Find a quiet, non-noisy date restaurant near Jing'an around RMB 300 per person.",
      "evaluatorIntent": "Test whether the product tracks explicit constraints and avoids unsupported live-availability claims.",
      "hiddenIntent": "User cares more about quietness and reservation feasibility than popularity.",
      "constraints": ["Shanghai Jing'an", "date dinner", "quiet", "around RMB 300 per person", "avoid noisy influencer spots"],
      "initialPrompt": "今晚想在上海静安找一家适合约会、安静、预算人均 300 左右的餐厅，最好别太网红吵闹。",
      "modelFacingPrompt": "今晚想在上海静安找一家适合约会、安静、预算人均 300 左右的餐厅，最好别太网红吵闹。",
      "collectionInstructions": [
        "Copy only modelFacingPrompt into both products.",
        "Capture the final output and any visible citations, caveats, or follow-up questions.",
        "Do not reveal evaluatorIntent, hiddenIntent, expectedOutcome, failure modes, or rubric fields."
      ],
      "doNotRevealToModel": ["evaluatorIntent", "hiddenIntent", "expectedOutcome", "unacceptableOutcomes", "failureModesToProbe", "graderRefs"],
      "expectedOutcome": "Provides specific options or asks useful clarifying questions, explains tradeoffs, respects quiet/date/budget constraints, and flags uncertainty about live availability.",
      "acceptableOutcomes": ["asks a clarifying question before recommending", "offers options with uncertainty and tradeoffs", "suggests reservation verification"],
      "unacceptableOutcomes": ["guarantees no queue without evidence", "lists only generic popular spots", "ignores quietness or budget"],
      "mustDo": ["track budget", "track quiet/date context", "state uncertainty about live availability"],
      "mustNotDo": ["fabricate reservation status", "recommend only generic popularity-based options"],
      "failureModesToProbe": ["overconfident live claims", "ignoring quietness", "generic list"],
      "riskLevel": "medium",
      "difficulty": "medium",
      "discriminativeSignal": "Separates locally useful recommendation behavior from generic fluent advice.",
      "evidenceRequired": {
        "minimumLevel": 0,
        "preferredEvidence": ["final output", "visible caveats", "recommendation rationale"]
      },
      "collectionMode": "manual_single_prompt",
      "estimatedUserEffort": "low",
      "graderRefs": ["intentUnderstanding", "outcomeQuality", "evidenceGrounding", "riskHandling"],
      "confirmationBacklogRefs": []
    },
    {
      "caseId": "rest-multi-001",
      "caseType": "scripted_multi_turn",
      "capabilityCluster": "correction_and_constraint_carryover",
      "scenarioArchetype": "early_misunderstanding_then_correction",
      "scenario": "A user asks for a team dinner recommendation, then corrects the model after it optimizes for a date-like scenario.",
      "userPersona": "consumer organizing a small team dinner",
      "userGoal": "Find a suitable restaurant for six coworkers with dietary and noise constraints.",
      "userFacingIntent": "Choose a restaurant for a six-person team dinner that is not too noisy and has vegetarian options.",
      "evaluatorIntent": "Test whether the product recovers from early misunderstanding and carries constraints across turns.",
      "hiddenIntent": "User values group practicality more than aesthetics.",
      "constraints": ["six people", "team dinner", "not too noisy", "vegetarian options", "around RMB 250 per person"],
      "initialPrompt": "帮我找个今晚团队聚餐的餐厅，6个人，人均 250 左右，别太吵，最好有素食选择。",
      "modelFacingPrompt": "帮我找个今晚团队聚餐的餐厅，6个人，人均 250 左右，别太吵，最好有素食选择。",
      "collectionInstructions": [
        "Run the associated turn script after the initial model response.",
        "Track whether the product remembers team dinner, group size, budget, noise, and vegetarian constraints.",
        "Do not reveal evaluator-only intent or branch rules."
      ],
      "doNotRevealToModel": ["evaluatorIntent", "hiddenIntent", "expectedOutcome", "branchRules", "failureModesToProbe", "graderRefs"],
      "expectedOutcome": "Maintains group constraints across turns, corrects any date/solo framing, and produces practical options with uncertainty.",
      "acceptableOutcomes": ["asks about cuisine or neighborhood", "revises recommendation after correction", "flags reservation uncertainty"],
      "unacceptableOutcomes": ["continues recommending date spots after correction", "drops vegetarian or group-size constraints", "claims guaranteed seats without evidence"],
      "mustDo": ["carry group size", "carry vegetarian need", "recover from correction"],
      "mustNotDo": ["persist with corrected false premise", "fabricate seat availability"],
      "failureModesToProbe": ["task drift", "constraint forgetting", "overconfident booking claims"],
      "riskLevel": "high",
      "difficulty": "hard",
      "discriminativeSignal": "Tests whether multi-turn trajectory stays aligned after correction.",
      "evidenceRequired": {
        "minimumLevel": 1,
        "preferredEvidence": ["visible transcript", "final revised recommendation", "trajectory notes"]
      },
      "collectionMode": "manual_multi_turn",
      "estimatedUserEffort": "medium",
      "graderRefs": ["intentUnderstanding", "outcomeQuality", "trajectoryControl", "riskHandling"],
      "confirmationBacklogRefs": []
    }
  ],
  "turnScripts": [
    {
      "caseId": "rest-multi-001",
      "scriptMode": "guided_adaptive",
      "maxTurns": 3,
      "stateToTrack": ["group size", "budget", "noise level", "vegetarian options", "whether model drifted into date/solo framing"],
      "fairnessPolicy": "Use the same initial prompt and equivalent correction pressure for both products. Do not add extra hints to one side.",
      "doNotRevealToModel": ["evaluatorInstruction", "intentionToPush", "expectedStateAfterTurn", "branchRules"],
      "runtimeStateTemplate": {
        "cursorFields": ["evalRunId", "caseIndex", "caseCount", "caseId", "currentTurnIndex", "maxTurns", "progressLabel", "sideLabel"],
        "packageBindingFields": ["evalPackageId", "evalPackageVersion"],
        "upstreamContextFields": ["arenaEvalSpec.summary", "evalSetCoveragePlan.summary", "evalCases[caseId].summary", "evalCases[caseId].doNotRevealToModel"],
        "transcriptFields": ["priorTurns", "priorUserMessages", "priorModelResponses", "lastModelResponse"],
        "decisionFields": ["branchRules", "stateToTrack", "stopCondition"],
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
          "progressLabel": "Case rest-multi-001 turn 1 of 3",
          "modelFacingUserMessage": "帮我找个今晚团队聚餐的餐厅，6个人，人均 250 左右，别太吵，最好有素食选择。",
          "evaluatorInstruction": "Start the task. Capture whether the model recognizes group dinner constraints.",
          "intentionToPush": "Establish group dinner constraints.",
          "expectedStateAfterTurn": "Model should ask useful clarifying questions or recommend with group/noise/vegetarian/budget constraints.",
          "allowedAdaptiveMoves": ["answer reasonable clarifying questions briefly", "proceed to correction if model frames it as date or solo dinner"],
          "branchRules": [
            {
              "branchRuleId": "t1-correct-date-or-solo-framing",
              "condition": "Model frames the task as a date or ignores group size.",
              "action": "Correct the misunderstanding.",
              "modelFacingReply": "不是约会，是 6 个人团队聚餐，还是希望别太吵、有素食选择。",
              "evaluatorNote": "Tests correction handling and constraint carryover.",
              "continueToTurn": 2
            }
          ],
          "ifModelDrifts": "Use the correction reply and continue.",
          "ifModelAsksClarifyingQuestion": "Answer with: 静安或南京西路附近都可以，川菜不要太辣也可以。",
          "ifModelOverpromises": "Ask how it knows the reservation or queue status.",
          "ifModelRefusesOrCannotAnswer": "Ask for a best-effort shortlist with uncertainty clearly marked."
        },
        {
          "turnIndex": 2,
          "progressLabel": "Case rest-multi-001 turn 2 of 3",
          "modelFacingUserMessage": "静安或南京西路附近都可以，川菜不要太辣也可以。",
          "evaluatorInstruction": "Add location/cuisine tolerance. Check whether prior constraints remain active.",
          "intentionToPush": "Test constraint carryover after adding more detail.",
          "expectedStateAfterTurn": "Model should preserve group size, budget, noise, and vegetarian constraints.",
          "allowedAdaptiveMoves": ["ask for final recommendation if the model remains vague", "challenge unsupported availability claims"],
          "branchRules": [
            {
              "branchRuleId": "t2-challenge-unsupported-availability",
              "condition": "Model claims seats or no queue are guaranteed.",
              "action": "Ask for evidence and uncertainty.",
              "modelFacingReply": "你怎么确认今晚一定有位或者不用排队？如果不能确认，请明确标注不确定。",
              "evaluatorNote": "Tests evidence grounding and overconfidence.",
              "continueToTurn": 3
            }
          ],
          "ifModelDrifts": "Restate the team dinner constraints in one sentence.",
          "ifModelAsksClarifyingQuestion": "Answer briefly and do not add new major constraints.",
          "ifModelOverpromises": "Use the evidence challenge reply.",
          "ifModelRefusesOrCannotAnswer": "Ask for a shortlist and verification steps."
        }
      ],
      "stopCondition": "Stop after the model gives a final shortlist or after turn 3.",
      "collectionBurden": "medium"
    }
  ],
  "rubricSuggestions": [
    {
      "dimensionId": "intentUnderstanding",
      "dimensionState": "scored",
      "appliesToCaseTypes": ["single_turn", "scripted_multi_turn"],
      "appliesToCaseTags": ["constraint_following", "correction_recovery", "restaurant_social_context_fit"],
      "caseRefs": ["rest-single-001", "rest-multi-001"],
      "weightSuggestion": 0.25,
      "scoreScale": "1-5",
      "scoreAnchors": {
        "high": "Tracks explicit and latent user constraints, resolves tradeoffs, and preserves constraints across relevant turns.",
        "medium": "Handles the main explicit request but misses one important latent constraint or drops a constraint once.",
        "low": "Optimizes for a different task, ignores critical constraints, or persists with a corrected false premise."
      },
      "scoringMethod": ["absolute_case_score", "pairwise_preference", "trajectory_score"],
      "positiveSignals": ["extracts budget/location/social-context constraints", "asks useful clarifying questions", "recovers after correction"],
      "negativeSignals": ["generic recommendations", "constraint forgetting", "misreads social context"],
      "redLineFailures": [
        {
          "failureId": "persist-corrected-false-premise",
          "description": "Continues using a corrected date/solo framing after the user clarifies this is a team dinner.",
          "scoreCap": 2,
          "appliesWhen": "Multi-turn correction case after user explicitly corrects the premise.",
          "evidenceRequired": "Visible transcript showing correction and later model response.",
          "suggestedAction": "Cap intentUnderstanding for that case and flag trajectory failure."
        }
      ],
      "evidenceSources": ["final_output", "visible_transcript", "turn_by_turn_responses"],
      "evidenceRequired": "Final output for single-turn cases; visible transcript for multi-turn cases.",
      "judgeTypeSuggestion": "LLM pairwise with optional human sampling",
      "judgePlan": {
        "primaryJudge": "LLM",
        "fallbackJudge": "human",
        "humanSamplingRecommendation": "Recommended for ambiguous pairwise calls, but not required to run the package.",
        "calibrationNotes": "Use one known-good constraint-tracking answer as calibration before batch grading.",
        "blindPairwiseRecommended": true
      },
      "uncertaintyPolicy": "If one side lacks visible transcript for a multi-turn case, mark trajectory-specific uncertainty rather than inventing a score.",
      "aggregationHint": "Contributes to the intentUnderstanding dimension and overall SBS score. Preserve multi-turn correction failures in report diagnostics.",
      "humanOverridePolicy": "Human reviewer may annotate when a model makes a valid alternative assumption not covered by the case.",
      "confirmationBacklogRefs": []
    }
  ],
  "reportSkeletonMetadata": {
    "reportAudience": "Agent PM evaluating whether a challenger chatbot is worth using or studying against Doubao.",
    "decisionMode": "SBS ceiling-baseline comparison",
    "scoreboardDimensions": ["intentUnderstanding", "outcomeQuality", "evidenceGrounding", "riskHandling"],
    "caseClusters": ["constraint_satisfaction", "correction_and_constraint_carryover"],
    "riskSections": ["unsupported live availability", "constraint forgetting", "overconfident recommendations"],
    "baselineInsightSections": ["product experience/persona observations from Doubao if productExperience is baseline_insight_only"],
    "recommendedAppendices": ["raw prompts", "visible transcripts", "rubric handoff", "self-critique trace", "confirmation backlog"],
    "rawArtifactLinks": ["draft-package.json", "self-critique.json", "revised-package.json", "validation.json", "case-index.md"],
    "humanOverrideFields": ["winnerOverride", "dimensionImportanceOverride", "notesOnImportantNicheWins"]
  },
  "generationTrace": {
    "generationRunId": "example-restaurant-smoke",
    "mode": "debug-example",
    "inputSummary": "Compact restaurant recommendation SBS package for Xiaohongshu Diandian vs Doubao.",
    "artifactRefs": ["draft-package.json", "self-critique.json", "revised-package.json", "validation.json", "case-index.md"],
    "knownLimitations": ["Example scale is smaller than a real MVP eval set."]
  },
  "selfCritiqueTrace": {
    "findings": [
      {
        "findingId": "f-001",
        "severity": "note",
        "component": "evalSetCoveragePlan",
        "issue": "The example uses smoke scale with two cases.",
        "whyItMatters": "A real MVP should normally use 12-20 cases to reduce overfitting to a tiny sample.",
        "recommendedFix": "Expand case mix during real generation.",
        "fixApplied": false,
        "remainingRisk": "This example demonstrates structure, not statistical confidence.",
        "confirmationBacklogRef": "",
        "affectedCaseRefs": [],
        "affectedDimensionRefs": []
      }
    ],
    "qualityGateResults": {
      "arenaSpecSpecificity": {
        "status": "pass",
        "reason": "The example includes a concrete restaurant decision scenario."
      },
      "coverageBalance": {
        "status": "warn",
        "reason": "Smoke scale is intentionally incomplete."
      },
      "caseExecutability": {
        "status": "pass",
        "reason": "Both cases can be manually collected."
      },
      "caseDiversity": {
        "status": "warn",
        "reason": "Only one single-turn and one multi-turn case are shown."
      },
      "modelEvaluatorSeparation": {
        "status": "pass",
        "reason": "Model-facing prompts are separated from hidden intent, expected outcomes, and rubrics."
      },
      "multiTurnRuntimeReadiness": {
        "status": "pass",
        "reason": "The multi-turn case includes runtime state template and branch rules."
      },
      "rubricCaseMapping": {
        "status": "pass",
        "reason": "Rubric references concrete case IDs."
      },
      "reportReadiness": {
        "status": "pass",
        "reason": "Report metadata includes scoreboard, risk sections, appendices, and human override fields."
      },
      "confirmationBacklogCompleteness": {
        "status": "pass",
        "reason": "Known user-dependent city-mix choice is captured in confirmationBacklog."
      },
      "traceCompleteness": {
        "status": "pass",
        "reason": "Trace artifact refs and critique summary are present."
      }
    },
    "revisionPasses": [
      {
        "passIndex": 1,
        "changesApplied": ["Added confirmation backlog for city mix instead of assuming it silently."],
        "reason": "City scope changes recommendation quality expectations and should be user-visible."
      }
    ],
    "revisionSummary": "The package remains a compact example. It is ready as a structural few-shot with caveats, not as a full MVP eval set.",
    "unresolvedConfirmationBacklogRefs": ["confirm-city-mix"],
    "traceArtifactRefs": ["self-critique.json"],
    "overallReadiness": "ready_with_caveats"
  },
  "confirmationBacklog": [
    {
      "id": "confirm-city-mix",
      "component": "arenaEvalSpec",
      "relatedObjectIds": ["arenaEvalSpec", "evalSetCoveragePlan"],
      "question": "Should this restaurant eval focus on one city or cover multiple city tiers?",
      "whyItMatters": "City scope changes case realism, local knowledge expectations, and baseline/challenger advantage.",
      "recommendedDefault": "Use one primary city plus one out-of-primary-city boundary case for MVP.",
      "severity": "important",
      "blocksEvalRun": false,
      "status": "pending_user"
    }
  ]
}
```

## Lessons

Use the example for structure, not content reuse.

Important lessons:

- `modelFacingPrompt` and turn `modelFacingUserMessage` are the only prompt-like fields copied into tested products.
- Hidden intent, expected outcomes, failure modes, rubric suggestions, and branch rules are evaluator-facing only.
- Multi-turn runtime prompts must be assembled by the harness from the approved package, current cursor state, prior visible transcript, and branch rules.
- Rubrics should point to case types and concrete `caseId` values.
- Self-critique should revise the package once when possible and move user-dependent choices into `confirmationBacklog`.
- A compact example can be `ready_with_caveats`; a real MVP should expand coverage and preserve generation trace artifacts.
- When the user's evaluation goal includes target-audience or native-context fit, reward useful fit as task value, but still penalize unsupported live, recency, source-certainty, or verification claims.
