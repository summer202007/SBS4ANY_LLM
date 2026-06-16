# Chatbot Eval-Set Generator Skill Brief

Created: 2026-06-07

## Purpose

Build a reusable Codex skill that generates systematic chatbot eval sets for arbitrary task spaces.

The skill should help an Agent PM create an auditable runtime eval package for side-by-side comparison between a challenger chatbot product and a ceiling baseline, usually Doubao for the first SBS workbench phase.

The skill is not a generic "write some eval questions" prompt. It is a structured workflow for:

1. clarifying the arena;
2. designing coverage;
3. generating executable eval cases;
4. generating single-turn and multi-turn collection scripts;
5. handing off draft rubrics to graders;
6. creating report metadata;
7. self-critiquing and revising the generated package;
8. preserving trace artifacts for review.

## Recommended Skill Name

`chatbot-eval-set-generator`

Reasoning:

- specific enough to avoid triggering for coding-agent evals;
- broad enough to cover consumer chatbot, work chatbot, research chatbot, recommendation chatbot, and workflow-style chatbot products;
- directly maps to the portfolio artifact.

## Trigger Description Draft

```yaml
description: Use only when invoked by the SBS workbench, local harness, or another explicit product workflow to generate, improve, or audit a structured runtime eval package for chatbot-style AI product comparisons. This skill turns product-provided task-space inputs into an arena spec, coverage plan, executable eval cases, turn scripts, rubric suggestions, report metadata, and self-critique trace. Trigger for backend or UI-driven chatbot eval-set generation, Doubao baseline comparison package creation, multi-turn chatbot eval package creation, or task-space-specific chatbot benchmark package validation. Do not use for ordinary chat-based brainstorming, requirement clarification, generic product PRDs, coding-agent evals, or final grading of collected model outputs.
```

Trigger boundaries:

- Use only when a productized SBS eval-generation workflow explicitly invokes it.
- Use for generating structured runtime eval packages from product-provided inputs.
- Use for auditing or improving an already generated runtime eval package.
- Do not use as a normal conversational assistant flow.
- Do not use for early requirement clarification; use product discussion or Steve-style clarification before the UI/harness invokes this skill.
- Do not use for actually grading collected outputs unless the product workflow explicitly asks to design the grader handoff.
- Do not use for coding-agent evals; that should become a separate skill later.

Product implication:

- The skill assumes a UI or harness has already collected the task-space form fields, optional user answers, and desired generation settings.
- If required fields are missing, the skill should return structured `clarificationQuestions` / `requiresUserConfirmation` instead of running a long conversational interview.

## Directory Architecture

```text
chatbot-eval-set-generator/
├── SKILL.md
├── agents/
│   └── openai.yaml
├── references/
│   ├── arena-spec-quality.md
│   ├── coverage-plan-patterns.md
│   ├── case-quality-checklist.md
│   ├── turn-script-policy.md
│   ├── rubric-handoff.md
│   ├── self-critique.md
│   └── example-complete-runtime-eval-package.md
├── schemas/
│   ├── runtime-eval-package.schema.json
│   └── eval-generation-critique.schema.json
└── scripts/
    └── validate_eval_package.mjs
```

## What Goes In `SKILL.md`

`SKILL.md` should stay lean. It should contain:

- what this skill does;
- when to ask user clarification questions;
- the high-level generation workflow: the stable orchestration steps this skill must run every time, not detailed case-writing rules;
- the six-piece output contract;
- the self-critique loop: the required evaluator-mode pass that critiques the draft package, records findings, and applies one revision before final output;
- which reference file to read for each subtask;
- instruction to output JSON-first plus human-readable summary;
- instruction to preserve trace in every invocation, whether in debugging mode or product mode.

It should not contain:

- long examples;
- full schemas;
- detailed case taxonomies;
- full rubric definitions;
- restaurant recommendation regression output.

Those belong in references, schemas, and test artifacts.

### High-Level Generation Workflow Definition

High-level generation workflow means the stable orchestration protocol, not the detailed content heuristics.

It should tell the agent:

1. read product-provided inputs;
2. construct Arena Eval Spec;
3. decide whether required fields are missing;
4. return structured clarification requests if needed;
5. design coverage plan;
6. generate the six-piece runtime eval package;
7. run self-critique;
8. revise once;
9. validate structure;
10. save trace;
11. return JSON package plus human-readable summary.

Detailed rules such as "what makes a good restaurant recommendation case" or "how to weight evidence grounding" should live in references, not in `SKILL.md`.

### Self-Critique Loop Definition

Self-critique loop means the same model switches into evaluator mode after generation and reviews its own draft against explicit quality gates.

It must produce structured critique findings before revision:

- `findingId`
- `severity`
- `component`
- `issue`
- `whyItMatters`
- `recommendedFix`
- `fixApplied`
- `remainingRisk`

The loop should check at least:

- Arena Spec completeness and confidence;
- Coverage Plan fit and dimension choices;
- case realism, specificity, diversity, duplication, gradeability, and discriminative signal;
- multi-turn drift handling;
- rubric-to-case alignment;
- whether report metadata can support a final SBS report;
- whether any unresolved user confirmations remain.

The loop must not be a vague "review your answer" instruction. It is a required generation phase with a structured artifact.

### Trace Preservation Policy

Trace preservation is mandatory in every invocation.

Debugging / conversation-mode trace:

- Use when the skill is being designed, tested, or manually invoked before the product UI exists.
- Save artifacts in the repo or working directory, for example:
  - `artifacts/eval-generation/<timestamp>-<slug>/input.json`
  - `artifacts/eval-generation/<timestamp>-<slug>/draft-package.json`
  - `artifacts/eval-generation/<timestamp>-<slug>/self-critique.json`
  - `artifacts/eval-generation/<timestamp>-<slug>/revised-package.json`
  - `artifacts/eval-generation/<timestamp>-<slug>/summary.md`
  - `artifacts/eval-generation/<timestamp>-<slug>/validation.json`
- Human review path: the agent links these files in the chat response; the reviewer opens the JSON/Markdown artifacts directly.

Product-mode trace:

- Use when the SBS workbench or local harness invokes the skill.
- Store artifacts under the app's run/generation artifact store, not hidden inside the conversation.
- Recommended persisted objects:
  - `generationRunId`
  - request payload / normalized inputs
  - prompt or instruction version
  - model/provider metadata
  - raw draft output
  - parsed draft package
  - self-critique trace
  - revised package
  - validation result
  - unresolved confirmations
  - timestamps and version hashes
- Human review path: the UI should expose a "Generation Trace" or "Why this eval set?" panel with summary, critique findings, unresolved assumptions, and links/downloads for raw artifacts.

In both modes, the final package must include references to its trace artifacts through `generationTrace` and `selfCritiqueTrace`.

## Reference Files

### `references/arena-spec-quality.md`

Purpose:

- define what a good Arena Eval Spec is;
- list required user-confirmation points;
- give confidence thresholds.

Key contents:

- task-space boundary;
- target user and user jobs;
- decision question;
- baseline/challenger assumptions;
- success/failure definitions;
- risk boundaries;
- evidence assumptions;
- when to stop and ask the user.

### `references/coverage-plan-patterns.md`

Purpose:

- guide dimension selection and case mix.

Key contents:

- default six dimensions;
- when to increase/decrease dimension weight;
- optional product-experience/persona module;
- suggested case scale by task complexity;
- positive, negative, boundary, and regression-like coverage.

### `references/case-quality-checklist.md`

Purpose:

- define what a good eval case and good eval case set look like.
- define rules for generating task-space-specific positive and negative examples, not hardcode a universal bank of examples.

Key contents:

- executable task object standards;
- specificity, realism, gradeability, discriminative signal;
- hidden intent and constraints;
- anti-duplication checks;
- failure modes;
- positive and negative example generation rules;
- a small number of illustrative examples only to show the pattern, not to constrain every task space.

Positive/negative example policy:

- Do not hardcode fixed positive/negative cases as if they apply to every domain.
- Write reusable rules for what a positive case and a negative/boundary case should test.
- At generation time, instantiate those rules into the current task space.
- For example, in restaurant recommendation, a positive case may test constraint satisfaction under clear user intent; a negative/boundary case may test whether the product avoids guaranteeing no queue, live availability, or unverifiable facts.
- In another task space, the same rule should produce different domain-specific examples.

### `references/turn-script-policy.md`

Purpose:

- turn multi-turn scripts into conversation driver policies.

Key contents:

- fixed turn scripts;
- adaptive drift handling;
- how to continue if the model asks clarification;
- how to push original intention forward;
- how to collect visible trace when full trace is unavailable.

### `references/rubric-handoff.md`

Purpose:

- define draft rubric suggestions as grader handoff artifacts.

Key contents:

- dimension-level rubric structure;
- deterministic vs LLM vs human judge suggestions;
- uncertainty policy;
- red-line failures;
- mapping rubric items to cases.

Red-line failure definition:

- A red-line failure is a severe failure that can dominate or cap the score for a case even if other parts of the answer look good.
- It is not a normal minor deduction.
- Examples include fabricating verification, ignoring a critical safety or eligibility constraint, making an impossible guarantee, giving advice that predictably harms the user's decision, or violating a required pushback condition.
- Red-line failures should be domain-instantiated. The rubric file defines the rule and examples; the generator decides which red lines apply to the current task space.

### `references/self-critique.md`

Purpose:

- guide the evaluator/self-critique pass.

Key contents:

- critique checklist;
- severity levels;
- common failure patterns;
- required revision loop;
- critique trace format.

### `references/example-complete-runtime-eval-package.md`

Purpose:

- provide one compact, high-quality few-shot example of a complete generated runtime eval package.
- The current first example may use "restaurant recommendation: Xiaohongshu Diandian vs Doubao" because it is the project's worked example.

Important:

- This should be an example of structure and reasoning, not a permanent official restaurant eval set.
- It should include trace notes and critique findings, not just final cases.
- The skill is a generator of eval packages, not the restaurant recommendation eval itself.
- If future examples are added, keep them as diverse few-shot examples across task spaces rather than domain rules.

## Schemas

### `schemas/runtime-eval-package.schema.json`

Validates:

- `arenaEvalSpec`
- `evalSetCoveragePlan`
- `evalCases`
- `turnScripts`
- `rubricSuggestions`
- `reportSkeletonMetadata`
- `generationTrace`
- `selfCritiqueTrace`

This schema is the core bridge from skill output to product/harness consumption.

### `schemas/eval-generation-critique.schema.json`

Validates the self-critique trace:

- finding id;
- severity;
- component;
- issue;
- why it matters;
- recommended fix;
- whether fix was applied;
- remaining risk.

## Script

### `scripts/validate_eval_package.mjs`

Purpose:

- deterministically validate generated JSON against the schema;
- detect common structural problems that should not depend on LLM judgment.

First-version checks:

- six top-level components exist;
- required fields exist;
- case ids are unique;
- turn scripts reference existing case ids;
- multi-turn cases have turn scripts;
- dimension weights are bounded;
- rubric refs point to known dimensions;
- every case has `expectedOutcome`, `failureModesToProbe`, and `discriminativeSignal`;
- unresolved confirmations are surfaced.

This script should not decide whether the eval set is "good"; it should decide whether the package is structurally usable.

## Output Mode

Recommended default:

1. JSON-first runtime eval package.
2. Markdown summary for human review.
3. Self-critique trace.
4. Revision summary.
5. Trace artifact references.

Reasoning:

- JSON is needed by the workbench UI and validators.
- Markdown is needed by humans and portfolio review.
- Critique trace is needed to judge generation quality, not just final case quality.
- Trace artifacts are needed to debug, audit, and improve the generator over time.

## Interaction Policy

The primary interaction surface is the SBS workbench UI, not a long chat interview.

Expected product flow:

1. The frontend collects task-space and generation settings through form-like inputs.
2. The harness normalizes those fields and composes the generation request.
3. The skill generates a complete draft package when possible and records structured confirmation needs.
4. The frontend displays the draft package, missing information, low-confidence assumptions, and confirmation backlog to the user in one review step.
5. The user answers, edits, skips, or overrides the backlog.
6. The harness revises the eval package from that one review round before starting SBS collection/eval.

The skill may request clarification when:

- task-space boundary is unclear;
- target user or use case is materially ambiguous;
- the eval decision question is unclear;
- risk sensitivity changes case design;
- product-experience/persona scoring may materially affect total score;
- the user asks for an official or high-stakes eval set but provides too little context.

Clarification should not become a hard gateway by default. The default pattern is generate first, record questions, ask after the full draft is visible, revise once, then proceed.

The skill should usually proceed with explicit assumptions when:

- the user asks for a draft;
- ambiguity is not material to case generation;
- the skill can mark low-confidence assumptions in `arenaEvalSpec.knownUnknowns`;
- unresolved confirmations are visible in the output.

Recommended interaction style:

- In product mode, return at most 1-3 high-impact structured clarification questions for the UI to show.
- In debugging mode, ask at most 1-3 high-impact questions before generation if truly necessary.
- Prefer a draft with visible assumptions over blocking on every detail.
- Never silently invent important product context.
- Do not turn clarification into a strong gate for generation unless even a skeleton would be misleading. Use `blocksEvalRun` to mark items that should be resolved before starting the actual SBS eval.

## Skill Workflow

Workflow diagram:

- Feishu doc: https://bytedance.larkoffice.com/docx/KQArdTKvPoC4drx7zi8lmCpagQh

```text
1. Intake
   -> Identify task space, challenger, baseline, user goal, desired scale.

2. Arena Spec Gate
   -> Build arenaEvalSpec.
   -> If confidence is too low, ask user.

3. Coverage Plan
   -> Select dimensions, weights, case mix, risk mix, and optional modules.

4. Draft Generation
   -> Generate evalCases, turnScripts, rubricSuggestions, reportSkeletonMetadata.

5. Self-Critique
   -> Switch to evaluator mode.
   -> Identify structural and quality issues.

6. Revision
   -> Apply fixes once.
   -> Preserve critique trace and revision summary.

7. Output
   -> Provide JSON package plus concise human-readable summary.
   -> Save trace artifacts in debugging mode or product mode.
   -> Return artifact references so humans can inspect the generation path.
```

## Implementation Phases

### Phase A: Repo-Level Brief And Schemas

Create:

- this brief;
- repo-level schemas under `schemas/`;
- optional validator script for the app.

### Phase B: Local Skill Folder

Create:

- `~/.codex/skills/chatbot-eval-set-generator/SKILL.md`;
- references;
- schemas;
- validator script;
- `agents/openai.yaml`.

### Phase C: Regression Test

Run:

- task space: restaurant recommendation capability;
- challenger: Xiaohongshu Diandian;
- baseline: Doubao;
- target output: runtime eval package plus self-critique trace.

Save:

- raw draft;
- critique;
- revised package;
- comparison note vs the previous one-off Feishu document.

## Decisions To Confirm

1. Skill name: accepted as `chatbot-eval-set-generator`.
2. Output mode: accepted as JSON-first plus Markdown summary.
3. Interaction style: accepted with revision: UI form and harness request first; clarification is structured and optional, not a strong gateway.
4. Product-experience/persona module: accepted as a configurable UI choice; ask or surface when it materially affects scoring.
5. Validator script: accepted for first skill implementation unless later implementation constraints force deferral.

## Recommendation

Use this architecture for the first implementation.

For the first version, include the validator script inside the skill because it teaches the skill to treat structure as a real contract. The web app can later reuse or port the same checks.
