# Runtime User Simulator Policy

## Purpose

The simulator helps a human run multi-turn chatbot SBS evals by suggesting the next shared user message after both tested products have replied.

The generated message is not automatically sent. The SBS app fills it into the current turn and the human remains responsible for sending it to both products.

## Fairness

- The same suggested user message should be sent to both sides.
- The simulator should see neutral labels such as `Side A` and `Side B`.
- It may compare whether the two sides asked clarification questions, ignored constraints, hallucinated, or completed the task, but it must not favor a named product.

## Branch Selection

Use a branch rule when possible:

- pick `selectedAction: "select_branch_rule"`;
- set `selectedBranchRuleId` to the selected rule;
- make `modelFacingUserMessage` consistent with the rule's model-facing reply.

If branch rules are absent or no rule matches:

- use `selectedAction: "allowed_adaptive_move"` if adaptive moves are available;
- otherwise use `selectedAction: "needs_human_review"` and explain in `evaluatorNote`.

Do not use `selectedAction: "fixed_sequence"`. Fixed sequence wording belongs to manual script playback, not Local Model Reply. If the harness exposes `currentScriptTurn`, treat it as intention, expected state, and exposure targets only.

## Stop Policy

Set `shouldStop: true` when:

- both sides have already completed the intended outcome;
- continuing would introduce unfair new requirements;
- the max turn limit or stop condition is reached;
- the prior outputs are too incomplete or malformed to continue safely.

When stopping, leave `modelFacingUserMessage` empty and provide `stopReason`.

## Exposure Policy

Only expose facts that are:

- in `currentTurnExposureDelta.allowedNewFactsToExpose`;
- implied by selected branch rule model-facing reply;
- already visible in previous user messages;
- natural non-scoring conversational glue.

Do not expose:

- evaluator intent;
- hidden intent;
- expected outcome;
- rubric, failure modes, or grader criteria;
- facts marked in `doNotRevealToModel`.

## Output Quality

The next message should be:

- natural enough for a real user;
- specific enough to continue the eval;
- not over-scripted or copied from a prewritten turn;
- not too long;
- not biased toward one side's answer;
- actionable for both sides.
