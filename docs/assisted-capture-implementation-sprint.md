# Assisted Capture Implementation Sprint

Created: 2026-06-10

## Goal

Implement the first usable semi-automated collection path for Doubao baseline output.

The product boundary is:

> Human sends the prompt in Chrome. SBS captures the current Chrome page read-only.

No prompt auto-send, no verification bypass, no hidden scraping.

## Locked Decisions

1. Capture side strategy: only Doubao/baseline assisted capture in this slice.
2. Challenger remains manual.
3. Trigger: user clicks an App button; the local server runs a Chrome current-page read script.
4. Failure fallback: show clear error and keep manual fields usable.
5. Multi-turn next-message timing: only after both sides for the current turn are collected.
6. Multi-turn message policy: shared user message.
7. Local Codex integration should be button-driven and quiet; do not expose CLI unless diagnostics are needed.

## User Flow

### Single-Turn Doubao Capture

1. User opens Collect.
2. User selects an approved case.
3. User chooses assisted capture for Doubao or uses the Doubao capture block.
4. App shows the model-facing prompt and `Copy User Message`.
5. User switches to Chrome, opens Doubao, sends the prompt manually, and waits for the answer.
6. User returns to SBS and clicks `Capture Chrome Current Page to Doubao`.
7. App reads Chrome's front-window active tab.
8. App shows pending capture preview.
9. User accepts, discards, or edits manually.
10. Accept maps capture into the existing baseline fields.

### Multi-Turn Doubao Capture

For each turn:

1. App shows the shared user message.
2. User sends it manually to Doubao and challenger.
3. User captures Doubao via assisted capture.
4. User fills challenger manually.
5. User marks the turn/case complete or, later, clicks `Suggest Next Turn`.

The first implementation does not call local Codex for next-turn generation. It preserves the UI/API shape for later.

## Data Model

```ts
type CaptureSession = {
  sessionId: string;
  provider: "doubao_web";
  side: "baseline";
  caseId: string;
  turnIndex: number;
  status: "active" | "pending" | "accepted" | "discarded" | "failed";
  createdAt: string;
  updatedAt: string;
  pendingCapture?: CapturePayload;
  lastError?: string;
};

type CapturePayload = {
  captureId: string;
  provider: "doubao_web";
  side: "baseline";
  caseId: string;
  turnIndex: number;
  capturedAt: string;
  url: string;
  title: string;
  finalAnswer: string;
  expandedSearchQueries: string[];
  referenceMaterials: Array<{ rank?: number; title: string; href?: string; sourceName?: string }>;
  riskNotices: string[];
  followupSuggestions: string[];
  visibleProcessNotes: string;
  toolcallNotes: string;
  rawVisibleText: string;
  captureNotes: string[];
};
```

## Backend Tasks

Status: implemented for the first Doubao current-Chrome path, except `GET /api/capture/session` is deferred because the current app reads session state through `GET /api/run/current` / package state refresh.

1. [done] Store capture session in `data/runs/current.json`.
2. [done] Add `POST /api/capture/session/start`.
3. [deferred] Add `GET /api/capture/session`.
4. [done] Add `POST /api/captures/doubao/current-chrome`.
5. [done] Add `POST /api/capture/session/accept`.
6. [done] Add `POST /api/capture/session/discard`.
7. [done] Map accepted Doubao payload into current turn baseline fields:
   - `baselineOutput`;
   - `baselineEvidenceLevel`;
   - `baselineSourceNotes`;
   - `baselineVisibleProcessNotes`;
   - `baselineToolcallNotes`.
8. [done] Preserve raw capture under the run state for audit.

## Frontend Tasks

Status: implemented inside the Collect page baseline side.

1. [done] Add assisted capture block inside baseline side only.
2. [done] Show short user-operated-browser instructions.
3. [done] Add capture button.
4. [done] Add pending preview with:
   - answer excerpt;
   - search queries;
   - reference count;
   - risk notices;
   - follow-up suggestions;
   - URL.
5. [done] Add accept/discard buttons.
6. [done] Keep existing manual fields always visible.

## Chrome Extraction

Use AppleScript to read Chrome's front-window active tab:

- URL;
- title;
- visible body text;
- anchors;
- buttons/chips;
- provider-specific candidate text blocks.

The extractor is heuristic and opportunistic. If the four Doubao search UI elements are absent, return empty arrays plus a capture note.

## Acceptance

- [implemented, needs real-page QA] User can capture Doubao current Chrome page into baseline side for one single-turn case.
- [done] Capture never sends a prompt.
- [done] Capture failure does not block manual collection.
- [done] App shows pending preview before saving.
- [done] Accepted capture persists after refresh.

## Implementation Notes

- `server/chromeCapture.mjs` owns the Chrome current-tab AppleScript extraction and Doubao-specific heuristic normalization.
- `server/storage.mjs` owns capture session state and accepted capture mapping into existing run turn fields.
- `server/index.mjs` exposes the capture routes.
- `web/render/collectView.js` renders the Doubao-only assisted capture block, pending preview, accept, and discard controls.
- `web/app.js` wires capture actions to status-bar feedback.
- If Chrome refuses JavaScript-from-Apple-Events, the UI shows the error and asks the user to fall back to manual paste. A future native helper can offer a one-click diagnostic for Chrome permissions.
