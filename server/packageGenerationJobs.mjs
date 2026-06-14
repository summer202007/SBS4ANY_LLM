import { generatePackageWithLocalCodex } from "./packageGenerator.mjs";
import { buildFallbackRuntimePackage } from "./packageTemplate.mjs";
import { getCurrentState, installRuntimePackage } from "./storage.mjs";

const jobs = new Map();
const maxLogs = 80;

export function startPackageGenerationJob({ activeTask, caseCountTarget = 15 } = {}) {
  if (!activeTask) throw new Error("Create or select an evaluation task first.");
  const now = new Date().toISOString();
  const jobId = `package-generation-${now.replaceAll(":", "").replaceAll(".", "")}`;
  const job = {
    jobId,
    status: "running",
    phase: "queued",
    caseCountTarget,
    taskId: activeTask.taskId,
    taskTitle: activeTask.title,
    startedAt: now,
    updatedAt: now,
    finishedAt: null,
    logs: [],
    warning: "",
    error: "",
    resultSummary: null,
  };
  jobs.set(jobId, job);
  runJob(job, activeTask).catch((error) => {
    updateJob(jobId, {
      status: "failed",
      phase: "failed",
      error: error.message,
      finishedAt: new Date().toISOString(),
    });
  });
  return publicJob(job);
}

export function getPackageGenerationJob(jobId) {
  const job = jobs.get(jobId);
  if (!job) throw new Error(`Unknown package generation job: ${jobId}`);
  return publicJob(job);
}

async function runJob(job, activeTask) {
  pushLog(job.jobId, "Generation job started.");
  try {
    const generation = await generatePackageWithLocalCodex({
      activeTask,
      caseCountTarget: job.caseCountTarget,
      onEvent: (event) => {
        if (event.type === "phase") {
          updateJob(job.jobId, { phase: event.message });
        }
        pushLog(job.jobId, event.message);
      },
    });
    pushLog(job.jobId, "Installing generated runtime package.");
    const state = installRuntimePackage(generation.runtimePackage, {
      activeTaskId: activeTask.taskId,
      sourceType: "local_codex_generation",
      generationArtifacts: generation.artifactRefs,
      artifactFiles: generation.artifactFiles,
    });
    updateJob(job.jobId, {
      status: "succeeded",
      phase: "package_ready",
      finishedAt: new Date().toISOString(),
      resultSummary: summarizeState(state),
    });
    pushLog(job.jobId, "Package generated and validated.");
  } catch (error) {
    pushLog(job.jobId, "Local Codex did not return a package. Installing fallback draft.");
    const fallbackPackage = buildFallbackRuntimePackage(activeTask, job.caseCountTarget, error.message);
    const state = installRuntimePackage(fallbackPackage, {
      activeTaskId: activeTask.taskId,
      sourceType: "fallback_scaffold_after_local_codex_failure",
      generationArtifacts: [],
      artifactFiles: {
        "local-codex-failure.txt": error.message,
      },
    });
    updateJob(job.jobId, {
      status: "fallback",
      phase: "fallback_package_ready",
      warning: error.message,
      finishedAt: new Date().toISOString(),
      resultSummary: summarizeState(state),
    });
    pushLog(job.jobId, "Fallback package installed. Review carefully or retry generation.");
  }
}

function updateJob(jobId, patch) {
  const job = jobs.get(jobId);
  if (!job) return;
  Object.assign(job, patch, { updatedAt: new Date().toISOString() });
}

function pushLog(jobId, message) {
  const job = jobs.get(jobId);
  if (!job || !message) return;
  job.logs.push({
    at: new Date().toISOString(),
    message: String(message),
  });
  if (job.logs.length > maxLogs) job.logs = job.logs.slice(-maxLogs);
  job.updatedAt = new Date().toISOString();
}

function summarizeState(state = getCurrentState()) {
  return {
    caseCount: state.package?.evalCases?.length || 0,
    validationOk: Boolean(state.validation?.ok),
    sourceType: state.activeProject?.sourceType || "",
  };
}

function publicJob(job) {
  return {
    ...job,
    logs: job.logs.slice(-30),
  };
}
