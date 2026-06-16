import { api } from "./api.js";
import { renderCasesView } from "./render/casesView.js";
import { renderCollectView } from "./render/collectView.js";
import { renderPackageView } from "./render/packageView.js";
import { renderReportView } from "./render/reportView.js";
import { renderReviewView } from "./render/reviewView.js";
import { renderArenaSetupForm } from "./render/setupView.js";
import { renderTasksView } from "./render/tasksView.js";
import {
  setCaseUiState,
  setCollectUiState,
  setCurrentView,
  setHealth,
  setGraderState,
  setPackageState,
  setPackageGenerationState,
  state,
} from "./state.js";

const viewRoot = document.querySelector("#viewRoot");
const statusBar = document.querySelector("#statusBar");
const appLayout = document.querySelector("#appLayout");
const navItems = [...document.querySelectorAll(".nav-item")];
const backToTasksButton = document.querySelector("#backToTasks");
const taskScopedItems = [...document.querySelectorAll(".nav-task")];
const confirmDialog = document.querySelector("#confirmDialog");
const confirmTitle = document.querySelector("#confirmTitle");
const confirmMessage = document.querySelector("#confirmMessage");
const confirmCancel = document.querySelector("#confirmCancel");
const confirmOk = document.querySelector("#confirmOk");

navItems.forEach((button) => {
  button.addEventListener("click", () => {
    setCurrentView(button.dataset.view);
    render();
  });
});

backToTasksButton.addEventListener("click", async () => {
  const confirmed = await confirmAction({
    title: "Return to Tasks",
    message: "Current task progress is saved automatically.",
    okLabel: "Return",
  });
  if (!confirmed) return;
  setCurrentView("tasks");
  render();
});

init();
window.setInterval(syncCollectStateFromServer, 3000);
window.setInterval(syncGraderStateFromServer, 3000);

async function init() {
  try {
    const [health, packageState, graderState] = await Promise.all([api.health(), api.getCurrentPackage(), api.getGrader()]);
    setHealth(health);
    setPackageState(packageState);
    setGraderState({ bundle: graderState.grader });
    setStatus(`Local server ready. Root: ${health.rootDir}`);
  } catch (error) {
    setStatus(error.message, "bad");
  }
  render();
}

async function syncGraderStateFromServer() {
  if (!["review", "report"].includes(state.currentView)) return;
  try {
    if (state.grader.job?.status === "running") {
      await pollGraderJobOnce(state.grader.job.jobId);
      return;
    }
    const graderState = await api.getGrader();
    if (!graderStateSignatureChanged(state.grader.bundle, graderState.grader)) return;
    setGraderState({ bundle: graderState.grader });
    render();
  } catch {
    // Best-effort refresh only.
  }
}

async function syncCollectStateFromServer() {
  if (state.currentView !== "collect") return;
  try {
    const packageState = await api.getCurrentPackage();
    if (!collectStateSignatureChanged(state.packageState, packageState)) return;
    setPackageState(packageState);
    render();
  } catch {
    // Background sync is best-effort; foreground actions still surface errors.
  }
}

function collectStateSignatureChanged(previousState, nextState) {
  return collectStateSignature(previousState) !== collectStateSignature(nextState);
}

function collectStateSignature(packageState) {
  return [
    packageState?.run?.updatedAt,
    packageState?.run?.status,
    packageState?.activeTask?.updatedAt,
    packageState?.activeTask?.arena?.challenger?.captureTemplate?.providerId,
    packageState?.activeTask?.arena?.challenger?.captureTemplate?.boundAt,
    packageState?.adapters?.updatedAt,
    captureSessionSignature(packageState?.run?.captureSession),
  ].join("|");
}

function captureSessionSignature(session) {
  const compact = (session) => {
    if (!session) return "";
    return [
      session.sessionId,
      session.status,
      session.side,
      session.caseId,
      session.turnIndex,
      session.updatedAt,
      session.lastError,
      session.pendingCapture?.captureId,
      session.pendingCapture?.adapterInfo?.status,
      session.pendingCapture?.qaResult?.adapterReadiness,
    ].join("|");
  };
  return compact(session);
}

function graderStateSignatureChanged(previousBundle, nextBundle) {
  return graderStateSignature(previousBundle) !== graderStateSignature(nextBundle);
}

function graderStateSignature(bundle) {
  const cleanedCases = bundle?.cleanedEvidence?.caseEvidence || [];
  const report = bundle?.gradingReport || {};
  return JSON.stringify({
    stale: bundle?.summary?.stale,
    hasCleanedEvidence: bundle?.summary?.hasCleanedEvidence,
    hasReport: bundle?.summary?.hasReport,
    reportGeneratedAt: bundle?.summary?.reportGeneratedAt,
    cleanedGeneratedAt: bundle?.cleanedEvidence?.generatedAt,
    coverageStatus: bundle?.cleanedEvidence?.coverageSummary?.coverageStatus,
    caseStatuses: cleanedCases.map((item) => [
      item.caseId,
      item.status,
      item.turnEvidence?.length || 0,
      item.caseFindings?.length || 0,
    ]),
    verdict: report.executiveVerdict?.verdict,
    confidence: report.executiveVerdict?.confidence || report.evaluationValidity?.confidence,
    caseTableLength: report.caseTable?.length || 0,
  });
}

function render() {
  const isTaskSelection = state.currentView === "tasks";
  appLayout.classList.toggle("task-selection-layout", isTaskSelection);
  taskScopedItems.forEach((item) => {
    item.hidden = isTaskSelection;
  });
  navItems.forEach((button) => {
    if (button.classList.contains("nav-primary")) {
      button.hidden = !isTaskSelection;
    }
    button.classList.toggle("active", button.dataset.view === state.currentView);
  });

  if (state.currentView === "tasks") {
    renderTasksView(viewRoot, state.packageState, {
      graderBundle: state.grader.bundle,
      onNewTask: ({ dialog, mount }) => {
        renderArenaSetupForm(mount, {
          onCancel: () => dialog.close(),
          onCreateTask: async (payload) => {
            await withStatus("Creating evaluation task...", async () => {
              const packageState = await api.createTask(payload);
              setPackageState(packageState);
              dialog.close();
              setCurrentView("package");
              render();
            }, "Evaluation task created. Generate or import an eval package next.");
          },
        });
        dialog.showModal();
      },
      onSelectTask: async (taskId) => {
        await withStatus("Selecting evaluation task...", async () => {
          const packageState = await api.selectTask(taskId);
          setPackageState(packageState);
          render();
        }, "Task selected.");
      },
      onOpenTask: async (taskId) => {
        await withStatus("Opening evaluation task...", async () => {
          const packageState = await api.selectTask(taskId);
          setPackageState(packageState);
          setCurrentView("package");
          render();
        }, "Task opened.");
      },
      onOpenReport: async (taskId) => {
        await withStatus("Opening SBS verdict...", async () => {
          const packageState = await api.selectTask(taskId);
          const graderState = await api.getGrader();
          setPackageState(packageState);
          setGraderState({ bundle: graderState.grader });
          setCurrentView("report");
          render();
        }, "SBS verdict opened.");
      },
      onDeleteTask: async (taskId) => {
        const task = state.packageState?.tasks?.items?.find((item) => item.taskId === taskId);
        const confirmed = await confirmAction({
          title: "Delete Evaluation Task",
          message: `Delete "${task?.title || taskId}"? This removes its package, collection, review, and report artifacts from the local app.`,
          okLabel: "Delete",
        });
        if (!confirmed) return;
        await withStatus("Deleting evaluation task...", async () => {
          const packageState = await api.deleteTask(taskId);
          setPackageState(packageState);
          const graderState = await api.getGrader();
          setGraderState({ bundle: graderState.grader, job: null });
          setCurrentView("tasks");
          render();
        }, "Evaluation task deleted.");
      },
    });
    return;
  }

  if (state.currentView === "package") {
    renderPackageView(viewRoot, state.packageState, {
      generationJob: state.packageGeneration.job,
      onGeneratePackage: async ({ caseCountTarget }) => {
        await withStatus("Starting local Codex package generation...", async () => {
          const job = await api.startPackageGeneration({ caseCountTarget });
          setPackageGenerationState({ job });
          render();
          pollPackageGenerationJob(job.jobId);
        }, "Local Codex generation started. You can watch progress below.");
      },
      onImportTemplate: async ({ xmlText }) => {
        await withStatus("Importing filled eval template...", async () => {
          const packageState = await api.importPackageTemplate({ xmlText });
          setPackageState(packageState);
          render();
        }, "Template imported. Review the package before curating cases.");
      },
    });
    return;
  }

  if (state.currentView === "cases") {
    renderCasesView(viewRoot, state.packageState, {
      ...state.cases,
      onSelectCase: (caseId) => {
        setCaseUiState({ selectedCaseId: caseId });
        render();
        requestAnimationFrame(() => scrollCaseDetailToTop());
        setStatus(`Selected case ${caseId}.`);
      },
      onFilterChange: (patch) => {
        setCaseUiState(patch);
        render();
      },
      onSaveCuration: async (payload) => {
        await withStatus("Saving case curation...", async () => {
          const packageState = await api.saveCaseCuration(payload);
          setPackageState(packageState);
          const nextCaseId = payload.advanceAfterSave
            ? findNextDraftCaseId(packageState, payload.caseId, state.cases)
            : payload.caseId;
          setCaseUiState({ selectedCaseId: nextCaseId });
          render();
          requestAnimationFrame(() => scrollCasesToTop());
        }, "Case curation saved.");
      },
      onStartCollection: async () => {
        await withStatus("Starting collection...", async () => {
          const packageState = await api.startCollection();
          setPackageState(packageState);
          const firstApprovedCaseId = findFirstApprovedCaseId(packageState);
          setCollectUiState({ selectedCaseId: firstApprovedCaseId });
          setCurrentView("collect");
          render();
          window.scrollTo({ top: 0, behavior: "auto" });
        }, "Collection started.");
      },
    });
    return;
  }

  if (state.currentView === "collect") {
    renderCollectView(viewRoot, state.packageState, {
      ...state.collect,
      adapters: state.packageState?.adapters,
      onSelectCase: (caseId) => {
        setCollectUiState({ selectedCaseId: caseId });
        render();
      },
      onOpenChallengerCapture: ({ caseId, turnIndex }) => {
        const key = `${caseId}::${turnIndex}`;
        setCollectUiState({
          challengerCaptureSetup: {
            ...(state.collect.challengerCaptureSetup || {}),
            [key]: {
              ...(state.collect.challengerCaptureSetup || {})[key],
              open: true,
            },
          },
        });
        render();
      },
      onChallengerCaptureUrlChange: ({ caseId, turnIndex, url }) => {
        const key = `${caseId}::${turnIndex}`;
        setCollectUiState({
          challengerCaptureSetup: {
            ...(state.collect.challengerCaptureSetup || {}),
            [key]: {
              ...(state.collect.challengerCaptureSetup || {})[key],
              open: true,
              url,
            },
          },
        });
        render();
      },
      onSaveCaseRun: async (payload) => {
        await withStatus("Saving collection...", async () => {
          const packageState = await api.saveCaseRun(payload);
          setPackageState(packageState);
          const nextCaseId = payload.autoAdvance
            ? findNextCollectCaseId(packageState, payload.caseId)
            : payload.caseId;
          setCollectUiState({ selectedCaseId: nextCaseId });
          render();
          if (payload.autoAdvance) window.scrollTo({ top: 0, behavior: "auto" });
        }, "Collection saved.");
      },
      onCaptureDoubao: async ({ caseId, turnIndex }) => {
        await withStatus("Capturing current Chrome tab for Doubao...", async () => {
          const packageState = await api.captureDoubaoCurrentChrome({ caseId, turnIndex });
          setPackageState(packageState);
          render();
          if (packageState.run?.captureSession?.status === "failed") {
            throw new Error(packageState.run.captureSession.lastError || "Doubao capture failed.");
          }
        }, "Doubao capture ready for review.");
      },
      onCaptureChallenger: async ({ caseId, turnIndex, firstTimeCalibration, targetUrl }) => {
        const stopPolling = startCaptureStatusPolling({ caseId, turnIndex });
        await withStatus(firstTimeCalibration ? "Testing first-time website capture setup..." : "Capturing challenger website from current Chrome tab...", async () => {
          try {
            const packageState = await api.captureChallengerCurrentChrome({ caseId, turnIndex, firstTimeCalibration, targetUrl });
            setPackageState(packageState);
            render();
            const session = packageState.run?.captureSession;
            if (session?.status === "failed") {
              throw new Error(session.lastError || "Challenger capture failed.");
            }
            if (session?.pendingCapture?.qaResult && !session.pendingCapture.qaResult.ok) {
              setStatus("Challenger adapter is not ready. Review QA issues or use manual paste.", "bad");
            }
          } finally {
            stopPolling();
          }
        }, firstTimeCalibration ? "First-time setup test ready for review." : "Challenger website capture ready for review.");
      },
      onAcceptCapture: async ({ sessionId }) => {
        await withStatus("Accepting capture...", async () => {
          const packageState = await api.acceptCapture({ sessionId });
          setPackageState(packageState);
          render();
        }, "Capture accepted.");
      },
      onLocalModelReply: async ({ caseId, turnIndex, draftRun }) => {
        await withStatus("Generating next user turn with local Codex...", async () => {
          try {
            let packageState = await api.saveCaseRun(draftRun);
            setPackageState(packageState);
            packageState = await api.suggestNextTurn({ caseId, turnIndex });
            setPackageState(packageState);
            setCollectUiState({ selectedCaseId: caseId });
          } finally {
            render();
          }
        }, "Local model reply inserted into Shared user message.");
      },
      onDiscardCapture: async ({ sessionId }) => {
        await withStatus("Discarding capture...", async () => {
          const previousSession = state.packageState?.run?.captureSession;
          const packageState = await api.discardCapture({ sessionId });
          setPackageState(packageState);
          if (previousSession?.side === "challenger") {
            const key = `${previousSession.caseId}::${Number(previousSession.turnIndex || 1)}`;
            const nextSetup = { ...(state.collect.challengerCaptureSetup || {}) };
            delete nextSetup[key];
            setCollectUiState({ challengerCaptureSetup: nextSetup });
          }
          render();
        }, "Capture discarded. Manual paste is still available.");
      },
    });
    return;
  }

  if (state.currentView === "review") {
    renderReviewView(viewRoot, state.packageState, state.grader.bundle, {
      job: state.grader.job,
      onRunGrader: async ({ settings }) => {
        await withStatus("Starting local Codex review + report pipeline...", async () => {
          const result = await api.startGraderJob({ settings });
          setGraderState({ job: result.job, bundle: result.grader });
          render();
          pollGraderJob(result.job.jobId);
        }, "Local Codex grader started. Cleaned evidence will appear first; report will continue in the background.");
      },
    });
    return;
  }

  if (state.currentView === "report") {
    renderReportView(viewRoot, state.packageState, state.grader.bundle, {
      job: state.grader.job,
      pdfExporting: state.grader.pdfExporting,
      onRunGrader: async ({ settings }) => {
        await withStatus("Starting local Codex review + report pipeline...", async () => {
          const result = await api.startGraderJob({ settings });
          setGraderState({ job: result.job, bundle: result.grader });
          render();
          pollGraderJob(result.job.jobId);
        }, "Local Codex grader started.");
      },
      onExportPdf: async () => {
        if (state.grader.pdfExporting) return;
        setGraderState({ pdfExporting: true });
        render();
        try {
          await withStatus("Preparing document-grade PDF report for download...", async () => {
            const result = await api.exportGraderPdf();
            const anchor = document.createElement("a");
            anchor.href = result.downloadUrl || "/api/grader/report-pdf";
            anchor.download = result.filename || "";
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            setStatus(`PDF exported: ${result.filename || result.pdfPath}`);
          }, "PDF download started and the generated file was revealed in Finder.");
        } finally {
          setGraderState({ pdfExporting: false });
          render();
        }
      },
    });
    return;
  }

  viewRoot.innerHTML = `
    <section class="empty-state">
      <p class="eyebrow">Coming next</p>
      <h2>${labelForView(state.currentView)}</h2>
      <p>This view is reserved for the next sprint phase after Package Overview review.</p>
    </section>
  `;
}

async function pollGraderJob(jobId) {
  try {
    const result = await api.getGraderJob(jobId);
    setGraderState({ job: result.job, bundle: result.grader });
    render();
    if (["running"].includes(result.job.status)) {
      window.setTimeout(() => pollGraderJob(jobId), 2500);
      return;
    }
    if (result.job.status === "succeeded") {
      setStatus("Review and report are ready.");
      return;
    }
    if (result.job.status === "succeeded_with_warnings") {
      setStatus("Review and report are ready with validation warnings. Check the quality audit.", "bad");
      return;
    }
    setStatus(result.job.error || "Grader pipeline failed.", "bad");
  } catch (error) {
    setStatus(error.message, "bad");
  }
}

async function pollGraderJobOnce(jobId) {
  const result = await api.getGraderJob(jobId);
  setGraderState({ job: result.job, bundle: result.grader });
}

async function pollPackageGenerationJob(jobId) {
  try {
    const result = await api.getPackageGenerationJob(jobId);
    setPackageGenerationState({ job: result.job });
    setPackageState(result.state);
    render();
    if (["running"].includes(result.job.status)) {
      window.setTimeout(() => pollPackageGenerationJob(jobId), 2500);
      return;
    }
    if (result.job.status === "succeeded") {
      setStatus("Eval package generated. Review the package before curating cases.");
      return;
    }
    if (result.job.status === "fallback") {
      setStatus("Local Codex did not finish. SBS generated a fallback draft package; review carefully or retry generation.", "bad");
      return;
    }
    setStatus(result.job.error || "Package generation failed.", "bad");
  } catch (error) {
    setStatus(error.message, "bad");
  }
}

function scrollCasesToTop() {
  window.scrollTo({ top: 0, behavior: "auto" });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
  scrollCaseDetailToTop();
  document.querySelector(".case-table")?.scrollTo?.({ top: 0, behavior: "auto" });
  setTimeout(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    scrollCaseDetailToTop();
  }, 0);
}

function scrollCaseDetailToTop() {
  document.querySelector(".case-detail-panel")?.scrollTo?.({ top: 0, behavior: "auto" });
}

async function withStatus(message, action, successMessage = "Done.") {
  setStatus(message);
  try {
    await action();
    setStatus(successMessage);
  } catch (error) {
    if (error instanceof SoftStatusError) {
      setStatus(error.message, "bad");
      return;
    }
    setStatus(error.message, "bad");
  }
}

class SoftStatusError extends Error {}

function startCaptureStatusPolling({ caseId, turnIndex }) {
  let stopped = false;
  const timer = window.setInterval(async () => {
    if (stopped) return;
    try {
      const packageState = await api.getCurrentPackage();
      const session = packageState.run?.captureSession;
      const sameCapture =
        session?.caseId === caseId &&
        Number(session?.turnIndex || 1) === Number(turnIndex || 1);
      if (!sameCapture) return;
      if (session.status && session.status !== "active") {
        setPackageState(packageState);
        render();
        stopped = true;
        window.clearInterval(timer);
      }
    } catch {
      // Keep the original capture request as the source of truth; polling is only a recovery path.
    }
  }, 3000);
  return () => {
    stopped = true;
    window.clearInterval(timer);
  };
}

function setStatus(message, tone = "neutral") {
  statusBar.textContent = compactStatusMessage(message);
  statusBar.title = String(message || "");
  statusBar.dataset.tone = tone;
}

function compactStatusMessage(message) {
  const text = String(message || "");
  if (text.length <= 500) return text;
  return `${text.slice(0, 500)}...`;
}

function confirmAction({ title, message, okLabel = "Continue", cancelLabel = "Cancel" }) {
  if (!confirmDialog || typeof confirmDialog.showModal !== "function") {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }

  confirmTitle.textContent = title;
  confirmMessage.textContent = message;
  confirmOk.textContent = okLabel;
  confirmCancel.textContent = cancelLabel;

  return new Promise((resolve) => {
    const handleClose = () => {
      confirmDialog.removeEventListener("close", handleClose);
      resolve(confirmDialog.returnValue === "ok");
    };
    confirmDialog.addEventListener("close", handleClose);
    confirmDialog.showModal();
  });
}

function labelForView(view) {
  return {
    tasks: "Evaluation Tasks",
    package: "Package Overview",
    cases: "Case Curation",
    collect: "Manual Collection",
    review: "Side-by-Side Review",
    report: "Report",
  }[view] || view;
}

function findNextDraftCaseId(packageState, currentCaseId, caseUiState) {
  const runtimePackage = packageState?.package;
  const cases = runtimePackage?.evalCases || [];
  const caseStatuses = packageState?.curation?.caseStatuses || {};
  if (!cases.length) return currentCaseId;

  const matchesFilter = (evalCase) => {
    const status = caseStatuses[evalCase.caseId]?.status || "draft";
    return (
      (!caseUiState.caseTypeFilter ||
        caseUiState.caseTypeFilter === "all" ||
        evalCase.caseType === caseUiState.caseTypeFilter) &&
      (!caseUiState.caseStatusFilter ||
        caseUiState.caseStatusFilter === "all" ||
        status === caseUiState.caseStatusFilter)
    );
  };

  const currentIndex = cases.findIndex((item) => item.caseId === currentCaseId);
  const ordered = [...cases.slice(currentIndex + 1), ...cases.slice(0, Math.max(currentIndex, 0))];
  return (
    ordered.find((evalCase) => (caseStatuses[evalCase.caseId]?.status || "draft") === "draft" && matchesFilter(evalCase))
      ?.caseId ||
    cases.find(matchesFilter)?.caseId ||
    currentCaseId
  );
}

function findFirstApprovedCaseId(packageState) {
  const cases = packageState?.package?.evalCases || [];
  const statuses = packageState?.curation?.caseStatuses || {};
  return cases.find((evalCase) => statuses[evalCase.caseId]?.status === "approved")?.caseId || null;
}

function findNextCollectCaseId(packageState, currentCaseId) {
  const cases = packageState?.package?.evalCases || [];
  const statuses = packageState?.curation?.caseStatuses || {};
  const caseRuns = packageState?.run?.caseRuns || {};
  const approved = cases.filter((evalCase) => statuses[evalCase.caseId]?.status === "approved");
  const currentIndex = approved.findIndex((item) => item.caseId === currentCaseId);
  const ordered = [...approved.slice(currentIndex + 1), ...approved.slice(0, Math.max(currentIndex, 0))];
  return (
    ordered.find((evalCase) => (caseRuns[evalCase.caseId]?.status || "not_started") !== "completed")?.caseId ||
    approved[currentIndex]?.caseId ||
    approved[0]?.caseId ||
    currentCaseId
  );
}
