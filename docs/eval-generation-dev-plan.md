# Eval Generation Development Plan

## Goal

Build an automated eval-generation mechanism that turns a task-space request into a structured runtime eval package.

The generator should produce more than case prompts. It must produce the six-piece package defined in `docs/eval-set-generator-sprint.md`:

1. `arenaEvalSpec`
2. `evalSetCoveragePlan`
3. `evalCases`
4. `turnScripts`
5. `rubricSuggestions`
6. `reportSkeletonMetadata`

It should also preserve generation trace and self-critique trace so the user can inspect how the eval set was created and improved.

The first version should support:

- Local Codex provider;
- GPT API provider if feasible;
- schema validation;
- meta-eval checks;
- human edit / approve / reject.

## Architecture

```text
User task-space request
  -> generation prompt builder
  -> provider: Local Codex / GPT API
  -> raw provider output
  -> parser
  -> runtime eval package schema validator
  -> self-critique / meta-eval validator
  -> draft package UI
  -> human approval
  -> approved eval set
```

## Development Tasks

### 1. Create Runtime Eval Package Schema

Create a schema that validates the whole generated package, not only individual cases.

Top-level objects:

- `arenaEvalSpec`
- `evalSetCoveragePlan`
- `evalCases`
- `turnScripts`
- `rubricSuggestions`
- `reportSkeletonMetadata`
- `generationTrace`
- `selfCritiqueTrace`

Keep compatibility with the existing case schema where possible, but treat the old case-only schema as a lower-level object.

Arena spec should include:

- task space;
- decision question;
- target users;
- baseline and challenger;
- success and failure definitions;
- assumptions and known unknowns;
- risk boundaries;
- required user confirmations.

Case objects should still include user goal, conversation seed, expected outcome, must-do, must-not-do, failure modes, risk level, grader refs, and replay mode.

### 2. Create Generation Prompt Builder

Inputs:

- task space;
- target user;
- baseline, default Doubao;
- challenger type;
- case count;
- case mix;
- whether to include project context;
- optional seed examples.
- optional product-experience/persona module preference.

Prompt requirements:

- generate a complete six-piece runtime eval package;
- ask the user when Arena Spec confidence is too low;
- explicitly mark assumptions and unknowns;
- include both single-turn and multi-turn cases when useful;
- include expected outcome, must-do, must-not-do, failure modes, risk level, and grader plan;
- include turn-script drift handling for multi-turn cases;
- include draft rubric suggestions as grader handoff artifacts;
- include report skeleton metadata;
- include self-critique findings and revision notes;
- output only JSON matching schema;
- mark all cases `draft`;
- avoid generic chatbot tasks;
- reject weak ideas rather than forcing every slot.

Dimension defaults:

- intent understanding;
- outcome quality;
- trajectory control;
- evidence / grounding;
- risk handling;
- product experience.

The generator must not blindly force all dimensions into every eval. It should explain enabled/disabled dimensions and ask the user when product-experience/persona evaluation materially changes scoring.

### 3. Implement Local Codex Provider

Use:

```bash
codex exec --ephemeral --output-schema schemas/eval-case.schema.json
```

Responsibilities:

- construct prompt;
- optionally include whitelisted project context;
- run Codex;
- capture raw output;
- parse normalized output;
- surface errors clearly.

### 4. Implement GPT API Provider

Use the same prompt and schema.

Requirements:

- API key stays local;
- no committed secrets;
- same validator path as Local Codex.

### 5. Build Parser And Validator

Support:

- plain JSON;
- fenced JSON, if provider returns it;
- schema validation;
- user-readable parse errors.

Invalid output must not enter approved eval sets.

Validation should distinguish:

- schema errors, which block import;
- quality warnings, which require human review;
- unresolved user confirmations, which should be visible in the UI.

### 6. Build Meta-Eval / Self-Critique Checks

First version can be deterministic + LLM-assisted later.

Deterministic checks:

- required fields present;
- all six top-level components present;
- turn indexes valid;
- multi-turn cases have multiple turns;
- weight suggestions are normalized or bounded;
- grader plan references known dimensions;
- case has at least one failure mode;
- task space is non-empty and reflected in scenario.
- unresolved required user confirmations are surfaced.
- every case has a discriminative signal.
- every multi-turn script has drift-handling instructions.

LLM/self-critique checks:

- Arena Spec completeness;
- representativeness;
- specificity;
- fairness;
- anti-gaming;
- coverage diversity;
- rubric clarity.
- case-rubric alignment;
- whether the package can support collection, grading, and report generation.

The self-critique trace should preserve findings with severity, component, issue, recommended fix, whether the fix was applied, and remaining risk.

### 7. Build Draft Package UI

At package level:

- show Arena Spec confidence and unresolved confirmations;
- show coverage plan, dimensions, weights, and case mix;
- show optional experience/persona module status;
- show self-critique findings and applied fixes.

For each generated case:

- show title, scenario, user goal;
- show case type and replay mode;
- show turns with progress;
- show expected outcome;
- show must-do / must-not-do;
- show failure modes;
- show grader plan;
- edit fields;
- approve / reject.

For each turn script:

- show `Case X / Turn Y of Z`;
- show progress label;
- show intention-to-push;
- show drift handling guidance.

### 8. Build Seed / Example Set Support

Seed examples are few-shot anchors for generation quality.

Tasks:

- create a small seed set;
- include examples in prompt when requested;
- keep seed examples separate from official eval sets.

### 9. Save Generation Artifacts

Persist:

- provider;
- prompt;
- raw output;
- normalized package;
- validation errors;
- meta-eval warnings;
- self-critique trace;
- revision summary;
- timestamp.

This makes generator behavior auditable.

### 10. Connect To Runtime Eval

Approved cases should feed the collection workflow.

Requirements:

- only approved cases are runnable;
- scripted turns display progress;
- run artifacts preserve case metadata and grader plan.
- report generation can consume report skeleton metadata.
- grader construction can consume rubric suggestions.

## MVP Cut Line

Must have:

- Local Codex generation;
- schema validation;
- draft UI;
- approve/reject;
- manual collection compatibility.
- six-piece runtime eval package output.
- generation trace and self-critique trace.

Should have:

- meta-eval deterministic warnings;
- seed examples;
- raw output preservation.
- restaurant recommendation regression artifact.

Can defer:

- adaptive multi-turn simulator;
- LLM meta-eval;
- GPT API provider;
- official task-space library;
- automatic graders.

## Test Plan

Tests should cover:

- prompt builder includes task-space and six-piece required output fields;
- Local Codex provider command is constructed correctly;
- parser handles valid JSON and fenced JSON;
- invalid output fails schema validation;
- multi-turn turn indexes are consistent;
- approved set excludes rejected cases;
- generation artifacts preserve raw output and validation warnings.
- missing Arena Spec fields create user-confirmation warnings.
- case set duplicate/shallow-variant checks produce warnings.
- multi-turn scripts without drift handling produce warnings.
