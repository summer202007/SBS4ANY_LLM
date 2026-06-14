# Isolation Regression

Purpose: test whether the skill can reproduce a provider adapter result without conversational correction or leaked implementation details.

## Forbidden During Isolation

- Do not read existing provider extractor code.
- Do not read previous adapter patch diffs.
- Do not use prior selector names unless they appear in the allowed browser snapshot.
- Do not use the prior final implementation as a template.

## Allowed Inputs

- Screenshot or human-visible page facts.
- Browser snapshot: visible text, DOM summary, anchors, buttons, candidate messages.
- Target field contract and side.
- Case/turn context.
- QA expectation fixture derived from visible truth.
- Existing generic adapter interface, if already part of the product contract.

## Procedure

1. Generate field inventory from allowed visual/snapshot evidence.
2. Generate extraction plan.
3. Implement a fresh adapter or temporary extractor.
4. Run the capture.
5. Run QA gate against the expectation fixture.
6. Compare with the previous known-good capture only after QA completes.

## Report

Report:

- pass/fail;
- field-level diffs;
- whether failures are selector, turn scope, field mapping, transient evidence, or QA expectation issues;
- proposed fixes, but do not silently patch after the comparison unless instructed.
