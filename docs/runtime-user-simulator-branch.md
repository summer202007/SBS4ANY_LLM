# Runtime User Simulator Branch

## Purpose

Multi-turn chatbot evaluation needs a runtime user driver after the tested model replies.

The eval-set generator produces `turnScripts` and a `harnessExecutionContract`; the Web App harness executes them.

## MVP Position

The MVP should support:

- `manual guided`: human follows turn scripts and branch rules;
- `LLM suggested`: local model proposes the next user turn, human confirms before sending.

The MVP should not claim fully automated guarded simulation until the harness enforces validation and replay logging end to end.

## Harness-Owned Cursor

The harness, not the model, owns:

- `evalPackageId`
- `evalPackageVersion`
- `evalRunId`
- `caseIndex`
- `caseId`
- `currentTurnIndex`
- `sideLabel`

The local model receives a fresh state packet every step. It does not rely on memory.

## Runtime State Packet Inputs

From the approved package:

- Arena summary
- Coverage summary
- Case summary
- `modelFacingPrompt`
- `evaluatorIntent`
- `hiddenIntent`
- `mustDo`
- `mustNotDo`
- `failureModesToProbe`
- `doNotRevealToModel`
- `exposureContract`
- `turnScript`
- current script turn
- current turn `exposureDelta`
- `branchRules`
- `allowedAdaptiveMoves`
- `stopCondition`
- `harnessExecutionContract`

From the current run:

- prior turns
- latest tested model response
- tracked state
- trajectory notes
- exposed facts so far

## Runtime Model Output

The local model should return structured JSON:

```json
{
  "caseId": "rest-mt-001",
  "currentTurnIndex": 2,
  "evalPackageVersion": "v1",
  "selectedAction": "select_branch_rule",
  "selectedBranchRuleId": "t2-budget-missing",
  "modelFacingUserMessage": "...",
  "evaluatorNote": "...",
  "newlyExposedFacts": [],
  "updatedTrackedState": {},
  "shouldStop": false,
  "stopReason": "",
  "trajectoryNotes": "..."
}
```

## Pre-Send Validation

Before a suggested message is shown as sendable/copyable, the harness should check:

- package and case binding;
- branch rule exists or an allowed adaptive move was used;
- no evaluator-only leakage;
- no unapproved new exposure;
- no unapproved new constraints;
- tracked state only changes allowed fields;
- max turns and stop condition.

In MVP, failed validation should return `needsHumanReview`.

## Product Interaction

Cases page:

- show whether a case has a multi-turn script;
- keep direct turnScript editing read-only;
- avoid running simulation here.

Collect page:

- show progress: `Case n of m / Turn x of y`;
- show prior transcript and latest tested model response;
- offer `Manual guided` first;
- later add `Suggest next user turn` using the local model;
- require human confirmation before copying/sending suggested text.
