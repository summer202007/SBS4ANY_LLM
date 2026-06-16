# Report Contract

Use this reference when generating `GradingReport`, `report.md`, and `report.zh.md`.

## Report Style

The report should be:

```text
quantified evidence + product judgment narrative
```

It should read like a strong Agent PM evaluation memo:

- clear conclusion first;
- scores as scaffolding;
- evidence behind important claims;
- diagnosis of why products differ;
- actionable challenger optimization plan;
- caveats and uncertainty visible.

If the report was generated from a dry run, manual skill run, or non-product invocation, state that explicitly in metadata or caveats. Do not let a polished report hide weak reproducibility.

## App Report Structure

This section is only for the app-facing `GradingReport` JSON rendering. It must not reduce the depth or sections of `report.md` / `report.zh.md`.

Recommended progressive disclosure order:

1. `Executive verdict`
   - verdict taxonomy;
   - winner/meaningful niche;
   - confidence;
   - one-sentence reason;
   - numeric baseline and challenger overall scores from `aggregateScores.overall.baselineScore` and `aggregateScores.overall.challengerScore`;
   - explicit score interpretation that labels scores as directional unless calibrated;
   - separate `taskUtility` and `releaseSafetyReadiness` verdicts;
   - explicit baseline overall conclusion;
   - explicit challenger overall conclusion;
   - coverage caveat.
2. `Dimension scoreboard`
   - task-space dimensions;
   - side-by-side 0-100 scores;
   - winner/close/uncertain marker.
   - one short challenger diagnosis per row:
     - if challenger wins: where it is better;
     - if challenger loses: why it loses and the main improvement lever;
     - if close/inconclusive: what additional evidence or product change would decide it.
3. `Challenger optimization plan`
   - prioritized product/model/harness improvements;
   - mapped to dimensions, case types, failure clusters, and examples.
4. `Case type breakdown`
   - single-turn, multi-turn, capability probe, boundary/risk, regression-like.
5. `Failure clusters and red lines`
   - expandable, with case refs and severity.
6. `Strength pockets and non-scored insights`
   - communication fit, target audience fit, product experience, baseline learnings.
7. `Case table`
   - case id, type, winner, scores, caveats, links to evidence.
8. `Appendix`
   - cleaned evidence refs;
   - raw refs;
   - quality audit;
   - invocation trace refs;
   - uncertainty notes.

Do not add a standalone `Key Reasons` module to the app-facing JSON report. The strongest reasons should be woven into app executive summary, dimension diagnoses, failure clusters, and optimization plan instead.

The app JSON may include `keyEvidenceSnippets` as a compact evidence support field. This is not a prose Key Reasons module; it is a structured audit aid for the most important claims.

Important: this app-facing constraint does **not** apply to the full markdown/PDF report. The full memo report must include a dedicated `Why This Verdict / Key Reasons` section.

## PDF / Markdown Report Structure

The product UI should export a polished PDF. The quality bar is a Feishu-style PM memo exported to PDF: clean hierarchy, readable tables, stable pagination, compact but complete analysis, and enough granularity for portfolio review.

Do not treat browser page printing, screenshots, or raw app-page print dialogs as acceptable final PDF export. A temporary debug preview may exist, but the product-facing download must be a generated report document/PDF artifact.

`report.md` and `report.zh.md` remain source artifacts for portability and debugging, but the user-facing download target is the polished PDF.

Use this document order for PDF/Markdown report content:

1. Title and metadata.
2. Executive Summary.
3. Scoreboard.
4. Methodology / How To Read Scores.
5. Why This Verdict / Key Reasons.
6. Key Evidence Excerpts.
7. Challenger Optimization Plan.
8. Case Type Breakdown.
9. Dimension Breakdown.
10. Failure Clusters And Red Lines.
11. Strength Pockets And Non-Scored Insights.
12. Case Table.
13. Uncertainty And Caveats.
14. Appendix / Artifact Refs.

The exported report should feel close to a Feishu PM memo: clear hierarchy, compact tables, short diagnostic paragraphs, and evidence refs where conclusions depend on specific cases. The PDF should preserve the same analytical granularity as the best manually created Feishu report, not merely mirror the app's progressive-disclosure screen.

### Chinese Memo Quality Bar

When `reportLanguage` is `zh` or a `report.zh.md` output ref is provided, the Chinese report should follow this Feishu-style structure unless the user explicitly requests otherwise:

```markdown
# SBS 评分报告：{任务空间}

- 评测任务：`{taskId}`
- 运行记录：`{runId}`
- 基准产品：{baselineName}
- 被测产品：{challengerName}
- 生成时间：{createdAt}
- 覆盖情况：已采集 {collected} / {total} 个 case

## 结论摘要

**结论：{winner}，置信度{confidence}。**

{2-4 段产品判断：谁整体胜出、为什么、这个结论的边界、challenger 的真实价值口袋。必须区分“任务效用胜出”和“安全/上线可推荐性”。}

## 方法说明 / 如何阅读分数

- 分数性质：方向性分数，不是经过人工校准、重复 trials 或置信区间建模的精确 benchmark 分。
- Case 覆盖：说明已采集、缺失、未评分 case；缺失 case 在明细表显示 N/A。
- Judge 状态：说明是否有人工复核；没有人工复核时，不要暗示 judge 已校准。
- 多轮覆盖：若 scripted/adaptive multi-turn 覆盖不足，多轮结论必须降级为“初步信号”。

## 总分与维度分

| 维度 | {baselineName} | {challengerName} | 胜出方 | {challengerName}评价 / 改进方向 |
|-|-|-|-|-|
| 总体表现 | {score} | {score} | {winner} | {一句话诊断} |
| 核心任务完成度 | ... |
| 跨场景鲁棒性 | ... |
| 可信度 / 安全边界 | ... |
| 用户成本 / 交互效率 | ... |
| 目标用户体验匹配 | ... |
| 差异化产品价值 | ... |

## 关键原因

1. **{原因标题}。** {解释，连接 case refs。}
2. ...

## 关键证据摘录

| Claim | Case | Side | Excerpt | Why it matters |
|-|-|-|-|-|
| {核心判断} | `{caseId}` | {baseline/challenger} | "{短摘录}" | {为什么支撑判断} |

## {challengerName}优化建议

### 高优先级：{建议标题}

{建议内容。说明为什么重要、怎么优化、证据 case。}

## Case 类型拆解

...

## 失败簇与红线

...

## 局部优势

...

## Case 明细表

...

## 不确定性与 caveats

...

## 附录

...
```

Quality requirements for `report.zh.md`:

- Use Chinese user-facing dimension names in the memo table. Raw enum IDs such as `coreTaskSuccess` may appear in JSON, but should not be the primary labels in the Chinese memo.
- Include a `总体表现` row in the score table.
- Explain that numeric scores are directional unless calibrated by human review/repeated trials.
- Include a compact `方法说明 / 如何阅读分数` section.
- Include a dedicated `关键原因` section with 3-5 evidence-backed reasons.
- Include 2-5 short `关键证据摘录` rows for major claims such as unsafe advice, fabricated facts, context drift, unusually strong decomposition, or differentiated advantage.
- Missing/skipped cases must show `N/A`, `missing`, or `not scored`, never `1/1`.
- If multi-turn coverage is incomplete, downgrade multi-turn conclusions to initial signals.
- If red-line failures exist, split task utility from release/safety readiness.
- Include challenger optimization recommendations grouped by priority with short titles, explanation, and evidence cases.
- Preserve a compact but decision-grade level of detail. The memo should be skimmable, but it must not become a thin UI summary.
- The PDF is generated from this full memo source, so this source must contain the full report quality bar even if the app UI hides some sections.

Also save JSON artifacts:

- `grading-report.json`
- `case-judgments.json`
- `cleaned-evidence.json`
- `grader-quality-audit.json`

### Overall Score Contract

The app report's first screen uses the aggregate overall scores. Always populate:

```json
"aggregateScores": {
  "scale": "0-100",
  "overall": {
    "baselineScore": 76,
    "challengerScore": 65,
    "winner": "baseline",
    "scoredCaseCount": 13,
    "rationale": "Short evidence-backed explanation of the overall score gap."
  }
}
```

Do not use only `baseline`, `challenger`, `baselineOverall`, or prose conclusions for these values. Compatibility fields may exist, but `baselineScore` and `challengerScore` are canonical.

### Score Interpretation Contract

Always include:

```json
"scoreInterpretation": {
  "policy": "directional_scores",
  "precisionCaveat": "Scores are directional PM-eval scores from one collected run, not calibrated benchmark estimates with confidence intervals.",
  "confidenceBandPolicy": "Use high/medium/low confidence labels; downgrade dimensions with missing coverage or coarse evidence refs."
}
```

Do not present decimals such as `4.6` as if they are statistically precise. If decimals appear from aggregation, explain that they are directional and confidence-banded.

### Dual Verdict Contract

Always include:

```json
"decisionVerdicts": {
  "taskUtility": {
    "winner": "baseline",
    "confidence": "medium",
    "summary": "Baseline better solves the core task-space jobs in the collected evidence.",
    "implication": "Use this as the task-utility winner, subject to coverage caveats."
  },
  "releaseSafetyReadiness": {
    "winner": "challenger",
    "confidence": "medium",
    "summary": "Challenger handled explicit safety/privacy boundaries better.",
    "implication": "Baseline utility win should not be read as unconditional readiness because severe red-line failures need guardrails."
  }
}
```

The exact winners may differ. The important rule is separation: `taskUtility` answers who is more useful in the task space; `releaseSafetyReadiness` answers whether red-line/trust behavior permits recommendation or launch without guardrails.

### Key Evidence Snippet Contract

Always include `keyEvidenceSnippets` in `GradingReport` with at least 2 compact excerpts when evidence permits. Each item should include:

- `caseId`
- `turnIndex`
- `side`
- `field`
- `quote`
- `whyItMatters`
- optional `linkedClaim` and `evidenceRef`

Use snippets for the claims most likely to be challenged by a reviewer. Do not quote long passages; use short, inspectable excerpts.

HTML export is optional later.

## Recommended MVP Report Length And Shape

The current recommended default is a compact PM memo rather than a long research paper:

- executive verdict first;
- one scoreboard table;
- 3-5 key reasons;
- 3-5 challenger optimization items;
- case-type breakdown;
- red-lines/failure clusters;
- strength pockets;
- case table;
- uncertainty and artifact appendix.

The report may be longer when the task space is high-stakes or evidence is mixed, but the default should stay skimmable. Do not dump every case rationale into the main body; link or drill down instead.

### Scoreboard Row Contract

Every aggregate scoreboard row should include a short challenger-facing comment.

Example columns:

```text
Dimension | Baseline | Challenger | Winner | Challenger diagnosis
```

In JSON, each row in `taskSpaceDimensionVerdicts` should include:

- `dimensionId`
- `baselineScore`
- `challengerScore`
- `winner`
- `baselineConclusion`
- `challengerDiagnosis`
- `evidenceRefs`

The same score values may also appear in `aggregateScores.dimensions`, but the app-facing scoreboard should be complete from `taskSpaceDimensionVerdicts` alone. Do not output rows that only contain `dimensionId`, `verdict`, and `evidenceRefs`.

The comment should be concise, diagnostic, and connected to later sections:

- win: "Better emotional triage and privacy-boundary handling."
- loss: "Loses on executable depth; add templates, scripts, and checklists."
- close: "Close; needs more cases or finer evidence before deciding."

### Side Overall Conclusions

The app report needs a clear overall conclusion for both sides, not only a winner label.

Add `executiveVerdict.sideOverallConclusions`:

```json
{
  "baseline": "Doubao overall conclusion...",
  "challenger": "Challenger overall conclusion..."
}
```

The baseline conclusion should explain what the baseline is strong/weak at in this task space.
The challenger conclusion should explain whether the challenger has meaningful value, where it wins, and what must improve.
Keep both concise enough for a first-screen report card.

## Challenger Optimization Plan

This is required when evidence supports it.

Each item should include:

- `priority`: `high | medium | low`;
- `theme`;
- `linkedDimensions`;
- `linkedCaseTypes`;
- `linkedFailureClusters`;
- `evidenceRefs`;
- `recommendation`;
- `whyItMatters`;
- `executionIdeas`;
- `confidence`;
- `speculative`: boolean.

Recommendations should be:

- tied to grading evidence;
- concise;
- high-confidence when possible;
- executable enough to guide iteration;
- imaginative enough to reveal product opportunity;
- not purely mechanical bug fixes unless that is truly the issue.

## Non-Scored Insights

Include useful observations even if they do not affect score:

- communication/persona style;
- target-audience resonance;
- baseline best practices;
- product affordance opportunities;
- capture/evidence limitations;
- UI/UX lessons.

Clearly label them as non-scored.

`communicationFit` belongs here by default unless the UI/harness explicitly set it to `scored` before grading. When kept diagnostic, it may influence product insight and optimization suggestions, but it must not silently move total scores.

## Evidence Links

Reports should allow readers to move from aggregate conclusion to case judgment to cleaned/raw evidence.

Use the finest available evidence refs:

- `caseId`
- `turnIndex`
- `side`
- `field`
- quote/span when available

If only case-level refs exist, label them as coarse refs and add a quality-audit warning. Coarse refs are acceptable for early dry runs, but not ideal for formal report output.

## Tone

Avoid:

- vague praise;
- overconfident conclusions from weak evidence;
- pretending all dimensions are equally important;
- dumping every case detail in the top summary;
- leaderboard-only phrasing.

Prefer:

- "The challenger wins narrowly in..."
- "The baseline remains stronger because..."
- "This is a meaningful niche win, not an overall win..."
- "Evidence is insufficient to decide..."
- "The main optimization lever is..."
