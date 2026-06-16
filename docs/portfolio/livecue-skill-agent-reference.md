# Portfolio Reference: LiveCue PGC Skill Agent

This is a reference to another completed portfolio project: a TikTok LIVE / LiveCue agent that extracts learnable livestream skills from an observation window.

It is **not** part of SBS 4 Any Agent, and its livestream domain, eval rubric, PGC categories, and skill-card taxonomy should not be treated as native context for this project.

## How To Use This Reference

Use it only as an optional reference for engineering patterns and portfolio storytelling, such as:

- structured agent input/output;
- provider abstraction;
- schema validation;
- raw output plus normalized artifact storage;
- fixtures and negative tests;
- handoff documentation style.

Do not use it to decide:

- SBS chatbot grader dimensions;
- SBS eval rubrics;
- SBS failure taxonomy;
- task-space selection;
- Doubao baseline evaluation rules.

## Source Materials

Primary handoff:

```text
/Users/bytedance/Downloads/HANDOFF-pgc-skill-agent.md
```

Full archive:

```text
/Users/bytedance/Downloads/pgc-gpt55-skill-agent-handoff-20260604.zip
```

Real run exports:

```text
/Users/bytedance/Downloads/livecue-skill-agent-runs/
```

## Useful Files If Referenced Later

If the archive is needed, unzip it to a temporary directory and inspect selectively:

- `README.md`: concise module overview.
- `docs/usage-guide.md`: provider usage and local demo style.
- `docs/task-card.md`: task contract and handoff format.
- `src/shared/schema.js`: schema validation and downstream output whitelist.
- `src/agent/skillAgent.js`: provider routing with shared validation.
- `src/agent/providers/*.js`: provider-specific parsing.
- `tests/gpt55-skill-agent.test.js`: negative tests and prompt rule tests.

Avoid reading or importing the PGC rubric/category JSON unless explicitly working on that completed LiveCue project.
