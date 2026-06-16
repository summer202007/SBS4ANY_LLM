# Extraction Plan

Purpose: convert visual evidence into an implementable read-only adapter plan.

## Plan Order

1. **Detect provider**
   - URL host/title/body markers.
   - Do not rely on one brittle class if text/structure can confirm.
   - Distinguish `provider detection` from `capture readiness`. A page can be recognized even when the first snapshot still lacks usable turn boundaries.

2. **Define turn scope**
   - Prefer message containers over whole-page text.
   - For single-turn: latest user message to end of assistant messages.
   - For multi-turn: current user message to next user message, or explicit message index boundaries.
   - If one assistant answer is split into multiple bubbles, group contiguous assistant bubbles within the same turn.
   - If message containers are missing or viewport-biased, fall back to current-user-message match plus visible line ranges, but lower confidence and request recon retry hints.
   - Enumerate all occurrences of the current user message in raw visible text. Do not choose the last occurrence by default: many UIs repeat the prompt in the bottom composer, input draft, search box, or sidebar/history.
   - Select the user-message occurrence that is followed by substantial assistant answer text. If the same prompt appears again later with no answer after it, treat that later occurrence as composer/input chrome and use it as an end boundary, not the start boundary.
   - When DOM containers and raw visible text disagree, prefer the source that correctly scopes the current turn. Container lists can be viewport-biased or stale; raw visible text can be polluted by chrome. Record the tradeoff in `turnBoundaryPlan`.

3. **Extract final answer**
   - Include answer bubbles/cards.
   - Exclude nav/sidebar/history/input chrome.
   - Exclude source-only cards, citation drawers, query blocks, suggestion chips, and risk notices unless the product renders them as part of the assistant answer and the mapper explicitly duplicates them.
   - If raw current-turn scoping produces a substantial answer and message containers are incomplete or from a previous turn, use the scoped raw text as the primary answer source and DOM containers only as fallback.
   - Never let a stale visible markdown/container block override a correctly scoped raw current-turn answer.

4. **Extract evidence surfaces**
   - Query/intent expansion: visible query terms only.
   - References: anchors, source drawers, related cards, inline quote snippets, search result lists.
   - When visible source/search-result cards already exist in the UI, extract those first as structured `referenceMaterials` instead of falling back to a page-wide anchor sweep.
   - Treat inline citation markers separately from source cards. Preserve cite index/label and href mapping when visible.
   - Treat `已阅读 N 个网页`-style badges as source summary or visible process/status, not as full reference evidence.
   - Follow-up suggestions: suggestion chips or assistant continuation prompts.
   - Risk notices: AI-generated/verification warnings.
   - Tool calls: structured visible execution/tool logs only.

5. **Expansion actions**
   - Only expand visible evidence controls.
   - Prefer idempotent checks: confirm collapsed/expanded state before clicking.
   - If citations or source cards are already visible, do not click.
   - Only use one synthetic, idempotent expansion click when the UI clearly exposes a collapsed source/citation panel and the click does not change conversation state.
   - Restrict expansion clicks to interactive controls (`button`, `a`, or `[role=button]`) with source/citation/reference text or class/attribute hints. Do not click ordinary answer words just because they look like cited concepts.
   - Synthetic clicks are provider-specific; if unstable, mark field partial and preserve manual fallback.

6. **Confidence and fallback**
   - Mark each field `high`, `medium`, `low`, or `unsupported`.
   - Low confidence fields cannot be used to claim adapter readiness unless QA accepts partial support.

## Snapshot Recon Contract

When the first snapshot is not strong enough, specify what the snapshot layer should collect next:

- `snapshotRequirements`: required evidence surfaces such as candidate message containers, markdown answer blocks, suggestion chips, visible warnings, or citation drawers.
- `selectorHints`: grounded selectors or attribute/class patterns for user messages, assistant messages, shared message containers, references, chips, warnings, and process/status areas.
- `turnBoundaryPlan`: exact rules for isolating the current turn.
- Include a duplicate-prompt policy in `turnBoundaryPlan` when the current prompt may appear in the composer/sidebar/history. State how to choose the real conversation occurrence and how to exclude composer/input echoes.
- `providerUiPatterns`: stable visible product patterns that help QA and future captures.
- `reconRetryAdvice`: when to rerun snapshot with refined hints instead of blocking immediately. Request duplicate prompt occurrence metadata, composer/input selectors, or scroll/viewport notes when these would materially improve turn scoping.

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
