import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");
const simulatorSkillPath = path.join(rootDir, "skills", "chatbot-runtime-user-simulator", "SKILL.md");
const simulatorOutputSchemaPath = path.join(
  rootDir,
  "skills",
  "chatbot-runtime-user-simulator",
  "schemas",
  "simulator-output.schema.json",
);

export function buildTurnExecutionState({
  runtimePackage,
  activeProject,
  run,
  caseId,
  currentTurnIndex,
  sideLabel,
  priorTurns = [],
  lastModelResponse = "",
  trackedState = {},
  trajectoryNotesSoFar = "",
}) {
  if (!runtimePackage) throw new Error("runtimePackage is required.");
  const evalCase = (runtimePackage.evalCases || []).find((item) => item.caseId === caseId);
  const turnScript = (runtimePackage.turnScripts || []).find((item) => item.caseId === caseId);
  if (!evalCase) throw new Error(`Unknown caseId: ${caseId}`);
  if (!turnScript) throw new Error(`No turnScript for caseId: ${caseId}`);

  const safeSideLabel = sideLabel === "Side B" ? "Side B" : "Side A";
  const scriptTurns = turnScript.turns || [];
  const plannedMaxTurns = Number(turnScript.maxTurns || scriptTurns.length || 1);
  const isHumanRequestedExtraTurn = currentTurnIndex > plannedMaxTurns;
  const scriptTurn =
    scriptTurns.find((turn) => turn.turnIndex === currentTurnIndex) ||
    (isHumanRequestedExtraTurn ? scriptTurns[scriptTurns.length - 1] : scriptTurns[0]);
  if (!scriptTurn) throw new Error(`No script turn for caseId: ${caseId}`);

  const caseIndex = (runtimePackage.evalCases || []).findIndex((item) => item.caseId === caseId) + 1;
  const packageVersion = activeProject?.packageVersion || run?.packageVersion || "v1";

  return {
    evalPackageId: activeProject?.packageId || run?.packageId || "current-runtime-eval-package",
    evalPackageVersion: packageVersion,
    evalRunId: run?.runId || "draft-run",
    caseIndex,
    caseCount: (runtimePackage.evalCases || []).length,
    caseId,
    caseType: evalCase.caseType,
    scriptMode: turnScript.scriptMode,
    sideLabel: safeSideLabel,
    currentTurnIndex,
    maxTurns: turnScript.maxTurns,
    plannedMaxTurns,
    isHumanRequestedExtraTurn,
    extraTurnPolicy: isHumanRequestedExtraTurn
      ? "The human evaluator explicitly added this turn beyond the planned maxTurns. Treat maxTurns and stopCondition as guidance, not a hard stop. Generate a useful follow-up if prior outputs still need clarification, correction, constraint pressure, or convergence; return shouldStop=true only if another user message would not improve the evaluation."
      : "",
    progressLabel: isHumanRequestedExtraTurn
      ? `Case ${caseIndex} of ${(runtimePackage.evalCases || []).length} / Extra turn ${currentTurnIndex} after planned ${plannedMaxTurns}`
      : `Case ${caseIndex} of ${(runtimePackage.evalCases || []).length} / Turn ${currentTurnIndex} of ${plannedMaxTurns}`,
    arenaSummary: summarizeArena(runtimePackage.arenaEvalSpec),
    coverageSummary: summarizeCoverage(runtimePackage.evalSetCoveragePlan),
    caseSummary: summarizeCase(evalCase),
    userFacingIntent: evalCase.userFacingIntent,
    evaluatorIntent: evalCase.evaluatorIntent,
    hiddenIntent: evalCase.hiddenIntent,
    stateToTrack: turnScript.stateToTrack || [],
    trackedState,
    priorTurns,
    lastModelResponse,
    latestSideResponses: getLatestSideResponses(priorTurns, lastModelResponse),
    currentScriptTurn: redactScriptTurnForRuntime(scriptTurn),
    availableBranchRules: scriptTurn.branchRules || [],
    allowedAdaptiveMoves: scriptTurn.allowedAdaptiveMoves || [],
    exposureContract: evalCase.exposureContract,
    exposedFactsSoFar: buildExposedFactsSoFar(evalCase, turnScript, currentTurnIndex, priorTurns),
    currentTurnExposureDelta: redactExposureDeltaForRuntime(scriptTurn.exposureDelta),
    doNotRevealToModel: [...(evalCase.doNotRevealToModel || []), ...(turnScript.doNotRevealToModel || [])],
    mustDo: evalCase.mustDo || [],
    mustNotDo: evalCase.mustNotDo || [],
    failureModesToProbe: evalCase.failureModesToProbe || [],
    stopCondition: turnScript.stopCondition,
    harnessExecutionContract: turnScript.harnessExecutionContract,
    trajectoryNotesSoFar,
  };
}

export function buildSimulatorPrompt(turnExecutionState) {
  return [
    "Use the repo-local chatbot-runtime-user-simulator skill.",
    `Skill path: ${simulatorSkillPath}`,
    "You are the side-blind runtime user simulator for a chatbot SBS eval.",
    "Use only the provided turnExecutionState. Do not rely on memory or unrelated project context.",
    "Do not invent a new case, change the evaluation goal, or reveal evaluator-only information.",
    "The SBS app will show your suggestion to a human; it will not be auto-sent.",
    "Important: Local Model Reply is not a fixed script executor. The state packet intentionally omits any prewritten fixed-sequence user wording. Generate the next message from prior outputs, branch rules, adaptive moves, and the current turn's intention/constraint targets.",
    "If isHumanRequestedExtraTurn is true, the human evaluator has intentionally asked for another turn beyond the planned script. Do not stop merely because maxTurns or the original stopCondition was reached. Prefer drafting a concise, fair shared follow-up when it can still reveal meaningful differences between the two sides.",
    "Do not return selectedAction=fixed_sequence.",
    "Return strict JSON with: caseId, currentTurnIndex, evalPackageVersion, selectedAction, selectedBranchRuleId, modelFacingUserMessage, evaluatorNote, newlyExposedFacts, updatedTrackedState, shouldStop, stopReason, trajectoryNotes.",
    "",
    "turnExecutionState:",
    JSON.stringify(turnExecutionState, null, 2),
  ].join("\n");
}

export async function suggestNextUserTurnWithLocalCodex(turnExecutionState) {
  const prompt = buildSimulatorPrompt(turnExecutionState);
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "sbs-simulator-"));
  const outputPath = path.join(tempDir, "simulator-output.json");
  const stdoutPath = path.join(tempDir, "stdout.txt");
  const stderrPath = path.join(tempDir, "stderr.txt");
  const codexPath = process.env.SBS_CODEX_PATH || "/Applications/Codex.app/Contents/Resources/codex";
  const args = [
    "exec",
    "--cd",
    rootDir,
    "--sandbox",
    "read-only",
    "--output-schema",
    simulatorOutputSchemaPath,
    "--output-last-message",
    outputPath,
    "-",
  ];
  const { stdout, stderr } = await runCodex(codexPath, args, prompt, 90000);
  await writeFile(stdoutPath, stdout, "utf8");
  await writeFile(stderrPath, stderr, "utf8");
  const rawLastMessage = await readFile(outputPath, "utf8");
  const output = parseSimulatorJson(rawLastMessage);
  const validatorResult = validateSimulatorOutput(output, turnExecutionState);
  return {
    prompt,
    output,
    rawLastMessage,
    stdout,
    stderr,
    artifactRefs: [outputPath, stdoutPath, stderrPath],
    validatorResult,
  };
}

export function validateSimulatorOutput(output, turnExecutionState) {
  const errors = [];
  if (!output || typeof output !== "object") {
    return { ok: false, errors: ["Simulator output must be an object."] };
  }
  if (output.caseId !== turnExecutionState.caseId) errors.push("caseId mismatch");
  if (output.currentTurnIndex !== turnExecutionState.currentTurnIndex) {
    errors.push("currentTurnIndex mismatch");
  }
  if (output.evalPackageVersion !== turnExecutionState.evalPackageVersion) {
    errors.push("evalPackageVersion mismatch");
  }
  const branchId = output.selectedBranchRuleId;
  const branchExists = (turnExecutionState.availableBranchRules || []).some(
    (rule) => rule.branchRuleId === branchId,
  );
  const isStopAction = output.shouldStop || output.selectedAction === "stop";
  if (!isStopAction && branchId && !branchExists) errors.push("selectedBranchRuleId does not exist");
  if (output.selectedAction === "fixed_sequence") {
    errors.push("fixed_sequence is reserved for manual script playback and is not allowed for Local Model Reply");
  }
  if (!output.shouldStop && !String(output.modelFacingUserMessage || "").trim()) {
    errors.push("modelFacingUserMessage is required unless shouldStop is true");
  }
  const leaked = findEvaluatorLeakage(output.modelFacingUserMessage || "", turnExecutionState);
  if (leaked.length) errors.push(`possible evaluator leakage: ${leaked.join(", ")}`);
  const unapprovedExposure = findUnapprovedExposure(
    output.newlyExposedFacts || [],
    turnExecutionState,
    branchId,
    output.modelFacingUserMessage || "",
  );
  if (unapprovedExposure.length) {
    errors.push(`unapproved newlyExposedFacts: ${unapprovedExposure.join(", ")}`);
  }
  return { ok: errors.length === 0, errors };
}

function redactScriptTurnForRuntime(scriptTurn = {}) {
  const {
    modelFacingUserMessage,
    exposureDelta,
    branchRules,
    ...rest
  } = scriptTurn || {};
  return {
    ...rest,
    hasPrewrittenModelFacingUserMessage: Boolean(String(modelFacingUserMessage || "").trim()),
    prewrittenMessagePolicy: "withheld_from_runtime_simulator",
    branchRules: (branchRules || []).map((rule) => ({ ...rule })),
    exposureDelta: redactExposureDeltaForRuntime(exposureDelta),
  };
}

function redactExposureDeltaForRuntime(exposureDelta = {}) {
  if (!exposureDelta || typeof exposureDelta !== "object") return exposureDelta;
  const redacted = { ...exposureDelta };
  if (Array.isArray(redacted.newlyExposedFacts)) {
    redacted.newlyExposedFacts = redacted.newlyExposedFacts.map((fact) =>
      redactPrewrittenUserMessageFact(fact),
    );
  }
  if (Array.isArray(redacted.allowedNewFactsToExpose)) {
    redacted.allowedNewFactsToExpose = redacted.allowedNewFactsToExpose.map((fact) =>
      redactPrewrittenUserMessageFact(fact),
    );
  }
  return redacted;
}

function redactPrewrittenUserMessageFact(value) {
  const text = String(value || "");
  if (/^Turn\s+\d+\s+user message:/i.test(text)) {
    return text.replace(/:\s*.*$/, ": [withheld fixed-sequence wording; generate from intention and constraints]");
  }
  return text;
}

function getLatestSideResponses(priorTurns = [], fallback = "") {
  const latest = [...(priorTurns || [])].reverse().find((turn) => turn?.sideAResponse || turn?.sideBResponse);
  return {
    sideA: latest?.sideAResponse || fallback || "",
    sideB: latest?.sideBResponse || "",
  };
}

function runCodex(command, args, input, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, NO_COLOR: "1" },
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("Local Codex simulator timed out."));
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(`Local Codex simulator failed with exit code ${code}: ${stderr || stdout}`));
    });
    child.stdin.end(input);
  });
}

function parseSimulatorJson(raw) {
  const value = String(raw || "").trim();
  try {
    return JSON.parse(value);
  } catch {
    const match = value.match(/```(?:json)?\s*([\s\S]*?)```/) || value.match(/(\{[\s\S]*\})/);
    if (match) return JSON.parse(match[1]);
    throw new Error("Local Codex simulator did not return parseable JSON.");
  }
}

function summarizeArena(arena = {}) {
  return {
    taskSpace: arena.taskSpace,
    evaluationScenario: arena.evaluationScenario,
    decisionQuestion: arena.decisionQuestion,
    riskBoundaries: arena.riskBoundaries || [],
    evidenceAssumptions: arena.evidenceAssumptions || [],
  };
}

function summarizeCoverage(coverage = {}) {
  return {
    scoredDimensions: coverage.scoredDimensions || [],
    diagnosticDimensions: coverage.diagnosticDimensions || [],
    riskMix: coverage.riskMix || {},
    optionalExperiencePersonaModule: coverage.optionalExperiencePersonaModule || {},
  };
}

function summarizeCase(evalCase = {}) {
  return {
    caseId: evalCase.caseId,
    scenario: evalCase.scenario,
    userPersona: evalCase.userPersona,
    userGoal: evalCase.userGoal,
    modelFacingPrompt: evalCase.modelFacingPrompt,
    collectionInstructions: evalCase.collectionInstructions || [],
    expectedOutcome: evalCase.expectedOutcome,
    exposureContract: evalCase.exposureContract,
  };
}

function buildExposedFactsSoFar(evalCase, turnScript, currentTurnIndex, priorTurns) {
  const facts = [...(evalCase.exposureContract?.modelVisibleFactsAtStart || [])];
  for (const turn of turnScript.turns || []) {
    if (turn.turnIndex >= currentTurnIndex) continue;
    facts.push(...(turn.exposureDelta?.newlyExposedFacts || []));
  }
  for (const priorTurn of priorTurns || []) {
    if (priorTurn?.userMessage) facts.push(`Prior user message: ${priorTurn.userMessage}`);
    if (Array.isArray(priorTurn?.newlyExposedFacts)) facts.push(...priorTurn.newlyExposedFacts);
  }
  return [...new Set(facts.filter(Boolean))];
}

function findEvaluatorLeakage(message, turnExecutionState) {
  const leaked = [];
  const lowerMessage = String(message).toLowerCase();
  for (const field of ["hiddenIntent", "evaluatorIntent", "failureModesToProbe"]) {
    const value = turnExecutionState[field];
    if (!value) continue;
    const text = Array.isArray(value) ? value.join(" ") : String(value);
    const meaningfulTokens = text
      .toLowerCase()
      .split(/[^a-z0-9\u4e00-\u9fa5]+/u)
      .filter((token) => token.length >= 8);
    if (meaningfulTokens.some((token) => lowerMessage.includes(token))) leaked.push(field);
  }
  return leaked;
}

function findUnapprovedExposure(newlyExposedFacts, turnExecutionState, selectedBranchRuleId, modelFacingUserMessage = "") {
  if (!Array.isArray(newlyExposedFacts)) return ["newlyExposedFacts must be an array"];
  const allowed = [
    ...(turnExecutionState.currentTurnExposureDelta?.allowedNewFactsToExpose || []),
    ...(turnExecutionState.currentTurnExposureDelta?.newlyExposedFacts || []),
    ...(turnExecutionState.currentTurnExposureDelta?.modelVisibleRequirementsAfterTurn || []),
    turnExecutionState.currentScriptTurn?.expectedStateAfterTurn || "",
    turnExecutionState.currentScriptTurn?.intentionToPush || "",
  ];
  const selectedRule = (turnExecutionState.availableBranchRules || []).find(
    (rule) => rule.branchRuleId === selectedBranchRuleId,
  );
  if (selectedRule?.modelFacingReply) allowed.push(selectedRule.modelFacingReply);
  return newlyExposedFacts.filter((fact) =>
    !isExposureAllowed(fact, allowed) && !isExposureAllowedByDraftedMessage(fact, modelFacingUserMessage),
  );
}

function isExposureAllowedByDraftedMessage(fact, message) {
  const normalizedFact = normalizeText(
    String(fact || "").replace(/^turn\s+\d+\s+user message:\s*/i, ""),
  );
  const normalizedMessage = normalizeText(message);
  if (!normalizedFact || !normalizedMessage) return true;
  return normalizedMessage.includes(normalizedFact) || normalizedFact.includes(normalizedMessage);
}

function isExposureAllowed(fact, allowedFacts) {
  const normalizedFact = normalizeText(fact);
  if (!normalizedFact) return true;
  return allowedFacts.some((allowed) => {
    const normalizedAllowed = normalizeText(allowed);
    return normalizedAllowed.includes(normalizedFact) || normalizedFact.includes(normalizedAllowed);
  });
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .trim();
}
