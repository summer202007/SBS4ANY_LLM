# Visual Recon

Purpose: identify visible evidence before choosing selectors.

## Questions

1. What did the user visibly ask in this turn?
2. Which UI region contains the assistant's answer for this turn?
3. Does one logical assistant answer span multiple bubbles/cards?
4. Are there visible non-answer evidence surfaces?
   - expanded search/query terms;
   - citation/source drawers;
   - related note cards;
   - inline quote snippets;
   - follow-up suggestion chips or assistant continuation questions;
   - risk notices or AI-generation caveats;
   - visible process/status text;
   - tool-call or execution traces.
5. Which visible text is nav/sidebar/history/input chrome and must be excluded?
6. Are any artifacts transient, meaning visible during generation but missing in final DOM?

## Field Inventory Rules

- `finalAnswer`: answer content for the current assistant turn only.
- `visibleProcessNotes`: externally visible process/status/tool-thinking surfaces only. Do not claim hidden reasoning.
- `intentExpansionQueries`: visible search/query/intent expansion text only. Do not infer from answer content.
- `referenceMaterials`: source evidence visible in UI. Preserve evidence type.
- `riskNotices`: visible warnings such as AI-generated caveats or verification cautions.
- `followupSuggestions`: product-suggested next actions, suggestion chips, or clear assistant continuation prompts.
- `toolcallNotes`: structured visible tool/execution trace only; otherwise write an explicit caveat.

## Output

Produce a compact table:

| Field | Visible? | Location | Required For This Adapter? | Notes |
| --- | --- | --- | --- | --- |

Mark `visibleProcessNotes` as best-effort when the only evidence is a human-provided transient screenshot.
