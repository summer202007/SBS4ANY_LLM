# Concepts

SBS 4 Any Agent is built around product decisions, not leaderboard positions.

The central question is:

> In a concrete task space, does the challenger product beat the strongest baseline enough to matter?

## Task Space

A task space is the product job being evaluated. It should be specific enough that success and failure can be observed.

Good task spaces:

- Job interview coaching for early-career white-collar users.
- Restaurant recommendation for high-intent local dining decisions.
- Coding-agent bugfix workflow in a known repository.

Weak task spaces:

- General chat quality.
- Intelligence.
- Helpfulness.

A good task space gives the eval generator enough context to build discriminative cases.

## Evaluation Arena

An evaluation arena combines:

- task space;
- target users;
- challenger product;
- strongest baseline;
- surfaces and access modes;
- evidence availability;
- winning criteria;
- risk boundaries.

The arena is the product contract for the run. If the arena is vague, the resulting eval set will also be vague.

## Strong Baseline

SBS assumes that a challenger should be compared with a strong product baseline, not just an abstract model.

For chatbot-style tasks, the initial baseline is Doubao. For coding-agent tasks, a future arena might use Codex or Claude Code. The baseline should represent the product ceiling users can already access.

## Runtime Eval Package

A runtime eval package is the executable evaluation artifact. It contains:

- `arenaEvalSpec`;
- `evalSetCoveragePlan`;
- `evalCases`;
- `turnScripts`;
- `rubricSuggestions`;
- `reportSkeletonMetadata`;
- `generationTrace`;
- `selfCritiqueTrace`;
- `confirmationBacklog`.

The package is JSON-first so the app can run it, but it also includes human-readable artifacts such as `case-index.md`.

## Human Curation

Generated cases are drafts. SBS requires a human gate before formal collection because task-space quality is a product judgment.

Humans can:

- approve cases;
- reject cases;
- edit case wording;
- leave reviewer notes;
- decide which confirmation backlog items matter before running.

## Evidence Level

SBS supports partial evidence rather than pretending every product exposes full traces.

| Level | Meaning |
| --- | --- |
| L0 | Final output only. |
| L1 | Final output plus visible process, copied notes, or visible transcript. |
| L2 | Tool calls, source cards, browser logs, or file changes when visibly available. |
| L3 | Complete auditable or replayable trace. |

The grader must respect evidence limits. Missing traces are not guessed.

## Side-By-Side Review

The review surface keeps the baseline and challenger outputs visible together. The goal is not only to pick a winner, but to understand why one product performs better and what that means for product iteration.

## Grading Report

The SBS grader produces:

- cleaned evidence;
- case-level judgments;
- aggregate scores;
- task-space verdict;
- red lines and caveats;
- evidence excerpts;
- optimization suggestions;
- memo-grade Markdown report.

Scores are directional PM-eval scores unless the run includes stronger calibration methodology.

## Why Not A Generic Leaderboard?

Generic benchmarks are useful for broad comparison, but product teams often need a narrower answer:

- Does this product help this user better?
- Does it beat the thing users already use?
- Where exactly does it fail?
- What should the product team fix next?

SBS is optimized for that decision workflow.
