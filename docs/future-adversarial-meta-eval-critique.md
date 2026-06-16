# Future Improvement: Adversarial Meta-Eval Critique

Created: 2026-06-07

## Why This Exists

The current `chatbot-eval-set-generator` skill has a self-critique and revision loop. It checks structure, coverage, model/evaluator separation, rubric mapping, and report readiness.

That is useful, but still not sharp enough.

The next improvement is to make critique test whether the generated eval set can actually distinguish strong, weak, and risky model behavior.

This should be tested after the full SBS workbench exists, ideally as an A/B test:

- **A:** current checklist-style self-critique
- **B:** adversarial meta-eval critique

## Core Idea

For representative cases, the critique pass should simulate or sketch several possible model outputs:

1. a generic weak chatbot answer;
2. a strong target-fit answer;
3. a risky overconfident answer;
4. optionally, a conservative but reliable answer;
5. optionally, a stylish/native-context-fit answer with weak evidence.

Then it should ask:

- Would this case distinguish strong and weak behavior?
- Would the rubric score the strong answer higher?
- Would the rubric penalize the risky answer?
- Would a generic but fluent answer sneak through?
- Would a good answer be unfairly punished because it does not match narrow expected wording?
- Does the case over-reward a challenger's native context advantage when the user's goal did not ask for it?
- Does it under-reward target-user fit when the user's goal explicitly requires it?

## What To Add To The Skill Later

Add a section to `references/self-critique.md`, probably named:

```text
Adversarial Meta-Eval Checks
```

Suggested workflow:

```text
For 3-5 representative cases:
1. imagine a generic weak answer
2. imagine a strong target-fit answer
3. imagine a risky overconfident answer
4. test expectedOutcome, mustDo/mustNotDo, failureModes, and rubricSuggestions against them
5. revise the case or rubric if the eval cannot distinguish them
```

## Expected Benefits

- Stronger eval cases, not just more complete schema fields.
- Better detection of generic prompt-like cases.
- Better detection of unfair hidden intent.
- Better rubric calibration for close SBS comparisons.
- Better handling of target-audience/native-context fit vs unsupported factual certainty.

## Risks

- More token and runtime cost.
- Critique may become over-complicated for MVP.
- Simulated outputs may bias the actual grader if leaked into runtime eval.
- The generator may overfit cases to imagined outputs.

Mitigation:

- Keep simulated outputs inside `selfCritiqueTrace` or a separate debug artifact.
- Never expose simulated outputs to the tested products.
- Use this as a product A/B test after the basic workbench can run end to end.

## Product A/B Test Proposal

When the SBS workbench is usable:

1. Run eval generation for the same task space twice:
   - baseline self-critique only;
   - adversarial meta-eval critique enabled.
2. Compare:
   - human approval rate of generated cases;
   - number of edited/rejected cases;
   - perceived case discriminativeness;
   - rubric usefulness after collecting outputs;
   - report quality.
3. Decide whether adversarial meta-eval should become default, optional, or debug-only.

## Current Decision

Do not implement this immediately.

Remember the idea and return after the product/harness exists.
