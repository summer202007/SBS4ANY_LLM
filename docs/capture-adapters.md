# Capture Adapters

Capture adapters help SBS collect visible evidence from web chatbot products.

They are intentionally conservative. Their job is to read what the user can see after the user operates the product.

## Non-Negotiable Boundary

Adapters must not:

- auto-send prompts;
- submit forms;
- bypass login, verification, paywalls, or anti-bot controls;
- read hidden data;
- infer private tool traces from UI fragments;
- treat navigation or sidebar text as model output;
- invent missing fields.

Manual paste is always the fallback.

## User-Operated Flow

The expected flow is:

1. SBS shows the eval case prompt.
2. The user copies it into the baseline and challenger products.
3. The user sends the prompt manually.
4. The user opens the relevant browser tab.
5. SBS reads visible evidence from the current page.
6. The user reviews the captured fields before accepting them.

This keeps SBS on the evaluation side of the boundary rather than becoming a third-party automation bot.

## Normalized SBS Fields

Adapters should map provider-specific UI elements into normalized fields:

- `finalAnswer`;
- `visibleProcessNotes`;
- `intentExpansionQueries`;
- `referenceMaterials`;
- `riskNotices`;
- `followupSuggestions`;
- `sourceNotes`;
- `toolcallNotes`;
- `rawVisibleText`;
- `scopedVisibleText`;
- `captureNotes`;
- `evidenceLevel`.

Unsupported fields should remain empty or explicitly marked partial.

## Turn Scope

Multi-turn pages are noisy. The adapter should scope capture by:

- current case id;
- turn index;
- current user message;
- next user message when available;
- message container boundaries when discoverable.

Wrong-turn capture is a blocking QA issue.

## QA Gate

An adapter is not ready because it returns JSON. It is ready only when QA confirms:

- the final answer is isolated from navigation and suggestions;
- required visible fields are present when visible on the page;
- unsupported fields are marked as unsupported or partial;
- evidence belongs to the current turn;
- source cards, search queries, and follow-up suggestions are separated from final answer;
- raw visible text is preserved for audit.

Readiness states:

- `ready`: usable for the target provider and target fields.
- `partial`: usable with explicit limitations and manual fallback.
- `blocked`: not safe or reliable enough for product use.

## Built-In Direction

The current built-in capture path focuses on Doubao Web as a baseline-side provider. Challenger-side capture is designed to use adapter templates so supported products can be added without rewriting the SBS workflow.

## Adding A Provider

1. Collect a browser snapshot and screenshot from a user-operated conversation.
2. Identify visible artifacts and unsupported artifacts.
3. Define turn scope.
4. Map provider fields into SBS normalized fields.
5. Run or prepare QA expectations.
6. Add the provider to the adapter registry only after readiness is clear.
