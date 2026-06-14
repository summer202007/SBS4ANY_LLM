---
name: chatbot-runtime-user-simulator
description: Use only when invoked by the SBS workbench or local harness to suggest the next user message during a chatbot SBS multi-turn evaluation. This skill consumes an explicit turnExecutionState packet, prior side-blind model outputs, eval case context, exposure contracts, branch rules, and collection constraints, then returns a guarded JSON simulator output. Do not use for eval-set generation, final grading, ordinary chat, or freeform product brainstorming.
metadata:
  short-description: Suggest next user turn for SBS chatbot eval
---

# Chatbot Runtime User Simulator

This skill drafts the next user-facing message for a multi-turn chatbot side-by-side eval.

It is a runtime helper, not an eval-set generator and not a grader. The SBS harness owns the package, case, turn cursor, side mapping, validation, and final insertion into the app.

## Required Input

Read the `turnExecutionState` packet from the harness. Do not rely on memory.

The packet should include:

- `evalPackageId`, `evalPackageVersion`, `evalRunId`;
- `caseId`, `caseIndex`, `caseCount`, `currentTurnIndex`, `maxTurns`;
- arena/task-space summary;
- case summary, user-facing intent, evaluator intent, hidden intent;
- current script turn intention/constraints, branch rules, allowed adaptive moves, stop condition;
- exposure contract and facts exposed so far;
- prior turns with side-blind outputs from `Side A` and `Side B`;
- latest side-blind model responses;
- validation and harness execution constraints.

For detailed rules, read `references/runtime-user-simulator-policy.md` when implementing or debugging simulator behavior.

## Output Contract

Return strict JSON only:

```json
{
  "caseId": "case-id",
  "currentTurnIndex": 2,
  "evalPackageVersion": "v1",
  "selectedAction": "select_branch_rule",
  "selectedBranchRuleId": "branch-rule-id-or-empty",
  "modelFacingUserMessage": "The next user message to send to both products.",
  "evaluatorNote": "Short reason for this suggestion.",
  "newlyExposedFacts": [],
  "updatedTrackedState": {},
  "shouldStop": false,
  "stopReason": "",
  "trajectoryNotes": "Brief runtime note."
}
```

## Core Rules

1. Stay side-blind. Use `Side A` and `Side B`; do not mention baseline/challenger product identities.
2. Produce one shared user message suitable for both sides unless `shouldStop` is true.
3. Prefer an existing `branchRuleId` when a branch rule matches the prior outputs.
4. If no branch rule fits, use allowed adaptive moves only when the packet allows them.
5. Do not reveal evaluator-only information, hidden intent labels, rubrics, failure modes, or expected outcomes to the tested products.
6. Do not add new hard constraints unless they are allowed by the current turn's exposure delta, branch rule, or naturally follow from already visible user facts.
7. If both sides already completed the user goal or the stop condition is met, set `shouldStop: true` and leave `modelFacingUserMessage` empty.
8. Keep the message natural, concise, and realistic for the case persona.
9. Do not use `fixed_sequence`. Local Model Reply is a runtime simulation path, not playback of the eval-set generator's prewritten turn. If fixed wording exists in the package, the harness withholds it from you by design.

## Workflow

1. Verify the packet is for a multi-turn case and current turn is greater than 1.
2. Read prior user messages and the latest Side A / Side B outputs.
3. Decide whether to stop, select a branch rule, or use an allowed adaptive move.
4. Draft one user-facing message from the prior outputs, current turn intention, expected state, and allowed exposure targets. Do not copy or ask for a hidden fixed-sequence message.
5. List only newly exposed facts that the drafted user message actually reveals.
6. Return JSON matching the output contract.
