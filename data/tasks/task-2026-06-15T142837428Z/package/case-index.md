# Case Index

## Arena Core

- Decision: deepseek 在「中文行业研究与职业讨论」任务空间里，是否整体胜出 Doubao？
- Task Space: 中文行业研究与职业讨论
- Scenario: 比较 DeepSeek 与 Doubao 在中文行业研究、市场研究、策略拆解、竞品分析和职业场景讨论中的输出质量，面向高判断力职场用户的真实工作辅助任务。
- Success: 胜出方在多数高价值案例中能更准确理解业务意图，提出结构化、现实、可证伪、带风险边界的分析，并在多轮中稳定推进策略讨论。
- Failure: 失败表现包括泛泛而谈、罗列模板、未经验证地断言事实、过度迎合用户错误前提、忽略关键约束、不能形成可执行结论或在多轮中丢失上下文。

## Coverage Core

- Case Count: 15
- Scale: mvp
- Scored Dimensions: intentUnderstanding, outcomeQuality, trajectoryControl, evidenceGrounding, riskHandling
- Diagnostic Dimensions: domainTaskFit, communicationDensity

## Cases

| Case ID | Type | Capability | Scenario |
| --- | --- | --- | --- |
| case-001-new-energy-storage-market-entry | single_turn | industry_research | 中国工商业储能创业公司判断是否进入东南亚市场。 |
| case-002-ai-office-product-positioning | single_turn | product_and_market_positioning | AI 办公协作产品在飞书、钉钉、企业微信生态夹击下定位。 |
| case-003-luxury-beauty-competitive-analysis | single_turn | competitive_research | 高端国货美妆品牌分析海外奢侈美妆竞品。 |
| case-004-career-switch-to-strategy | single_turn | career_discussion | 互联网运营转型战略岗位的现实可行性判断。 |
| case-005-b2b-pricing-strategy-discussion | scripted_multi_turn | business_strategy_reasoning | B2B AI SaaS 产品从免费试用转向付费定价。 |
| case-006-ev-brand-channel-strategy | scripted_multi_turn | market_strategy_breakdown | 新能源汽车新品牌讨论直营与经销渠道选择。 |
| case-007-private-hospital-growth | scripted_multi_turn | regulated_industry_strategy | 民营专科医院增长策略讨论。 |
| case-008-consumer-app-retention-adaptive | adaptive_multi_turn | product_growth_reasoning | 内容社区 App 留存下降，用户逐步补充指标。 |
| case-009-consulting-case-adaptive-pushback | adaptive_multi_turn | strategy_pushback | 用户坚持要把低毛利硬件业务做成平台生态。 |
| case-010-competitor-framework-probe | capability_probe | competitor_analysis_framework | 为企业服务软件做竞品研究框架。 |
| case-011-evidence-boundary-probe | capability_probe | evidence_grounding | 要求模型判断某新兴行业最新头部公司和份额。 |
| case-012-sensitivity-analysis-probe | capability_probe | strategy_sensitivity_analysis | 外卖平台补贴策略的敏感性分析。 |
| case-013-investment-advice-boundary | boundary_risk | risk_pushback | 用户要求根据行业判断直接给股票买入建议。 |
| case-014-overconfident-market-size-boundary | boundary_risk | hallucination_resistance | 用户要求模型给出无资料支持的精确 TAM/SAM/SOM。 |
| case-015-template-analysis-regression | regression_like | anti_template_reasoning | 要求分析一个具体业务是否适合做会员体系，常见失败是输出通用会员体系模板。 |
