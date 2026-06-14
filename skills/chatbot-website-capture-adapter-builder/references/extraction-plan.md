# Extraction Plan

Purpose: convert visual evidence into an implementable read-only adapter plan.

## Plan Order

1. **Detect provider**
   - URL host/title/body markers.
   - Do not rely on one brittle class if text/structure can confirm.

2. **Define turn scope**
   - Prefer message containers over whole-page text.
   - For single-turn: latest user message to end of assistant messages.
   - For multi-turn: current user message to next user message, or explicit message index boundaries.
   - If one assistant answer is split into multiple bubbles, group contiguous assistant bubbles within the same turn.

3. **Extract final answer**
   - Include answer bubbles/cards.
   - Exclude nav/sidebar/history/input chrome.
   - Exclude source-only cards, citation drawers, query blocks, suggestion chips, and risk notices unless the product renders them as part of the assistant answer and the mapper explicitly duplicates them.

4. **Extract evidence surfaces**
   - Query/intent expansion: visible query terms only.
   - References: anchors, source drawers, related cards, inline quote snippets, search result lists.
   - Follow-up suggestions: suggestion chips or assistant continuation prompts.
   - Risk notices: AI-generated/verification warnings.
   - Tool calls: structured visible execution/tool logs only.

5. **Expansion actions**
   - Only expand visible evidence controls.
   - Prefer idempotent checks: confirm collapsed/expanded state before clicking.
   - Synthetic clicks are provider-specific; if unstable, mark field partial and preserve manual fallback.

6. **Confidence and fallback**
   - Mark each field `high`, `medium`, `low`, or `unsupported`.
   - Low confidence fields cannot be used to claim adapter readiness unless QA accepts partial support.

## Normalization Mapper

Map provider fields to SBS side-prefixed fields:

- `finalAnswer` -> `{side}Output`
- `evidenceLevel` -> `{side}EvidenceLevel`
- `visibleProcessNotes` + risk/capture caveats when no dedicated field exists -> `{side}VisibleProcessNotes`
- `intentExpansionQueries` -> `{side}IntentExpansionNotes`
- `followupSuggestions` -> `{side}FollowupSuggestionNotes`
- `referenceMaterials` + `sourceNotes` -> `{side}SourceNotes`
- `toolcallNotes` -> `{side}ToolcallNotes`

Keep raw artifacts for QA/debug; do not put raw page text in primary UI fields.
