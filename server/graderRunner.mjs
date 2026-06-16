import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { activeTaskWorkspacePaths, getCurrentState, readJson, rootDir, writeJson } from "./storage.mjs";

const skillPath = path.join(rootDir, "skills", "chatbot-sbs-grader", "SKILL.md");
const graderTimeoutMs = 25 * 60 * 1000;

export function getGraderPaths(taskId = getCurrentState().activeTask?.taskId) {
  if (!taskId) throw new Error("Create or select an evaluation task first.");
  const scoped = activeTaskWorkspacePaths(taskId);
  if (!scoped) throw new Error(`No task workspace found for ${taskId}.`);
  const graderDir = scoped.graderDir;
  return {
    taskId,
    taskRoot: scoped.taskRoot,
    graderDir,
    jobsDir: scoped.graderJobsDir,
    packagePath: scoped.currentPackage,
    runPath: scoped.currentRun,
    cleanedPrecleanPath: path.join(graderDir, "cleaned-evidence.preclean.json"),
    cleanedEvidencePath: path.join(graderDir, "cleaned-evidence.json"),
    cleaningSummaryPath: path.join(graderDir, "cleaning-summary.md"),
    reviewNotesPath: path.join(graderDir, "review-notes.json"),
    caseJudgmentsPath: path.join(graderDir, "case-judgments.json"),
    gradingReportPath: path.join(graderDir, "grading-report.json"),
    qualityAuditPath: path.join(graderDir, "grader-quality-audit.json"),
    reportMarkdownPath: path.join(graderDir, "report.md"),
    reportZhMarkdownPath: path.join(graderDir, "report.zh.md"),
    reportPrintHtmlPath: path.join(graderDir, "report.print.html"),
    reportPdfPath: path.join(graderDir, "report.pdf"),
    validationResultsPath: path.join(graderDir, "validation-results.json"),
    cleanTracePath: path.join(graderDir, "invocation-trace.clean.json"),
    reportTracePath: path.join(graderDir, "invocation-trace.report.json"),
    reportRepairTracePath: path.join(graderDir, "invocation-trace.report-repair.json"),
  };
}

export function readGraderBundle(taskId = getCurrentState().activeTask?.taskId) {
  if (!taskId) return emptyBundle();
  const p = getGraderPaths(taskId);
  return {
    taskId,
    summary: summarizeArtifacts(p),
    cleanedEvidence: readOptionalJson(p.cleanedEvidencePath),
    caseJudgments: readOptionalJson(p.caseJudgmentsPath),
    gradingReport: readOptionalJson(p.gradingReportPath),
    qualityAudit: readOptionalJson(p.qualityAuditPath),
    reportMarkdown: readOptionalText(p.reportMarkdownPath),
    reportZhMarkdown: readOptionalText(p.reportZhMarkdownPath),
    validationResults: readOptionalJson(p.validationResultsPath),
    reviewNotes: readOptionalJson(p.reviewNotesPath) || {},
  };
}

export function writeReviewNotes({ taskId, notes } = {}) {
  const p = getGraderPaths(taskId);
  mkdirSync(p.graderDir, { recursive: true });
  writeJson(p.reviewNotesPath, {
    updatedAt: new Date().toISOString(),
    notes: notes && typeof notes === "object" ? notes : {},
  });
  return readGraderBundle(taskId);
}

export async function runFullGraderPipeline({ taskId, settings = {}, jobId, onEvent } = {}) {
  const p = getGraderPaths(taskId);
  const state = getCurrentState();
  const localCodexModel = state.activeTask?.arena?.localCodexModel;
  mkdirSync(p.graderDir, { recursive: true });
  mkdirSync(p.jobsDir, { recursive: true });
  if (!existsSync(p.packagePath)) throw new Error("No runtime eval package found for the active task.");
  if (!existsSync(p.runPath)) throw new Error("No collected run found for the active task.");

  const inputHash = hashFiles([p.packagePath, p.runPath, p.reviewNotesPath].filter(Boolean));
  emit(onEvent, "preclean", "Running deterministic evidence pre-clean.");
  const precleanValidation = runDeterministicPreclean(p);
  emit(onEvent, "preclean_complete", "Deterministic pre-clean completed.");

  emit(onEvent, "cleaning", "Starting Local Codex evidence cleaning with chatbot-sbs-grader.");
  const cleanManifest = await runCodexStage({
    stage: "evidence_cleaning",
    prompt: buildCleaningPrompt(p, { settings, jobId, inputHash }),
    outputPath: path.join(p.graderDir, "clean-manifest.json"),
    tracePath: p.cleanTracePath,
    localCodexModel,
    onEvent,
  });
  emit(onEvent, "cleaned_ready", "Cleaned evidence written. Review page can render it now.");
  const cleanedValidation = runValidator(
    path.join(rootDir, "skills", "chatbot-sbs-grader", "scripts", "validate_cleaned_evidence.mjs"),
    p.cleanedEvidencePath,
  );

  emit(onEvent, "reporting", "Starting Local Codex case judgments and report generation.");
  const reportManifest = await runCodexStage({
    stage: "full_report",
    prompt: buildReportPrompt(p, { settings, jobId, inputHash }),
    outputPath: path.join(p.graderDir, "report-manifest.json"),
    tracePath: p.reportTracePath,
    localCodexModel,
    onEvent,
  });
  emit(onEvent, "validating_report", "Validating grader output artifacts.");
  const caseJudgmentValidation = runValidator(
    path.join(rootDir, "skills", "chatbot-sbs-grader", "scripts", "validate_case_judgments.mjs"),
    p.caseJudgmentsPath,
  );
  const gradingReportValidation = runValidator(
    path.join(rootDir, "skills", "chatbot-sbs-grader", "scripts", "validate_grading_report.mjs"),
    p.gradingReportPath,
  );
  let reportMarkdownValidation = runValidator(
    path.join(rootDir, "skills", "chatbot-sbs-grader", "scripts", "validate_report_markdown.mjs"),
    existsSync(p.reportZhMarkdownPath) ? p.reportZhMarkdownPath : p.reportMarkdownPath,
  );
  let reportRepairManifest = null;
  if (!reportMarkdownValidation.ok) {
    emit(onEvent, "repairing_report_markdown", "Report memo quality check failed; asking Local Codex to repair markdown/PDF source quality.");
    reportRepairManifest = await runCodexStage({
      stage: "report_markdown_repair",
      prompt: buildReportMarkdownRepairPrompt(p, { settings, jobId, inputHash, reportMarkdownValidation }),
      outputPath: path.join(p.graderDir, "report-repair-manifest.json"),
      tracePath: p.reportRepairTracePath,
      localCodexModel,
      onEvent,
    });
    reportMarkdownValidation = runValidator(
      path.join(rootDir, "skills", "chatbot-sbs-grader", "scripts", "validate_report_markdown.mjs"),
      existsSync(p.reportZhMarkdownPath) ? p.reportZhMarkdownPath : p.reportMarkdownPath,
    );
  }

  const validationResults = {
    createdAt: new Date().toISOString(),
    inputHash,
    preclean: precleanValidation,
    cleanedEvidence: cleanedValidation,
    caseJudgments: caseJudgmentValidation,
    gradingReport: gradingReportValidation,
    reportMarkdown: reportMarkdownValidation,
    cleanManifest,
    reportManifest,
    reportRepairManifest,
  };
  writeJson(p.validationResultsPath, validationResults);
  emit(onEvent, "completed", "Grader review and report artifacts are ready.");
  return {
    ok: cleanedValidation.ok && caseJudgmentValidation.ok && gradingReportValidation.ok && reportMarkdownValidation.ok,
    inputHash,
    artifacts: summarizeArtifacts(p),
    validationResults,
    bundle: readGraderBundle(taskId),
  };
}

function buildCleaningPrompt(p, { settings, jobId, inputHash }) {
  const manifest = {
    invocationMode: "product_job",
    jobId,
    jobType: "grader.evidence_cleaning",
    taskId: p.taskId,
    inputHash,
    skillPath,
    inputRefs: {
      package: relative(p.packagePath),
      run: relative(p.runPath),
      deterministicPreclean: relative(p.cleanedPrecleanPath),
      reviewNotes: existsSync(p.reviewNotesPath) ? relative(p.reviewNotesPath) : "",
    },
    outputRefs: {
      cleanedEvidence: relative(p.cleanedEvidencePath),
      cleaningSummary: relative(p.cleaningSummaryPath),
      invocationTrace: relative(p.cleanTracePath),
    },
    settings,
  };
  return [
    "Use the repo-local chatbot-sbs-grader skill.",
    `Skill path: ${skillPath}`,
    "This is an SBS workbench product job. Do not use unrelated skills.",
    "Stage: evidence cleaning only.",
    "Read the package, run, and deterministic preclean artifacts listed below.",
    "Produce a complete CleanedEvidencePackage at outputRefs.cleanedEvidence.",
    "Also write a concise cleaning summary markdown at outputRefs.cleaningSummary.",
    "Preserve raw evidence; cleaning is derived and must not rewrite collected run files.",
    "Use minimal compression when possible. Briefs may help navigation but must not replace full evidence.",
    "Return strict JSON manifest only as the final response. Do not wrap in Markdown.",
    "The final response should include ok, stage, artifactRefs, summary, and caveats. The full cleaned evidence must be in the output file, not only in the final response.",
    "",
    "Product job manifest:",
    JSON.stringify(manifest, null, 2),
  ].join("\n");
}

function buildReportPrompt(p, { settings, jobId, inputHash }) {
  const manifest = {
    invocationMode: "product_job",
    jobId,
    jobType: "grader.full_report",
    taskId: p.taskId,
    inputHash,
    skillPath,
    inputRefs: {
      package: relative(p.packagePath),
      run: relative(p.runPath),
      cleanedEvidence: relative(p.cleanedEvidencePath),
      reviewNotes: existsSync(p.reviewNotesPath) ? relative(p.reviewNotesPath) : "",
    },
    outputRefs: {
      caseJudgments: relative(p.caseJudgmentsPath),
      gradingReport: relative(p.gradingReportPath),
      qualityAudit: relative(p.qualityAuditPath),
      reportMarkdown: relative(p.reportMarkdownPath),
      reportZhMarkdown: relative(p.reportZhMarkdownPath),
      invocationTrace: relative(p.reportTracePath),
    },
    settings: {
      communicationFit: "diagnostic_only",
      reportLanguage: "zh",
      ...settings,
    },
  };
  return [
    "Use the repo-local chatbot-sbs-grader skill.",
    `Skill path: ${skillPath}`,
    "This is an SBS workbench product job. Do not use unrelated skills.",
    "Stage: full case judgments, aggregation, quality audit, and PM-ready report.",
    "Read the package, run, cleaned evidence, and review notes listed below.",
    "Use cleaned evidence as the primary normalized layer, but reopen full cleaned/raw evidence when a judgment depends on details. Do not rely on briefs alone.",
    "When reopening raw run data, remember run.caseRuns may be an object keyed by caseId, not an array. Never call .find/.map/.filter on raw run.caseRuns; normalize first with Array.isArray(run.caseRuns) ? run.caseRuns : Object.values(run.caseRuns || {}).",
    "Produce all required JSON artifacts and markdown reports at the exact outputRefs paths.",
    "There are two report surfaces: grading-report.json is app-facing structured data; report.md/report.zh.md are full memo-grade sources for PDF export. Do not collapse the full report into the app summary.",
    "The app will render grading-report.json, while PDF export uses report.zh.md/report.md. Markdown reports must preserve PM memo depth and should not merely mirror app cards.",
    "In grading-report.json, aggregateScores.overall is required and must include numeric baselineScore and challengerScore on the 0-100 scale, plus winner. These values power the app's Baseline Overall and Challenger Overall cards.",
    "In grading-report.json, scoreInterpretation is required. Mark scores as directional_scores unless explicit calibration evidence exists; do not imply false precision.",
    "In grading-report.json, decisionVerdicts.taskUtility and decisionVerdicts.releaseSafetyReadiness are required. Separate task usefulness from safety/release readiness when red-line failures exist.",
    "In grading-report.json, keyEvidenceSnippets is required with at least 2 compact excerpts supporting major claims. Use short quotes from cleaned/raw evidence, not long transcript dumps.",
    "In grading-report.json, executiveVerdict.sideOverallConclusions.baseline and .challenger are required. Give each side a concise overall conclusion, not only a winner label.",
    "In grading-report.json, taskSpaceDimensionVerdicts must be a complete app-facing scoreboard: every row needs dimensionId, baselineScore, challengerScore, winner, baselineConclusion, challengerDiagnosis, and evidenceRefs.",
    "In case-judgments.json and grading-report.json caseTable, missing/skipped/not_scored cases must use null scores and N/A/not scored presentation semantics. Never encode missing evidence as 1/5, and never cite nonexistent output fields for missing cases.",
    "Do not create a standalone Key Reasons app module in grading-report.json. But report.zh.md/report.md MUST include a dedicated Why This Verdict / Key Reasons section.",
    "For report.zh.md, use Chinese report headings and Chinese user-facing dimension names. Include 方法说明/如何阅读分数, a 总体表现 row in the score table, a 关键原因 section, a 关键证据摘录 section, priority-grouped challenger optimization suggestions, case type breakdown, red lines, local strengths, case table, caveats, and appendix.",
    "If multi-turn coverage is incomplete, downgrade multi-turn conclusions to initial signals rather than settled conclusions.",
    "Return strict JSON manifest only as the final response. Do not wrap in Markdown.",
    "The final response should include ok, stage, artifactRefs, verdictSummary, validationHints, and caveats. Do not put the full report only in the final response.",
    "",
    "Product job manifest:",
    JSON.stringify(manifest, null, 2),
  ].join("\n");
}

function buildReportMarkdownRepairPrompt(p, { settings, jobId, inputHash, reportMarkdownValidation }) {
  const manifest = {
    invocationMode: "product_job",
    jobId,
    jobType: "grader.report_markdown_repair",
    taskId: p.taskId,
    inputHash,
    skillPath,
    inputRefs: {
      package: relative(p.packagePath),
      run: relative(p.runPath),
      cleanedEvidence: relative(p.cleanedEvidencePath),
      caseJudgments: relative(p.caseJudgmentsPath),
      gradingReport: relative(p.gradingReportPath),
      qualityAudit: relative(p.qualityAuditPath),
      currentReportMarkdown: existsSync(p.reportMarkdownPath) ? relative(p.reportMarkdownPath) : "",
      currentReportZhMarkdown: existsSync(p.reportZhMarkdownPath) ? relative(p.reportZhMarkdownPath) : "",
    },
    outputRefs: {
      reportMarkdown: relative(p.reportMarkdownPath),
      reportZhMarkdown: relative(p.reportZhMarkdownPath),
      invocationTrace: relative(p.reportRepairTracePath),
    },
    failedValidation: reportMarkdownValidation,
    settings: {
      communicationFit: "diagnostic_only",
      reportLanguage: "zh",
      ...settings,
    },
  };
  return [
    "Use the repo-local chatbot-sbs-grader skill.",
    `Skill path: ${skillPath}`,
    "This is an SBS workbench product repair job. Do not use unrelated skills.",
    "Stage: repair markdown report quality only.",
    "Do not change collected evidence, case judgments, grading-report.json, or quality audit.",
    "Read the existing artifacts and rewrite report.md/report.zh.md at the exact outputRefs paths.",
    "When reopening raw run data, remember run.caseRuns may be an object keyed by caseId, not an array. Never call .find/.map/.filter on raw run.caseRuns; normalize first with Array.isArray(run.caseRuns) ? run.caseRuns : Object.values(run.caseRuns || {}).",
    "The repair goal is to restore the full PM memo quality bar while preserving the same judgments and scores.",
    "The web app does not need a standalone Key Reasons JSON module, but report.zh.md/report.md MUST include a dedicated 关键原因 / Why This Verdict section.",
    "For report.zh.md, use the canonical Chinese memo structure from report-contract.md: 结论摘要, 方法说明/如何阅读分数, 总分与维度分 with 总体表现 row, 关键原因, 关键证据摘录, priority-grouped challenger optimization suggestions, Case 类型拆解, 失败簇与红线, 局部优势, Case 明细表, 不确定性与 caveats, 附录.",
    "Use Chinese user-facing dimension labels in report.zh.md; avoid raw enum IDs as main table labels.",
    "Preserve the dual verdict distinction: task utility winner versus release/safety readiness. Preserve directional-score caveats and N/A for missing/skipped cases.",
    "Return strict JSON manifest only as the final response. Do not wrap in Markdown.",
    "",
    "Product repair manifest:",
    JSON.stringify(manifest, null, 2),
  ].join("\n");
}

function runDeterministicPreclean(p) {
  const script = path.join(rootDir, "skills", "chatbot-sbs-grader", "scripts", "deterministic_preclean.mjs");
  const result = spawnSync(
    process.execPath,
    [script, "--package", p.packagePath, "--run", p.runPath, "--out", p.cleanedPrecleanPath, "--task-id", p.taskId],
    { cwd: rootDir, encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "Deterministic pre-clean failed.");
  }
  return runValidator(
    path.join(rootDir, "skills", "chatbot-sbs-grader", "scripts", "validate_cleaned_evidence.mjs"),
    p.cleanedPrecleanPath,
  );
}

async function runCodexStage({ stage, prompt, outputPath, tracePath, localCodexModel, onEvent }) {
  const codexPath = process.env.SBS_CODEX_PATH || "/Applications/Codex.app/Contents/Resources/codex";
  const args = [
    "exec",
    "--cd",
    rootDir,
    "--skip-git-repo-check",
    "--ignore-user-config",
    "--ephemeral",
    ...buildModelArgs(localCodexModel),
    "--sandbox",
    "workspace-write",
    "--output-last-message",
    outputPath,
    "-",
  ];
  const startedAt = new Date().toISOString();
  const result = await runCodex(codexPath, args, prompt, graderTimeoutMs, onEvent);
  const finishedAt = new Date().toISOString();
  const manifestText = readOptionalText(outputPath) || "{}";
  const manifest = parseJsonLoose(manifestText, { ok: false, raw: manifestText });
  writeJson(tracePath, {
    stage,
    startedAt,
    finishedAt,
    command: codexPath,
    args,
    prompt,
    outputPath: relative(outputPath),
    stdout: result.stdout,
    stderr: result.stderr,
    manifest,
  });
  return manifest;
}

function buildModelArgs(localCodexModel) {
  const model = ["gpt-5.4", "gpt-5.5"].includes(localCodexModel) ? localCodexModel : "gpt-5.5";
  return ["--model", model];
}

function runCodex(command, args, input, timeoutMs, onEvent) {
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
      const error = new Error("Local Codex grader timed out.");
      error.stdout = stdout;
      error.stderr = stderr;
      reject(error);
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;
      emitProcessLines("stdout", text, onEvent);
    });
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      emitProcessLines("stderr", text, onEvent);
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
      const error = new Error(`Local Codex grader failed with exit code ${code}.`);
      error.stdout = stdout;
      error.stderr = stderr;
      reject(error);
    });
    child.stdin.end(input);
  });
}

function runValidator(script, artifactPath) {
  if (!existsSync(artifactPath)) {
    return {
      ok: false,
      errors: [`Missing artifact: ${relative(artifactPath)}`],
      warnings: [],
      checkerType: "artifact_presence",
    };
  }
  const result = spawnSync(process.execPath, [script, artifactPath], {
    cwd: rootDir,
    encoding: "utf8",
  });
  const parsed = parseJsonLoose(result.stdout, {
    ok: false,
    errors: [result.stderr || result.stdout || "Validator output was not JSON."],
    warnings: [],
  });
  parsed.exitCode = result.status;
  parsed.artifactRef = relative(artifactPath);
  return parsed;
}

function summarizeArtifacts(p) {
  const files = [
    ["cleanedEvidence", p.cleanedEvidencePath],
    ["caseJudgments", p.caseJudgmentsPath],
    ["gradingReport", p.gradingReportPath],
    ["qualityAudit", p.qualityAuditPath],
    ["reportMarkdown", p.reportMarkdownPath],
    ["reportZhMarkdown", p.reportZhMarkdownPath],
    ["reportPdf", p.reportPdfPath],
    ["validationResults", p.validationResultsPath],
    ["reportRepairTrace", p.reportRepairTracePath],
  ];
  const artifacts = {};
  for (const [key, filePath] of files) {
    artifacts[key] = summarizeFile(filePath);
  }
  const inputHash = hashFiles([p.packagePath, p.runPath, p.reviewNotesPath].filter(Boolean));
  const validation = readOptionalJson(p.validationResultsPath);
  return {
    hasCleanedEvidence: artifacts.cleanedEvidence.exists,
    hasReport: artifacts.gradingReport.exists && artifacts.reportMarkdown.exists,
    inputHash,
    artifactInputHash: validation?.inputHash || "",
    stale: Boolean(validation?.inputHash && validation.inputHash !== inputHash),
    artifacts,
  };
}

function summarizeFile(filePath) {
  if (!existsSync(filePath)) return { exists: false, path: relative(filePath) };
  const stat = statSync(filePath);
  return {
    exists: true,
    path: relative(filePath),
    size: stat.size,
    updatedAt: stat.mtime.toISOString(),
  };
}

function emit(onEvent, phase, message) {
  onEvent?.({ type: "phase", phase, message });
}

function emitProcessLines(stream, text, onEvent) {
  if (!onEvent) return;
  for (const line of String(text || "").split(/\r?\n/)) {
    const cleaned = compactCodexLogLine(line);
    if (!cleaned) continue;
    onEvent({ type: "log", stream, message: cleaned });
  }
}

function compactCodexLogLine(line) {
  const value = String(line || "").trim();
  if (!value) return "";
  if (value === "codex") return "";
  if (value.includes(" WARN ")) {
    if (value.includes("invalid openai.yaml")) return "Ignoring an unrelated global skill config warning.";
    if (value.includes("defaultPrompt")) return "";
    if (value.includes("remote installed plugins cache")) return "Plugin catalog refresh skipped; continuing locally.";
    return "";
  }
  if (value.includes("OpenAI Codex v")) return "Local Codex started.";
  if (value.startsWith("workdir:")) return value;
  if (value.startsWith("model:")) return value;
  if (value.startsWith("sandbox:")) return value;
  if (value.startsWith("{\"ok\":")) return "Codex wrote an artifact manifest.";
  if (looksLikeNoisyProgramOutput(value)) return "";
  if (value.startsWith("exec")) return "Codex is reading local grader skill files.";
  if (value.includes("succeeded in")) return "Local context read completed.";
  if (value.length > 260) return `${value.slice(0, 260)}...`;
  return value;
}

function looksLikeNoisyProgramOutput(value) {
  if (/^[{}\][,[\]]+$/.test(value)) return true;
  if (/^["']?[A-Za-z0-9_$.-]+["']?\s*[:,]$/.test(value)) return true;
  if (/^["'].*["'],?$/.test(value) && value.length < 120) return true;
  if (/^(const|let|var|function|return|if|for|while|await|import|export)\b/.test(value)) return true;
  if (/^(fs\.|path\.|process\.|console\.|throw new|at\s|syscall:|errno:|code:|path:)/.test(value)) return true;
  if (value.includes("node:internal/")) return true;
  if (value === "Node.js v24.14.0") return true;
  if (/^\d{1,3},\d{3}$/.test(value)) return true;
  if (/^(true|false|null),?$/.test(value)) return true;
  if (/^data\/tasks\/.+\.(json|md|txt)$/.test(value)) return true;
  return false;
}

function hashFiles(filePaths) {
  const hash = createHash("sha256");
  for (const filePath of filePaths) {
    if (!filePath || !existsSync(filePath)) continue;
    hash.update(filePath);
    hash.update(readFileSync(filePath));
  }
  return hash.digest("hex");
}

function readOptionalJson(filePath) {
  if (!existsSync(filePath)) return null;
  try {
    return readJson(filePath);
  } catch {
    return null;
  }
}

function readOptionalText(filePath) {
  if (!existsSync(filePath)) return "";
  return readFileSync(filePath, "utf8");
}

function parseJsonLoose(raw, fallback) {
  const value = String(raw || "").trim();
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    const match = value.match(/```(?:json)?\s*([\s\S]*?)```/) || value.match(/(\{[\s\S]*\})/);
    if (!match) return fallback;
    try {
      return JSON.parse(match[1]);
    } catch {
      return fallback;
    }
  }
}

function emptyBundle() {
  return {
    taskId: "",
    summary: null,
    cleanedEvidence: null,
    caseJudgments: null,
    gradingReport: null,
    qualityAudit: null,
    reportMarkdown: "",
    reportZhMarkdown: "",
    validationResults: null,
    reviewNotes: {},
  };
}

function relative(filePath) {
  return path.relative(rootDir, filePath);
}
