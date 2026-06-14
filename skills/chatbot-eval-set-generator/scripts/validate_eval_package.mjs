#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
let validationMode = "local";
let filePath = "";

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === "--mode") {
    validationMode = args[i + 1] || "";
    i += 1;
  } else if (arg.startsWith("--mode=")) {
    validationMode = arg.slice("--mode=".length);
  } else if (!filePath) {
    filePath = arg;
  } else {
    console.error(`Unexpected argument: ${arg}`);
    process.exit(2);
  }
}

if (!filePath || !["local", "product"].includes(validationMode)) {
  console.error("Usage: validate_eval_package.mjs [--mode local|product] <runtime-eval-package.json>");
  process.exit(2);
}

const raw = fs.readFileSync(filePath, "utf8");
const pkg = JSON.parse(raw);
const packageDir = path.dirname(path.resolve(filePath));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaDir = path.resolve(__dirname, "../schemas");
const schemaCache = new Map();

function loadSchema(schemaPath) {
  const absolutePath = path.isAbsolute(schemaPath) ? schemaPath : path.join(schemaDir, schemaPath);
  if (!schemaCache.has(absolutePath)) {
    schemaCache.set(absolutePath, JSON.parse(fs.readFileSync(absolutePath, "utf8")));
  }
  return schemaCache.get(absolutePath);
}

function typeOf(value) {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  return typeof value;
}

function isType(value, expected) {
  if (expected === "array") return Array.isArray(value);
  if (expected === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
  if (expected === "integer") return Number.isInteger(value);
  if (expected === "number") return typeof value === "number" && Number.isFinite(value);
  return typeof value === expected;
}

function formatPath(parts) {
  if (!parts.length) return "$";
  return "$" + parts.map((part) => typeof part === "number" ? `[${part}]` : `.${part}`).join("");
}

function validateJsonSchema(schema, value, parts = [], errors = []) {
  if (schema.$ref) {
    const refSchema = loadSchema(schema.$ref);
    return validateJsonSchema(refSchema, value, parts, errors);
  }

  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${formatPath(parts)} must be one of ${schema.enum.map((x) => JSON.stringify(x)).join(", ")}`);
    return errors;
  }

  if (schema.type) {
    const expectedTypes = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!expectedTypes.some((expected) => isType(value, expected))) {
      errors.push(`${formatPath(parts)} must be ${expectedTypes.join(" or ")}; got ${typeOf(value)}`);
      return errors;
    }
  }

  if (typeof value === "string" && typeof schema.minLength === "number" && value.length < schema.minLength) {
    errors.push(`${formatPath(parts)} must have length >= ${schema.minLength}`);
  }

  if (typeof value === "number") {
    if (typeof schema.minimum === "number" && value < schema.minimum) {
      errors.push(`${formatPath(parts)} must be >= ${schema.minimum}`);
    }
    if (typeof schema.maximum === "number" && value > schema.maximum) {
      errors.push(`${formatPath(parts)} must be <= ${schema.maximum}`);
    }
  }

  if (Array.isArray(value)) {
    if (typeof schema.minItems === "number" && value.length < schema.minItems) {
      errors.push(`${formatPath(parts)} must contain at least ${schema.minItems} item(s)`);
    }
    if (schema.items) {
      value.forEach((item, index) => validateJsonSchema(schema.items, item, [...parts, index], errors));
    }
  }

  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    for (const key of schema.required || []) {
      if (!(key in value)) {
        errors.push(`${formatPath(parts)} missing required property: ${key}`);
      }
    }

    const properties = schema.properties || {};
    for (const [key, childSchema] of Object.entries(properties)) {
      if (key in value) {
        validateJsonSchema(childSchema, value[key], [...parts, key], errors);
      }
    }

    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in properties)) {
          errors.push(`${formatPath(parts)} has unexpected property: ${key}`);
        }
      }
    } else if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
      for (const [key, childValue] of Object.entries(value)) {
        if (!(key in properties)) {
          validateJsonSchema(schema.additionalProperties, childValue, [...parts, key], errors);
        }
      }
    }
  }

  return errors;
}

const schemaErrors = validateJsonSchema(loadSchema("runtime-eval-package.schema.json"), pkg).map((error) => `schema: ${error}`);
const consistencyErrors = [];
const warnings = [];

const requiredTopLevel = [
  "arenaEvalSpec",
  "evalSetCoveragePlan",
  "evalCases",
  "turnScripts",
  "rubricSuggestions",
  "reportSkeletonMetadata",
  "generationTrace",
  "selfCritiqueTrace",
  "confirmationBacklog"
];

for (const key of requiredTopLevel) {
  if (!(key in pkg)) consistencyErrors.push(`missing top-level component: ${key}`);
}

const cases = Array.isArray(pkg.evalCases) ? pkg.evalCases : [];
if (!cases.length) consistencyErrors.push("evalCases must contain at least one case");

const caseIds = new Set();
const casesById = new Map();
for (const c of cases) {
  if (!c.caseId) {
    consistencyErrors.push("case missing caseId");
    continue;
  }
  if (caseIds.has(c.caseId)) consistencyErrors.push(`duplicate caseId: ${c.caseId}`);
  caseIds.add(c.caseId);
  casesById.set(c.caseId, c);

  for (const field of ["expectedOutcome", "discriminativeSignal"]) {
    if (!c[field]) consistencyErrors.push(`case ${c.caseId} missing ${field}`);
  }
  if (!Array.isArray(c.failureModesToProbe) || c.failureModesToProbe.length === 0) {
    consistencyErrors.push(`case ${c.caseId} missing failureModesToProbe`);
  }
  if (!Array.isArray(c.graderRefs) || c.graderRefs.length === 0) {
    warnings.push(`case ${c.caseId} has no graderRefs`);
  }
  validateExposureContract(c);
}

const turnScripts = Array.isArray(pkg.turnScripts) ? pkg.turnScripts : [];
const turnScriptCaseIds = new Set(turnScripts.map((s) => s.caseId).filter(Boolean));
for (const script of turnScripts) {
  if (!caseIds.has(script.caseId)) {
    consistencyErrors.push(`turn script references unknown caseId: ${script.caseId}`);
  }
  if (!Array.isArray(script.turns) || script.turns.length === 0) {
    consistencyErrors.push(`turn script ${script.caseId} has no turns`);
    continue;
  }
  if (!script.runtimeStateTemplate) {
    consistencyErrors.push(`turn script ${script.caseId} missing runtimeStateTemplate`);
  } else if (!Array.isArray(script.runtimeStateTemplate.packageBindingFields)) {
    warnings.push(`turn script ${script.caseId} runtimeStateTemplate missing packageBindingFields`);
  }
  for (const turn of script.turns) {
    for (const field of [
      "ifModelDrifts",
      "ifModelAsksClarifyingQuestion",
      "ifModelRefusesOrCannotAnswer"
    ]) {
      if (!turn[field]) warnings.push(`turn script ${script.caseId} turn ${turn.turnIndex} missing ${field}`);
    }
  }
}

for (const c of cases) {
  if (["scripted_multi_turn", "adaptive_multi_turn"].includes(c.caseType) && !turnScriptCaseIds.has(c.caseId)) {
    consistencyErrors.push(`multi-turn case ${c.caseId} missing turn script`);
  }
}

const dimensions = new Set(pkg.evalSetCoveragePlan?.enabledDimensions || []);
const weights = pkg.evalSetCoveragePlan?.dimensionWeights || {};
const scoredDimensions = new Set(pkg.evalSetCoveragePlan?.scoredDimensions || []);
const diagnosticDimensions = new Set(pkg.evalSetCoveragePlan?.diagnosticDimensions || []);
const baselineInsightDimensions = new Set(pkg.evalSetCoveragePlan?.baselineInsightDimensions || []);
const disabledDimensions = new Set(pkg.evalSetCoveragePlan?.disabledDimensions || []);
const expectedEnabledDimensions = new Set([
  ...scoredDimensions,
  ...diagnosticDimensions,
  ...baselineInsightDimensions
]);

function sortedSetDifference(left, right) {
  return [...left].filter((item) => !right.has(item)).sort();
}

function missingArrayItems(actualArray, requiredArray) {
  const actual = new Set(Array.isArray(actualArray) ? actualArray : []);
  return requiredArray.filter((item) => !actual.has(item));
}

const requiredRuntimeInputFields = [
  "evalPackageId",
  "evalPackageVersion",
  "caseId",
  "currentTurnIndex",
  "sideLabel",
  "priorTurns",
  "lastModelResponse"
];
const requiredPreSendValidation = [
  "package_binding",
  "branch_rule_exists",
  "no_evaluator_leakage",
  "no_unapproved_exposure",
  "no_unapproved_constraints",
  "tracked_state_whitelist",
  "max_turns_stop_condition"
];
const requiredReplayLogFields = [
  "state_packet",
  "simulator_output",
  "validator_result",
  "final_user_message"
];

for (const script of turnScripts) {
  const template = script.runtimeStateTemplate || {};
  const templateFields = [
    ...(template.cursorFields || []),
    ...(template.packageBindingFields || []),
    ...(template.transcriptFields || [])
  ];
  const missingRuntimeFields = missingArrayItems(templateFields, requiredRuntimeInputFields);
  if (missingRuntimeFields.length) {
    consistencyErrors.push(`turn script ${script.caseId || "<unknown>"} runtimeStateTemplate missing required runtime fields: ${missingRuntimeFields.join(", ")}`);
  }

  const outputFields = template.outputFields || [];
  const missingOutputFields = missingArrayItems(outputFields, [
    "selectedAction",
    "selectedBranchRuleId",
    "modelFacingUserMessage",
    "updatedTrackedState",
    "shouldStop"
  ]);
  if (missingOutputFields.length) {
    consistencyErrors.push(`turn script ${script.caseId || "<unknown>"} runtimeStateTemplate.outputFields missing simulator output fields: ${missingOutputFields.join(", ")}`);
  }

  const contract = script.harnessExecutionContract || {};
  if (contract.cursorOwner !== "harness") {
    consistencyErrors.push(`turn script ${script.caseId || "<unknown>"} harnessExecutionContract.cursorOwner must be harness`);
  }
  if (contract.sideBlind !== true) {
    consistencyErrors.push(`turn script ${script.caseId || "<unknown>"} harnessExecutionContract.sideBlind must be true`);
  }
  const validDecisionPolicies = ["fixed_sequence", "branch_rules_only"];
  if (!validDecisionPolicies.includes(contract.decisionPolicy)) {
    consistencyErrors.push(`turn script ${script.caseId || "<unknown>"} harnessExecutionContract.decisionPolicy must be fixed_sequence or branch_rules_only`);
  }
  if (["guided_adaptive", "hybrid"].includes(script.scriptMode) && contract.decisionPolicy !== "branch_rules_only") {
    consistencyErrors.push(`turn script ${script.caseId || "<unknown>"} ${script.scriptMode} requires decisionPolicy=branch_rules_only`);
  }
  if (script.scriptMode === "fixed" && contract.decisionPolicy !== "fixed_sequence") {
    consistencyErrors.push(`turn script ${script.caseId || "<unknown>"} fixed scriptMode requires decisionPolicy=fixed_sequence`);
  }
  if (contract.decisionPolicy === "branch_rules_only" && contract.branchFallbackPolicy !== "allowed_adaptive_moves_or_needs_human_review") {
    consistencyErrors.push(`turn script ${script.caseId || "<unknown>"} branch_rules_only requires branchFallbackPolicy=allowed_adaptive_moves_or_needs_human_review`);
  }
  if (contract.decisionPolicy === "fixed_sequence" && contract.branchFallbackPolicy !== "not_applicable") {
    consistencyErrors.push(`turn script ${script.caseId || "<unknown>"} fixed_sequence requires branchFallbackPolicy=not_applicable`);
  }
  if (contract.humanReviewFallbackRequired !== true) {
    consistencyErrors.push(`turn script ${script.caseId || "<unknown>"} harnessExecutionContract.humanReviewFallbackRequired must be true`);
  }
  const requiredPreSend = contract.decisionPolicy === "fixed_sequence"
    ? requiredPreSendValidation.filter((check) => check !== "branch_rule_exists")
    : requiredPreSendValidation;
  const missingPreSend = missingArrayItems(contract.preSendValidation, requiredPreSend);
  if (missingPreSend.length) {
    consistencyErrors.push(`turn script ${script.caseId || "<unknown>"} harnessExecutionContract.preSendValidation missing checks: ${missingPreSend.join(", ")}`);
  }
  const missingReplayFields = missingArrayItems(contract.replayLogFields, requiredReplayLogFields);
  if (missingReplayFields.length) {
    consistencyErrors.push(`turn script ${script.caseId || "<unknown>"} harnessExecutionContract.replayLogFields missing fields: ${missingReplayFields.join(", ")}`);
  }
  if (contract.runtimeModelMode === "llm_two_stage_planner_drafter" && contract.plannerDrafterSplit !== "required") {
    consistencyErrors.push(`turn script ${script.caseId || "<unknown>"} two-stage runtime mode requires plannerDrafterSplit=required`);
  }
  if (contract.runtimeModelMode === "llm_single_step_guarded" && !["recommended", "not_applicable"].includes(contract.plannerDrafterSplit)) {
    consistencyErrors.push(`turn script ${script.caseId || "<unknown>"} single-step guarded runtime has invalid plannerDrafterSplit`);
  }

  for (const turn of script.turns || []) {
    if (!turn.exposureDelta) {
      consistencyErrors.push(`turn script ${script.caseId || "<unknown>"} turn ${turn.turnIndex} missing exposureDelta`);
    } else {
      for (const field of [
        "exposedFactsBeforeTurn",
        "newlyExposedFacts",
        "modelVisibleRequirementsAfterTurn",
        "allowedNewFactsToExpose"
      ]) {
        if (!Array.isArray(turn.exposureDelta[field])) {
          consistencyErrors.push(`turn script ${script.caseId || "<unknown>"} turn ${turn.turnIndex} exposureDelta.${field} must be an array`);
        }
      }
    }
    const branchIds = new Set();
    for (const rule of turn.branchRules || []) {
      if (!rule.branchRuleId) {
        consistencyErrors.push(`turn script ${script.caseId || "<unknown>"} turn ${turn.turnIndex} has branch rule without branchRuleId`);
        continue;
      }
      if (branchIds.has(rule.branchRuleId)) {
        consistencyErrors.push(`turn script ${script.caseId || "<unknown>"} turn ${turn.turnIndex} has duplicate branchRuleId: ${rule.branchRuleId}`);
      }
      branchIds.add(rule.branchRuleId);
    }
  }
}

function validateExposureContract(c) {
  const contract = c.exposureContract;
  if (!contract || typeof contract !== "object" || Array.isArray(contract)) {
    consistencyErrors.push(`case ${c.caseId} missing exposureContract`);
    return;
  }
  for (const field of [
    "modelVisibleFactsAtStart",
    "evaluatorOnlyFacts",
    "hardScoringRequirements",
    "inferenceTargets",
    "nonScoringContext"
  ]) {
    if (!Array.isArray(contract[field])) {
      consistencyErrors.push(`case ${c.caseId} exposureContract.${field} must be an array`);
    }
  }
  if (typeof contract.fairnessNotes !== "string" || !contract.fairnessNotes.trim()) {
    consistencyErrors.push(`case ${c.caseId} exposureContract.fairnessNotes must be a non-empty string`);
  }

  const allowedSources = new Set([
    "model_facing_prompt",
    "turn_exposed_fact",
    "reasonable_inference",
    "general_safety_norm"
  ]);
  for (const [index, requirement] of (contract.hardScoringRequirements || []).entries()) {
    if (!requirement || typeof requirement !== "object" || Array.isArray(requirement)) {
      consistencyErrors.push(`case ${c.caseId} exposureContract.hardScoringRequirements[${index}] must be an object`);
      continue;
    }
    if (!requirement.requirement) {
      consistencyErrors.push(`case ${c.caseId} exposureContract.hardScoringRequirements[${index}] missing requirement`);
    }
    if (!allowedSources.has(requirement.source)) {
      consistencyErrors.push(`case ${c.caseId} exposureContract.hardScoringRequirements[${index}] has invalid source`);
    }
    if (!Number.isInteger(requirement.eligibleFromTurn) || requirement.eligibleFromTurn < 1) {
      consistencyErrors.push(`case ${c.caseId} exposureContract.hardScoringRequirements[${index}] eligibleFromTurn must be an integer >= 1`);
    }
    if (c.caseType === "single_turn" && requirement.source === "turn_exposed_fact") {
      consistencyErrors.push(`case ${c.caseId} single_turn hard scoring requirement cannot use source=turn_exposed_fact`);
    }
    if (c.caseType === "single_turn" && requirement.eligibleFromTurn !== 1) {
      consistencyErrors.push(`case ${c.caseId} single_turn hard scoring requirement must be eligibleFromTurn=1`);
    }
  }
}

function validateArtifactRefs(componentName, refs) {
  if (!Array.isArray(refs)) {
    consistencyErrors.push(`${componentName} must be an array`);
    return [];
  }

  const normalizedRefs = [];
  for (const ref of refs) {
    if (typeof ref !== "string" || ref.trim() === "") {
      consistencyErrors.push(`${componentName} contains a non-empty-string violation`);
      continue;
    }
    if (validationMode === "product") {
      normalizedRefs.push(ref);
      continue;
    }
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(ref)) {
      consistencyErrors.push(`${componentName} artifact ref must be a local relative path, got URI-like ref: ${ref}`);
      continue;
    }
    if (path.isAbsolute(ref)) {
      consistencyErrors.push(`${componentName} artifact ref must be relative to the package directory, got absolute path: ${ref}`);
      continue;
    }

    const resolved = path.resolve(packageDir, ref);
    const relative = path.relative(packageDir, resolved);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      consistencyErrors.push(`${componentName} artifact ref escapes package directory: ${ref}`);
      continue;
    }
    if (!fs.existsSync(resolved)) {
      consistencyErrors.push(`${componentName} artifact ref does not exist: ${ref}`);
      continue;
    }
    if (!fs.statSync(resolved).isFile()) {
      consistencyErrors.push(`${componentName} artifact ref is not a file: ${ref}`);
      continue;
    }
    normalizedRefs.push(ref);
  }

  return normalizedRefs;
}

function isCaseIndexArtifactRef(ref) {
  const normalized = String(ref).toLowerCase();
  if (validationMode === "local") {
    return path.basename(ref) === "case-index.md";
  }
  return /case[-_]?index|audit[-_]?index|caseindex/.test(normalized);
}

const missingEnabledDimensions = sortedSetDifference(expectedEnabledDimensions, dimensions);
const extraEnabledDimensions = sortedSetDifference(dimensions, expectedEnabledDimensions);
if (missingEnabledDimensions.length) {
  consistencyErrors.push(`enabledDimensions missing dimensions from scored/diagnostic/baselineInsight sets: ${missingEnabledDimensions.join(", ")}`);
}
if (extraEnabledDimensions.length) {
  consistencyErrors.push(`enabledDimensions contains dimensions not in scored/diagnostic/baselineInsight sets: ${extraEnabledDimensions.join(", ")}`);
}

for (const [leftName, leftSet, rightName, rightSet] of [
  ["scoredDimensions", scoredDimensions, "diagnosticDimensions", diagnosticDimensions],
  ["scoredDimensions", scoredDimensions, "baselineInsightDimensions", baselineInsightDimensions],
  ["diagnosticDimensions", diagnosticDimensions, "baselineInsightDimensions", baselineInsightDimensions],
  ["enabledDimensions", dimensions, "disabledDimensions", disabledDimensions],
  ["scoredDimensions", scoredDimensions, "disabledDimensions", disabledDimensions],
  ["diagnosticDimensions", diagnosticDimensions, "disabledDimensions", disabledDimensions],
  ["baselineInsightDimensions", baselineInsightDimensions, "disabledDimensions", disabledDimensions]
]) {
  const overlap = [...leftSet].filter((item) => rightSet.has(item)).sort();
  if (overlap.length) {
    consistencyErrors.push(`${leftName} overlaps with ${rightName}: ${overlap.join(", ")}`);
  }
}

for (const [dimension, weight] of Object.entries(weights)) {
  if (typeof weight !== "number" || weight < 0 || weight > 1) {
    consistencyErrors.push(`dimension weight out of bounds: ${dimension}`);
  }
  if (!scoredDimensions.has(dimension)) {
    consistencyErrors.push(`dimensionWeights includes non-scored dimension: ${dimension}`);
  }
}

for (const dimension of scoredDimensions) {
  if (!(dimension in weights)) {
    consistencyErrors.push(`scored dimension missing weight: ${dimension}`);
  }
}

const scoredWeightSum = [...scoredDimensions].reduce((sum, dimension) => sum + (typeof weights[dimension] === "number" ? weights[dimension] : 0), 0);
if (scoredDimensions.size > 0 && Math.abs(scoredWeightSum - 1) > 0.000001) {
  consistencyErrors.push(`dimensionWeights for scoredDimensions must sum to 1; got ${Number(scoredWeightSum.toFixed(6))}`);
}

const taskFitModule = pkg.evalSetCoveragePlan?.taskFitModule;
const productExperienceDisabled = disabledDimensions.has("productExperience");
if (taskFitModule) {
  const taskFitActive = !["disabled", "baseline_insight_only"].includes(taskFitModule.status);
  if (taskFitActive && productExperienceDisabled && taskFitModule.relationshipToProductExperience !== "task_value_not_product_experience") {
    consistencyErrors.push("taskFitModule is active while productExperience is disabled; relationshipToProductExperience must be task_value_not_product_experience");
  }
  if (taskFitActive && (!Array.isArray(taskFitModule.scoredThroughDimensions) || taskFitModule.scoredThroughDimensions.length === 0)) {
    consistencyErrors.push("active taskFitModule must declare scoredThroughDimensions");
  }
  for (const dimension of taskFitModule.scoredThroughDimensions || []) {
    if (!dimensions.has(dimension)) {
      consistencyErrors.push(`taskFitModule scoredThroughDimensions references disabled or unknown dimension: ${dimension}`);
    }
    if (dimension === "productExperience" && productExperienceDisabled) {
      consistencyErrors.push("taskFitModule cannot score through productExperience when productExperience is disabled");
    }
  }
  if (taskFitActive && !taskFitModule.rewardPolicy) {
    warnings.push("active taskFitModule should include rewardPolicy");
  }
  if (taskFitActive && !taskFitModule.penaltyPolicy) {
    warnings.push("active taskFitModule should include penaltyPolicy");
  }
}

for (const rubric of pkg.rubricSuggestions || []) {
  if (rubric.dimensionId && dimensions.size && !dimensions.has(rubric.dimensionId)) {
    warnings.push(`rubric dimension not in enabledDimensions: ${rubric.dimensionId}`);
  }
  if (!["scored", "diagnostic_only", "baseline_insight_only", "disabled"].includes(rubric.dimensionState)) {
    consistencyErrors.push(`rubric ${rubric.dimensionId || "<unknown>"} has invalid dimensionState`);
  }
  if (rubric.dimensionState !== "scored" && rubric.weightSuggestion > 0) {
    warnings.push(`rubric ${rubric.dimensionId} is ${rubric.dimensionState} but has positive weightSuggestion`);
  }
  if (rubric.dimensionState === "scored" && rubric.weightSuggestion === 0) {
    warnings.push(`scored rubric ${rubric.dimensionId} has zero weightSuggestion`);
  }
  for (const caseRef of rubric.caseRefs || []) {
    if (!caseIds.has(caseRef)) {
      consistencyErrors.push(`rubric ${rubric.dimensionId || "<unknown>"} references unknown caseId: ${caseRef}`);
    }
  }
  const referencedCaseTypes = new Set(
    (rubric.caseRefs || [])
      .map((caseRef) => casesById.get(caseRef)?.caseType)
      .filter(Boolean)
  );
  const declaredCaseTypes = new Set(rubric.appliesToCaseTypes || []);
  const missingReferencedCaseTypes = sortedSetDifference(referencedCaseTypes, declaredCaseTypes);
  const extraDeclaredCaseTypes = sortedSetDifference(declaredCaseTypes, referencedCaseTypes);
  if (missingReferencedCaseTypes.length) {
    consistencyErrors.push(`rubric ${rubric.dimensionId || "<unknown>"} appliesToCaseTypes missing referenced case types: ${missingReferencedCaseTypes.join(", ")}`);
  }
  if (extraDeclaredCaseTypes.length) {
    consistencyErrors.push(`rubric ${rubric.dimensionId || "<unknown>"} appliesToCaseTypes includes case types not present in caseRefs: ${extraDeclaredCaseTypes.join(", ")}`);
  }
  for (const failure of rubric.redLineFailures || []) {
    if (typeof failure !== "object" || failure === null) {
      consistencyErrors.push(`rubric ${rubric.dimensionId || "<unknown>"} has non-object redLineFailure`);
      continue;
    }
    if (typeof failure.scoreCap !== "number") {
      consistencyErrors.push(`rubric ${rubric.dimensionId || "<unknown>"} redLineFailure ${failure.failureId || "<unknown>"} missing numeric scoreCap`);
    }
  }
  const humanSampling = String(rubric.judgePlan?.humanSamplingRecommendation || "").toLowerCase();
  const saysOptional = /(not required|optional|advisory|recommended|suggested|not mandatory)/.test(humanSampling);
  if (!saysOptional && /(must|required|mandatory|block|gate)/.test(humanSampling)) {
    warnings.push(`rubric ${rubric.dimensionId || "<unknown>"} humanSamplingRecommendation may be too strong; human sampling should be advisory`);
  }
}

if (pkg.arenaEvalSpec?.requiresUserConfirmation) {
  const qs = pkg.arenaEvalSpec?.clarificationQuestions;
  if (!Array.isArray(qs) || qs.length === 0) {
    consistencyErrors.push("arenaEvalSpec requires user confirmation but has no clarificationQuestions");
  }
}

const backlog = Array.isArray(pkg.confirmationBacklog) ? pkg.confirmationBacklog : null;
if (!backlog) {
  consistencyErrors.push("confirmationBacklog must be an array");
} else {
  for (const item of backlog) {
    if (!item.id) consistencyErrors.push("confirmationBacklog item missing id");
    if (!item.component) consistencyErrors.push(`confirmationBacklog item ${item.id || "<unknown>"} missing component`);
    if (!item.question) consistencyErrors.push(`confirmationBacklog item ${item.id || "<unknown>"} missing question`);
    if (item.blocksEvalRun === true && item.status === "skipped") {
      warnings.push(`blocking confirmation item skipped: ${item.id}`);
    }
  }
}

const findings = pkg.selfCritiqueTrace?.findings;
if (!Array.isArray(findings)) {
  consistencyErrors.push("selfCritiqueTrace.findings must be an array");
}
const qualityGateResults = pkg.selfCritiqueTrace?.qualityGateResults;
if (!qualityGateResults || typeof qualityGateResults !== "object") {
  consistencyErrors.push("selfCritiqueTrace.qualityGateResults must be an object");
} else {
  for (const [gate, result] of Object.entries(qualityGateResults)) {
    if (!["pass", "warn", "fail", "not_applicable"].includes(result?.status)) {
      consistencyErrors.push(`selfCritiqueTrace quality gate ${gate} has invalid status`);
    }
    if (!result?.reason) {
      warnings.push(`selfCritiqueTrace quality gate ${gate} missing reason`);
    }
  }
}
const readiness = pkg.selfCritiqueTrace?.overallReadiness;
if (!["ready_to_run", "ready_with_caveats", "needs_user_confirmation", "blocked"].includes(readiness)) {
  consistencyErrors.push("selfCritiqueTrace.overallReadiness has invalid value");
}
if (readiness === "blocked") {
  warnings.push("selfCritiqueTrace.overallReadiness is blocked; do not start collection until resolved");
}
const backlogIds = new Set((pkg.confirmationBacklog || []).map((item) => item.id).filter(Boolean));
for (const ref of pkg.selfCritiqueTrace?.unresolvedConfirmationBacklogRefs || []) {
  if (!backlogIds.has(ref)) {
    consistencyErrors.push(`selfCritiqueTrace references unknown confirmationBacklog item: ${ref}`);
  }
}
if (!Array.isArray(pkg.selfCritiqueTrace?.revisionPasses)) {
  consistencyErrors.push("selfCritiqueTrace.revisionPasses must be an array");
}
if (!Array.isArray(pkg.selfCritiqueTrace?.traceArtifactRefs)) {
  consistencyErrors.push("selfCritiqueTrace.traceArtifactRefs must be an array");
}

const generationArtifactRefs = validateArtifactRefs("generationTrace.artifactRefs", pkg.generationTrace?.artifactRefs);
const selfCritiqueArtifactRefs = validateArtifactRefs("selfCritiqueTrace.traceArtifactRefs", pkg.selfCritiqueTrace?.traceArtifactRefs);
const allTraceArtifactRefs = [...generationArtifactRefs, ...selfCritiqueArtifactRefs];
if (!allTraceArtifactRefs.some((ref) => isCaseIndexArtifactRef(ref))) {
  consistencyErrors.push(validationMode === "local"
    ? "trace artifacts must include case-index.md in generationTrace.artifactRefs or selfCritiqueTrace.traceArtifactRefs"
    : "trace artifacts must include a case-index/audit-index artifact ref in generationTrace.artifactRefs or selfCritiqueTrace.traceArtifactRefs");
}

const errors = [...schemaErrors, ...consistencyErrors];
const result = {
  ok: errors.length === 0,
  errors,
  schemaErrors,
  consistencyErrors,
  warnings,
  stats: {
    caseCount: cases.length,
    turnScriptCount: turnScripts.length,
    rubricCount: Array.isArray(pkg.rubricSuggestions) ? pkg.rubricSuggestions.length : 0,
    validationMode
  }
};

console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
