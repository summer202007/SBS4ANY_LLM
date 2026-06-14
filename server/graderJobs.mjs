import { getCurrentState } from "./storage.mjs";
import { readGraderBundle, runFullGraderPipeline, writeReviewNotes } from "./graderRunner.mjs";

const jobs = new Map();
const maxLogs = 120;

export function startGraderJob({ settings = {} } = {}) {
  const state = getCurrentState();
  const taskId = state.activeTask?.taskId;
  if (!taskId) throw new Error("Create or select an evaluation task first.");
  if (!state.package) throw new Error("No runtime eval package loaded.");
  if (!state.run) throw new Error("No collection run found.");
  const now = new Date().toISOString();
  const jobId = `grader-${now.replaceAll(":", "").replaceAll(".", "")}`;
  const job = {
    jobId,
    taskId,
    status: "running",
    phase: "queued",
    startedAt: now,
    updatedAt: now,
    finishedAt: null,
    logs: [],
    settings: normalizeSettings(settings),
    error: "",
    resultSummary: null,
  };
  jobs.set(jobId, job);
  runJob(job).catch((error) => {
    pushLog(jobId, error.message);
    updateJob(jobId, {
      status: "failed",
      phase: "failed",
      error: error.message,
      finishedAt: new Date().toISOString(),
    });
  });
  return publicJob(job);
}

export function getGraderJob(jobId) {
  const job = jobs.get(jobId);
  if (!job) throw new Error(`Unknown grader job: ${jobId}`);
  return publicJob(job);
}

export function getCurrentGrader({ taskId = getCurrentState().activeTask?.taskId } = {}) {
  return readGraderBundle(taskId);
}

export function saveGraderReviewNotes({ notes } = {}) {
  const taskId = getCurrentState().activeTask?.taskId;
  if (!taskId) throw new Error("Create or select an evaluation task first.");
  return writeReviewNotes({ taskId, notes });
}

async function runJob(job) {
  pushLog(job.jobId, "Grader pipeline started.");
  const result = await runFullGraderPipeline({
    taskId: job.taskId,
    settings: job.settings,
    jobId: job.jobId,
    onEvent: (event) => {
      if (event.type === "phase") {
        updateJob(job.jobId, { phase: event.phase || event.message });
      }
      pushLog(job.jobId, event.message);
    },
  });
  updateJob(job.jobId, {
    status: result.ok ? "succeeded" : "succeeded_with_warnings",
    phase: "completed",
    finishedAt: new Date().toISOString(),
    resultSummary: {
      ok: result.ok,
      hasCleanedEvidence: result.artifacts?.hasCleanedEvidence,
      hasReport: result.artifacts?.hasReport,
      validationOk: Boolean(
        result.validationResults?.cleanedEvidence?.ok &&
          result.validationResults?.caseJudgments?.ok &&
          result.validationResults?.gradingReport?.ok &&
          result.validationResults?.reportMarkdown?.ok,
      ),
    },
  });
  pushLog(job.jobId, "Grader pipeline completed.");
}

function normalizeSettings(settings = {}) {
  return {
    communicationFit: ["scored", "diagnostic_only", "disabled"].includes(settings.communicationFit)
      ? settings.communicationFit
      : "diagnostic_only",
    reportLanguage: settings.reportLanguage === "en" ? "en" : "zh",
    evidenceMode: ["auto_minimal", "full", "brief_first"].includes(settings.evidenceMode)
      ? settings.evidenceMode
      : "auto_minimal",
  };
}

function updateJob(jobId, patch) {
  const job = jobs.get(jobId);
  if (!job) return;
  Object.assign(job, patch, { updatedAt: new Date().toISOString() });
}

function pushLog(jobId, message) {
  const job = jobs.get(jobId);
  if (!job || !message) return;
  job.logs.unshift({
    at: new Date().toISOString(),
    message: String(message),
  });
  if (job.logs.length > maxLogs) job.logs = job.logs.slice(0, maxLogs);
  job.updatedAt = new Date().toISOString();
}

function publicJob(job) {
  return {
    ...job,
    logs: job.logs.slice(0, 60),
  };
}
