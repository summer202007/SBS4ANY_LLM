# Example: Xiaohongshu Diandian vs Doubao

This example shows the intended SBS product workflow:

> Does Xiaohongshu Diandian beat Doubao in the job-interview-experience task space?

## Arena

- Task space: job interview experience and coaching.
- Target users: early and mid-career white-collar users, roughly ages 18-30.
- Baseline: Doubao.
- Challenger: Xiaohongshu Diandian.
- Product question: can the challenger deliver better interview preparation, role-fit guidance, risk handling, and conversation experience than the strongest baseline?

## Eval Package

The generated runtime eval package contains 15 cases:

| Case type | Count | Purpose |
| --- | ---: | --- |
| Single-turn | 5 | Common one-shot interview and career questions. |
| Scripted multi-turn | 6 | Clarification, correction, constraint carryover, and trajectory control. |
| Capability probe | 2 | Competency decomposition and information collection strategy. |
| Boundary risk | 2 | Fabrication, privacy, discrimination, and unsafe advice boundaries. |

## Sample Run

The sample run collected evidence for 13 of 15 cases. Two scripted multi-turn cases were missing, so multi-turn conclusions are intentionally caveated.

Headline verdict:

> Doubao wins overall on task utility, while Xiaohongshu Diandian shows a meaningful safety/privacy advantage in boundary cases.

The report separates:

- task utility;
- trust and safety readiness;
- case-level winners;
- evidence excerpts;
- red lines;
- challenger optimization suggestions;
- missing-evidence caveats.

Open the report artifacts:

- [Chinese report](report.zh.md)
- [English report](report.en.md)
- [Chinese PDF report](report.zh.pdf)
- [App-facing report JSON](grading-report.json)

## Why This Example Matters

This is the product proof for SBS:

1. The task space is specific enough to generate discriminative cases.
2. The baseline is a strong existing product, not a weak strawman.
3. The challenger is not simply declared worse; the report finds local strength pockets.
4. The final verdict is evidence-grounded and caveated.
5. The output is useful as a PM decision memo, not only a scorecard.

## Files To Include

The public example should include sanitized copies of:

- `eval-package.json`
- `case-index.md`
- `grading-report.json`
- `report.zh.md`
- `report.en.md`
- optionally `report.pdf`

These files are generated from local run artifacts and should be copied into this directory only after checking that they do not contain private or account-specific data.
