# Evidence Cleaning Summary

Job: grader-2026-06-13T064644748Z  
Stage: evidence cleaning only  
Task: task-2026-06-12T064110798Z

## 输出

- Cleaned evidence: `data/tasks/task-2026-06-12T064110798Z/grader/cleaned-evidence.json`
- Invocation trace: `data/tasks/task-2026-06-12T064110798Z/grader/invocation-trace.clean.json`

## 覆盖情况

- Package cases: 15
- Collected cases: 13
- Missing cases: jobint-mt-010, jobint-mt-011
- Coverage status: partial

## 清洗动作

- 保留 collected run 原文；本次只生成派生 cleaned evidence，没有改写 raw run/package/preclean 文件。
- 保留完整 `cleanFinalOutput`，未用摘要替代完整证据。
- 将 challenger adapter/capture 文本从 product-visible process 中分离到 `captureNotes`。
- 将通用 `内容由 AI 生成` 归入 `riskNotices`，并标记为非实质性 generic disclaimer。
- 将 Doubao chat URL 保留为 `raw_page_url` provenance，不作为 claim-level citation support。
- 保留 inline quote / related-note 类 source evidence，并在后续评分时要求按支持的具体 claim 解释。
- 标记潜在 unsupported claim candidates，供 grounding / risk 维度后续检查。

## 统计

- Cases: 15 (11 ready, 2 low_confidence, 2 missing)
- Turns: 19; side-turns: 38
- Capture notes separated: 57
- Removed/misfiled noise items: 146
- Source evidence items: 69
- Risk notice items: 54
- Unsupported claim candidates: 52

## Caveats

- Missing collected cases `jobint-mt-010`, `jobint-mt-011` mean downstream grading is partial unless recollected or explicitly excluded.
- No substantive human review state was found in `run.manualReviews`; formal scoring should include spot checks for low-confidence and missing cases.
- Unsupported-claim candidates are pattern-based evidence flags, not final judgments.
