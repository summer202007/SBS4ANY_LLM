import { createServer } from "node:http";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildReportMarkdown } from "./report.mjs";
import { captureDoubaoCurrentChrome } from "./chromeCapture.mjs";
import { buildSimulatorPrompt, buildTurnExecutionState, suggestNextUserTurnWithLocalCodex } from "./simulator.mjs";
import { captureChallengerCurrentChrome } from "./websiteAdapters.mjs";
import { generatePackageWithLocalCodex } from "./packageGenerator.mjs";
import { getPackageGenerationJob, startPackageGenerationJob } from "./packageGenerationJobs.mjs";
import { getCurrentGrader, getGraderJob, saveGraderReviewNotes, startGraderJob } from "./graderJobs.mjs";
import { exportCurrentGraderPdf, readCurrentGraderPdf } from "./pdfExporter.mjs";
import { buildFallbackRuntimePackage, buildManualTemplateWorkbook, parseManualTemplateWorkbook } from "./packageTemplate.mjs";
import {
  applySimulatorSuggestion,
  acceptCaptureSession,
  createEvaluationTask,
  discardCaptureSession,
  failCaptureSession,
  getCurrentState,
  installRuntimePackage,
  loadRestaurantFixture,
  paths,
  readRequestJson,
  rootDir,
  savePendingCapture,
  selectEvaluationTask,
  startCollectionRun,
  startCaptureSession,
  updateCaseCuration,
  updateCaseRun,
} from "./storage.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.join(__dirname, "..", "web");
const port = Number(process.env.PORT || 3000);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }
    serveStatic(res, url.pathname);
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`SBS workbench running at http://127.0.0.1:${port}`);
});

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/health") {
    sendJson(res, 200, { ok: true, rootDir });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/package/load-fixture") {
    sendJson(res, 200, loadRestaurantFixture());
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/package/generate") {
    const payload = await readRequestJson(req);
    const state = getCurrentState();
    try {
      const generation = await generatePackageWithLocalCodex({
        activeTask: state.activeTask,
        caseCountTarget: payload.caseCountTarget || 15,
      });
      sendJson(
        res,
        200,
        installRuntimePackage(generation.runtimePackage, {
          sourceType: "local_codex_generation",
          generationArtifacts: generation.artifactRefs,
          artifactFiles: generation.artifactFiles,
        }),
      );
    } catch (error) {
      const fallbackPackage = buildFallbackRuntimePackage(
        state.activeTask,
        payload.caseCountTarget || 15,
        error.message,
      );
      const nextState = installRuntimePackage(fallbackPackage, {
        sourceType: "fallback_scaffold_after_local_codex_failure",
        generationArtifacts: [],
        artifactFiles: {
          "local-codex-failure.txt": error.message,
        },
      });
      sendJson(res, 200, {
        ...nextState,
        generationWarning: error.message,
      });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/package/generate-job") {
    const payload = await readRequestJson(req);
    const state = getCurrentState();
    sendJson(
      res,
      200,
      startPackageGenerationJob({
        activeTask: state.activeTask,
        caseCountTarget: payload.caseCountTarget || 15,
      }),
    );
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/package/generation-job") {
    sendJson(res, 200, {
      job: getPackageGenerationJob(url.searchParams.get("jobId")),
      state: getCurrentState(),
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/package/template") {
    const state = getCurrentState();
    const workbook = buildManualTemplateWorkbook(state.activeTask);
    res.writeHead(200, {
      "Content-Type": "application/vnd.ms-excel; charset=utf-8",
      "Content-Disposition": 'attachment; filename="sbs-eval-package-template.xml"',
      "Cache-Control": "no-store, max-age=0",
    });
    res.end(workbook);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/package/import-template") {
    const payload = await readRequestJson(req);
    const state = getCurrentState();
    const runtimePackage = parseManualTemplateWorkbook(payload.xmlText || "", state.activeTask);
    sendJson(
      res,
      200,
      installRuntimePackage(runtimePackage, {
        sourceType: "manual_template_import",
        importArtifacts: ["uploaded-template.xml"],
        artifactFiles: {
          "uploaded-template.xml": payload.xmlText || "",
        },
      }),
    );
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/tasks") {
    sendJson(res, 200, getCurrentState());
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/tasks/create") {
    const payload = await readRequestJson(req);
    sendJson(res, 200, createEvaluationTask(payload));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/tasks/select") {
    const payload = await readRequestJson(req);
    sendJson(res, 200, selectEvaluationTask(payload.taskId));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/package/current") {
    sendJson(res, 200, getCurrentState());
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/curation/current") {
    const payload = await readRequestJson(req);
    sendJson(res, 200, updateCaseCuration(payload));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/run/start-collection") {
    sendJson(res, 200, startCollectionRun());
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/run/current") {
    sendJson(res, 200, getCurrentState());
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/run/current/case") {
    const payload = await readRequestJson(req);
    sendJson(res, 200, updateCaseRun(payload));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/capture/session/start") {
    const payload = await readRequestJson(req);
    sendJson(res, 200, startCaptureSession(payload));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/captures/doubao/current-chrome") {
    const payload = await readRequestJson(req);
    const state = startCaptureSession({
      provider: "doubao_web",
      side: "baseline",
      caseId: payload.caseId,
      turnIndex: payload.turnIndex,
    });
    const caseRun = state.run?.caseRuns?.[payload.caseId];
    const currentTurnIndex = Number(payload.turnIndex || 1);
    const turn = caseRun?.turns?.find((item) => item.turnIndex === currentTurnIndex);
    const nextTurn = caseRun?.turns?.find((item) => item.turnIndex === currentTurnIndex + 1);
    try {
      const capture = await captureDoubaoCurrentChrome({
        caseId: payload.caseId,
        turnIndex: currentTurnIndex,
        userMessage: turn?.userMessage || "",
        nextUserMessage: nextTurn?.userMessage || "",
      });
      sendJson(res, 200, savePendingCapture(capture));
    } catch (error) {
      sendJson(res, 200, failCaptureSession({
        error: error.message,
        caseId: payload.caseId,
        turnIndex: currentTurnIndex,
      }));
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/captures/challenger/current-chrome") {
    const payload = await readRequestJson(req);
    const state = startCaptureSession({
      provider: "website_adapter",
      side: "challenger",
      caseId: payload.caseId,
      turnIndex: payload.turnIndex,
    });
    const caseRun = state.run?.caseRuns?.[payload.caseId];
    const currentTurnIndex = Number(payload.turnIndex || 1);
    const turn = caseRun?.turns?.find((item) => item.turnIndex === currentTurnIndex);
    const nextTurn = caseRun?.turns?.find((item) => item.turnIndex === currentTurnIndex + 1);
    try {
      const capture = await captureChallengerCurrentChrome({
        caseId: payload.caseId,
        turnIndex: currentTurnIndex,
        userMessage: turn?.userMessage || "",
        nextUserMessage: nextTurn?.userMessage || "",
        firstTimeCalibration: Boolean(payload.firstTimeCalibration),
        targetUrl: payload.targetUrl || "",
      });
      assertCaptureReadyForReview(capture);
      sendJson(res, 200, savePendingCapture(capture));
    } catch (error) {
      sendJson(res, 200, failCaptureSession({
        error: error.message,
        caseId: payload.caseId,
        turnIndex: currentTurnIndex,
        provider: "website_adapter",
        side: "challenger",
      }));
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/capture/session/accept") {
    const payload = await readRequestJson(req);
    sendJson(res, 200, acceptCaptureSession(payload));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/capture/session/discard") {
    const payload = await readRequestJson(req);
    sendJson(res, 200, discardCaptureSession(payload));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/report/current") {
    sendJson(res, 200, { markdown: buildReportMarkdown(getCurrentState()) });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/grader/current") {
    sendJson(res, 200, { grader: getCurrentGrader() });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/grader/run-job") {
    const payload = await readRequestJson(req);
    sendJson(res, 200, {
      job: startGraderJob({ settings: payload.settings || {} }),
      grader: getCurrentGrader(),
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/grader/job") {
    sendJson(res, 200, {
      job: getGraderJob(url.searchParams.get("jobId")),
      grader: getCurrentGrader(),
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/grader/review-notes") {
    const payload = await readRequestJson(req);
    sendJson(res, 200, { grader: saveGraderReviewNotes({ notes: payload.notes || {} }) });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/grader/export-pdf") {
    sendJson(res, 200, await exportCurrentGraderPdf());
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/grader/report-pdf") {
    const pdf = readCurrentGraderPdf();
    res.writeHead(200, {
      "Content-Type": "application/pdf",
      "Content-Disposition": buildAttachmentDisposition(pdf.filename),
      "Cache-Control": "no-store, max-age=0",
    });
    res.end(pdf.bytes);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/simulator/turn-packet") {
    const payload = await readRequestJson(req);
    const state = getCurrentState();
    const turnExecutionState = buildTurnExecutionState({
      runtimePackage: state.package,
      activeProject: state.activeProject,
      run: state.run,
      ...payload,
    });
    sendJson(res, 200, {
      mode: "packet_only",
      turnExecutionState,
      prompt: buildSimulatorPrompt(turnExecutionState),
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/simulator/suggest-next-turn") {
    const payload = await readRequestJson(req);
    const state = getCurrentState();
    const caseRun = state.run?.caseRuns?.[payload.caseId];
    if (!caseRun) throw new Error(`Unknown caseId: ${payload.caseId}`);
    const currentTurnIndex = Number(payload.turnIndex || 1);
    validateSimulatorPrerequisites(caseRun, currentTurnIndex);
    const priorTurns = buildSimulatorPriorTurns(caseRun, currentTurnIndex);
    const latestPriorTurn = priorTurns[priorTurns.length - 1] || {};
    const turnExecutionState = buildTurnExecutionState({
      runtimePackage: state.package,
      activeProject: state.activeProject,
      run: state.run,
      caseId: payload.caseId,
      currentTurnIndex,
      sideLabel: "Side A",
      priorTurns,
      lastModelResponse: latestPriorTurn.sideAResponse || "",
      trackedState: {},
      trajectoryNotesSoFar: collectTrajectoryNotes(caseRun, currentTurnIndex),
    });
    const simulatorResult = await suggestNextUserTurnWithLocalCodex(turnExecutionState);
    const nextState = applySimulatorSuggestion({
      caseId: payload.caseId,
      turnIndex: currentTurnIndex,
      simulatorResult,
      turnExecutionState,
    });
    if (!simulatorResult.validatorResult.ok) {
      sendJson(res, 422, {
        error: `Local model suggestion failed validation: ${simulatorResult.validatorResult.errors.join("; ")}`,
        state: nextState,
      });
      return;
    }
    sendJson(res, 200, nextState);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/report/download") {
    const markdown = buildReportMarkdown(getCurrentState());
    writeFileSync(paths.currentReport, markdown, "utf8");
    sendJson(res, 200, { ok: true, path: path.relative(rootDir, paths.currentReport), markdown });
    return;
  }

  sendJson(res, 404, { error: `Unknown API route: ${req.method} ${url.pathname}` });
}

function buildAttachmentDisposition(filename) {
  const safeAscii = String(filename || "sbs-report.pdf")
    .replace(/[^\x20-\x7E]+/g, "-")
    .replace(/["\\]/g, "")
    .replace(/^-+|-+$/g, "") || "sbs-report.pdf";
  return `attachment; filename="${safeAscii}"; filename*=UTF-8''${encodeURIComponent(filename || "sbs-report.pdf")}`;
}

function validateSimulatorPrerequisites(caseRun, currentTurnIndex) {
  if (currentTurnIndex <= 1) throw new Error("Local Model Reply is only available for turn 2+.");
  const currentTurn = (caseRun.turns || []).find((turn) => turn.turnIndex === currentTurnIndex);
  if (!currentTurn) throw new Error(`Turn ${currentTurnIndex} does not exist yet. Add the turn first.`);
  const previousTurn = (caseRun.turns || []).find((turn) => turn.turnIndex === currentTurnIndex - 1);
  if (!previousTurn) throw new Error(`Previous turn ${currentTurnIndex - 1} is missing.`);
  for (const side of ["baseline", "challenger"]) {
    if (!isSideTurnComplete(previousTurn, side)) {
      throw new Error(`Previous turn ${currentTurnIndex - 1} ${side} response is required before local model reply.`);
    }
  }
}

function isSideTurnComplete(turn, side) {
  const caveatType = String(turn[`${side}CaveatType`] || "none");
  if (caveatType !== "none") return Boolean(String(turn[`${side}Caveat`] || "").trim());
  return Boolean(String(turn[`${side}Output`] || "").trim());
}

function buildSimulatorPriorTurns(caseRun, currentTurnIndex) {
  return (caseRun.turns || [])
    .filter((turn) => turn.turnIndex < currentTurnIndex)
    .map((turn) => ({
      turnIndex: turn.turnIndex,
      userMessage: turn.userMessage || "",
      sideAResponse: buildSideResponse(turn, "baseline"),
      sideBResponse: buildSideResponse(turn, "challenger"),
      newlyExposedFacts: turn.newlyExposedFacts || [],
      branchRuleId: turn.branchRuleId || "",
    }));
}

function buildSideResponse(turn, side) {
  const caveatType = String(turn[`${side}CaveatType`] || "none");
  if (caveatType !== "none") {
    return `[Collection caveat: ${caveatType}] ${turn[`${side}Caveat`] || ""}`.trim();
  }
  return [
    turn[`${side}Output`] ? `Final output:\n${turn[`${side}Output`]}` : "",
    turn[`${side}IntentExpansionNotes`] ? `Intent/query expansion:\n${turn[`${side}IntentExpansionNotes`]}` : "",
    turn[`${side}FollowupSuggestionNotes`] ? `Follow-up suggestions:\n${turn[`${side}FollowupSuggestionNotes`]}` : "",
    turn[`${side}VisibleProcessNotes`] ? `Visible process:\n${turn[`${side}VisibleProcessNotes`]}` : "",
    turn[`${side}SourceNotes`] ? `Sources/citations:\n${turn[`${side}SourceNotes`]}` : "",
    turn[`${side}ToolcallNotes`] ? `Tool/execution notes:\n${turn[`${side}ToolcallNotes`]}` : "",
  ].filter(Boolean).join("\n\n");
}

function collectTrajectoryNotes(caseRun, currentTurnIndex) {
  return (caseRun.turns || [])
    .filter((turn) => turn.turnIndex < currentTurnIndex)
    .map((turn) => turn.simulatorTrajectoryNotes)
    .filter(Boolean)
    .join("\n");
}

function assertCaptureReadyForReview(capture) {
  const blocked = capture?.adapterInfo?.status === "blocked" ||
    (capture?.qaResult?.ok === false && capture?.qaResult?.adapterReadiness === "blocked");
  if (!blocked) return;
  const issue = capture?.qaResult?.blockingIssues?.[0];
  const message = issue?.message || capture?.captureNotes?.[0] || "Capture failed QA checks.";
  throw new Error(message);
}

function serveStatic(res, pathname) {
  const normalized = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(webDir, normalized));
  if (!filePath.startsWith(webDir) || !existsSync(filePath)) {
    sendText(res, 404, "Not found");
    return;
  }

  const ext = path.extname(filePath);
  res.writeHead(200, {
    "Content-Type": mimeTypes[ext] || "application/octet-stream",
    "Cache-Control": "no-store, max-age=0",
  });
  res.end(readFileSync(filePath));
}

function sendJson(res, status, value) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, max-age=0",
  });
  res.end(JSON.stringify(value));
}

function sendText(res, status, value) {
  res.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store, max-age=0",
  });
  res.end(value);
}
