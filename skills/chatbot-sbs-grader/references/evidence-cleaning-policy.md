# Evidence Cleaning Policy

Use this reference when producing `CleanedEvidencePackage`.

## Purpose

Collected SBS outputs are not grader-ready by default. They may include raw final answers, visible process notes, citation/source notes, query expansion, follow-up suggestions, risk notices, tool-call notes, capture notes, simulator artifacts, and manual paste noise.

The cleaner must separate product behavior from capture artifacts before any score is assigned.

## Real Run Lessons

The current interview run exposed these concrete patterns:

- Run data may use flat fields such as `baselineOutput`, `challengerOutput`, `baselineVisibleProcessNotes`, not nested `sides`.
- `caseRuns` may be an object keyed by `caseId`, not an array. Never call
  `.find`, `.map`, or `.filter` directly on raw `run.caseRuns`; normalize it
  first with `Array.isArray(run.caseRuns) ? run.caseRuns : Object.values(run.caseRuns || {})`.
- Doubao source notes may be only `Captured from: https://www.doubao.com/chat/...`; this proves page provenance but not claim support.
- Doubao visible process notes may include risk notices and follow-up suggestions, not internal thinking.
- Doubao intent/query expansion can be useful, noisy, or unrelated; do not automatically reward it.
- Dots/Diandian visible process notes often include adapter notes such as `Used approved dots.ai Web adapter template` and `Grouped all assistant bubbles...`; these are capture notes, not model reasoning.
- Dots/Diandian source notes often use `inline_quote` or related-note evidence; this is a different source type from URLs.
- Missing query/citation fields may mean the product UI did not expose them, not that the model failed.
- Multi-turn simulator notes may reflect harness behavior; do not treat them as tested-product behavior.
- Optional fields can be wrong-page or cross-case contaminated even when final answers are valid.
- Partial collection such as 13/15 cases should produce coverage caveats, not silent failure.

## Required Normalized Evidence Channels

For every case / turn / side, produce:

- `cleanFinalOutput`
- `productVisibleProcess`
- `intentExpansionEvidence`
- `sourceEvidence`
- `followupSuggestions`
- `riskNotices`
- `toolOrExecutionEvidence`
- `captureNotes`
- `simulatorNotes`
- `removedNoise`
- `suspectedContamination`
- `unsupportedClaims`
- `evidenceCompleteness`
- `gradeReadiness`
- `confidence`
- `humanReviewHints`

## Raw Preservation

Never destroy or overwrite raw collection.

Each cleaned item should include raw refs:

- `rawField`
- `rawExcerpt`
- `caseId`
- `turnIndex`
- `side`

Cleaning is a derived layer.

## Grader-Friendly Briefs

Long collected answers may need a compressed working view, especially when one side returns a very large answer.

A brief is allowed only as an index/navigation layer. It must not become the sole evidence used for grading.

Prefer minimal compression when the context budget allows. The priority order is:

1. preserve enough full evidence for accurate scoring;
2. avoid context overflow or failed output;
3. compress only the parts that are not material to the current judgment;
4. always keep full evidence refs so the grader can re-open important spans.

When forced to compress aggressively, preserve high-risk cases, red-line candidates, close calls, user corrections, final outcomes, and any evidence that supports a key verdict claim before preserving generic long-form advice.

If producing a brief, preserve:

- `caseId`
- `turnIndex`
- `side`
- prompt/user-message summary
- answer structure summary
- evidence-channel counts
- grade-readiness flags
- noise/contamination flags
- refs back to the full cleaned fields and raw fields

Do not let the brief:

- omit a material caveat from the full answer;
- convert uncertainty into certainty;
- hide a red-line failure;
- erase a weak or strong section of either side;
- serve as the only source for a dimension rationale.

When a case judgment depends on a claim found through a brief, re-open the full cleaned evidence and cite the finer evidence ref.

## Channel Taxonomy

### Final Output

The main user-visible answer. Keep it intact unless it contains obvious UI chrome or copied navigation unrelated to the answer.

If the final answer looks like a sidebar/history list rather than the current assistant answer, mark `suspectedContamination`.

### Product Visible Process

Only include user-visible model/product process, such as:

- visible planning text;
- visible search/retrieval action text;
- visible step-by-step reasoning explicitly shown in the UI;
- visible tool execution progress.

Do not include:

- capture adapter notes;
- SBS harness notes;
- `No structured tool-call trace was visible...`;
- `Used approved dots.ai Web adapter template`;
- `Grouped all assistant bubbles...`;
- `Transient thinking/status is not claimed...`;
- generic `内容由 AI 生成` notices.

Move those to `captureNotes` or `riskNotices`.

### Intent / Query Expansion Evidence

Capture query rewrites, search keywords, or product-visible interpretation of intent.

Do not treat every query as correct. Mark:

- `useful_intent_signal`
- `generic_or_low_signal`
- `possibly_wrong_intent`
- `wrong_page_or_cross_case`

### Source Evidence

Classify source evidence by type:

- `url_citation`
- `related_note_card`
- `inline_quote`
- `raw_page_url`
- `product_risk_notice`
- `manual_source_note`
- `not_exposed`

Do not compare only source counts. Assess whether sources support key claims.

This rule is provider-agnostic: every source item should be judged by what claim it supports, how visible it was to the user, and whether it is provenance, quotation, retrieval metadata, or substantive support. Provider-specific examples may guide cleaning, but must not become fixed grading assumptions for all products.

### Follow-Up Suggestions

Follow-up suggestions are an evidence channel for `trajectoryUserEffort`, not a scoring dimension by themselves.

Evaluate later whether they:

- reduce next-step user cost;
- are specific to the task;
- are timely;
- avoid unnecessary conversation extension;
- are not misleading or risk-amplifying.

### Risk Notices

Separate:

- generic AI disclaimer;
- product-specific caution;
- substantive risk pushback;
- legal/safety/ethical boundary warning.

Generic disclaimers should not count as meaningful risk handling unless the answer itself follows through.

### Tool / Execution Evidence

Only include actual visible tool calls or execution traces. If a field says no trace was visible, move it to `captureNotes`.

## Contamination Heuristics

Mark suspected contamination when:

- optional fields mention a different role, product, location, or task than the case prompt;
- final output begins with unrelated history/sidebar/navigation;
- source URL repeats from a previous unrelated case while content differs;
- query expansion includes terms from another case;
- follow-up suggestions reference another task space;
- a multi-turn later turn repeats stale suggestions from earlier unrelated turns;
- field contains capture setup errors or browser/app state.

Do not delete contaminated content. Preserve it in `removedNoise` or `suspectedContamination` with evidence refs.

## Unsupported Claim Marking

Mark claims needing grounding:

- live job openings, interview process, HC, salary bands, company status, layoffs;
- exact legal claims;
- exam/private/internal material claims;
- medical/mental health/safety claims;
- promises about offer probability, salary outcome, referral success;
- claims about current policy, price, availability, queue, booking, rankings, or reviews.

Unsupported claims do not always fail the case, but they should feed `groundingTrustCalibration` and `riskBoundaryHandling`.

## Grade Readiness

Use:

- `ready`: enough clean evidence for normal grading.
- `low_confidence`: usable but missing important fields or has mild contamination.
- `needs_human_review`: important ambiguity, suspected wrong-page capture, or severe evidence asymmetry.
- `blocked`: final output missing for one or both sides, or case/run mismatch makes grading misleading.

Prefer continuing with caveats unless grading would be actively misleading.

## Review Gate Readiness

Before a report is treated as formal product output, the cleaned evidence should expose enough for human review:

- per-case readiness;
- missing/blocked cases;
- suspected contamination;
- low-confidence evidence channels;
- red-line candidates;
- side-by-side cleaned answer links;
- raw artifact refs.

If this review state was skipped, the grader may still produce a dry-run report, but it must label the report as lower confidence and preserve a caveat that evidence was not human-reviewed.
