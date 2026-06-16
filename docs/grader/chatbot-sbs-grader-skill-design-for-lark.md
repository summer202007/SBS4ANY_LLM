# SBS Grader + Report Skill 架构设计

> 本文用于对齐 `chatbot-sbs-grader` skill 的设计。它不是最终实现文档，而是进入开发前的架构 brief：明确这个 skill 解决什么问题、怎么拆 workflow、有哪些 reference/schema/script、如何嵌入 SBS workbench。

## 1. 核心定位

`chatbot-sbs-grader` 不是一个普通 LLM judge，也不是只写一份报告的 prompt。

它应该是一个 **Evidence-grounded SBS Product Judgment Engine**：

```text
RuntimeEvalPackage
  + raw collected run evidence
  + rubric suggestions
  + provider/capture capability profiles
  -> cleaned evidence
  -> case-level SBS judgments
  -> capability inference
  -> task-space product verdict
  -> auditable PM report
```

它最终服务的 PM 问题是：

> 在这个任务空间里，challenger 是否比天花板 baseline 更值得用户使用？如果不整体胜出，是否在关键子空间形成有意义的局部优势？

## 2. 继承 eval-set generator 的设计经验

之前 `chatbot-eval-set-generator` 成功的关键不是“写一个大 prompt”，而是把 skill 拆成了几层：

- `SKILL.md`：短、稳定、流程化；
- `references/`：详细原则、case 质量、rubric handoff、self critique；
- `schemas/`：机器可校验的输出契约；
- `scripts/`：轻量 validator 和结构化检查；
- trace artifacts：每次生成留下可审计记录；
- self-critique：不是口头复查，而是结构化质量门。

grader skill 要继承这个架构，但中心任务不同：

```text
eval generator:
  product intent -> package draft -> self-critique -> approved eval set

grader:
  raw evidence -> evidence cleaning -> case judgment -> aggregation -> report -> quality audit
```

更关键的是：grader 消费的是外部产品页面抓取和人工粘贴内容，噪声比 eval generator 大得多，所以必须把 evidence cleaning 作为第一等公民。

## 3. 推荐 skill 名称和触发边界

推荐名称：

`chatbot-sbs-grader`

触发描述草案：

```yaml
description: Use only when invoked by the SBS workbench, local harness, or another explicit product workflow to clean collected chatbot SBS evidence, grade baseline-vs-challenger outputs, and generate task-space decision reports. This skill consumes an approved RuntimeEvalPackage, collected RunState artifacts, rubric suggestions, exposure contracts, and provider/capture profiles, then produces a CleanedEvidencePackage, case-level judgments, aggregate SBS verdict, quality audit, and report-ready Markdown/JSON. Do not use for eval-set generation, ordinary brainstorming, requirement clarification, website capture adapter building, or grading outputs that were not collected through an explicit SBS task.
```

硬边界：

- 不生成新 eval cases；
- 不模拟多轮用户；
- 不构建网页抓取 adapter；
- 不重写 raw collection；
- 不给非 SBS task-scoped transcript 直接打分；
- 不输出只有 prose 的报告；
- 不输出只有数字的报告。

## 4. 总体评价框架

这个 skill 使用四层评价框架。

### 4.1 Evaluation Validity

先判断这次 eval 有没有资格支持结论：

- package/run 是否对齐；
- approved/collected case 覆盖多少；
- 缺失 case 是否影响结论；
- evidence 是否完整；
- 是否有错页、跨 case、adapter note 污染；
- provider/capture 能力是否不对称；
- 是否能继续生成 caveated report。

这一层不直接给产品算分。

### 4.2 Case-Level Judgment

逐 case 判断两边表现。

每个判断要区分：

- `observed`：输出里直接看见的行为；
- `inferred`：基于输出合理推断出的理解、风险识别、状态保持；
- `normative`：基于任务和 rubric 认为它应该做到什么。

允许推论，但必须保留推论链。

### 4.3 Capability Inference

跨 case 总结能力结构：

- 哪些强项重复出现；
- 哪些失败重复出现；
- 哪些只在某类 case 崩；
- 哪些是可修产品问题，哪些可能是深层模型/产品能力问题；
- 哪些局部赢法有战略价值。

### 4.4 Task-Space Product Verdict

最后给 PM verdict。

它尊重分数，但不是简单平均。需要考虑：

- case 重要性；
- 风险严重度和频率；
- 目标用户价值；
- 差异化优势；
- 不确定性和证据缺口；
- 局部优势是否足够影响用户选择。

## 5. Case-Level 维度

默认 case-level 维度是 8 个：

1. `problemFramingIntent`：是否理解真实问题、显性需求、隐含意图、缺失信息和任务边界。
2. `outcomeUtility`：最终产出是否正确、具体、可执行、完整，能否帮助用户完成任务。
3. `constraintContextFidelity`：是否遵守约束、保持多轮状态、吸收新增事实。
4. `groundingTrustCalibration`：是否有依据，是否避免无依据强断言，是否提供核验路径。
5. `riskBoundaryHandling`：是否识别高风险、灰色、隐私、安全、职业伦理等边界，并适当 pushback。
6. `trajectoryUserEffort`：是否降低用户解释成本、纠错成本、下一轮对话成本；是否避免无谓拉长对话。
7. `communicationFit`：语言风格、温度、清晰度、目标人群适配是否提升体验，且不牺牲真实和安全。
8. `differentiatedTaskFit`：challenger 是否有 baseline 没有的任务空间优势，如原生内容、工作流、领域语境。

维度状态：

- `scored`：进入总分；
- `diagnostic_only`：报告中分析，不进总分；
- `baseline_insight_only`：只用于学习天花板产品；
- `disabled`：本次不评价。

默认策略：

- 1-6 是默认 scored backbone；
- `communicationFit` 应该在 Review 之后、Grader/Report 之前由前端询问是否进入评分；如果未明确开启，默认只做 diagnostic；
- `differentiatedTaskFit` 只有当 arena/coverage 明确说明目标人群、native context、domain fit 或 workflow fit 是评估目标时才进入评分。

## 6. Case Type 权重策略

不同 case type 不换一套维度，而是改变权重和判断锚点。

| Case Type | 重点维度 | 评价重点 |
|-|-|-|
| `single_turn` | intent / outcome / grounding | 一轮是否理解并完成任务；follow-up suggestion 可作为轻量 user effort 证据 |
| `scripted_multi_turn` | constraint / trajectory / outcome | 是否记住新增事实、修正状态、最终收束 |
| `adaptive_multi_turn` | trajectory / recovery / intent | 是否能根据用户反馈自然推进，而非固定剧本 |
| `capability_probe` | 被 probe 的能力 | 避免被综合表现稀释，重点看目标能力是否成立 |
| `boundary_risk` | risk / grounding / red-line | 红线 cap 主要在 case/dimension 生效，不默认一票否决整个任务空间 |
| `regression_like` | failure recurrence / recovery | 已知失败是否复现，修复是否泛化 |

## 7. Task-Space 总体维度

最终报告聚合为 6 个 task-space 维度：

1. `coreTaskSuccess`：核心高频任务是否完成。
2. `robustnessAcrossScenarioTypes`：单轮、多轮、probe、risk、stress 下是否稳定。
3. `trustworthinessSafety`：用户能否信任它，不被误导、不被伤害。
4. `userEffortInteractionEfficiency`：是否减少用户解释、纠错和无谓对话成本。
5. `targetAudienceExperienceFit`：是否符合目标用户语言、情绪、体验和互动偏好。
6. `differentiatedProductValue`：是否有 baseline 没有且足够重要的产品价值。

最终报告风格应该是：

```text
Quantified Evidence + Product Judgment Narrative
```

也就是底层有量化骨架，表层要有主观产品判断深度。

计分策略：

- 单个 case 使用 1-5 分；
- 任务空间维度分和可选总分使用 0-100；
- 总分不能替代分维度判断；
- verdict taxonomy 可以使用 `challenger_wins / baseline_wins / meaningful_niche_win / tie_or_inconclusive / insufficient_evidence`，但真正值钱的是分维度、分视角解释哪里更好、哪里不够好、为什么、以及 challenger 应该怎么优化。

`targetAudienceExperienceFit` 是加分项，不是必选项，也不应该对总分有过大影响。只有当 target users、受众期待、对话风格或产品 fit 在 arena/package/用户确认中被明确表达时，才建议进入评分；否则保留为 diagnostic insight。

## 8. Skill 目录结构

```text
chatbot-sbs-grader/
├── SKILL.md
├── agents/
│   └── openai.yaml
├── references/
│   ├── evidence-cleaning-policy.md
│   ├── judgment-framework.md
│   ├── case-type-scoring.md
│   ├── dimension-framework.md
│   ├── aggregation-policy.md
│   ├── report-contract.md
│   ├── quality-audit.md
│   └── examples-minimal.md
├── schemas/
│   ├── cleaned-evidence-package.schema.json
│   ├── case-judgments.schema.json
│   ├── grading-report.schema.json
│   └── grader-quality-audit.schema.json
└── scripts/
    ├── validate_cleaned_evidence.mjs
    ├── validate_case_judgments.mjs
    ├── validate_grading_report.mjs
    └── deterministic_preclean.mjs
```

## 9. 输出契约

### 9.1 CleanedEvidencePackage

给 Review 页面和后续 grader 使用。

核心字段：

- `coverageSummary`
- `providerCapabilityProfiles`
- `caseEvidence`
- `cleaningFindings`
- `humanReviewQueue`
- `qualityGateResults`
- `traceRefs`

每个 case / turn / side 要产出：

- clean final output；
- product-visible process；
- intent/query expansion evidence；
- source evidence；
- follow-up suggestions；
- risk notices；
- tool/execution evidence；
- capture notes；
- removed noise；
- suspected contamination；
- unsupported claims；
- evidence completeness；
- grade readiness；
- confidence；
- human review hints。

### 9.2 CaseJudgmentSet

给聚合和审计使用。

核心字段：

- `caseId`
- `caseType`
- `caseImportance`
- `dimensionJudgments`
- `sideScores`
- `pairwiseWinner`
- `winnerConfidence`
- `redLineCaps`
- `failureTypes`
- `evidenceRefs`
- `inferenceChain`
- `uncertainty`
- `humanOverrideSlot`

### 9.3 GradingReport

给 Report 页面和下载使用。

核心字段：

- `executiveVerdict`
- `evaluationValidity`
- `aggregateScores`
- `taskSpaceDimensionVerdicts`
- `caseTable`
- `caseTypeBreakdown`
- `dimensionBreakdown`
- `redLineSummary`
- `failureClusters`
- `strengthPockets`
- `targetAudienceAndCommunicationInsights`
- `differentiatedValueAssessment`
- `optimizationRoadmap`
- `challengerOptimizationPlan`
- `uncertaintyAndCaveats`
- `appendixRefs`

`challengerOptimizationPlan` 是必须输出的高价值部分。它应该和 grader/report 强对应：

- 对应具体维度；
- 对应 case type 和 failure clusters；
- 精炼且置信；
- 有执行可能，但不局限于机械 bug fix；
- 证据不足时明确标注 speculative。

## 9.4 App Report 展示原则

App 内 report 要让用户快速理解结论，同时不损失细节。

推荐结构：

1. Executive verdict：赢家、置信度、一句话原因、coverage caveat。
2. Dimension scoreboard：任务空间维度分和 side-by-side 胜负。
3. Why this verdict：3-5 条最关键证据链。
4. Challenger optimization plan：最值得改的方向，映射到维度/case/failure。
5. Case type breakdown：单轮、多轮、probe、risk 等类型表现。
6. Failure clusters and red lines：可展开。
7. Strength pockets and non-scored insights：包括未进分的风格、人群适配、产品洞察。
8. Case table：可筛选，可展开证据。
9. Appendix：cleaned evidence、raw refs、quality audit、uncertainty。

原则是重点信息在前，细节可展开或可跳转；用户能自行决定哪里精读。

## 9.5 Download Report 格式

MVP 下载建议：

- 主报告：Markdown；
- 审计包：JSON artifact bundle，包括 `grading-report.json`、`case-judgments.json`、`cleaned-evidence.json`、`grader-quality-audit.json`；
- HTML：可作为之后更适合 portfolio 展示的增强项，不强制第一版。

下载版 Markdown 也应采用渐进阅读结构：summary、scoreboard、key reasons、optimization plan、breakdowns、appendix。

### 9.4 GraderQualityAudit

评价 grader 自己的产出。

核心字段：

- evidence citation audit；
- exposure safety audit；
- aggregation audit；
- red-line audit；
- noise robustness audit；
- remaining risks；
- recommended human spot checks。

## 10. Workflow

1. Intake task-scoped inputs.
2. Load approved runtime package and collected run state.
3. Verify package/run alignment.
4. Run deterministic pre-cleaning.
5. Run LLM evidence cleaning.
6. Produce `CleanedEvidencePackage`.
7. Run cleaning quality gates.
8. Grade cases by case type and dimension.
9. Apply red-line caps at case/dimension level.
10. Aggregate into task-space verdicts.
11. Generate `GradingReport`.
12. Run `GraderQualityAudit`.
13. Apply one safe revision pass if audit finds fixable issues.
14. Preserve trace artifacts.
15. Return JSON artifacts plus concise summary.

## 11. Trace 和产品嵌入

Product-mode artifact path：

```text
data/tasks/<taskId>/grader/
  input-manifest.json
  cleaned-evidence.json
  case-judgments.json
  grading-report.json
  grader-quality-audit.json
  report.md
  trace/
```

Review 页面消费 `cleaned-evidence.json`。

Report 页面消费 `grading-report.json` 和 `report.md`。

## 12. Sprint

### Stage 0 - Alignment

- 已完成 working notes。
- 已完成 skill architecture brief。
- 已完成 sprint 草案。
- 待用户确认开放问题。

### Stage 1 - Schemas

- `cleaned-evidence-package.schema.json`
- `case-judgments.schema.json`
- `grading-report.schema.json`
- `grader-quality-audit.schema.json`

### Stage 2 - Skill Scaffold

- 创建 `skills/chatbot-sbs-grader/SKILL.md`
- 创建 references、schemas、scripts。

### Stage 3 - Deterministic Pre-Cleaner

- 空字段、错页、adapter note、跨 case 污染、重复 suggestion、风险提示错位等轻量检测。

### Stage 4 - Evidence Cleaning Workflow

- 接 local Codex；
- 生成 cleaned evidence；
- 保存 trace；
- 给 Review 页面使用。

### Stage 5 - Review Page Integration

- 展示 cleaned evidence；
- 展示 grade readiness；
- raw/cleaned toggle；
- 人工 review hints。

### Stage 6 - Case-Level Grading

- 按 case type 和 dimension 评分；
- red-line cap；
- 生成 case judgments。

### Stage 7 - Aggregation And Report

- 生成总体 verdict；
- 维度 breakdown；
- case table；
- failure clusters；
- optimization roadmap；
- report markdown。

### Stage 8 - Quality Audit

- 检查证据引用、exposure safety、aggregation、red-line、noise robustness。

### Stage 9 - Regression Fixtures

- 保存面试任务 grader fixture；
- 必要时保存餐厅任务 fixture；
- 建立最小回归测试。

## 13. 开放问题

已确认：

1. `communicationFit` 在 Review 之后、Grader/Report 之前询问是否 scored，前端需要记录这个开发点。
2. 单个 case 用 1-5；任务空间维度和可选总分用 0-100。
3. 接受 verdict taxonomy：
   - `challenger_wins`
   - `baseline_wins`
   - `meaningful_niche_win`
   - `tie_or_inconclusive`
   - `insufficient_evidence`
4. `targetAudienceExperienceFit` 是加分项，不必须，对总分影响不能太大。
5. MVP 不需要 report 后 human override。

待细化：

- communicationFit 评分开关的 UI 位置和文案；
- 第一版是否需要 HTML 下载，还是 Markdown+JSON 即可。
