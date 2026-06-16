# Frontend Technical Architecture

## Goal

Build the first runnable local desktop Web App for SBS 4 Any Agent, then embed it in a native macOS development shell.

The MVP should prove the fixture-first workbench loop:

`load runtime eval package -> review package -> curate cases -> manual collection -> SBS review -> report download`

Do not start with live eval generation. The first implementation should consume:

`artifacts/eval-generation/20260607-restaurant-diandian-vs-doubao/revised-package.json`

## Stack Decision

Use a zero-install local web stack for the first MVP:

- Node built-in `http` server
- Node built-in `fs/path/child_process`
- Static HTML/CSS/JS served from `web/`
- Browser-native ES modules
- Local JSON files under `data/`

Add a native macOS development shell for desktop-assisted workflows:

- Swift/AppKit executable under `desktop/`;
- AppKit app lifecycle;
- WKWebView embedding `http://127.0.0.1:3000`;
- shell starts or reuses the existing Node server;
- no Electron/Tauri dependency for the first desktop slice.

Reasoning:

- This repo currently has no frontend project or dependency lockfile.
- Network access may slow down dependency installation.
- The first product risk is not component sophistication; it is whether the package-first workflow feels coherent.
- A no-dependency shell can later be migrated to Vite/React after the interaction model is proven.

## Runtime Shape

```text
Browser UI
  -> fetch /api/*
  -> local Node server
  -> data/*.json
  -> package validator script
  -> Markdown report file

Desktop Dev Shell
  -> starts/reuses local Node server
  -> WKWebView loads Browser UI
```

## Directory Layout

```text
web/
  index.html
  styles.css
  app.js
  api.js
  state.js
  render/
    packageView.js
    casesView.js
    collectView.js
    reviewView.js
    reportView.js

server/
  index.mjs
  storage.mjs
  report.mjs

desktop/
  Package.swift
  Sources/
    SBSDesktop/
      main.swift

scripts/
  desktop/
    build_dev.sh
    run_dev.sh

data/
  active-project.json
  packages/
    current.json
  runs/
    current.json
  reports/
    current.md
```

MVP can start with fewer frontend modules and split when code gets large.

## Backend API

### `GET /api/health`

Returns server status and project root.

### `POST /api/package/load-fixture`

Copies the restaurant regression package into `data/packages/current.json`, validates it in local mode, initializes curation and run state.

### `GET /api/package/current`

Returns:

- `package`
- `validation`
- `curation`
- `run`

If no current package exists, returns empty state.

### `POST /api/curation/current`

Saves case curation state.

Payload:

```json
{
  "caseId": "rest-st-001",
  "status": "approved",
  "reviewerNotes": "...",
  "editedCase": {}
}
```

### `POST /api/run/current`

Saves manual collection or review updates.

### `GET /api/report/current`

Generates Markdown preview from current package, curation, and run state.

### `POST /api/report/download`

Writes `data/reports/current.md`.

## Validation

Use the existing validator:

```bash
node skills/chatbot-eval-set-generator/scripts/validate_eval_package.mjs --mode local data/packages/current.json
```

The server should surface:

- `ok`
- `schemaErrors`
- `consistencyErrors`
- `warnings`
- `stats.validationMode`

If validation fails, the UI may show package metadata but must block collection.

## Frontend Information Architecture

### Package

Purpose: understand what this eval package is and whether it is trustworthy enough to run.

Must show:

- validation status
- arena decision question
- baseline and challenger
- target users
- success/failure definitions
- coverage plan and dimension weights
- taskFitModule
- quality gates
- confirmation backlog
- trace artifact refs

### Cases

Purpose: turn generated draft cases into approved runnable cases.

Must show:

- case table
- filters by case type/status/risk/capability cluster
- case detail
- model-facing fields separated from evaluator-facing fields
- approve/reject
- reviewer notes

Editing can be lightweight in the first pass: reviewer notes and status first, full structured editing second.

### Collect

Purpose: manually collect outputs from Doubao and challenger.

Must show:

- only approved cases
- case/turn progress
- copyable model-facing prompt
- evaluator instructions clearly marked as not copied
- baseline output textarea
- challenger output textarea
- evidence level per side
- visible process notes per side
- save state

Multi-turn MVP is manual driver only.

### Review

Purpose: compare collected outputs and write human judgment.

Must show:

- side-by-side outputs
- evidence levels
- transcript/turn navigation
- rubric suggestions as read-only hints
- manual winner/rationale/product implication fields

### Report

Purpose: produce portfolio-readable Markdown.

Must include:

- arena summary
- package validation and caveats
- coverage summary
- approved cases
- collection status
- SBS outputs
- manual review
- grader placeholder
- open questions

## State Rules

1. Do not mutate original package fields directly.
2. Store curation state separately.
3. Store run state separately.
4. Preserve unknown package fields.
5. Collection is allowed only for approved cases.
6. Report should include skipped/incomplete cases as caveats.
7. Copy buttons must only copy model-facing messages.
8. Evaluator-only fields must never appear in copy areas.

## Checkpoints Requiring User Review

### Checkpoint 1: Package Overview

Ask user to review after:

- fixture loads;
- validation status renders;
- Arena/Coverage/Self-Critique/Backlog are visible.

Decision needed:

- whether package overview information density feels right;
- whether the page makes the eval package understandable.

### Checkpoint 2: Case Curation

Ask user to review after:

- case table and case detail render;
- approve/reject works;
- model-facing vs evaluator-facing separation is clear.

Decision needed:

- whether case review is low-friction enough;
- which fields should become editable in MVP.

### Checkpoint 3: Manual Collection

Ask user to review after:

- approved cases enter collection;
- copy/paste/evidence-level flow works for one single-turn case and one multi-turn case.

Decision needed:

- whether collection burden is acceptable;
- whether multi-turn manual-driver copy is clear enough.

### Checkpoint 4: Report

Ask user to review after:

- report preview and Markdown download work.

Decision needed:

- whether report is portfolio-worthy enough;
- whether report should be more PM narrative or more artifact audit.

## Explicit Non-Goals For This Build

- No Local Codex generation button yet.
- No GPT API.
- No browser automation.
- No automatic grader.
- No guarded LLM simulator.
- No historical run dashboard.
- No mobile layout optimization beyond basic responsiveness.
