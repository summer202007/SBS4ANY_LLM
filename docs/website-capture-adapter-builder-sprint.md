# Website Capture Adapter Builder Sprint

Created: 2026-06-11

## Purpose

Turn the Doubao-assisted capture lessons into a reusable mechanism for adapting new web chatbot products.

The single-turn spike is not being run merely to make one single-turn dots.ai capture work. It is a controlled rehearsal for the future automated `chatbot-website-capture-adapter-builder` skill: every step should reveal what must become reusable instructions, artifacts, QA gates, and developer loops.

The goal is not to promise universal one-click scraping. The goal is to create a local, user-operated, QA-gated workflow that can build a capture adapter for a new website with bounded effort.

If successful, the SBS workbench can move from:

> supported provider: Doubao Web

to:

> supported provider: any web chatbot that exposes enough visible UI evidence and passes calibration.

## Product Thesis

The valuable unit is not a selector. The valuable unit is a verified extraction contract:

- what the user can visibly see;
- which visible artifacts matter for SBS evaluation;
- how those artifacts map to normalized capture fields;
- how reliably the local helper can extract them;
- when the helper should warn, fail, or fall back to manual paste.

## Non-Negotiable Boundaries

1. User-operated only.
   - The app must not auto-send prompts into third-party products.
   - The app reads only the page the user intentionally opened.

2. Read-only by default.
   - The adapter may inspect DOM, visible text, anchors, and screenshots.
   - It may perform limited UI expansion only for visible evidence controls, such as citation drawers or reference blocks.
   - It must not bypass verification, login, paywalls, or hidden data protections.

3. Manual fallback remains mandatory.
   - If extraction fails, users can paste final output and notes manually.
   - The UI should not claim a field was captured if QA cannot verify it.

4. QA gate is strong.
   - A new adapter is not considered usable until a QA pass validates fields against screenshot-visible evidence.
   - Partial adapters are allowed but must label unsupported fields clearly.

## Evidence Fields

The generic adapter builder should target the same normalized capture fields already used by Doubao:

- `finalAnswer`
- `visibleProcessNotes`
- `intentExpansionQueries`
- `referenceMaterials`
- `riskNotices`
- `followupSuggestions`
- `sourceNotes`
- `toolcallNotes`
- `rawVisibleText`
- `scopedVisibleText`
- `url`
- `title`
- `evidenceLevel`
- `captureNotes`

Future optional fields:

- screenshot artifact ref;
- per-message DOM container refs;
- provider-specific raw artifact refs;
- extraction confidence per field.

## Core Lessons From Doubao

1. Start from visible evidence, not selectors.
   - First identify what the user can see and what matters to eval.
   - Then implement selectors/parsers as one possible extraction method.

2. Turn scoping is the hardest part.
   - Multi-turn pages require current user message, next user message, or message-container boundaries.
   - Search/reference/follow-up artifacts must be attached to the correct turn.

3. Visual and DOM truth can diverge.
   - Text may be in DOM but visually collapsed.
   - Screenshot may show chips that are not normal buttons.
   - References may be anchors, cards, drawers, or text-only lists.

4. Click expansion is brittle.
   - Some React components require pointer/mouse sequences.
   - Some clicks toggle state twice if not carefully controlled.
   - Expansion should be treated as an adapter-specific strategy, not a generic guarantee.

5. QA must compare extracted JSON with visible page evidence.
   - Missing query/citation/suggestion fields should fail the adapter QA when the screenshot shows them.
   - Wrong-turn extraction should fail hard.

## First Spike Notes: dots.ai

The first non-Doubao spike target is `dots.ai`.

Two dots.ai-specific observations must shape the adapter-builder workflow:

1. Transient visible thinking can disappear after completion.
   - During generation, dots.ai may expose a short process/status trace such as "再查查候选餐厅详情...".
   - After the answer completes, this trace may be hidden and unavailable in the final DOM or screenshot.
   - This is an advanced evidence target. Future automation should consider capture-during-generation, polling, or screen sampling, but failure to capture transient thinking must not block collection of final output.

2. One assistant turn may be split across many chat bubbles.
   - dots.ai uses a dialogue-style presentation where a single assistant response can be rendered as multiple consecutive bubbles.
   - For SBS collection, all assistant bubbles between two user messages belong to the same eval turn.
   - The adapter-builder must group contiguous assistant messages by user-turn boundary, not by individual bubble.

## Proposed Skill

Name:

`chatbot-website-capture-adapter-builder`

Trigger:

Use only when invoked by the SBS workbench or local harness to create, calibrate, or QA a capture adapter for a web chatbot page. Do not use for final grading, eval set generation, ordinary browsing, or manual transcript analysis.

### Skill Inputs

The skill should receive a structured adapter-building packet:

```json
{
  "providerName": "Example Chatbot",
  "providerId": "example_chatbot_web",
  "url": "https://example.com/chat/...",
  "targetFields": [
    "finalAnswer",
    "intentExpansionQueries",
    "referenceMaterials",
    "followupSuggestions",
    "riskNotices"
  ],
  "caseContext": {
    "caseId": "rest-mt-002",
    "turnIndex": 2,
    "currentUserMessage": "区域优先朝阳/三里屯附近，如果不好选，国贸也可以。",
    "nextUserMessage": ""
  },
  "visualInputs": {
    "screenshotArtifactRef": "artifacts/capture-calibration/example.png",
    "visibleText": "optional OCR or browser visible text"
  },
  "domInputs": {
    "rawVisibleText": "document.body.innerText",
    "domSummary": [],
    "anchorSummary": [],
    "buttonSummary": []
  },
  "existingAdapterCode": "optional path or code",
  "constraints": {
    "readOnly": true,
    "noAutoSend": true,
    "manualFallbackRequired": true
  }
}
```

### Skill Outputs

The skill should produce:

```json
{
  "providerId": "example_chatbot_web",
  "fieldInventory": {
    "finalAnswer": {
      "visible": true,
      "visualLocation": "main assistant answer block",
      "recommendedExtraction": "messageContainer.innerText minus known artifact sections",
      "confidence": "high"
    }
  },
  "extractionPlan": {
    "turnScopeStrategy": "current_user_message_to_next_user_message",
    "selectors": [],
    "textParsers": [],
    "expansionActions": [],
    "fallbacks": []
  },
  "adapterPatchPlan": [],
  "qaChecklist": [],
  "knownLimitations": [],
  "manualFallbackInstructions": []
}
```

When used in implementation mode, the skill can also produce or update:

- a provider adapter module;
- a provider-specific probe script;
- provider QA fixtures;
- capture notes shown to the user.

## Workflow

### Phase 0: Product Contract

Status: pending

Define the user-facing product promise:

- button text;
- expected time;
- failure probability;
- what permissions are needed;
- what manual fallback looks like;
- what counts as "adapter ready".

Candidate UI copy:

> Create Capture Adapter for This Website

Helper copy:

> Experimental. The app will inspect the current page and try to build a read-only capture adapter. It will not send prompts. Some sites may require manual capture.

Acceptance:

- The product does not overpromise universal automation.
- User understands this is a calibration workflow.

### Phase 1: Generic Capture Artifact Contract

Status: pending

Create a reusable artifact format for adapter building:

- screenshot ref;
- raw visible text;
- scoped visible text;
- DOM node summary;
- anchors;
- buttons / role buttons;
- candidate message containers;
- candidate evidence blocks;
- page metadata;
- current / next user message;
- target fields.

Acceptance:

- The artifact is provider-neutral.
- It can be saved beside run artifacts.
- It is small enough for Local Codex to inspect without dumping the whole DOM.

### Phase 2: Visual Recon Prompt / Skill Reference

Status: pending

Write the skill reference that asks Local Codex to inspect screenshot-visible evidence:

- Which artifacts are visibly present?
- Which fields should be extracted?
- Which are not visible and should not be claimed?
- What visual anchors separate final answer from citation/query/suggestion blocks?
- What turn does each artifact appear to belong to?

Acceptance:

- The model outputs a structured field inventory.
- The inventory distinguishes visible evidence from inferred evidence.

### Phase 3: Extraction Plan Generator

Status: pending

Generate an extraction plan from visual recon + DOM summary:

- turn scope strategy;
- final answer isolation strategy;
- citation/reference strategy;
- intent/search query strategy;
- follow-up suggestion strategy;
- risk notice strategy;
- expansion strategy;
- fallback strategy.

Acceptance:

- The plan is implementable by a developer agent.
- The plan includes exact QA expectations.
- The plan warns when a field is visually present but DOM extraction may be unstable.

### Phase 4: Adapter Developer Loop

Status: pending

Implement a generic adapter interface and one generated adapter prototype.

Suggested interface:

```ts
type ChatbotCaptureAdapter = {
  providerId: string;
  detect(page: PageSnapshot): ProviderDetectionResult;
  expandVisibleEvidence(page: BrowserPageHandle, scope: TurnScope): Promise<ExpansionResult>;
  capture(page: PageSnapshot, scope: TurnScope): CaptureResult;
  qa?(capture: CaptureResult, artifact: CalibrationArtifact): QaResult;
};
```

MVP can keep this in plain Node/AppleScript rather than adding Playwright.

Acceptance:

- Doubao can be wrapped as the first provider adapter.
- A second provider can be added without rewriting the capture API.

### Phase 5: QA Gate

Status: pending

Build QA around three questions:

1. Did the adapter extract every screenshot-visible target field?
2. Did it attach artifacts to the right turn?
3. Did it avoid polluting final answer with citations, suggestions, nav text, or other UI?

QA outputs:

```json
{
  "ok": false,
  "fieldResults": {
    "finalAnswer": "pass",
    "intentExpansionQueries": "fail_missing_visible_field",
    "referenceMaterials": "pass",
    "followupSuggestions": "fail_wrong_turn"
  },
  "blockingIssues": [],
  "developerInstructions": []
}
```

Acceptance:

- QA can block adapter readiness.
- QA can approve partial support with explicit unsupported fields.
- The UI can show QA status to the user.

### Phase 6: SBS UI Integration

Status: in progress

Add a provider setup flow:

- user selects challenger surface as web chat;
- user opens the product in Chrome;
- user clicks `Create Capture Adapter`;
- app captures calibration artifact;
- Local Codex runs adapter builder skill;
- app shows supported fields and confidence;
- user accepts adapter or falls back to manual.

Acceptance:

- The flow does not interrupt existing manual collection.
- Adapter status is visible on the Collect page.

Current implementation slice:

- Challenger side in Collect now has an experimental website capture button.
- The flow reads the current Chrome tab, creates a calibration snapshot, detects a supported provider, runs capture, and shows QA status before the user accepts the result into Challenger fields.
- First successful capture is still human-reviewed; accepting a ready capture records the provider in the local adapter registry.
- Unknown providers are blocked with a saved snapshot and manual fallback instead of pretending to work.
- Challenger side also has `Test First-Time Setup`, which simulates the first-time review flow without persisting a template. This helps validate the user experience when an already-supported provider would otherwise skip the "new website" feeling.

UX reset:

- Do not show adapter/setup details by default.
- Challenger starts with a single `Try Automated Capture` opt-in.
- Opt-in asks for the challenger chat URL and checks the local adapter registry.
- Existing template: show only the normal capture action.
- Missing template: show first-time setup guidance and a setup action.
- QA/debug details should appear only inside the first-time setup/capture result preview, not as always-visible chrome.

Current implementation boundary:

- First-time setup can call local Codex and produce a structured adapter-template draft with QA/readiness metadata.
- That draft is useful for human review and local template registration, but it is not automatically executable for arbitrary websites yet.
- A website should only show the simple capture action when it matches a concrete ready adapter implementation or a future safe generic adapter runner.
- Until then, manual paste remains the fallback for unknown websites after setup preview.

Future registry direction:

- Built-in templates such as Doubao Web and dots.ai Web should be shown as reusable capture templates.
- User-generated templates should be saved locally and reusable across runs.
- Later, templates can be shared/exported so other users do not need to regenerate scripts for already-supported products.

### Phase 7: First Non-Doubao Trial

Status: pending

Pick one web chatbot other than Doubao and run the full adapter-building loop.

Trial criteria:

- single-turn capture first;
- one page with visible final answer;
- if available, visible citations or suggestions;
- no login-sensitive hidden data;
- manual fallback ready.

Candidate targets:

- a challenger web chatbot the user wants to evaluate;
- a public chatbot demo page;
- a search-answer product with visible citations.

Acceptance:

- Capture either passes QA or produces a useful failure report.
- Failure report tells us whether the blocker is visual, DOM, permission, turn scoping, or provider-specific behavior.

## Engineering Tasks

### Task A: Capture Artifact Snapshot

Status: pending

Create `server/captureSnapshot.mjs` or equivalent.

It should produce:

- URL/title;
- screenshot ref if desktop shell can provide it;
- raw visible text;
- DOM summary;
- anchor summary;
- button summary;
- candidate message containers;
- candidate evidence blocks;
- target turn scope packet.

### Task B: Provider Adapter Interface

Status: pending

Create a provider-neutral adapter shape.

Initial adapters:

- `doubao_web` existing logic migrated behind the interface;
- `generic_web_chatbot` placeholder.

### Task C: Adapter Builder Skill

Status: in progress

Create local skill:

`skills/chatbot-website-capture-adapter-builder/`

Files:

- `SKILL.md`
- `references/visual-recon.md`
- `references/extraction-plan.md`
- `references/qa-gate.md`
- `schemas/adapter-builder-output.schema.json`
- `schemas/adapter-qa-result.schema.json`

Install copy into:

`/Users/bytedance/.codex/skills/chatbot-website-capture-adapter-builder/`

Current state:

- Skill folder and references have been created in the repo.
- The skill defines visual recon, extraction planning, normalization mapping, QA gate, and isolation-regression mode.
- Isolation-regression mode explicitly forbids reading existing provider extractor code or previous implementation diffs.

### Task D: QA Probe Scripts

Status: in progress

Generalize current Doubao probes:

- `scripts/probe-doubao-dom.mjs`
- `scripts/test-doubao-search-click.mjs`

Into:

- `scripts/capture/probe-current-web-chat.mjs`
- `scripts/capture/test-adapter-clicks.mjs`
- `scripts/capture/qa-capture-result.mjs`

Current state:

- `probe-current-web-chat.mjs` exists and produces provider-neutral calibration snapshots.
- `qa-capture-result.mjs` exists and enforces expectation fixtures with non-zero exit on blocking QA failures.
- `artifacts/capture-calibration/dots-ai-single-turn-qa-expectations.json` captures the current dots.ai single-turn ground-truth expectations.

### Task E: UI Experiment

Status: pending

Add UI behind a small experimental flag:

- `Create Capture Adapter`
- `Capture Calibration Snapshot`
- `Run Adapter QA`
- show supported fields and limitations.

### Task F: Documentation

Status: pending

Update:

- `PROJECT_BRIEF.md`
- `docs/local-desktop-capture-sprint.md`
- `docs/dev-diary.md`

Only after we decide this is a committed product direction, not just a spike.

## Risks

1. Screenshot/OCR may be slower and less deterministic than DOM.
2. Some websites virtualize old messages aggressively.
3. Some websites block script execution or synthetic clicks.
4. Generic selectors may overfit one provider.
5. QA agent may need human-visible screenshot input that current CLI flow does not yet provide cleanly.
6. Adapter generation could feel magical but fail silently unless QA is strict.

## Recommended First Spike

Do not start with full skill implementation.

Start with a narrow spike:

1. Create generic snapshot artifact for current Chrome tab.
2. Feed snapshot + screenshot into a temporary prompt.
3. Ask Local Codex to produce field inventory and extraction plan.
4. Manually implement a tiny adapter for one non-Doubao site.
5. Run QA against one single-turn case.

If this works, promote the temporary prompt into a formal skill.

## Isolation Regression Protocol

After the skill is created, run a controlled dots.ai regression:

1. Treat the previous conversationally-built dots.ai capture as known-good baseline only for final diff.
2. Do not read or reuse the previous dots.ai extractor implementation during the regression.
3. Give the skill only allowed inputs:
   - browser snapshot;
   - screenshot or user-visible page facts;
   - target field contract;
   - case/turn context;
   - QA expectation fixture.
4. Generate a fresh extraction plan and fresh temporary adapter.
5. Run capture and `qa-capture-result.mjs`.
6. Only after QA finishes, compare field-level output against the known-good capture.
7. If there is regression, report the diff and planned fix before patching.

Current dots.ai isolation result:

- The fresh generated adapter passed `qa-capture-result.mjs`.
- Structured fields matched the known-good capture.
- The only diff was `finalAnswer` paragraph spacing; whitespace-normalized output matched exactly.
- This is a formatting fidelity issue, not a missing-evidence regression.

## Open Questions For Next Discussion

1. What should be the first non-Doubao website to adapt?
2. Should adapter building be allowed for baseline only, challenger only, or both?
3. Do we require screenshots for QA, or can DOM + visible text be enough for the first spike?
4. Should generated adapter code be saved inside repo, local user data, or run artifacts?
5. How much of the developer/QA loop should be automatic versus shown to the user?
