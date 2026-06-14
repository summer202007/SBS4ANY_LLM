---
name: chatbot-website-capture-adapter-builder
description: Use only when invoked by the SBS workbench or local harness to create, calibrate, or QA a read-only capture adapter for a web chatbot page. This skill turns browser snapshots, screenshots, visible text, DOM summaries, and task-turn context into a provider-specific extraction plan, adapter contract, normalized SBS field mapping, and QA gate result. Do not use for final grading, eval-set generation, ordinary browsing, or auto-sending prompts into third-party products.
---

# Chatbot Website Capture Adapter Builder

Build or audit a capture adapter for a web chatbot page. The adapter's job is not to control the chatbot. It only reads user-visible evidence after the human has operated the product.

## Non-Negotiable Boundaries

- User-operated: never auto-send prompts or submit messages into third-party products.
- Read-only by default: inspect DOM, visible text, anchors, buttons, screenshots, and explicit visible evidence controls.
- No bypass: do not bypass verification, login, paywalls, hidden data, or anti-bot controls.
- Manual fallback: if a field cannot be verified, mark it unsupported or partial.
- QA-gated: an adapter is not ready until QA validates it against visible evidence and turn scope.

## Required Inputs

Use the smallest available packet that contains:

- provider name/id and current URL;
- current case id, turn index, current user message, and next user message if known;
- target side: `baseline` or `challenger`;
- target fields, usually `finalAnswer`, `visibleProcessNotes`, `intentExpansionQueries`, `referenceMaterials`, `riskNotices`, `followupSuggestions`, `sourceNotes`, `toolcallNotes`;
- screenshot or human-visible description when available;
- browser snapshot: raw visible text, DOM summary, anchors, buttons, candidate message containers;
- current adapter code only if the task is explicitly an update, not an isolation regression.

## Workflow

1. **Product contract check**
   - Confirm this is a user-operated read-only capture flow.
   - State what can be captured, what is best-effort, and what requires manual fallback.

2. **Visual evidence inventory**
   - Read `references/visual-recon.md` when screenshot or user-visible page facts are available.
   - List visible target artifacts and unsupported artifacts.
   - Separate final answer, source evidence, intent/search expansion, risk notices, follow-up suggestions, visible process/status, and nav/sidebar noise.

3. **Extraction plan**
   - Read `references/extraction-plan.md`.
   - Define turn scope first. For multi-turn pages, scope by current user message, next user message, and message-container boundaries.
   - Plan extraction for each target field.
   - Include provider-specific expansion actions only for visible evidence controls.

4. **Normalization mapper**
   - Map provider-native fields into SBS fields for the requested side.
   - Keep final output separate from sources, suggestions, nav text, and caveats.
   - Preserve evidence types such as `url_citation`, `inline_quote`, `related_note_card`, `search_result`, `source_drawer`, `tool_log`.
   - Never invent missing query expansion, tool calls, or process traces.

5. **QA gate**
   - Read `references/qa-gate.md`.
   - Produce a QA expectation object and run/prepare an engineering check when a capture JSON exists.
   - Block readiness for wrong-turn capture, missing screenshot-visible required fields, or final-answer pollution.
   - Partial support is allowed only when unsupported fields are explicit.

6. **Isolation regression mode**
   - Read `references/isolation-regression.md` when validating whether the skill works without conversational correction.
   - Do not read prior provider extractor code, prior implementation notes that reveal selectors, or final adapter implementation.
   - Use only allowed artifacts: screenshot/human-visible facts, browser snapshot, target field contract, and QA expectations.

## Output Contract

Return or save structured output with:

```json
{
  "providerId": "example_web",
  "mode": "plan|implementation|qa|isolation_regression",
  "fieldInventory": {},
  "extractionPlan": {},
  "normalizationMapper": {},
  "qaExpectations": {},
  "qaResult": {},
  "knownLimitations": [],
  "manualFallbackInstructions": [],
  "adapterReadiness": "ready|partial|blocked"
}
```

For implementation tasks, also list exact files changed and the adapter readiness status. For QA failures, do not quietly patch around them; report blocking issues and developer instructions.
