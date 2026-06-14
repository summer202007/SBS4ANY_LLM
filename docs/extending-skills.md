# Extending Skills

SBS is a skill-driven workbench. The UI and server orchestrate the workflow, while repo-local skills define the product reasoning contracts.

Each skill lives under `skills/<skill-name>/` and usually contains:

```text
SKILL.md
references/
schemas/
scripts/
agents/
```

## Current Skills

### `chatbot-eval-set-generator`

Purpose: generate a runtime eval package from product inputs.

Inputs:

- arena and task-space fields from the workbench;
- baseline and challenger metadata;
- case count target;
- collection constraints.

Outputs:

- runtime eval package JSON;
- human-readable summary;
- case index;
- validation results;
- self-critique trace.

Extend this skill when you want to improve eval case quality, add coverage patterns, change package schema expectations, or support a new chatbot task-space style.

### `chatbot-sbs-grader`

Purpose: clean collected evidence, judge each case, aggregate verdicts, and write PM-ready reports.

Inputs:

- approved runtime eval package;
- collected run state;
- curation state;
- provider and capture capability profiles;
- optional human review notes.

Outputs:

- `CleanedEvidencePackage`;
- `CaseJudgmentSet`;
- `GradingReport`;
- `GraderQualityAudit`;
- Markdown report sources.

Extend this skill when you need new grader dimensions, stricter evidence policy, different report style, or stronger validation.

### `chatbot-website-capture-adapter-builder`

Purpose: design or QA a read-only capture adapter for a web chatbot page.

Inputs:

- provider name and URL;
- target side and current turn context;
- visible text, DOM summary, anchors, buttons, and screenshots when available;
- target field contract.

Outputs:

- field inventory;
- extraction plan;
- SBS field mapper;
- QA expectations;
- readiness status.

Extend this skill when adding support for a new web chatbot or improving capture QA.

### `chatbot-runtime-user-simulator`

Purpose: suggest the next shared user message in side-blind multi-turn evals.

Inputs:

- turn execution state;
- prior side-blind outputs;
- branch rules;
- exposure contract;
- stop conditions.

Outputs:

- strict JSON simulator response;
- next user message or stop signal;
- newly exposed facts;
- trajectory notes.

Extend this skill when improving multi-turn trajectory control.

## Extension Principles

### Keep Skills Narrow

Each skill should own one workflow. Package generation should not grade outputs. Grading should not generate new cases. Capture adapters should not submit prompts into third-party products.

### Preserve Artifacts

Important outputs should be written as files, not only returned in chat text. A good skill invocation leaves inspectable artifacts and validation results.

### Validate Contracts

If a skill produces structured output, add or update validators under `scripts/`. Prefer lightweight deterministic checks that catch shape, required fields, enums, score ranges, and missing artifact refs.

### Separate Product Judgment From Evidence

The grader may infer product implications, but important claims should point back to collected or cleaned evidence. Missing evidence should create caveats, not hallucinated certainty.

### Make Human Review Explicit

Generated packages and grader outputs should expose uncertainty and confirmation needs. Do not silently resolve product choices that require a human.

## Adding A New Task-Space Pattern

1. Add or update reference material in `skills/chatbot-eval-set-generator/references/`.
2. Define coverage expectations and risk boundaries.
3. Generate a sample package.
4. Validate the package.
5. Add an example under `examples/<task-space>/`.
6. Document what the example proves.

## Adding A New Grader Dimension

1. Update `skills/chatbot-sbs-grader/references/dimension-framework.md`.
2. Update aggregation and report expectations if the dimension affects final verdicts.
3. Update schemas or validators if new fields are required.
4. Run the grader against a sample task.
5. Check that report caveats still separate evidence from product judgment.

## Adding A New Capture Adapter

1. Start from the read-only adapter contract.
2. Capture visible text and DOM summaries from the user-operated page.
3. Map provider-native visible evidence into SBS fields.
4. Run a QA gate against known-good visible evidence.
5. Mark unsupported fields explicitly.

See [capture-adapters.md](capture-adapters.md).
