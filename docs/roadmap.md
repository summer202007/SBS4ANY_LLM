# Roadmap

SBS 4 Any Agent should grow from a strong chatbot SBS workbench into a broader agent evaluation system. The public story should stay honest about what exists today.

## v0.1: Chatbot SBS Workbench

Goal: make the local chatbot evaluation loop clear, usable, and easy to inspect.

Focus:

- GitHub-ready README and examples.
- Task-space eval package generation.
- Human curation flow.
- Manual collection and read-only assisted capture.
- Evidence-grounded grader reports.
- Sample report that proves the product decision workflow.

## v0.2: Adapter Ecosystem

Goal: make capture support extensible without turning SBS into an automation bot.

Focus:

- Windows app packaging and smoke testing;
- provider adapter registry;
- adapter QA gates;
- visible-evidence field mapping;
- reusable provider templates;
- clearer manual fallback UX;
- examples for multiple chatbot products.

## v0.3: Stronger Grader Calibration

Goal: improve confidence in task-space verdicts.

Focus:

- stronger human review workflow;
- repeated-trial support;
- case weighting and sensitivity analysis;
- red-line policy calibration;
- report comparison across runs.

## v0.4: Any-Agent Arenas

Goal: extend the SBS pattern beyond chatbots.

Candidate arenas:

- coding agents;
- local coding-agent automation engines;
- research agents;
- workflow/browser agents;
- document agents;
- data analysis agents.

Each new arena should define its own:

- task-space contract;
- evidence model;
- capture or trace adapter;
- grader dimensions;
- report standard.

## Longer-Term Product Directions

- Report templates for different decision styles, such as PM memo, technical audit, and leadership summary.
- Run-to-run comparison so teams can see whether product or prompt changes improved the verdict.
- Reproducible benchmark bundles that package eval cases, evidence, grader settings, and reports.
- More public task-space examples beyond the current job-interview showcase.
- Team sharing and review workflows for approving cases, challenging evidence, and signing off on reports.

## Non-Goals For The First Public Release

- Cloud backend.
- Account system.
- Universal model marketplace.
- Fully automated third-party product runners.
- Claims of statistically calibrated benchmark scores.

The first release should win by being clear, inspectable, and useful for product judgment.
