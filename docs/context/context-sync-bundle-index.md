# Context Sync Bundle Index

The full imported bundle lives locally at:

```text
context-sync-bundle/
```

It is intentionally ignored by git because it contains private work and resume context.

Use this index to retrieve only what is needed. Do not load the full bundle at once.

## Startup Files

Read these when recovering the overall cross-project context:

- `context-sync-bundle/START_HERE.md`
- `context-sync-bundle/CONTEXT_HANDOFF.md`
- `context-sync-bundle/NEW_PROJECT_IMPORT_GUIDE.md`

Current distilled project memory:

- `docs/context/agent-pm-transition-context.md`

## SBS Eval Harness

Read when working on this project deeply:

- `context-sync-bundle/sbs-eval-harness-session-brief.md`

Use for:

- PRD;
- MVP scope;
- eval case schema;
- SBS report;
- architecture;
- README/demo/resume packaging.

Note: this bundle brief predates some decisions made in this repo. If it conflicts with `PROJECT_BRIEF.md` or `docs/context/agent-pm-transition-context.md`, the repo-local files win.

## Chatbot Design And Evaluation

Entry points:

- `context-sync-bundle/chatbot-reading-vault/state/articles-index.md`
- `context-sync-bundle/agent-pm-chatbot-design-eval-skill/SKILL.md`
- `context-sync-bundle/notes/chatbot/`

Use for:

- chatbot metrics;
- multi-turn eval;
- semantic intent / outcome / trajectory;
- conversation regression testing;
- trust, safety, wellbeing;
- handoff and customer-service outcome framing.

Recommended retrieval query:

```bash
rg -n "multi-turn|semantic intent|semantic outcome|trajectory|conversation regression|ground truth|gold label|outcome|handoff" context-sync-bundle
```

## Anthropic / Claude Agent Learning Vault

Entry points:

- `context-sync-bundle/anthropic-reading-vault/state/articles-index.md`
- `context-sync-bundle/anthropic-reading-vault/state/concepts-index.md`
- `context-sync-bundle/anthropic-reading-vault/state/recovery-summary.md`
- `context-sync-bundle/ANTHROPIC_READING_PROTOCOL.md`
- `context-sync-bundle/notes/anthropic/`

Use for:

- workflow vs agent;
- tools / MCP / skills;
- context engineering;
- evals and eval suites;
- harness design;
- managed agents;
- sandboxing and auto mode;
- multi-agent systems.

Recommended retrieval query:

```bash
rg -n "eval suite|grader|rubric|transcript|trajectory|pass@|pass\\^|harness|sandbox|skill|tool|MCP|context" context-sync-bundle
```

## Skill / AI Product Teardown

Entry points:

- `context-sync-bundle/agent-skill-teardown-takeaways.md`
- `context-sync-bundle/skills/maintain-skill-teardown-notes/SKILL.md`
- `context-sync-bundle/teardown-artifacts/github-skill-teardown-20.xml`
- `context-sync-bundle/teardown-artifacts/superpowers-project-teardown.xml`

Use for:

- skill/product architecture patterns;
- gateway eval;
- eval-as-code;
- black-box vs white-box SBS;
- PM-facing SBS design principles.

## Resume And Work Context

Files:

- `context-sync-bundle/Du Bowei Resume - 2026.pdf`
- `context-sync-bundle/compact_resume.html`
- `context-sync-bundle/compact_resume.pdf`
- `context-sync-bundle/feishu-digest/context/me.skill.md`
- `context-sync-bundle/feishu-digest/context/editable-docs.md`

Use only for private portfolio/resume alignment. Do not publish or quote externally without explicit user approval.

## Separate Portfolio Project Reference

The completed LiveCue PGC Skill Agent project remains separate from SBS 4 Any Agent. See:

- `docs/portfolio/livecue-skill-agent-reference.md`

Use only for engineering/storytelling comparison, not for SBS eval rubric design.
