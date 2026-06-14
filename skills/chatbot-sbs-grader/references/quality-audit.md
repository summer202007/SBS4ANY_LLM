# Quality Audit

Use this reference to produce `GraderQualityAudit`.

The grader must evaluate its own output before returning a final report.

## Required Gates

Use statuses:

- `pass`
- `warn`
- `fail`
- `not_applicable`

Minimum gates:

- `packageRunAlignment`
- `collectionCoverage`
- `evidenceCompleteness`
- `briefFidelity`
- `noiseSeparation`
- `contaminationDetection`
- `exposureSafety`
- `rubricAlignment`
- `caseTypeScoringFit`
- `redLineApplication`
- `aggregationReasonableness`
- `reportActionability`
- `invocationTraceability`
- `traceCompleteness`

Each gate needs:

- status;
- reason;
- affected case refs;
- recommended fix or caveat.

## Evidence Citation Audit

Check:

- Do important verdict claims cite case/evidence refs?
- Are raw and cleaned refs preserved?
- Are evidence refs specific enough to inspect?
- Are source counts not overinterpreted?
- Can a reviewer follow each major claim from report -> case judgment -> cleaned evidence -> raw field?

Fail when:

- report gives major conclusion without evidence;
- cleaned evidence cannot be traced to raw collection.

Warn when:

- refs stop at case-level for important claims;
- evidence spans are available but not used;
- a case brief is cited without a full evidence ref.

## Brief Fidelity Audit

Check:

- case briefs are labeled as summaries or navigation aids;
- every brief links back to full cleaned/raw evidence;
- red-line signals from raw evidence are preserved in brief/findings;
- long answers were not judged only from their opening section;
- uncertainty/capture caveats survived compression.

Fail when:

- a dimension score or red-line call can only be justified by a brief and not by full evidence.

Warn when:

- brief generation was used but no human review or spot check was performed.

## Exposure Safety Audit

Check:

- Did grader avoid scoring hidden persona/expected outcome as if model saw it?
- Are inferences grounded in output behavior?
- Are normative expectations clearly based on rubric/task/safety?

Warn when:

- a judgment depends on target user assumptions not confirmed by setup.

## Noise Robustness Audit

Check:

- adapter notes moved to capture notes;
- generic AI disclaimers not treated as substantive risk handling;
- source page URLs not treated as content support;
- suspected wrong-page contamination flagged;
- simulator artifacts not treated as product behavior.

## Red-Line Audit

Check:

- red-line cases are considered;
- caps are applied at case/dimension level;
- aggregate implication is explained;
- one red-line does not automatically decide whole task unless justified.

## Aggregation Audit

Check:

- aggregate scores match case judgments directionally;
- missing case coverage appears in caveats;
- case type imbalance is visible;
- meaningful niche wins are preserved;
- target-audience fit does not dominate unless explicitly enabled.
- `communicationFit` remains diagnostic unless explicitly enabled as scored before grading.

## Report Actionability Audit

Check:

- report has a clear executive verdict;
- dimension-level strengths/weaknesses are understandable;
- challenger optimization plan exists when evidence supports it;
- non-scored insights are labeled;
- user can decide where to drill down.

## Invocation Traceability Audit

Check:

- invocation mode is recorded, such as `product_job`, `debug_dry_run`, or `manual_skill_run`;
- skill path/version or local skill ref is recorded;
- input artifact refs are recorded;
- output artifact refs are recorded;
- validation results are recorded;
- known limitations are recorded.

Warn when:

- the grader was manually or interactively executed rather than invoked through the product backend.

Fail when:

- a formal report has no reproducible invocation trace and no caveat.

## Human Spot Checks

Recommend human spot checks for:

- high-impact close calls;
- red-line cases;
- low-confidence evidence;
- suspected contamination;
- target-audience or communication-fit judgments;
- cases where both products are poor.

Human spot checks are recommended, not required, for MVP.
