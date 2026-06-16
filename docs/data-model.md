# Data Model

This document supersedes the earlier case-only model. The current MVP should be package-first: the Web App consumes a generated `RuntimeEvalPackage`, lets the user curate its cases, manually collects side-by-side outputs, and exports a report.

The canonical generated package schema lives in:

- `schemas/runtime-eval-package.schema.json`
- `schemas/eval-generation-critique.schema.json`

The first frontend fixture should be:

- `artifacts/eval-generation/20260607-restaurant-diandian-vs-doubao/revised-package.json`

## Product Surface

MVP target: local desktop Web App.

Reasoning:

- eval package review needs dense tables, JSON-ish fields, side-by-side comparison, long text areas, and report preview;
- manual collection requires copying prompts and pasting long Doubao/challenger outputs, which is much easier on desktop;
- local file storage and local provider integration fit desktop Web App better than mobile;
- mobile can be a future read-only/report review surface, not the MVP authoring surface.

## Core Objects

### RuntimeEvalPackage

The generated package is the central object.

```ts
type RuntimeEvalPackage = {
  arenaEvalSpec: ArenaEvalSpec;
  evalSetCoveragePlan: EvalSetCoveragePlan;
  evalCases: EvalCase[];
  turnScripts: TurnScript[];
  rubricSuggestions: RubricSuggestion[];
  reportSkeletonMetadata: ReportSkeletonMetadata;
  generationTrace: GenerationTrace;
  selfCritiqueTrace: SelfCritiqueTrace;
  confirmationBacklog: ConfirmationBacklogItem[];
};
```

The frontend should preserve unknown fields rather than dropping them. The schema and skill may evolve faster than the UI.

### ArenaEvalSpec

Shown in Setup / Package Overview.

Important fields:

- `taskSpace`
- `evaluationScenario`
- `decisionQuestion`
- `targetUsers`
- `baseline`
- `challenger`
- `successDefinition`
- `failureDefinition`
- `riskBoundaries`
- `knownUnknowns`
- `requiresUserConfirmation`
- `clarificationQuestions`

### EvalSetCoveragePlan

Shown in Package Overview / Coverage panel.

Important fields:

- `scoredDimensions`
- `diagnosticDimensions`
- `baselineInsightDimensions`
- `enabledDimensions`
- `disabledDimensions`
- `dimensionWeights`
- `scalePreset`
- `caseMix`
- `caseCountTarget`
- `taskFitModule`
- `coverageGaps`
- `confirmationBacklogRefs`

### EvalCase

Generated case objects are richer than the early MVP `EvalCase` idea.

```ts
type EvalCase = {
  caseId: string;
  caseType:
    | "single_turn"
    | "scripted_multi_turn"
    | "adaptive_multi_turn"
    | "capability_probe"
    | "boundary_risk"
    | "regression_like";
  capabilityCluster: string;
  scenarioArchetype: string;
  scenario: string;
  userPersona: string;
  userGoal: string;
  userFacingIntent: string;
  evaluatorIntent: string;
  hiddenIntent: string;
  constraints: string[];
  initialPrompt: string;
  modelFacingPrompt: string;
  collectionInstructions: string[];
  doNotRevealToModel: string[];
  expectedOutcome: string;
  acceptableOutcomes: string[];
  unacceptableOutcomes: string[];
  mustDo: string[];
  mustNotDo: string[];
  failureModesToProbe: string[];
  riskLevel: "low" | "medium" | "high";
  difficulty: "easy" | "medium" | "hard";
  discriminativeSignal: string;
  evidenceRequired: Record<string, unknown>;
  collectionMode:
    | "manual_single_prompt"
    | "manual_multi_turn"
    | "manual_with_visible_transcript"
    | "future_automated";
  estimatedUserEffort: "low" | "medium" | "high";
  graderRefs: string[];
  confirmationBacklogRefs: string[];
};
```

Frontend curation state should be stored separately from the generated package.

```ts
type CaseCurationState = {
  caseId: string;
  status: "draft" | "approved" | "rejected";
  editedCase?: EvalCase;
  reviewerNotes?: string;
  updatedAt: string;
};
```

### TurnScript

Used by the manual collection UI and future guarded simulator.

```ts
type TurnScript = {
  caseId: string;
  scriptMode: "fixed" | "guided_adaptive" | "hybrid";
  maxTurns: number;
  stateToTrack: string[];
  fairnessPolicy: string;
  doNotRevealToModel: string[];
  runtimeStateTemplate: RuntimeStateTemplate;
  harnessExecutionContract: HarnessExecutionContract;
  turns: ScriptTurn[];
  stopCondition: string;
  collectionBurden: "low" | "medium" | "high";
};
```

MVP behavior:

- run `manual_driver` only;
- show fixed/guided prompts and evaluator instructions;
- do not claim automated simulator safety;
- preserve transcript and notes.

### ScriptTurn

```ts
type ScriptTurn = {
  turnIndex: number;
  progressLabel: string;
  modelFacingUserMessage: string;
  evaluatorInstruction: string;
  intentionToPush: string;
  expectedStateAfterTurn: string;
  allowedAdaptiveMoves: string[];
  branchRules: BranchRule[];
  ifModelDrifts: string;
  ifModelAsksClarifyingQuestion: string;
  ifModelOverpromises: string;
  ifModelRefusesOrCannotAnswer: string;
};
```

### HarnessExecutionContract

Important for future automation, but mostly read-only in MVP.

```ts
type HarnessExecutionContract = {
  runtimeModelMode:
    | "manual_driver"
    | "llm_single_step_guarded"
    | "llm_two_stage_planner_drafter"
    | "future_automated";
  cursorOwner: "harness";
  sideBlind: boolean;
  decisionPolicy: "fixed_sequence" | "branch_rules_only";
  branchFallbackPolicy:
    | "not_applicable"
    | "allowed_adaptive_moves_or_needs_human_review";
  preSendValidation: string[];
  replayLogFields: string[];
  plannerDrafterSplit: "not_applicable" | "recommended" | "required";
  humanReviewFallbackRequired: boolean;
};
```

### RubricSuggestion

Rubrics are evaluator-facing handoff artifacts, not final graders.

Important fields:

- `dimensionId`
- `dimensionState`
- `appliesToCaseTypes`
- `appliesToCaseTags`
- `caseRefs`
- `weightSuggestion`
- `scoreAnchors`
- `positiveSignals`
- `negativeSignals`
- `redLineFailures`
- `judgePlan`
- `uncertaintyPolicy`
- `aggregationHint`

## App State

### ActiveProjectState

One active run only in MVP.

```ts
type ActiveProjectState = {
  activePackageId: string;
  packagePath: string;
  curation: Record<string, CaseCurationState>;
  run: RunState;
  report?: ReportSnapshot;
  updatedAt: string;
};
```

### RunState

```ts
type RunState = {
  id: string;
  packageId: string;
  status: "not_started" | "collecting" | "ready_for_review" | "reported";
  caseRuns: Record<string, CaseRunState>;
  createdAt: string;
  updatedAt: string;
};
```

### CaseRunState

```ts
type CaseRunState = {
  caseId: string;
  status: "not_started" | "collecting" | "complete" | "skipped";
  turnRuns: Record<string, TurnRunState>;
  manualReview?: ManualReview;
  caseNotes?: string;
};
```

### TurnRunState

```ts
type TurnRunState = {
  turnKey: string; // usually `${caseId}:${turnIndex}`
  caseId: string;
  turnIndex: number;
  promptSent: string;
  baselineOutput?: CollectedOutput;
  challengerOutput?: CollectedOutput;
  collectionNotes?: string;
  collectedAt?: string;
};
```

For single-turn cases, use `turnIndex=1` and `promptSent=evalCase.modelFacingPrompt`.

### CollectedOutput

```ts
type CollectedOutput = {
  finalOutput: string;
  visibleProcessNotes?: string;
  evidenceLevel: 0 | 1 | 2 | 3;
  copiedFrom?: "manual_paste";
  collectedAt: string;
};
```

### ManualReview

Temporary placeholder until final grader methodology exists.

```ts
type ManualReview = {
  winner?: "baseline" | "challenger" | "tie" | "unclear";
  rationale?: string;
  notableFailureModes?: string[];
  productImplication?: string;
  nextRecommendation?: string;
};
```

## File Conventions

Suggested MVP files:

```text
data/
  active-project.json
  packages/
    current.json
  runs/
    current.json
  reports/
    current.md
    current.html
  provider-runs/
    latest/
      input.json
      raw-output.txt
      normalized-package.json
      validation.json
      case-index.md
```

The existing `artifacts/eval-generation/...` folder can be used as a fixture source. Future generated packages can be copied or normalized into `data/packages/current.json`.

## MVP Cut Line

Must implement now:

- load a package fixture;
- validate package in local mode;
- render package overview;
- curate cases with approve/reject/edit;
- collect manual outputs;
- review SBS;
- export Markdown report.

Do not implement now:

- guarded LLM simulator;
- automatic grader;
- browser automation;
- historical run dashboard;
- mobile-native app.
