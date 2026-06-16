# Chatbot SBS Grader Working Notes

Created: 2026-06-12

## Scope

These notes capture the intended design direction before building the `chatbot-sbs-grader` skill and wiring it into the SBS workbench.

The grader should be one skill with two explicit workflows:

1. `evidence_cleaning`
2. `grading_report`

The implementation artifacts should remain separate:

- `CleanedEvidencePackage`
- `GradingReport`

## Why Evidence Cleaning Is Mandatory

Collected chatbot outputs are not grader-ready by default.

Observed in the interview collection:

- Diandian `visibleProcessNotes` often contains adapter/capture notes, not model thinking.
- Doubao `visibleProcessNotes` can mix risk notices, follow-up suggestions, and capture artifacts.
- Doubao intent/query expansion can contain useful query traces, but also noise or wrong-page contamination.
- Source/citation fields are provider-specific: Doubao usually exposes URL citation; Diandian often exposes inline quotes or related notes.
- Missing fields may mean "not exposed by product UI", not "model lacks capability".
- Multi-turn simulator artifacts can reflect old harness behavior and should not be mistaken for product behavior.
- A case can have valid final outputs but contaminated optional fields; graders must not blindly score all fields.

## Evidence Cleaning Responsibilities

The cleaner should transform raw `RunState` into a review- and grader-ready object.

For every case, turn, and side, produce:

- `cleanFinalOutput`
- `productVisibleProcess`
- `intentExpansionEvidence`
- `sourceEvidence`
- `followupSuggestions`
- `riskNotices`
- `toolOrExecutionEvidence`
- `captureNotes`
- `removedNoise`
- `suspectedContamination`
- `unsupportedFields`
- `evidenceCompleteness`
- `gradeReadiness`: `ready | low_confidence | needs_human_review | blocked`
- `confidence`
- `humanReviewHints`

## Cleaning Rules

- Preserve raw evidence; never destructively overwrite original collection.
- Do not treat capture adapter notes as product reasoning.
- Do not treat missing provider-specific fields as a model failure unless the product claims or visibly exposes that capability.
- Separate source evidence type from source count:
  - URL citation
  - related note card
  - inline quote
  - raw captured page URL
  - product risk notice
  - unsupported / not exposed
- Detect likely wrong-page or cross-case contamination when optional fields mention a different task, role, or user goal than the current case.
- Deduplicate repeated risk notices and follow-up suggestions.
- Mark unsupported live, recency, salary, company process, legal, safety, or availability claims for grader attention.
- Respect `exposureContract`: only hard-score facts visible to the tested product, reasonable inferences, or general safety norms.

## Grading Responsibilities

The grader should consume:

- approved `RuntimeEvalPackage`
- `CleanedEvidencePackage`
- `rubricSuggestions`
- `exposureContract`
- provider/capture capability profiles

The grader should output:

- per-case pairwise winner
- per-side dimension scores
- per-dimension pairwise rationale
- red-line caps and severe failures
- uncertainty / evidence caveats
- aggregate dimension scoreboard
- overall SBS verdict
- failure clusters
- strength pockets
- optimization roadmap
- report-ready Markdown/JSON

## Core Grader Frame

Use three ground-truth lenses:

- Intent: did the model understand what the user was trying to do?
- Outcome: did the final answer help the user complete the task?
- Failure type: what kind of failure explains misses or risks?

For multi-turn cases, add trajectory:

- Did the model ask/answer at the right time?
- Did it preserve and update state?
- Did it recover from correction or newly exposed facts?
- Did user effort stay reasonable?

## Quality Gates For Grader Outputs

A good grader output should be:

- package-aligned: uses the generated cases/rubrics, not generic taste;
- exposure-safe: does not punish models for hidden facts;
- evidence-grounded: cites collected evidence or says evidence is insufficient;
- provider-fair: accounts for unsupported capture fields;
- red-line aware: severe safety/trust failures cap scores;
- decision-useful: explains whether the challenger beats the baseline and where;
- auditable: keeps raw refs, cleaned refs, scoring rationale, and uncertainty.

## Open Implementation TODO

- Design `CleanedEvidencePackage` schema.
- Design `GradingReport` schema.
- Add local `chatbot-sbs-grader` skill with two workflows.
- Add a lightweight deterministic pre-cleaner before LLM cleaning where possible.
- Add Review page display for cleaned evidence and grade readiness.
- Add Report page generation from `GradingReport`.
- Add local Codex job wrapper with progress logs similar to package generation.
- Preserve grader artifacts under task-scoped storage.
