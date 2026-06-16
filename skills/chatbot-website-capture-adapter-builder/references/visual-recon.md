# Visual Recon

Purpose: identify visible evidence before choosing selectors.

## Questions

1. What did the user visibly ask in this turn?
   - Does that same prompt appear more than once, such as in the bottom composer, a sidebar/history title, a search box, or a copied prompt preview? If yes, mark which occurrence is the real conversation turn.
2. Which UI region contains the assistant's answer for this turn?
3. Does one logical assistant answer span multiple bubbles/cards?
4. Are there visible non-answer evidence surfaces?
   - expanded search/query terms;
   - citation/source drawers;
   - related note cards;
   - visible source/search-result side panels or cards;
   - inline quote snippets;
   - follow-up suggestion chips or assistant continuation questions;
   - risk notices or AI-generation caveats;
   - visible process/status text;
   - tool-call or execution traces.
5. Which visible text is nav/sidebar/history/input chrome and must be excluded?
   - Treat composer/input echoes of the current prompt as chrome, not as the current turn boundary.
6. Are any artifacts transient, meaning visible during generation but missing in final DOM?

## Field Inventory Rules

- `finalAnswer`: answer content for the current assistant turn only.
  The final answer must be text after the real conversation-turn user prompt. If the current prompt is repeated in the composer/input area, do not scope from that repeated prompt.
- `visibleProcessNotes`: externally visible process/status/tool-thinking surfaces only. Do not claim hidden reasoning.
- `intentExpansionQueries`: visible search/query/intent expansion text only. Do not infer from answer content.
- `referenceMaterials`: source evidence visible in UI. Preserve evidence type.
  Prefer visible source cards / source panels / search-result lists over a page-wide anchor dump. If source cards and inline citations both exist, preserve both as separate evidence types.
  If a visible read-only evidence control such as `参考 N 篇资料`, `引用`, `来源`, or `已阅读 N 个网页` must be opened to reveal those sources, one safe expansion click is allowed before snapshotting. This is only for the currently visible evidence drawer and must not submit prompts, switch threads, or navigate away.
- `riskNotices`: visible warnings such as AI-generated caveats or verification cautions.
- `followupSuggestions`: product-suggested next actions, suggestion chips, or clear assistant continuation prompts.
- `toolcallNotes`: structured visible tool/execution trace only; otherwise write an explicit caveat.

## Output

Produce a compact table:

| Field | Visible? | Location | Required For This Adapter? | Notes |
| --- | --- | --- | --- | --- |

Mark `visibleProcessNotes` as best-effort when the only evidence is a human-provided transient screenshot.
