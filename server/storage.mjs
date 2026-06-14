import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export const rootDir = process.cwd();

const dataDir = path.join(rootDir, "data");
const fixturePath = path.join(
  rootDir,
  "artifacts",
  "eval-generation",
  "20260607-restaurant-diandian-vs-doubao",
  "revised-package.json",
);

export const paths = {
  dataDir,
  activeProject: path.join(dataDir, "active-project.json"),
  activeTask: path.join(dataDir, "tasks", "active-task.json"),
  adapterRegistry: path.join(dataDir, "adapters", "index.json"),
  curation: path.join(dataDir, "curation", "current.json"),
  currentPackage: path.join(dataDir, "packages", "current.json"),
  packageValidation: path.join(dataDir, "packages", "current.validation.json"),
  currentRun: path.join(dataDir, "runs", "current.json"),
  currentReport: path.join(dataDir, "reports", "current.md"),
  tasksIndex: path.join(dataDir, "tasks", "index.json"),
};

export function ensureDataDirs() {
  for (const dir of [
    dataDir,
    path.join(dataDir, "packages"),
    path.join(dataDir, "curation"),
    path.join(dataDir, "runs"),
    path.join(dataDir, "reports"),
    path.join(dataDir, "tasks"),
    path.join(dataDir, "adapters"),
  ]) {
    mkdirSync(dir, { recursive: true });
  }
}

export function activeTaskWorkspacePaths(taskId = readJson(paths.activeTask)?.taskId) {
  if (!taskId) return null;
  const taskRoot = path.join(dataDir, "tasks", taskId);
  return {
    taskRoot,
    activeProject: path.join(taskRoot, "active-project.json"),
    packageDir: path.join(taskRoot, "package"),
    currentPackage: path.join(taskRoot, "package", "current.json"),
    packageValidation: path.join(taskRoot, "package", "current.validation.json"),
    packageArtifactsDir: path.join(taskRoot, "package", "artifacts"),
    curation: path.join(taskRoot, "curation", "current.json"),
    currentRun: path.join(taskRoot, "runs", "current.json"),
    currentReport: path.join(taskRoot, "reports", "current.md"),
    graderDir: path.join(taskRoot, "grader"),
    graderJobsDir: path.join(taskRoot, "grader", "jobs"),
  };
}

function readActiveTaskFile(key, globalPath, fallback = null) {
  const scoped = activeTaskWorkspacePaths();
  if (scoped?.[key] && existsSync(scoped[key])) return readJson(scoped[key], fallback);
  return readJson(globalPath, fallback);
}

function writeActiveTaskFile(key, globalPath, value) {
  const scoped = activeTaskWorkspacePaths();
  if (scoped?.[key]) writeJson(scoped[key], value);
  writeJson(globalPath, value);
}

function writeCurrentPackage(runtimePackage, validation, activeProject, curation, run, taskId = readJson(paths.activeTask)?.taskId) {
  const scoped = activeTaskWorkspacePaths(taskId);
  if (scoped) {
    writeJson(scoped.currentPackage, runtimePackage);
    writeJson(scoped.packageValidation, validation);
    writeJson(scoped.activeProject, activeProject);
    writeJson(scoped.curation, curation);
    writeJson(scoped.currentRun, run);
  }
  if (!taskId || taskId === readJson(paths.activeTask)?.taskId) {
    writeJson(paths.currentPackage, runtimePackage);
    writeJson(paths.packageValidation, validation);
    writeJson(paths.activeProject, activeProject);
    writeCurrentCuration(curation);
    writeCurrentRun(run);
  }
}

function writeCurrentRun(run) {
  writeActiveTaskFile("currentRun", paths.currentRun, run);
}

function writeCurrentCuration(curation) {
  writeActiveTaskFile("curation", paths.curation, curation);
}

export function readJson(filePath, fallback = null) {
  if (!existsSync(filePath)) return fallback;
  return JSON.parse(readFileSync(filePath, "utf8"));
}

export function writeJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function getCurrentState() {
  ensureDataDirs();
  const tasks = readTasksIndex();
  const activeTaskRef = readJson(paths.activeTask);
  const activeTask = tasks.items.find((task) => task.taskId === activeTaskRef?.taskId) || null;
  const activeProject = readActiveTaskFile("activeProject", paths.activeProject);
  const workspaceBelongsToActiveTask =
    !activeProject?.activeTaskId || !activeTask?.taskId || activeProject.activeTaskId === activeTask.taskId;
  return {
    package: workspaceBelongsToActiveTask ? readActiveTaskFile("currentPackage", paths.currentPackage) : null,
    validation: workspaceBelongsToActiveTask ? readActiveTaskFile("packageValidation", paths.packageValidation) : null,
    activeProject: workspaceBelongsToActiveTask ? activeProject : null,
    tasks,
    activeTask,
    adapters: readAdapterRegistry(),
    curation: workspaceBelongsToActiveTask ? readActiveTaskFile("curation", paths.curation) : null,
    run: workspaceBelongsToActiveTask ? readActiveTaskFile("currentRun", paths.currentRun) : null,
  };
}

export async function readRequestJson(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
  }
  if (!body.trim()) return {};
  return JSON.parse(body);
}

export function readTasksIndex() {
  ensureDataDirs();
  return readJson(paths.tasksIndex, { items: [], updatedAt: null });
}

export function readAdapterRegistry() {
  ensureDataDirs();
  const fallback = {
    items: [
      {
        providerId: "doubao_web",
        providerName: "Doubao Web",
        status: "ready",
        sideSupport: ["baseline"],
        urlPatterns: ["doubao.com"],
        templateSource: "built_in",
        updatedAt: null,
      },
    ],
    updatedAt: null,
  };
  const registry = readJson(paths.adapterRegistry, fallback);
  const builtIns = new Map(fallback.items.map((item) => [item.providerId, item]));
  registry.items = (registry.items || []).map((item) => ({
    ...(builtIns.get(item.providerId) || {}),
    ...item,
    urlPatterns: normalizeUrlPatterns(
      item.urlPatterns?.length
        ? item.urlPatterns
        : builtIns.get(item.providerId)?.urlPatterns || inferUrlPatterns(item.lastVerifiedUrl),
    ),
  }));
  for (const item of fallback.items) {
    if (!registry.items.some((existing) => existing.providerId === item.providerId)) {
      registry.items.push(item);
    }
  }
  return registry;
}

export function createEvaluationTask(payload = {}) {
  ensureDataDirs();
  const now = new Date().toISOString();
  const taskId = `task-${now.replaceAll(":", "").replaceAll(".", "")}`;
  const task = sanitizeEvaluationTask({
    ...payload,
    taskId,
    status: "setup",
    createdAt: now,
    updatedAt: now,
  });
  const tasks = readTasksIndex();
  tasks.items = [task, ...tasks.items.filter((item) => item.taskId !== taskId)];
  tasks.updatedAt = now;
  writeJson(paths.tasksIndex, tasks);
  writeJson(paths.activeTask, { taskId, updatedAt: now });
  return getCurrentState();
}

export function selectEvaluationTask(taskId) {
  ensureDataDirs();
  const tasks = readTasksIndex();
  const task = tasks.items.find((item) => item.taskId === taskId);
  if (!task) throw new Error(`Unknown taskId: ${taskId}`);
  writeJson(paths.activeTask, { taskId, updatedAt: new Date().toISOString() });
  return getCurrentState();
}

function updateActiveTask(patch, taskId = readJson(paths.activeTask)?.taskId) {
  if (!taskId) return;
  const tasks = readTasksIndex();
  const now = new Date().toISOString();
  tasks.items = tasks.items.map((task) =>
    task.taskId === taskId
      ? sanitizeEvaluationTask({ ...task, ...patch, updatedAt: now })
      : task,
  );
  tasks.updatedAt = now;
  writeJson(paths.tasksIndex, tasks);
}

export function updateCaseCuration(update) {
  ensureDataDirs();
  const curation = readJson(paths.curation);
  if (!curation) throw new Error("No current curation state. Load a package first.");
  if (!update.caseId) throw new Error("caseId is required.");

  const current = curation.caseStatuses?.[update.caseId];
  if (!current) throw new Error(`Unknown caseId: ${update.caseId}`);

  const allowedStatuses = new Set(["draft", "approved", "rejected"]);
  if (update.status && !allowedStatuses.has(update.status)) {
    throw new Error(`Unsupported status: ${update.status}`);
  }

  curation.caseStatuses[update.caseId] = {
    ...current,
    status: update.status || current.status,
    reviewerNotes:
      typeof update.reviewerNotes === "string" ? update.reviewerNotes : current.reviewerNotes,
    editedCase: sanitizeEditedCase(update.editedCase, current.editedCase),
    updatedAt: new Date().toISOString(),
  };
  curation.updatedAt = new Date().toISOString();
  writeCurrentCuration(curation);
  return getCurrentState();
}

function sanitizeEvaluationTask(task) {
  const arena = task.arena || {};
  const taskSpace = task.taskSpace || {};
  const baseline = arena.baseline || {};
  const challenger = arena.challenger || {};
  const productType = ["chatbot", "coding_agent"].includes(arena.productType) ? arena.productType : "chatbot";
  const title =
    String(task.title || "").trim() ||
    `${String(taskSpace.label || "Untitled task space").trim()}：${String(challenger.name || "Challenger").trim()} vs ${String(
      baseline.name || "Doubao",
    ).trim()}`;

  return {
    taskId: String(task.taskId || ""),
    title,
    status: ["setup", "package_loaded", "curating", "collecting", "reviewed", "report_ready"].includes(task.status)
      ? task.status
      : "setup",
    arena: {
      productType,
      baseline: {
        name: String(baseline.name || "Doubao").trim(),
        surface: sanitizeSurface(baseline.surface || "web_chat"),
        chatUrl: String(baseline.chatUrl || "").trim(),
        accessNotes: String(baseline.accessNotes || "").trim(),
        evidenceAvailability: sanitizeEvidenceAvailability(baseline.evidenceAvailability),
        collectionMethod: "manual_paste",
      },
      challenger: {
        name: String(challenger.name || "Challenger").trim(),
        surface: sanitizeSurface(challenger.surface || "mobile_app"),
        chatUrl: String(challenger.chatUrl || "").trim(),
        accessNotes: String(challenger.accessNotes || "").trim(),
        evidenceAvailability: sanitizeEvidenceAvailability(challenger.evidenceAvailability),
        expectedAdvantage: String(challenger.expectedAdvantage || "").trim(),
        collectionMethod: "manual_paste",
        captureTemplate: sanitizeTaskCaptureTemplate(challenger.captureTemplate),
      },
    },
    taskSpace: {
      label: String(taskSpace.label || "").trim(),
      concreteScenario: String(taskSpace.concreteScenario || "").trim(),
      targetAudience: String(taskSpace.targetAudience || "").trim(),
      decisionQuestion:
        String(taskSpace.decisionQuestion || "").trim() ||
        buildDecisionQuestion(challenger.name, baseline.name, taskSpace.label),
      winningCriteria: String(taskSpace.winningCriteria || "").trim(),
      mustCoverCapabilities: splitTextList(taskSpace.mustCoverCapabilities),
      riskAreas: splitTextList(taskSpace.riskAreas),
      evaluateConversationExperience: Boolean(taskSpace.evaluateConversationExperience),
      nativeContextPolicy: String(taskSpace.nativeContextPolicy || "").trim(),
      supplementalNotes: String(taskSpace.supplementalNotes || "").trim(),
    },
    packageSummary: task.packageSummary || null,
    createdAt: task.createdAt || new Date().toISOString(),
    updatedAt: task.updatedAt || new Date().toISOString(),
  };
}

function sanitizeTaskCaptureTemplate(template = {}) {
  if (!template || typeof template !== "object") return null;
  const providerId = String(template.providerId || "").trim();
  if (!providerId) return null;
  return {
    providerId,
    providerName: String(template.providerName || providerId).trim(),
    status: ["ready", "partial"].includes(template.status) ? template.status : "ready",
    urlPatterns: normalizeUrlPatterns(template.urlPatterns),
    templateSource: String(template.templateSource || "local").trim(),
    lastVerifiedUrl: String(template.lastVerifiedUrl || "").trim(),
    boundAt: String(template.boundAt || new Date().toISOString()),
    boundFromCaseId: String(template.boundFromCaseId || "").trim(),
    boundFromTurnIndex: Number(template.boundFromTurnIndex || 1),
  };
}

function buildDecisionQuestion(challengerName, baselineName, taskSpaceLabel) {
  return `${String(challengerName || "Challenger").trim()} 在「${String(taskSpaceLabel || "该任务空间").trim()}」任务空间里，是否整体胜出 ${String(
    baselineName || "Doubao",
  ).trim()}？`;
}

function sanitizeSurface(value) {
  return ["web_chat", "mobile_app", "desktop_app", "api", "other"].includes(value) ? value : "web_chat";
}

function sanitizeEvidenceAvailability(value) {
  return ["L0", "L1", "L2", "L3"].includes(value) ? value : "L0";
}

function splitTextList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value || "")
    .split(/\n|,|，|;/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function startCollectionRun() {
  ensureDataDirs();
  const state = getCurrentState();
  if (!state.package) throw new Error("No current package. Load a package first.");
  if (!state.curation) throw new Error("No curation state. Curate cases first.");

  const now = new Date().toISOString();
  const cases = state.package.evalCases || [];
  const approvedCases = cases.filter(
    (evalCase) => state.curation.caseStatuses?.[evalCase.caseId]?.status === "approved",
  );
  if (!approvedCases.length) throw new Error("No approved cases to collect.");

  const existingRun = state.run || {};
  const caseRuns = { ...(existingRun.caseRuns || {}) };
  for (const evalCase of approvedCases) {
    if (!caseRuns[evalCase.caseId]) {
      caseRuns[evalCase.caseId] = createCaseRun(evalCase, state.package);
    }
  }

  const run = {
    ...existingRun,
    runId: existingRun.runId || `run-${now.replaceAll(":", "").replaceAll(".", "")}`,
    packageId: state.activeProject?.packageId || existingRun.packageId || "current-runtime-eval-package",
    packageVersion: state.activeProject?.packageVersion || existingRun.packageVersion || "v1",
    status: "in_progress",
    caseRuns,
    manualReviews: existingRun.manualReviews || {},
    createdAt: existingRun.createdAt || now,
    updatedAt: now,
  };
  writeCurrentRun(run);
  return getCurrentState();
}

export function updateCaseRun(update) {
  ensureDataDirs();
  const state = getCurrentState();
  if (!state.run) throw new Error("No current run. Start collection first.");
  if (!update.caseId) throw new Error("caseId is required.");

  const runtimePackage = state.package;
  const evalCase = (runtimePackage?.evalCases || []).find((item) => item.caseId === update.caseId);
  if (!evalCase) throw new Error(`Unknown caseId: ${update.caseId}`);

  const run = state.run;
  const currentCaseRun = run.caseRuns?.[update.caseId] || createCaseRun(evalCase, runtimePackage);
  const nextCaseRun = sanitizeCaseRunUpdate(currentCaseRun, update, evalCase, runtimePackage);
  run.caseRuns = { ...(run.caseRuns || {}), [update.caseId]: nextCaseRun };
  run.status = "in_progress";
  run.updatedAt = new Date().toISOString();
  writeCurrentRun(run);
  return getCurrentState();
}

export function startCaptureSession({ provider = "doubao_web", side = "baseline", caseId, turnIndex = 1 } = {}) {
  ensureDataDirs();
  const state = getCurrentState();
  if (!state.run) throw new Error("No current run. Start collection first.");
  if (!["baseline", "challenger"].includes(side)) throw new Error(`Unsupported capture side: ${side}`);
  const evalCase = findEvalCase(state, caseId);
  if (!evalCase) throw new Error(`Unknown caseId: ${caseId}`);
  const caseRun = state.run.caseRuns?.[caseId] || createCaseRun(evalCase, state.package);
  const turn = caseRun.turns?.find((item) => item.turnIndex === Number(turnIndex));
  if (!turn) throw new Error(`Unknown turnIndex ${turnIndex} for case ${caseId}`);
  if (!turn.userMessage) {
    const seed = getTurnUserMessageSeed(evalCase, state.package, Number(turnIndex));
    turn.userMessage = seed.userMessage;
    turn.messageSource = turn.messageSource || seed.messageSource;
    turn.newlyExposedFacts = turn.newlyExposedFacts?.length ? turn.newlyExposedFacts : seed.newlyExposedFacts;
  }

  const now = new Date().toISOString();
  const run = state.run;
  run.caseRuns = { ...(run.caseRuns || {}), [caseId]: caseRun };
  run.status = "in_progress";
  run.captureSession = {
    sessionId: `capture-session-${now.replaceAll(":", "").replaceAll(".", "")}`,
    provider,
    side,
    caseId,
    turnIndex: Number(turnIndex),
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
  run.updatedAt = now;
  writeCurrentRun(run);
  return getCurrentState();
}

export function savePendingCapture(capture) {
  ensureDataDirs();
  const state = getCurrentState();
  if (!state.run?.captureSession) throw new Error("No active capture session.");
  const session = state.run.captureSession;
  assertCaptureMatchesSession(capture, session);
  const now = new Date().toISOString();
  const run = state.run;
  run.captureSession = {
    ...session,
    status: "pending",
    pendingCapture: sanitizeCapturePayload(capture),
    updatedAt: now,
  };
  run.updatedAt = now;
  writeCurrentRun(run);
  return getCurrentState();
}

export function acceptCaptureSession({ sessionId } = {}) {
  ensureDataDirs();
  const state = getCurrentState();
  const session = state.run?.captureSession;
  if (!session) throw new Error("No capture session to accept.");
  if (sessionId && session.sessionId !== sessionId) throw new Error("Capture session changed. Refresh and retry.");
  if (!session.pendingCapture) throw new Error("No pending capture to accept.");

  const run = state.run;
  const capture = sanitizeCapturePayload(session.pendingCapture);
  const qaBlocked = capture.qaResult && capture.qaResult.ok === false && capture.qaResult.adapterReadiness === "blocked";
  if (capture.adapterInfo?.status === "blocked" || qaBlocked) {
    throw new Error("Blocked capture cannot be accepted. Discard it or use manual paste.");
  }
  const caseRun = run.caseRuns?.[capture.caseId];
  if (!caseRun) throw new Error(`Unknown caseId: ${capture.caseId}`);
  const turns = [...(caseRun.turns || [])];
  const turnIndex = turns.findIndex((turn) => turn.turnIndex === capture.turnIndex);
  if (turnIndex < 0) throw new Error(`Unknown turnIndex ${capture.turnIndex} for case ${capture.caseId}`);

  const turn = { ...turns[turnIndex] };
  const side = capture.side === "challenger" ? "challenger" : "baseline";
  const templateOnly = Boolean(capture.adapterBuilderOutput) && !String(capture.finalAnswer || "").trim();
  if (!templateOnly) {
    turn[`${side}Output`] = capture.finalAnswer || "";
    turn[`${side}EvidenceLevel`] = capture.evidenceLevel || "L1";
    turn[`${side}IntentExpansionNotes`] = formatIntentExpansionNotes(capture.intentExpansionQueries);
    turn[`${side}FollowupSuggestionNotes`] = formatFollowupSuggestionNotes(capture.followupSuggestions);
    turn[`${side}VisibleProcessNotes`] = formatVisibleProcessNotes(capture);
    turn[`${side}SourceNotes`] = capture.sourceNotes || "";
    turn[`${side}ToolcallNotes`] = capture.toolcallNotes || "";
    turn[`${side}CaveatType`] = "none";
    turn[`${side}Caveat`] = "";
    turns[turnIndex] = turn;
  }

  const now = new Date().toISOString();
  run.captureArtifacts = {
    ...(run.captureArtifacts || {}),
    [capture.captureId]: {
      ...capture,
      acceptedAt: now,
      sessionId: session.sessionId,
    },
  };
  if (capture.adapterInfo?.providerId) {
    upsertAdapterTemplate(capture.adapterInfo, capture, now);
    if (capture.side === "challenger" && capture.adapterInfo.status === "ready") {
      bindActiveTaskChallengerCaptureTemplate(capture.adapterInfo, capture, now);
    }
  }
  run.captureSession = {
    ...session,
    status: "accepted",
    pendingCapture: capture,
    updatedAt: now,
  };
  run.caseRuns = {
    ...(run.caseRuns || {}),
    [capture.caseId]: templateOnly
      ? caseRun
      : sanitizeCaseRunUpdate(caseRun, { ...caseRun, turns, status: "in_progress" }, findEvalCase(state, capture.caseId), state.package),
  };
  run.status = "in_progress";
  run.updatedAt = now;
  writeCurrentRun(run);
  return getCurrentState();
}

function bindActiveTaskChallengerCaptureTemplate(adapterInfo, capture, now) {
  const template = sanitizeTaskCaptureTemplate({
    providerId: adapterInfo.providerId,
    providerName: adapterInfo.providerName,
    status: adapterInfo.status,
    urlPatterns: adapterInfo.urlPatterns?.length ? adapterInfo.urlPatterns : inferUrlPatterns(capture.url),
    templateSource: adapterInfo.templateSource || "local",
    lastVerifiedUrl: capture.url,
    boundAt: now,
    boundFromCaseId: capture.caseId,
    boundFromTurnIndex: capture.turnIndex,
  });
  if (!template) return;
  const state = getCurrentState();
  const activeTask = state.activeTask;
  if (!activeTask) return;
  updateActiveTask({
    arena: {
      ...(activeTask.arena || {}),
      challenger: {
        ...(activeTask.arena?.challenger || {}),
        captureTemplate: template,
      },
    },
  });
}

export function discardCaptureSession({ sessionId } = {}) {
  ensureDataDirs();
  const state = getCurrentState();
  const session = state.run?.captureSession;
  if (!session) throw new Error("No capture session to discard.");
  if (sessionId && session.sessionId !== sessionId) throw new Error("Capture session changed. Refresh and retry.");
  const now = new Date().toISOString();
  const run = state.run;
  delete run.captureSession;
  run.updatedAt = now;
  writeCurrentRun(run);
  return getCurrentState();
}

export function applySimulatorSuggestion({ caseId, turnIndex, simulatorResult, turnExecutionState } = {}) {
  ensureDataDirs();
  const state = getCurrentState();
  if (!state.run) throw new Error("No current run. Start collection first.");
  const run = state.run;
  const caseRun = run.caseRuns?.[caseId];
  if (!caseRun) throw new Error(`Unknown caseId: ${caseId}`);
  const turns = [...(caseRun.turns || [])];
  const targetIndex = turns.findIndex((turn) => turn.turnIndex === Number(turnIndex));
  if (targetIndex < 0) throw new Error(`Unknown turnIndex ${turnIndex} for case ${caseId}`);

  const output = simulatorResult?.output || {};
  const validatorResult = simulatorResult?.validatorResult || { ok: false, errors: ["Missing validator result."] };
  const now = new Date().toISOString();
  const artifactId = `simulator-${now.replaceAll(":", "").replaceAll(".", "")}`;
  run.simulatorArtifacts = {
    ...(run.simulatorArtifacts || {}),
    [artifactId]: {
      artifactId,
      caseId,
      turnIndex: Number(turnIndex),
      createdAt: now,
      turnExecutionState,
      simulatorOutput: output,
      validatorResult,
      rawLastMessage: String(simulatorResult?.rawLastMessage || ""),
      artifactRefs: Array.isArray(simulatorResult?.artifactRefs)
        ? simulatorResult.artifactRefs.map((item) => String(item))
        : [],
    },
  };

  if (validatorResult.ok) {
    const targetTurn = { ...turns[targetIndex] };
    const fallbackMessage = resolveSimulatorUserMessage(output, turnExecutionState, targetTurn);
    targetTurn.userMessage = output.shouldStop ? "" : fallbackMessage;
    targetTurn.messageSource = output.shouldStop ? "manual" : "local_model_suggested";
    targetTurn.branchRuleId = String(output.selectedBranchRuleId || "");
    targetTurn.newlyExposedFacts = stringArray(output.newlyExposedFacts);
    targetTurn.simulatorArtifactId = artifactId;
    targetTurn.simulatorEvaluatorNote = String(output.evaluatorNote || "");
    targetTurn.simulatorTrajectoryNotes = String(output.trajectoryNotes || "");
    targetTurn.simulatorSelectedAction = String(output.selectedAction || "");
    targetTurn.simulatorShouldStop = Boolean(output.shouldStop);
    targetTurn.simulatorStopReason = String(output.stopReason || "");
    turns[targetIndex] = targetTurn;
    run.caseRuns = {
      ...(run.caseRuns || {}),
      [caseId]: sanitizeCaseRunUpdate(caseRun, { ...caseRun, turns, status: "in_progress" }, findEvalCase(state, caseId), state.package),
    };
    run.status = "in_progress";
  }

  run.updatedAt = now;
  writeCurrentRun(run);
  return getCurrentState();
}

function resolveSimulatorUserMessage(output = {}, turnExecutionState = {}, targetTurn = {}) {
  const direct = String(output.modelFacingUserMessage || "").trim();
  if (direct) return direct;
  const selectedBranch = (turnExecutionState.availableBranchRules || []).find(
    (rule) => rule.branchRuleId === output.selectedBranchRuleId,
  );
  const branchMessage = String(selectedBranch?.modelFacingReply || "").trim();
  if (branchMessage) return branchMessage;
  const existing = String(targetTurn.userMessage || "").trim();
  if (existing) return existing;
  const adaptiveMoves = Array.isArray(turnExecutionState.allowedAdaptiveMoves)
    ? turnExecutionState.allowedAdaptiveMoves.map((item) => String(item).trim()).filter(Boolean)
    : [];
  return adaptiveMoves[0] || "";
}

export function failCaptureSession({ error, caseId, turnIndex, provider = "doubao_web", side = "baseline" } = {}) {
  ensureDataDirs();
  const state = getCurrentState();
  if (!state.run) throw new Error("No current run. Start collection first.");
  const now = new Date().toISOString();
  const session = state.run.captureSession || {
    sessionId: `capture-session-${now.replaceAll(":", "").replaceAll(".", "")}`,
    provider,
    side,
    caseId,
    turnIndex: Number(turnIndex || 1),
    createdAt: now,
  };
  const run = state.run;
  run.captureSession = {
    ...session,
    status: "failed",
    lastError: String(error || "Capture failed."),
    pendingCapture: null,
    updatedAt: now,
  };
  run.updatedAt = now;
  writeCurrentRun(run);
  return getCurrentState();
}

function sanitizeEditedCase(nextEditedCase, previousEditedCase = {}) {
  if (!nextEditedCase || typeof nextEditedCase !== "object") return previousEditedCase || {};
  const editableFields = new Set([
    "modelFacingPrompt",
    "scenario",
    "userPersona",
    "userGoal",
    "expectedOutcome",
    "mustDo",
    "mustNotDo",
    "failureModesToProbe",
    "riskLevel",
    "difficulty",
  ]);
  const sanitized = {};
  for (const [key, value] of Object.entries(nextEditedCase)) {
    if (!editableFields.has(key)) continue;
    if (Array.isArray(value)) {
      sanitized[key] = value.map((item) => String(item).trim()).filter(Boolean);
    } else if (typeof value === "string") {
      sanitized[key] = value.trim();
    }
  }
  return sanitized;
}

function findEvalCase(state, caseId) {
  const evalCase = (state.package?.evalCases || []).find((item) => item.caseId === caseId);
  if (!evalCase) throw new Error(`Unknown caseId: ${caseId}`);
  return evalCase;
}

function assertCaptureMatchesSession(capture, session) {
  if (!capture || typeof capture !== "object") throw new Error("Capture payload is required.");
  for (const key of ["side", "caseId", "turnIndex"]) {
    if (capture[key] !== session[key]) {
      throw new Error(`Capture ${key} does not match active session.`);
    }
  }
  if (session.provider !== "website_adapter" && capture.provider !== session.provider) {
    throw new Error("Capture provider does not match active session.");
  }
}

function sanitizeCapturePayload(capture) {
  const referenceMaterials = Array.isArray(capture.referenceMaterials)
    ? capture.referenceMaterials.map((item) => ({
        rank: Number.isFinite(item.rank) ? item.rank : undefined,
        title: String(item.title || "").trim(),
        href: String(item.href || "").trim(),
        sourceName: String(item.sourceName || "").trim(),
        type: String(item.type || "").trim(),
      })).filter((item) => item.title || item.href)
    : [];
  return {
    captureId: String(capture.captureId || `capture-${new Date().toISOString().replaceAll(":", "").replaceAll(".", "")}`),
    provider: String(capture.provider || "unknown_web_chatbot"),
    side: ["baseline", "challenger"].includes(capture.side) ? capture.side : "baseline",
    caseId: String(capture.caseId || ""),
    turnIndex: Number.isInteger(capture.turnIndex) ? capture.turnIndex : 1,
    capturedAt: String(capture.capturedAt || new Date().toISOString()),
    url: String(capture.url || ""),
    title: String(capture.title || ""),
    finalAnswer: String(capture.finalAnswer || ""),
    intentExpansionQueries: stringArray(capture.intentExpansionQueries || capture.expandedSearchQueries),
    expandedSearchQueries: stringArray(capture.expandedSearchQueries),
    referenceMaterials,
    riskNotices: stringArray(capture.riskNotices),
    followupSuggestions: stringArray(capture.followupSuggestions),
    visibleProcessNotes: String(capture.visibleProcessNotes || ""),
    sourceNotes: String(capture.sourceNotes || ""),
    toolcallNotes: String(capture.toolcallNotes || ""),
    evidenceLevel: sanitizeEvidenceLevel(capture.evidenceLevel),
    rawVisibleText: String(capture.rawVisibleText || "").slice(0, 80000),
    captureNotes: stringArray(capture.captureNotes),
    adapterInfo: sanitizeAdapterInfo(capture.adapterInfo),
    qaResult: sanitizeQaResult(capture.qaResult),
    adapterBuilderOutput: capture.adapterBuilderOutput && typeof capture.adapterBuilderOutput === "object"
      ? capture.adapterBuilderOutput
      : null,
    adapterBuilderArtifacts: stringArray(capture.adapterBuilderArtifacts),
    snapshotArtifactRef: String(capture.snapshotArtifactRef || ""),
  };
}

function sanitizeAdapterInfo(info = {}) {
  if (!info || typeof info !== "object") return null;
  return {
    providerId: String(info.providerId || ""),
    providerName: String(info.providerName || ""),
    status: ["ready", "partial", "blocked"].includes(info.status) ? info.status : "partial",
    templateSource: String(info.templateSource || ""),
    requiresHumanReview: Boolean(info.requiresHumanReview),
    doNotPersist: Boolean(info.doNotPersist),
    urlPatterns: normalizeUrlPatterns(info.urlPatterns),
  };
}

function sanitizeQaResult(result = {}) {
  if (!result || typeof result !== "object") return null;
  if (!Object.keys(result).length) return null;
  return {
    ok: Boolean(result.ok),
    adapterReadiness: ["ready", "partial", "blocked"].includes(result.adapterReadiness)
      ? result.adapterReadiness
      : result.ok ? "ready" : "blocked",
    fieldResults: result.fieldResults && typeof result.fieldResults === "object" ? result.fieldResults : {},
    blockingIssues: Array.isArray(result.blockingIssues) ? result.blockingIssues : [],
    warnings: stringArray(result.warnings),
    developerInstructions: stringArray(result.developerInstructions),
  };
}

function upsertAdapterTemplate(adapterInfo, capture, now) {
  const registry = readAdapterRegistry();
  const providerId = String(adapterInfo.providerId || capture.provider || "").trim();
  if (!providerId || !["ready", "partial"].includes(adapterInfo.status) || adapterInfo.doNotPersist) return;
  const nextUrlPatterns = normalizeUrlPatterns(
    adapterInfo.urlPatterns?.length ? adapterInfo.urlPatterns : inferUrlPatterns(capture.url),
  );
  const item = {
    providerId,
    providerName: String(adapterInfo.providerName || providerId),
    status: adapterInfo.status,
    sideSupport: [capture.side],
    urlPatterns: nextUrlPatterns,
    templateSource: String(adapterInfo.templateSource || "local"),
    lastVerifiedUrl: String(capture.url || ""),
    lastQaResult: capture.qaResult || null,
    adapterBuilderOutput: capture.adapterBuilderOutput || null,
    adapterBuilderArtifacts: stringArray(capture.adapterBuilderArtifacts),
    updatedAt: now,
  };
  const previous = registry.items.find((entry) => entry.providerId === providerId);
  if (previous) {
    item.sideSupport = [...new Set([...(previous.sideSupport || []), capture.side])];
    item.urlPatterns = normalizeUrlPatterns([...(previous.urlPatterns || []), ...(item.urlPatterns || [])]);
  }
  registry.items = [item, ...registry.items.filter((entry) => entry.providerId !== providerId)];
  registry.updatedAt = now;
  writeJson(paths.adapterRegistry, registry);
}

function inferUrlPatterns(url) {
  const host = inferHostPattern(url);
  return host ? [host] : [];
}

function normalizeUrlPatterns(value) {
  return [...new Set(stringArray(value).map(inferHostPattern).filter(Boolean))];
}

function inferHostPattern(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    return new URL(raw).hostname.toLowerCase().replace(/^www\./, "").replace(/^\*\./, "");
  } catch {
    return raw
      .replace(/^https?:\/\//i, "")
      .split(/[/?#]/)[0]
      .toLowerCase()
      .replace(/^www\./, "")
      .replace(/^\*\./, "");
  }
}

function stringArray(value) {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
}

function formatIntentExpansionNotes(queries = []) {
  const items = stringArray(queries);
  if (!items.length) return "";
  return `Intent/query expansion captured from product UI:\n${items.map((item) => `- ${item}`).join("\n")}`;
}

function formatFollowupSuggestionNotes(suggestions = []) {
  const items = stringArray(suggestions);
  if (!items.length) return "";
  return `Follow-up suggestions captured from product UI:\n${items.map((item) => `- ${item}`).join("\n")}`;
}

function formatVisibleProcessNotes(capture) {
  const sections = [];
  if (capture.visibleProcessNotes) sections.push(String(capture.visibleProcessNotes));
  const riskNotices = stringArray(capture.riskNotices);
  if (riskNotices.length) sections.push(`Risk notices:\n${riskNotices.map((item) => `- ${item}`).join("\n")}`);
  const notes = stringArray(capture.captureNotes);
  if (notes.length) sections.push(`Capture notes:\n${notes.map((item) => `- ${item}`).join("\n")}`);
  const qa = capture.qaResult;
  if (qa && qa.ok === false) {
    sections.push(`Capture QA:\n- Adapter readiness: ${qa.adapterReadiness || "blocked"}`);
  }
  return sections.join("\n\n");
}

function createCaseRun(evalCase, runtimePackage) {
  const turnScript = (runtimePackage.turnScripts || []).find((script) => script.caseId === evalCase.caseId);
  const isMultiTurn = Boolean(turnScript);
  const firstSeed = getTurnUserMessageSeed(evalCase, runtimePackage, 1);
  return {
    caseId: evalCase.caseId,
    status: "not_started",
    executionStrategy: isMultiTurn ? "shared_user_turns" : "single_turn",
    collectionMode: evalCase.collectionMode,
    plannedMaxTurns: isMultiTurn ? turnScript.maxTurns || 1 : 1,
    actualTurns: 0,
    turns: [
      createTurnRun({
        turnIndex: 1,
        userMessage: firstSeed.userMessage,
        messageSource: firstSeed.messageSource,
        newlyExposedFacts: firstSeed.newlyExposedFacts,
      }),
    ],
    stopReason: "",
    collectionNotes: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function getTurnUserMessageSeed(evalCase, runtimePackage, turnIndex) {
  const turnScript = (runtimePackage.turnScripts || []).find((script) => script.caseId === evalCase.caseId);
  const scriptTurn = turnScript?.turns?.find((turn) => turn.turnIndex === Number(turnIndex));
  const firstScriptMessage = turnScript?.turns?.find((turn) => turn.turnIndex === 1)?.modelFacingUserMessage || "";
  const userMessage =
    scriptTurn?.modelFacingUserMessage ||
    (Number(turnIndex) === 1 ? evalCase.modelFacingPrompt || evalCase.initialPrompt || "" : "");
  return {
    userMessage:
      Number(turnIndex) > 1 && userMessage && userMessage === firstScriptMessage ? "" : userMessage,
    messageSource: scriptTurn ? "script_default" : Number(turnIndex) === 1 ? "model_facing_prompt" : "manual",
    newlyExposedFacts: scriptTurn?.exposureDelta?.newlyExposedFacts || (Number(turnIndex) === 1
      ? evalCase.exposureContract?.modelVisibleFactsAtStart || []
      : []),
  };
}

function createTurnRun({ turnIndex, userMessage = "", messageSource = "manual", newlyExposedFacts = [] }) {
  return {
    turnIndex,
    userMessage,
    messageSource,
    baselineOutput: "",
    challengerOutput: "",
    baselineCaveatType: "none",
    challengerCaveatType: "none",
    baselineEvidenceLevel: "L0",
    challengerEvidenceLevel: "L0",
    baselineIntentExpansionNotes: "",
    challengerIntentExpansionNotes: "",
    baselineFollowupSuggestionNotes: "",
    challengerFollowupSuggestionNotes: "",
    baselineVisibleProcessNotes: "",
    challengerVisibleProcessNotes: "",
    baselineSourceNotes: "",
    challengerSourceNotes: "",
    baselineToolcallNotes: "",
    challengerToolcallNotes: "",
    baselineCaveat: "",
    challengerCaveat: "",
    branchRuleId: "",
    simulatorArtifactId: "",
    simulatorEvaluatorNote: "",
    simulatorTrajectoryNotes: "",
    simulatorSelectedAction: "",
    simulatorShouldStop: false,
    simulatorStopReason: "",
    newlyExposedFacts,
  };
}

function sanitizeCaseRunUpdate(currentCaseRun, update, evalCase, runtimePackage) {
  const now = new Date().toISOString();
  const turnScript = (runtimePackage.turnScripts || []).find((script) => script.caseId === evalCase.caseId);
  const allowedStatuses = new Set(["not_started", "in_progress", "completed", "skipped", "needs_review"]);
  const turns = Array.isArray(update.turns)
    ? update.turns.map((turn, index) => sanitizeTurnRun(turn, index + 1))
    : currentCaseRun.turns || [];
  const actualTurns = turns.filter((turn) => turn.baselineOutput || turn.challengerOutput || turn.userMessage).length;
  return {
    ...currentCaseRun,
    status: allowedStatuses.has(update.status) ? update.status : inferCaseRunStatus(turns, update.status),
    executionStrategy: update.executionStrategy || currentCaseRun.executionStrategy,
    collectionMode: currentCaseRun.collectionMode || evalCase.collectionMode,
    plannedMaxTurns: Number.isInteger(update.plannedMaxTurns)
      ? update.plannedMaxTurns
      : currentCaseRun.plannedMaxTurns || turnScript?.maxTurns || 1,
    actualTurns,
    turns,
    stopReason: typeof update.stopReason === "string" ? update.stopReason : currentCaseRun.stopReason || "",
    collectionNotes:
      typeof update.collectionNotes === "string" ? update.collectionNotes : currentCaseRun.collectionNotes || "",
    completedAt: update.status === "completed" ? now : currentCaseRun.completedAt || "",
    updatedAt: now,
  };
}

function sanitizeTurnRun(turn, fallbackIndex) {
  return {
    turnIndex: Number.isInteger(turn.turnIndex) ? turn.turnIndex : fallbackIndex,
    userMessage: String(turn.userMessage || ""),
    messageSource: ["model_facing_prompt", "script_default", "manual", "local_model_suggested", "edited"].includes(
      turn.messageSource,
    )
      ? turn.messageSource
      : "manual",
    baselineOutput: String(turn.baselineOutput || ""),
    challengerOutput: String(turn.challengerOutput || ""),
    baselineCaveatType: sanitizeCaveatType(turn.baselineCaveatType),
    challengerCaveatType: sanitizeCaveatType(turn.challengerCaveatType),
    baselineEvidenceLevel: sanitizeEvidenceLevel(turn.baselineEvidenceLevel),
    challengerEvidenceLevel: sanitizeEvidenceLevel(turn.challengerEvidenceLevel),
    baselineIntentExpansionNotes: String(turn.baselineIntentExpansionNotes || ""),
    challengerIntentExpansionNotes: String(turn.challengerIntentExpansionNotes || ""),
    baselineFollowupSuggestionNotes: String(turn.baselineFollowupSuggestionNotes || ""),
    challengerFollowupSuggestionNotes: String(turn.challengerFollowupSuggestionNotes || ""),
    baselineVisibleProcessNotes: String(turn.baselineVisibleProcessNotes || ""),
    challengerVisibleProcessNotes: String(turn.challengerVisibleProcessNotes || ""),
    baselineSourceNotes: String(turn.baselineSourceNotes || ""),
    challengerSourceNotes: String(turn.challengerSourceNotes || ""),
    baselineToolcallNotes: String(turn.baselineToolcallNotes || ""),
    challengerToolcallNotes: String(turn.challengerToolcallNotes || ""),
    baselineCaveat: String(turn.baselineCaveat || ""),
    challengerCaveat: String(turn.challengerCaveat || ""),
    branchRuleId: String(turn.branchRuleId || ""),
    simulatorArtifactId: String(turn.simulatorArtifactId || ""),
    simulatorEvaluatorNote: String(turn.simulatorEvaluatorNote || ""),
    simulatorTrajectoryNotes: String(turn.simulatorTrajectoryNotes || ""),
    simulatorSelectedAction: String(turn.simulatorSelectedAction || ""),
    simulatorShouldStop: Boolean(turn.simulatorShouldStop),
    simulatorStopReason: String(turn.simulatorStopReason || ""),
    newlyExposedFacts: Array.isArray(turn.newlyExposedFacts)
      ? turn.newlyExposedFacts.map((item) => String(item).trim()).filter(Boolean)
      : [],
  };
}

function sanitizeEvidenceLevel(value) {
  return ["L0", "L1", "L2", "L3"].includes(value) ? value : "L0";
}

function sanitizeCaveatType(value) {
  return ["none", "refused", "no_output", "truncated", "access_issue", "other"].includes(value)
    ? value
    : "none";
}

function inferCaseRunStatus(turns, requestedStatus) {
  if (requestedStatus === "skipped" || requestedStatus === "needs_review") return requestedStatus;
  const hasAnyOutput = turns.some((turn) => turn.baselineOutput || turn.challengerOutput || turn.baselineCaveat || turn.challengerCaveat);
  const sideComplete = (turn, side) =>
    turn[`${side}CaveatType`] && turn[`${side}CaveatType`] !== "none"
      ? Boolean(turn[`${side}Caveat`])
      : Boolean(turn[`${side}Output`]);
  const allHaveRequiredOutput =
    turns.length > 0 &&
    turns.every((turn) => turn.userMessage && sideComplete(turn, "baseline") && sideComplete(turn, "challenger"));
  if (allHaveRequiredOutput) return "completed";
  if (hasAnyOutput) return "in_progress";
  return "not_started";
}

export function loadRestaurantFixture() {
  ensureDataDirs();
  if (!existsSync(fixturePath)) {
    throw new Error(`Fixture package not found: ${fixturePath}`);
  }

  const runtimePackage = readJson(fixturePath);
  copyFixtureArtifacts(runtimePackage);
  return installRuntimePackage(runtimePackage, {
    sourceType: "fixture",
    fixtureSource: path.relative(rootDir, fixturePath),
  });
}

export function installRuntimePackage(runtimePackage, metadata = {}) {
  ensureDataDirs();
  if (!runtimePackage || typeof runtimePackage !== "object") {
    throw new Error("runtimePackage is required.");
  }
  const activeTaskId = metadata.activeTaskId || readJson(paths.activeTask)?.taskId || null;
  const packageMetadata = { ...metadata, activeTaskId };
  ensurePackageArtifacts(runtimePackage, packageMetadata);

  const now = new Date().toISOString();
  const packageId = getPackageId(runtimePackage);
  const packageVersion = getPackageVersion(runtimePackage);

  const caseStatuses = Object.fromEntries(
    (runtimePackage.evalCases || []).map((evalCase) => [
      evalCase.caseId,
      {
        caseId: evalCase.caseId,
        status: "draft",
        reviewerNotes: "",
        updatedAt: now,
      },
    ]),
  );

  const scoped = activeTaskWorkspacePaths(activeTaskId);
  const activePackagePath = scoped
    ? path.relative(rootDir, scoped.currentPackage)
    : "data/packages/current.json";
  if (scoped?.currentPackage) writeJson(scoped.currentPackage, runtimePackage);
  if (!activeTaskId || activeTaskId === readJson(paths.activeTask)?.taskId) {
    writeJson(paths.currentPackage, runtimePackage);
  }
  const validation = validatePackage(scoped?.currentPackage || paths.currentPackage);
  const activeProject = {
    activePackagePath,
    packageId,
    packageVersion,
    activeTaskId,
    sourceType: packageMetadata.sourceType || "generated",
    fixtureSource: packageMetadata.fixtureSource || undefined,
    generationArtifacts: packageMetadata.generationArtifacts || [],
    importArtifacts: packageMetadata.importArtifacts || [],
    loadedAt: now,
  };
  const curation = {
    packageId,
    packageVersion,
    caseStatuses,
    updatedAt: now,
  };
  const run = {
    runId: `run-${now.replaceAll(":", "").replaceAll(".", "")}`,
    packageId,
    packageVersion,
    status: "not_started",
    caseRuns: {},
    manualReviews: {},
    createdAt: now,
    updatedAt: now,
  };
  writeCurrentPackage(runtimePackage, validation, activeProject, curation, run);

  updateActiveTask(
    {
      status: "package_loaded",
      packageSummary: {
        packageId,
        packageVersion,
        caseCount: runtimePackage.evalCases?.length || 0,
        baselineName: runtimePackage.arenaEvalSpec?.baseline?.name || "Doubao",
        challengerName: runtimePackage.arenaEvalSpec?.challenger?.name || "Xiaohongshu Diandian",
        taskSpace: runtimePackage.arenaEvalSpec?.taskSpace || "restaurant recommendation",
        sourceType: packageMetadata.sourceType || "generated",
        fixtureSource: packageMetadata.fixtureSource || undefined,
        generationArtifacts: packageMetadata.generationArtifacts || [],
        importArtifacts: packageMetadata.importArtifacts || [],
        loadedAt: now,
      },
    },
    activeTaskId,
  );

  return getCurrentState();
}

function ensurePackageArtifacts(runtimePackage, metadata = {}) {
  const artifactFiles = {
    "case-index.md": buildCaseIndexMarkdown(runtimePackage),
    ...(metadata.artifactFiles || {}),
  };
  if (metadata.artifactFiles) {
    runtimePackage.generationTrace = runtimePackage.generationTrace || {};
    runtimePackage.selfCritiqueTrace = runtimePackage.selfCritiqueTrace || {};
    runtimePackage.generationTrace.artifactRefs = Object.keys(artifactFiles);
    runtimePackage.selfCritiqueTrace.traceArtifactRefs = Object.keys(artifactFiles);
  } else {
    ensureArtifactRef(runtimePackage, "generationTrace", "artifactRefs", "case-index.md");
    ensureArtifactRef(runtimePackage, "selfCritiqueTrace", "traceArtifactRefs", "case-index.md");
  }
  const scoped = activeTaskWorkspacePaths(metadata.activeTaskId);
  for (const [artifactRef, content] of Object.entries(artifactFiles)) {
    if (!artifactRef || artifactRef.includes("..") || path.isAbsolute(artifactRef)) continue;
    if (scoped?.packageDir) {
      const scopedArtifactPath = path.join(scoped.packageDir, artifactRef);
      mkdirSync(path.dirname(scopedArtifactPath), { recursive: true });
      writeFileSync(scopedArtifactPath, String(content || ""), "utf8");
    }
    if (!metadata.activeTaskId || metadata.activeTaskId === readJson(paths.activeTask)?.taskId) {
      const globalArtifactPath = path.join(path.dirname(paths.currentPackage), artifactRef);
      mkdirSync(path.dirname(globalArtifactPath), { recursive: true });
      writeFileSync(globalArtifactPath, String(content || ""), "utf8");
    }
  }
}

function ensureArtifactRef(runtimePackage, objectKey, refKey, ref) {
  runtimePackage[objectKey] = runtimePackage[objectKey] || {};
  const refs = Array.isArray(runtimePackage[objectKey][refKey]) ? runtimePackage[objectKey][refKey] : [];
  if (!refs.includes(ref)) refs.push(ref);
  runtimePackage[objectKey][refKey] = refs;
}

function buildCaseIndexMarkdown(runtimePackage) {
  const arena = runtimePackage.arenaEvalSpec || {};
  const coverage = runtimePackage.evalSetCoveragePlan || {};
  const cases = runtimePackage.evalCases || [];
  return [
    `# Case Index`,
    ``,
    `## Arena Core`,
    ``,
    `- Decision: ${arena.decisionQuestion || ""}`,
    `- Task Space: ${arena.taskSpace || ""}`,
    `- Scenario: ${arena.evaluationScenario || ""}`,
    `- Success: ${arena.successDefinition || ""}`,
    `- Failure: ${arena.failureDefinition || ""}`,
    ``,
    `## Coverage Core`,
    ``,
    `- Case Count: ${cases.length}`,
    `- Scale: ${coverage.scalePreset || "mvp"}`,
    `- Scored Dimensions: ${(coverage.scoredDimensions || []).join(", ")}`,
    `- Diagnostic Dimensions: ${(coverage.diagnosticDimensions || []).join(", ")}`,
    ``,
    `## Cases`,
    ``,
    `| Case ID | Type | Capability | Scenario |`,
    `| --- | --- | --- | --- |`,
    ...cases.map((item) => `| ${item.caseId} | ${item.caseType} | ${item.capabilityCluster || ""} | ${String(item.scenario || "").replaceAll("|", "/")} |`),
    ``,
  ].join("\n");
}

export function validatePackage(packagePath) {
  const validator = path.join(
    rootDir,
    "skills",
    "chatbot-eval-set-generator",
    "scripts",
    "validate_eval_package.mjs",
  );
  const result = spawnSync(process.execPath, [validator, "--mode", "local", packagePath], {
    cwd: rootDir,
    encoding: "utf8",
  });

  if (result.status !== 0 && !result.stdout) {
    return {
      ok: false,
      schemaErrors: [],
      consistencyErrors: [result.stderr || "Validator failed without output."],
      warnings: [],
      stats: { validationMode: "local" },
    };
  }

  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    return {
      ok: false,
      schemaErrors: [],
      consistencyErrors: [`Validator output was not JSON: ${error.message}`],
      warnings: [],
      rawStdout: result.stdout,
      rawStderr: result.stderr,
      stats: { validationMode: "local" },
    };
  }
}

function copyFixtureArtifacts(runtimePackage) {
  const artifactRefs = new Set([
    ...(runtimePackage?.generationTrace?.artifactRefs || []),
    ...(runtimePackage?.selfCritiqueTrace?.traceArtifactRefs || []),
  ]);
  for (const artifactRef of artifactRefs) {
    if (!artifactRef || artifactRef.includes("://") || path.isAbsolute(artifactRef)) continue;
    const source = path.join(path.dirname(fixturePath), artifactRef);
    const destination = path.join(path.dirname(paths.currentPackage), artifactRef);
    if (!existsSync(source)) continue;
    mkdirSync(path.dirname(destination), { recursive: true });
    copyFileSync(source, destination);
  }
}

function getPackageId(runtimePackage) {
  return (
    runtimePackage?.reportSkeletonMetadata?.reportId ||
    runtimePackage?.generationTrace?.generationRunId ||
    "current-runtime-eval-package"
  );
}

function getPackageVersion(runtimePackage) {
  return runtimePackage?.generationTrace?.packageVersion || runtimePackage?.packageVersion || "v1";
}
