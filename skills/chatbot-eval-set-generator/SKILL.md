---
name: chatbot-eval-set-generator
description: Use only when invoked by the SBS workbench, local harness, or another explicit product workflow to generate, improve, or audit a structured runtime eval package for chatbot-style AI product comparisons. This skill turns product-provided task-space inputs into an arena spec, coverage plan, executable eval cases, turn scripts, rubric suggestions, report metadata, and self-critique trace. Trigger for backend or UI-driven chatbot eval-set generation, Doubao baseline comparison package creation, multi-turn chatbot eval package creation, or task-space-specific chatbot benchmark package validation. Do not use for ordinary chat-based brainstorming, requirement clarification, generic product PRDs, coding-agent evals, or final grading of collected model outputs.
---

# Chatbot Eval-Set Generator

Generate structured runtime eval packages for chatbot-style SBS evaluation workflows.

This skill is an internal generation engine for a product UI or harness. It is not a normal conversational brainstorming flow. If product inputs are incomplete, continue generating a draft package when possible and record all confirmation needs in `confirmationBacklog` for the UI to show after generation.

## Output Contract

Always produce a JSON-first runtime eval package with these top-level objects:

1. `arenaEvalSpec`
2. `evalSetCoveragePlan`
3. `evalCases`
4. `turnScripts`
5. `rubricSuggestions`
6. `reportSkeletonMetadata`
7. `generationTrace`
8. `selfCritiqueTrace`
9. `confirmationBacklog`

Also provide a concise Markdown summary for human review.

## Workflow

1. Intake normalized product inputs from the UI/harness.
2. Build `arenaEvalSpec`.
3. Record uncertainty and confirmation needs. Do not make clarification a hard gate by default.
4. Design `evalSetCoveragePlan`.
5. Generate executable `evalCases`, `turnScripts`, `rubricSuggestions`, and `reportSkeletonMetadata`.
6. Switch to evaluator mode and run the self-critique and revision loop.
7. Apply one revision pass.
8. Validate structure with `scripts/validate_eval_package.mjs` when file access is available.
9. Preserve trace artifacts and a human-readable case index in every invocation.
10. Return JSON package, Markdown summary, validation result, and artifact references.

## Confirmation Backlog Policy

Generate first, then ask.

During generation, record every uncertainty that may need user confirmation in `confirmationBacklog`. After the complete draft package is produced, the UI should show the backlog to the user in one review step. After the user answers, revise the eval package and then proceed to the SBS collection/eval workflow.

Do not interrupt generation with Steve-style gated questioning. Only return without a draft when the inputs are so empty that even a low-confidence skeleton would be misleading.

Each backlog item should include:

- `id`
- `component`
- `relatedObjectIds`
- `question`
- `whyItMatters`
- `recommendedDefault`
- `severity`
- `blocksEvalRun`
- `status`

## References

Load only the reference needed for the current subtask:

- Arena quality: `references/arena-spec-quality.md`
- Coverage and dimensions: `references/coverage-plan-patterns.md`
- Eval case quality: `references/case-quality-checklist.md`
- Multi-turn scripts: `references/turn-script-policy.md`
- Rubric handoff: `references/rubric-handoff.md`
- Self-critique and revision: `references/self-critique.md`
- Compact complete example: `references/example-complete-runtime-eval-package.md`

Schemas:

- Runtime package schema: `schemas/runtime-eval-package.schema.json`
- Critique schema: `schemas/eval-generation-critique.schema.json`

## Trace Preservation

Trace preservation is mandatory.

In debugging or conversation-mode runs, save artifacts under:

```text
artifacts/eval-generation/<timestamp>-<slug>/
```

Recommended files:

- `input.json`
- `draft-package.json`
- `self-critique.json`
- `revised-package.json`
- `validation.json`
- `summary.md`
- `case-index.md`

`case-index.md` should be human-reviewable and include:

- the Arena core conclusion: the concrete product decision, target users, success definition, and failure definition;
- the Coverage core conclusion: scored dimensions, diagnostic dimensions, disabled dimensions, and case mix rationale;
- a multi-turn evaluation note explaining whether multi-turn cases affect final score, diagnostic trajectory, or both;
- a case table with case id, case type, capability cluster, and scenario;
- open confirmation items.

In product-mode runs, store the same logical artifacts in the app generation artifact store and include artifact references in `generationTrace` and `selfCritiqueTrace`.

In debug/local-file mode, validate with `scripts/validate_eval_package.mjs --mode local <package.json>`. Artifact refs are not decorative strings: they must resolve to existing files relative to the runtime package directory. `case-index.md` is mandatory because it is the human-readable audit entry point.

In product mode, validate with `scripts/validate_eval_package.mjs --mode product <package.json>`. Product artifact refs may be artifact IDs, store-scoped refs, or URLs. The validator checks that a case-index/audit-index artifact ref is present, but the harness must provide the artifact-store resolver and existence check.

## Self-Critique And Revision Loop

The self-critique and revision loop is required. It is not a vague "review your answer" instruction. It must critique the draft package, apply one revision pass when fixes do not require new user input, and record unresolved user-dependent issues in `confirmationBacklog`.

The draft package must be the generator's best first attempt. Do not intentionally under-generate or leave fixable gaps to make the critique appear useful. A critique with no major findings is acceptable when the draft is genuinely strong.

Create structured findings with:

- `findingId`
- `severity`
- `component`
- `issue`
- `whyItMatters`
- `recommendedFix`
- `fixApplied`
- `remainingRisk`

Check at least:

- Arena Spec completeness and confidence
- Coverage Plan fit and dimension choices
- case realism, specificity, diversity, duplication, gradeability, and discriminative signal
- multi-turn drift handling
- rubric-to-case alignment
- report metadata usefulness
- unresolved user confirmations

## Hard Boundaries

- Do not grade collected challenger/baseline outputs. Only design grader handoff artifacts.
- Do not generate coding-agent eval packages.
- Do not silently invent important product context.
- Do not treat the restaurant recommendation example as a domain rule.
- Do not output prose-only packages; important fields must be structured.
