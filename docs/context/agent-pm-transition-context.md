# Agent PM Transition Context

This project is part of Du Bowei's transition from recommendation / strategy product manager to Agent PM.

## User Positioning

Du Bowei's strongest native advantages:

- recommendation-system and strategy-product thinking;
- task-space definition;
- intent modeling;
- supply/value/ecosystem modeling;
- AB, badcase, and regression iteration instincts;
- TikTok LIVE / content ecosystem / supply strategy / music recommendation background;
- practical learning style grounded in artifacts, traces, evals, and source material.

The target is not to become a pure engineer. The target is to prove Agent PM competence through runnable artifacts and evaluation methodology.

## Portfolio Direction

The main portfolio project in this repo is:

> Agent Product SBS Eval Harness

Core thesis:

> If an agent or AI product cannot outperform strong product baselines in its chosen task space, it has little reason to exist. The product should first prove competitiveness through task-space SBS eval.

This project should prove that the user can:

- define an agent product problem;
- define a task space and task boundary;
- generate or curate an eval suite;
- compare agent products against strong baselines;
- distinguish black-box outcome/proxy evaluation from white-box trajectory evaluation;
- read transcripts and identify failure modes;
- convert eval findings into product roadmap;
- package a runnable demo, sample report, README, and resume story.

## Current SBS Project Direction

Current MVP direction, as decided in this repo:

- local Web App plus local file storage;
- chatbot arena first;
- Doubao as fixed chatbot-product ceiling;
- challenger output collected manually;
- eval set generation is the most valuable capability;
- Local Codex provider first, GPT API provider second;
- generated cases are drafts until human-approved;
- no browser automation in MVP;
- grader methodology deferred to a separate Steve 老师 session.

This repo's latest decision supersedes older bundle suggestions that recommended immediately choosing one task space and hand-building 20 cases. The updated MVP prioritizes the workbench and AI-assisted eval-set draft generation first; official task-space sets are important but come after the framework works.

## Evaluation Concepts Already Understood

Do not re-teach these from scratch unless the user asks:

- workflow vs agent;
- tool vs MCP vs skill;
- harness vs session vs sandbox;
- runtime rubric vs offline eval;
- pass@k vs pass^k;
- transcript vs trial;
- classifier see/not-see logic;
- context lifecycle;
- multi-agent conditions;
- skill progressive disclosure;
- tool invocation and harness exposure.

Useful aligned language:

- workflow = control theory / pre-designed flow;
- agent = action theory in uncertain environments;
- chatbot optimizes next response; agent optimizes next action;
- agent product evaluates task space, capability interface, context, harness, eval, permission, UX/trust;
- eval suite = tasks + harness + trials + traces + graders + metrics + maintenance loop.

## User Preferences

Prefer:

- practical mechanisms over abstract principles;
- concrete entities, inputs, outputs, intermediate artifacts;
- source-grounded notes;
- transcript and badcase-driven reasoning;
- separating source reconstruction from assistant commentary;
- concise but deep conceptual correction;
- portfolio-oriented outputs.

Avoid:

- generic AI product slogans;
- unsupported claims about hidden internals of closed products;
- pretending black-box eval reveals internal tool trajectory;
- compressing implementation details into vague frameworks.

## Privacy Boundary

The imported context bundle includes private ByteDance / TikTok LIVE context and resume materials.

Do not publish without explicit user approval:

- resume PDFs or compact resume;
- `feishu-digest/` private context;
- Feishu URLs;
- internal business details;
- private work-context examples.

The local `context-sync-bundle/` directory is intentionally ignored by git.
