# SBS 4 Any Agent - Project Brief

Created: 2026-06-06

## Original User Description

The user is a China-based agent PM and wants to build a side-by-side comparison application for evaluating any two large models or AI agent products.

Core idea:

1. The user wants a side-by-side app for comparing arbitrary large models or agent products. As an agent PM, they believe many agent products only matter if they can beat the strongest baseline in their task space. For example, if a chatbot cannot beat Doubao in a chatbot task space, or a coding agent cannot beat Claude Code or Codex in coding-agent tasks, then the product may not be meaningful in that space because the market is winner-takes-all.
2. The app should let the user define:
   - the challenger, such as an AI product from a startup team;
   - the task space, such as shopping guide, programming, or a specific functional work domain;
   - the benchmark opponent, which should be callable locally at first. Initial benchmark targets are Doubao and Codex.
   Then the system should automate evaluation and compare performance.
3. Evaluation needs a test set, and also a semi-automated way to produce new, less generic eval sets for specific task spaces.
4. If full traces can be obtained, side-by-side comparison should include those traces. If full traces are not available, at least exposed traces, reasoning/thinking surfaces, and final outputs should be evaluated.
5. The final product should produce:
   - dimension-level graders that say which side is stronger;
   - a detailed evaluation report;
   - optimization suggestions for how to improve the weaker product or agent.

## My Restatement

We are building an evaluation workbench for agent PMs who need to answer a sharp product question:

> In a specific task space, does this challenger agent meaningfully beat the strongest available baseline?

The product should not be a generic leaderboard first. It should be a repeatable decision tool for comparing two concrete systems under a task-space-specific eval set, with enough trace and report detail to explain why one side wins and what should be improved.

The core loop is:

1. Define an evaluation arena:
   - task space;
   - challenger system;
   - baseline system;
   - allowed tools, data access, budget, latency constraints, and judging dimensions.
2. Build or select an eval set:
   - curated seed cases;
   - semi-automated generation for task-specific coverage;
   - review/dedup/filter steps to avoid generic or low-signal tasks.
3. Run both systems side by side:
   - same input;
   - controlled environment;
   - captured outputs;
   - captured traces where available;
   - metadata such as runtime, cost, retries, tool calls, and failure modes.
4. Grade results:
   - final answer quality;
   - task success;
   - trace quality or visible reasoning quality;
   - tool-use quality;
   - reliability;
   - latency/cost;
   - domain-specific dimensions.
5. Produce decision artifacts:
   - per-case comparison;
   - aggregate win rate and dimension scores;
   - report explaining strengths, weaknesses, and representative examples;
   - optimization suggestions.

## Current Product Direction

This project is a lightweight local SBS evaluation workbench. It is not a full benchmark platform, and it is not an automation-first runner.

The collection direction has shifted from pure manual paste toward local desktop-assisted capture. The product should not auto-send prompts into third-party products such as Doubao because that can trigger anti-bot verification and oversteps the intended black-box eval boundary. Instead, users operate external products in their real browser, while SBS provides prompt management, capture sessions, read-only current-page extraction, structured capture review, and local file persistence.

The next single-turn dots.ai capture spike is not being run merely to support dots.ai or to prove single-turn capture. It is a controlled rehearsal for a future automated website-capture adapter-builder skill: the important output is the reusable workflow, artifact contract, QA gate, and developer loop that can later adapt arbitrary web chatbot products.

That adapter-builder direction now has an initial local skill scaffold and QA gate. The critical validation rule is that a new website adapter is not considered ready merely because it produces JSON; it must pass a visible-evidence QA gate that checks turn scope, required visible fields, field separation, and pollution. Isolation regressions must avoid reading prior provider extractor code and compare against known-good captures only after the fresh run completes.

The first engineering slice of this direction adds an experimental Challenger-side website capture entry in Collect. It treats provider capture logic as reusable adapter templates. Built-in templates and future user-generated local templates should live in a registry so already-supported products can be reused rather than regenerated every time.

Important boundary: first-time website setup currently produces a local Codex adapter-template draft and QA/readiness report. It should not be treated as a guaranteed executable capture adapter for arbitrary websites until a concrete provider adapter or safe generic adapter runner exists. The product UI must keep manual paste as the fallback and only show simple automatic capture for ready executable templates.

The website-capture direction now needs a stronger split between:

1. a generic snapshot recon layer that collects broad, provider-agnostic visible evidence such as raw visible text, candidate message containers, markdown/rendered content blocks, buttons, anchors, turn-boundary candidates, and DOM summaries; and
2. an adapter/template layer that maps those observations into SBS fields.

The long-term goal is not to hardcode one selector set per website. It is to let Local Codex generate provider-specific recon hints and turn-boundary rules when the first snapshot is too weak, then rerun a refined snapshot pass before capture QA decides whether the provider is usable. Known providers such as Doubao, dots.ai, and DeepSeek may still keep built-in adapters, but the generic recon layer should make unseen websites reach a useful partial capture path instead of immediately failing.

The app is also being migrated from browser-only local Web App toward a local macOS desktop-assisted workbench. The current desktop development shell uses a native Swift/AppKit WKWebView wrapper around the existing Node/Web App, so the Web App remains the source of product UI while desktop-only helper capabilities can be added incrementally.

This project is also a portfolio artifact for Du Bowei's transition from recommendation / strategy PM to Agent PM. It should prove product judgment, task-space definition, eval-suite construction, baseline comparison, transcript/failure-mode analysis, and roadmap thinking.

The MVP should prove this loop:

1. Define a chatbot arena.
2. Generate structured eval set drafts for a task space.
3. Let a human edit, reject, or approve generated cases.
4. Collect Doubao and challenger outputs through manual paste or user-operated-browser assisted capture.
5. Review outputs side by side.
6. Download a report.

The grader/report direction is now framed as an evidence-grounded product judgment system rather than a generic LLM judge. It should first clean noisy collected evidence, then produce case-level SBS judgments, infer task-space capability patterns, and finally generate a PM-ready report. The report should combine quantified scoring with product judgment narrative, preserving uncertainty, red-line caveats, provider/capture limitations, and non-scored product insights.

The product shell now starts one layer above the eval package. Users should first create or open an evaluation task, then configure the arena and task space, then generate or import an eval package under that task. The fixed restaurant package is a development/demo fixture, not a primary user-facing action.

The most valuable part of the MVP is eval set generation: turning a task space into structured, editable, human-approved eval cases. The SBS workbench carries the loop around that capability.

The app now needs an explicit low-friction demo / decision layer above the internal workbench. The strongest product story is not the engineering pipeline itself, but:

> In a concrete task space, SBS can generate a systematic eval set, collect comparable outputs, and turn the evidence into a PM decision report against the strongest baseline.

The default Tasks page should therefore first show the philosophy, a featured guided run, and the system capabilities in plain product language. The existing Package / Cases / Collect / Review / Report workflow remains available as the advanced workbench for audit, continuation, and debugging.

## Scope Locked So Far

1. Product type: lightweight SBS evaluation workbench.
2. Runtime: local Web App plus local file storage, with a native macOS development shell for desktop-assisted workflows.
3. First arena type: chatbot.
4. Baseline: Doubao. It is treated as a strong chatbot-product ceiling with strong harness, memory, and tool-use behavior, but evaluated with chatbot-style eval cases.
5. Challenger: any product whose output can be manually pasted.
6. Eval set generation: Local Codex provider first, GPT API key provider second.
7. Human gate: generated eval cases are draft only until a human edits/approves them.
8. Collection: manual paste remains the universal fallback. The next MVP slice adds local desktop-assisted capture for supported web surfaces, starting with Doubao Web.
9. Automation boundary: SBS must not auto-send prompts or bypass verification in third-party products. Assisted capture is read-only after the user manually sends the prompt in their real browser.
10. Storage: local files, no account, no database, no cloud backend.
11. History: no historical run management in MVP; report download is required.
12. Grader/evaluation methodology: now being designed as a reusable `chatbot-sbs-grader` skill with two major workflows: evidence cleaning and grading/report generation.
13. Eval set generation has been promoted into a reusable chatbot eval-set generator skill. It outputs a structured runtime eval package, not only case prompts.
14. The first local skill implementation exists in `skills/chatbot-eval-set-generator/` and is installed to `/Users/bytedance/.codex/skills/chatbot-eval-set-generator/`. All seven reference files have completed first review. The next skill-side step is a restaurant recommendation regression run before integrating it into the web app.

## MVP User Flow

0. Evaluation Tasks
   - View existing evaluation tasks.
   - Create a new evaluation task through a large New Evaluation modal.
   - Continue an active task.
   - See task status, baseline, challenger, task space, and case count.

1. New Evaluation Modal
   - Enter task space.
   - Enter challenger name.
   - Baseline defaults to Doubao.
   - Choose product surface/access type such as Web chat or Mobile app.
   - Choose Local Codex or GPT API key for eval generation.
   - Choose whether generation can use project context.
   - After confirmation, enter the task execution flow.

2. Generate Eval Draft
   - Generate structured cases for the task space.
   - Cases may be single-turn or scripted multi-turn.
   - Each case includes draft rubric suggestions and failure mode candidates, but final grader methodology is deferred.
   - The Package page now supports two draft creation paths:
     - Local Codex generation through the `chatbot-eval-set-generator` skill, defaulting to 15 cases;
     - manual template import through an SBS-generated Excel-compatible XML workbook with separate sheets for case types.

3. Curate Eval Set
   - Edit generated cases.
   - Approve or reject each case.
   - Only approved cases enter the collection workflow.

4. Collect Outputs
   - Show one case/turn at a time.
   - For multi-turn cases, show progress such as `Case 3 / Turn 2 of 5`.
   - User copies the prompt into Doubao and challenger.
   - User sends prompts manually in the target products.
   - User either pastes each side's output or runs an assisted capture helper that reads the current browser page.
   - Assisted capture stores final answer, visible process/source/tool notes when exposed, Doubao search keywords, reference materials, risk notices, follow-up suggestions, raw visible text, URL, and optional screenshot artifacts.
   - For multi-turn cases, after both sides' previous-turn outputs are collected, the user may click `Local Model Reply` to call local Codex as a side-blind runtime user simulator. The app inserts the suggested next shared user message for human review; it does not send prompts automatically.
   - Store evidence level for each side.

5. Review SBS
   - Show outputs side by side.
   - Show turn-level and case-level notes.
   - Keep grader output as placeholder until the evaluation session defines it.

6. Download Report
   - Export Markdown and/or HTML.
   - Include arena metadata, eval set, outputs, evidence levels, review notes, and unresolved evaluation questions.

## Evidence Levels

- Level 0: final output only.
- Level 1: final output plus visible process, copied notes, or conversation logs.
- Level 2: tool calls, file changes, browser/execution logs when manually available.
- Level 3: complete auditable/replayable trace.

The MVP stores evidence level but does not require complete traces.

## Engineering Documents

See:

- `docs/context/agent-pm-transition-context.md`
- `docs/context/context-sync-bundle-index.md`
- `docs/product-spec.md`
- `docs/evaluation-framework.md`
- `docs/eval-generation-dev-plan.md`
- `docs/eval-set-generator-sprint.md`
- `docs/future-adversarial-meta-eval-critique.md`
- `docs/chatbot-eval-set-generator-skill-brief.md`
- `docs/chatbot-eval-set-generator-implementation-log.md`
- `docs/engineering-plan.md`
- `docs/mvp-sprint.md`
- `docs/data-model.md`
- `docs/desktop-app-migration-sprint.md`
- `docs/local-desktop-capture-sprint.md`
- `docs/website-capture-adapter-builder-sprint.md`
- `docs/grader/chatbot-sbs-grader-working-notes.md`
- `docs/grader/chatbot-sbs-grader-skill-brief.md`
- `docs/grader/chatbot-sbs-grader-sprint.md`
- `docs/grader/chatbot-sbs-grader-implementation-log.md`
- `docs/dev-diary.md`
- `docs/portfolio/portfolio-deliverables.md`
- `docs/portfolio/livecue-skill-agent-reference.md`
- `schemas/eval-case.schema.json`
- `schemas/runtime-eval-package.schema.json`
- `schemas/eval-generation-critique.schema.json`
- `skills/chatbot-eval-set-generator/SKILL.md`
- `skills/chatbot-website-capture-adapter-builder/SKILL.md`
- `skills/chatbot-sbs-grader/SKILL.md`

## Open Questions

1. What is the first official task space and seed eval set after the framework works?
2. What exact grader dimensions, weights, and failure taxonomy should chatbot SBS use?
3. What report standard is strong enough for the portfolio artifact?
4. How should Local Codex provider prompts be tuned?
5. How much context should Local Codex read by default for users other than this repo owner?
6. When should browser automation for Doubao be added?
7. When should the coding-agent arena begin?

## Working Principles

1. The product exists to support product decisions, not just to produce scores.
2. The strongest baseline should be fixed for the initial product type: Doubao for chatbot, Codex for coding agent later.
3. Eval sets must be task-space-specific enough to avoid shallow generic conclusions.
4. Generated eval cases are drafts; human approval is required.
5. Raw artifacts must be preserved so reports are auditable.
6. The system should support partial evidence gracefully.
7. Grading should explain evidence and suggestions, not silently replace PM judgment.
8. Eval generation must preserve structured outputs and self-critique traces so humans can inspect both the final eval set and the generator's reasoning quality.
9. If the user's evaluation goal includes target-audience, style, domain, or native-context fit, the eval package may reward useful fit as task value. If the goal does not imply it, the generator should not invent it.
10. Native-context advantage, such as Xiaohongshu content fit, should not excuse unsupported live facts, recency, source certainty, queue/booking, price, availability, safety, or verification claims.
11. Runtime eval package fields consumed by harnesses or grader builders should stay machine-matchable. For example, rubric `appliesToCaseTypes` uses only schema case type enums, while flexible task-space labels belong in `appliesToCaseTags`.
12. Trace preservation is a real artifact contract, not only prose. In debug/local-file mode, trace artifact refs must resolve to existing files beside the runtime package, and every generated package must include a human-readable `case-index.md`. In product mode, artifact refs may be store IDs or URLs, but the package must still include a case-index/audit-index artifact ref and the harness must resolve it.
13. Multi-turn automation is a harness contract, not a skill promise. The harness owns package/case/turn cursor, runtime simulation must be side-blind, branch-rule-driven, pre-send validated, and replay-logged. If the MVP only supports manual execution, multi-turn cases must be labeled as manual guided scripts rather than automated simulator runs.
14. Grading eligibility must be based on model-visible exposure, not guessed model knowledge. Each eval case should declare an `exposureContract` separating initial model-visible facts, evaluator-only context, hard scoring requirements, inference targets, non-scoring context, and fairness notes. Multi-turn scripts should declare `exposureDelta` per turn so the harness can track which facts became visible and reject unapproved new exposure from a runtime simulator.
15. Browser/product collection should be user-operated and read-only from the SBS side. The safe default is "human sends, helper captures." Capture helpers may read the active browser page, but should not type prompts, submit messages, or bypass verification.

## Current Implementation State And Next Likely Step

MVP shell progress:

1. [done] Scaffold local web app.
2. [done] Load the existing restaurant recommendation runtime eval package as the first fixture.
3. [done] Implement package-first local JSON file storage and validation.
4. [done] Implement package overview and eval case edit/approve flow.
5. [done] Implement manual output collection.
6. [partial] Implement Doubao web assisted capture for user-operated Chrome pages.
7. [partial] Implement local-model next-turn suggestion for multi-turn chatbot cases through a runtime user simulator skill and Codex CLI.
8. [partial] Implement report download; grader/report quality remains later work.
7. [done, needs real-page QA] Add local desktop-assisted capture for Doubao Web: capture session UI, local capture API, and Chrome current-tab helper.
8. [next] Test Doubao assisted capture on real pages, then improve extraction and permission guidance.
9. [partial, needs real generation QA] Add Local Codex package generation after the task setup loop works.
10. [partial] Add manual template download/upload for eval package import.
10. [later] A/B test current self-critique against adversarial meta-eval critique after the product/harness exists.
