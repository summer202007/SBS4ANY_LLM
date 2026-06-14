# Contributing

Thanks for taking a look at SBS 4 Any Agent.

This project is early. The most useful contributions are ones that make task-space-specific AI product evaluation more concrete, inspectable, and extensible.

## Good First Contribution Areas

- Add a well-scoped example under `examples/`.
- Improve README clarity, diagrams, or screenshots.
- Improve skill references under `skills/*/references/`.
- Add or tighten schema and validator checks.
- Document a new capture adapter plan.
- Improve report quality without hiding evidence caveats.

## Project Principles

### Product Decision First

SBS should help teams decide whether a challenger product beats a strong baseline in a concrete task space. Avoid generic benchmark language when a task-space framing would be clearer.

### Human Gate For Generated Evals

Generated eval cases are drafts. Human approval, rejection, and editing are core product behavior, not temporary friction.

### Evidence Before Scores

Reports should cite collected or cleaned evidence. Missing traces should create caveats, not guessed conclusions.

### Conservative Capture

Capture helpers should be user-operated and read-only. Do not add automation that submits prompts, bypasses verification, or reads hidden data from third-party products.

### Keep Skills Focused

Each skill should do one job:

- package generation;
- evidence cleaning and grading;
- capture adapter planning or QA;
- runtime user simulation.

Do not collapse these roles into a single all-purpose instruction file.

## Before Opening A PR

Please check:

- Does the change improve the public product story or the extension path?
- Are local/private artifacts excluded from the change?
- Are new examples sanitized?
- Do structured outputs still validate?
- Are caveats preserved where evidence is partial?

## Local Artifacts

The following are local workspace state and should usually stay out of commits:

- `data/`
- `artifacts/`
- `dist/`
- `.build/`
- `context-sync-bundle/`
- `.env*`

If an artifact is useful for public readers, copy a sanitized version into `examples/`.
