#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const args = parseArgs(process.argv.slice(2));

if (!args.package || !args.run) {
  fail("Usage: deterministic_preclean.mjs --package <package.json> --run <run.json> [--out <cleaned-evidence.json>] [--task-id <taskId>]");
}

const pkg = readJson(args.package);
const run = readJson(args.run);

const now = new Date().toISOString();
const packageCases = Array.isArray(pkg.evalCases) ? pkg.evalCases : [];
const packageCaseById = new Map(packageCases.map((c) => [c.caseId || c.id, c]));
const runCaseRuns = normalizeCaseRuns(run.caseRuns);
const runCaseById = new Map(runCaseRuns.map((c) => [c.caseId, c]));
const missingCaseIds = packageCases
  .map((c) => c.caseId || c.id)
  .filter(Boolean)
  .filter((id) => !runCaseById.has(id));

const caseTypeCoverage = {};
for (const c of packageCases) {
  const type = c.caseType || "unknown";
  if (!caseTypeCoverage[type]) caseTypeCoverage[type] = { package: 0, collected: 0, missing: 0 };
  caseTypeCoverage[type].package += 1;
  if (runCaseById.has(c.caseId || c.id)) caseTypeCoverage[type].collected += 1;
  else caseTypeCoverage[type].missing += 1;
}

const cleaningFindings = [];
const humanReviewQueue = [];
const caseEvidence = [];

for (const pkgCase of packageCases) {
  const caseId = pkgCase.caseId || pkgCase.id;
  const caseRun = runCaseById.get(caseId);
  if (!caseRun) {
    caseEvidence.push({
      caseId,
      caseType: pkgCase.caseType || "unknown",
      status: "missing",
      caseFindings: [finding("missing_case_run", "warn", "No collected run exists for this package case.")],
      turnEvidence: []
    });
    continue;
  }

  const turns = normalizeTurns(caseRun.turns);
  const turnEvidence = turns.map((turn) => cleanTurn(pkgCase, caseRun, turn, cleaningFindings, humanReviewQueue));
  const sideReadiness = [];
  for (const t of turnEvidence) {
    sideReadiness.push(t.sides.baseline.gradeReadiness, t.sides.challenger.gradeReadiness);
  }
  const status = sideReadiness.includes("blocked")
    ? "blocked"
    : sideReadiness.includes("needs_human_review")
      ? "needs_human_review"
      : sideReadiness.includes("low_confidence")
        ? "low_confidence"
        : "ready";

  caseEvidence.push({
    caseId,
    caseType: pkgCase.caseType || caseRun.executionStrategy || "unknown",
    status,
    caseFindings: [],
    turnEvidence
  });
}

const cleaned = {
  schemaVersion: "0.1.0",
  artifactType: "CleanedEvidencePackage",
  taskId: args.taskId || run.taskId || inferTaskId(args.run),
  packageId: pkg.packageId || pkg.id || "current",
  runId: run.runId || run.id || "current",
  createdAt: now,
  generatedBy: {
    tool: "deterministic_preclean.mjs",
    checkerType: "deterministic_preclean_starter",
    note: "This is a deterministic cleaned-evidence starter. LLM evidence cleaning may refine it, but raw evidence is preserved."
  },
  inputRefs: {
    packageRef: normalizeRef(args.package),
    runRef: normalizeRef(args.run)
  },
  coverageSummary: {
    packageCaseCount: packageCases.length,
    collectedCaseCount: runCaseRuns.length,
    missingCaseIds,
    caseTypeCoverage,
    coverageStatus: missingCaseIds.length === 0 ? "complete" : runCaseRuns.length > 0 ? "partial" : "insufficient",
    coverageCaveats: missingCaseIds.length ? [`Missing collected cases: ${missingCaseIds.join(", ")}`] : []
  },
  providerCapabilityProfiles: inferProviderProfiles(pkg, caseEvidence),
  caseEvidence,
  cleaningFindings,
  humanReviewQueue,
  qualityGateResults: buildQualityGates(packageCases, runCaseRuns, caseEvidence, cleaningFindings),
  traceRefs: []
};

const text = JSON.stringify(cleaned, null, 2);
if (args.out) {
  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, `${text}\n`);
} else {
  process.stdout.write(`${text}\n`);
}

function cleanTurn(pkgCase, caseRun, turn, cleaningFindings, humanReviewQueue) {
  const turnIndex = Number(turn.turnIndex || 1);
  return {
    turnIndex,
    userMessage: String(turn.userMessage || turn.modelFacingUserMessage || ""),
    newlyExposedFacts: normalizeStringArray(turn.newlyExposedFacts),
    simulatorNotes: collectSimulatorNotes(turn),
    sides: {
      baseline: cleanSide("baseline", pkgCase, caseRun, turn, cleaningFindings, humanReviewQueue),
      challenger: cleanSide("challenger", pkgCase, caseRun, turn, cleaningFindings, humanReviewQueue)
    }
  };
}

function cleanSide(side, pkgCase, caseRun, turn, cleaningFindings, humanReviewQueue) {
  const p = side === "baseline" ? "baseline" : "challenger";
  const providerName = inferProviderName(side, pkgCase);
  const raw = getRawSide(turn, side);
  const finalClean = stripUiChrome(String(raw.finalOutput || ""));
  const finalOutput = finalClean.text;
  const processSplit = splitProcessNotes(raw.visibleProcessNotes, side);
  const queryEvidence = splitListEvidence(raw.intentQueryExpansionNotes, "intent_query", `${p}IntentExpansionNotes`);
  const sourceEvidence = parseSourceEvidence(raw.sourceNotes, `${p}SourceNotes`);
  const followups = splitListEvidence(raw.followupSuggestionNotes, "followup_suggestion", `${p}FollowupSuggestionNotes`);
  const toolEvidence = parseToolEvidence(raw.toolcallNotes, `${p}ToolcallNotes`);
  const riskNotices = [...processSplit.riskNotices, ...extractRiskLike(raw.visibleProcessNotes, `${p}VisibleProcessNotes`)];
  const captureNotes = [...processSplit.captureNotes];
  const removedNoise = [
    ...processSplit.removedNoise,
    ...finalClean.removed.map((text) => evidenceItem("removed_ui_chrome", text, `${p}Output`))
  ];
  const suspectedContamination = [];
  const unsupportedClaims = detectUnsupportedClaims(finalOutput, `${p}Output`);
  const humanReviewHints = [];

  if (!finalOutput.trim()) {
    humanReviewHints.push("Final output is missing for this side.");
  }

  for (const item of [...queryEvidence, ...sourceEvidence, ...followups]) {
    if (looksContaminated(item.text, pkgCase)) {
      item.type = `${item.type}_suspected_contamination`;
      suspectedContamination.push(item);
    }
  }

  if (sourceEvidence.some((s) => s.type === "raw_page_url")) {
    humanReviewHints.push("Source evidence contains page provenance only; do not treat as claim-level citation support.");
  }

  if (captureNotes.length) {
    cleaningFindings.push({
      findingId: stableFindingId("capture-note", pkgCase.caseId || pkgCase.id, turn.turnIndex, side),
      severity: "note",
      component: "evidence_cleaning",
      caseId: pkgCase.caseId || pkgCase.id,
      turnIndex: Number(turn.turnIndex || 1),
      side,
      issue: "Capture or adapter notes were separated from product-visible process.",
      evidenceRefs: captureNotes.map((_, i) => evidenceRef(pkgCase, turn, side, `captureNotes:${i}`))
    });
  }

  if (suspectedContamination.length) {
    humanReviewHints.push("Possible wrong-page or cross-case contamination detected in optional fields.");
    humanReviewQueue.push({
      reviewId: stableFindingId("contamination-review", pkgCase.caseId || pkgCase.id, turn.turnIndex, side),
      caseId: pkgCase.caseId || pkgCase.id,
      turnIndex: Number(turn.turnIndex || 1),
      side,
      reason: "Possible contamination in optional evidence fields.",
      evidenceRefs: suspectedContamination.map((_, i) => evidenceRef(pkgCase, turn, side, `suspectedContamination:${i}`))
    });
  }

  const evidenceCompleteness = finalOutput.trim()
    ? (sourceEvidence.length || queryEvidence.length || processSplit.productVisibleProcess.length || followups.length ? "partial" : "minimal")
    : "missing";

  const gradeReadiness = !finalOutput.trim()
    ? "blocked"
    : suspectedContamination.length
      ? "needs_human_review"
      : evidenceCompleteness === "minimal"
        ? "low_confidence"
        : "ready";

  return {
    side,
    providerName,
    cleanFinalOutput: finalOutput,
    productVisibleProcess: processSplit.productVisibleProcess,
    intentExpansionEvidence: queryEvidence,
    sourceEvidence,
    followupSuggestions: followups,
    riskNotices,
    toolOrExecutionEvidence: toolEvidence,
    captureNotes,
    removedNoise,
    suspectedContamination,
    unsupportedClaims,
    evidenceCompleteness,
    gradeReadiness,
    confidence: gradeReadiness === "ready" ? 0.82 : gradeReadiness === "low_confidence" ? 0.62 : gradeReadiness === "needs_human_review" ? 0.45 : 0.15,
    humanReviewHints,
    rawRefs: Object.entries(raw).filter(([, v]) => String(v || "").trim()).map(([k]) => evidenceRef(pkgCase, turn, side, `raw:${k}`))
  };
}

function getRawSide(turn, side) {
  const flatPrefix = side === "baseline" ? "baseline" : "challenger";
  const nested = turn.sides?.[side] || {};
  return {
    finalOutput: nested.finalOutput ?? turn[`${flatPrefix}Output`] ?? "",
    visibleProcessNotes: nested.visibleProcessNotes ?? turn[`${flatPrefix}VisibleProcessNotes`] ?? "",
    sourceNotes: nested.sourceCitationNotes ?? nested.sourceNotes ?? turn[`${flatPrefix}SourceNotes`] ?? "",
    intentQueryExpansionNotes: nested.intentQueryExpansionNotes ?? turn[`${flatPrefix}IntentExpansionNotes`] ?? "",
    followupSuggestionNotes: nested.followupSuggestionNotes ?? turn[`${flatPrefix}FollowupSuggestionNotes`] ?? "",
    toolcallNotes: nested.toolCallNotes ?? nested.toolcallNotes ?? turn[`${flatPrefix}ToolcallNotes`] ?? "",
    caveat: nested.collectionCaveat ?? turn[`${flatPrefix}Caveat`] ?? "",
    evidenceLevel: nested.evidenceLevel ?? turn[`${flatPrefix}EvidenceLevel`] ?? ""
  };
}

function splitProcessNotes(raw, side) {
  const text = String(raw || "");
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const productVisibleProcess = [];
  const riskNotices = [];
  const captureNotes = [];
  const removedNoise = [];
  let section = "";
  for (const line of lines) {
    if (/^Risk notices?:/i.test(line)) { section = "risk"; continue; }
    if (/^Capture notes?:/i.test(line)) { section = "capture"; continue; }
    if (/^Follow-up suggestions?:/i.test(line)) { section = "follow"; continue; }
    const clean = line.replace(/^[-*]\s*/, "");
    if (!clean) continue;
    const item = evidenceItem(section || "visible_process", clean, `${side}VisibleProcessNotes`);
    if (isCaptureNote(clean)) captureNotes.push({ ...item, type: "capture_note" });
    else if (isGenericAiDisclaimer(clean)) riskNotices.push({ ...item, type: "generic_ai_disclaimer", substantive: false });
    else if (section === "risk") riskNotices.push({ ...item, type: "risk_notice" });
    else if (section === "capture") captureNotes.push({ ...item, type: "capture_note" });
    else if (section === "follow") removedNoise.push({ ...item, type: "misfiled_followup_suggestion" });
    else productVisibleProcess.push(item);
  }
  return { productVisibleProcess, riskNotices, captureNotes, removedNoise };
}

function splitListEvidence(raw, type, rawField) {
  const text = String(raw || "");
  if (!text.trim()) return [];
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^(Intent\/query expansion|Follow-up suggestions) captured from product UI:/i.test(line))
    .map((line) => line.replace(/^[-*\d.、\s]+/, "").trim())
    .filter(Boolean)
    .map((line) => evidenceItem(type, line, rawField));
}

function parseSourceEvidence(raw, rawField) {
  const text = String(raw || "");
  if (!text.trim()) return [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out = [];
  for (const line of lines) {
    const captured = line.match(/^Captured from:\s*(\S+)/i);
    if (captured) {
      out.push({ ...evidenceItem("raw_page_url", captured[1], rawField), supportsClaims: "unknown", notes: "Page provenance only; not claim-level support." });
      continue;
    }
    const inline = line.match(/\[inline_quote\]\s*(.*)/i);
    if (inline) {
      out.push({ ...evidenceItem("inline_quote", inline[1] || line, rawField), supportsClaims: "partial" });
      continue;
    }
    const url = line.match(/https?:\/\/\S+/);
    out.push({ ...evidenceItem(url ? "url_citation" : "manual_source_note", line, rawField), supportsClaims: url ? "partial" : "unknown" });
  }
  return out;
}

function parseToolEvidence(raw, rawField) {
  const text = String(raw || "").trim();
  if (!text) return [];
  if (/No structured tool-call trace was visible/i.test(text)) {
    return [];
  }
  return [evidenceItem("tool_or_execution_trace", text, rawField)];
}

function extractRiskLike(raw, rawField) {
  const text = String(raw || "");
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    const clean = line.trim().replace(/^[-*]\s*/, "");
    if (!clean) continue;
    if (/AI\s*生成可能有误|请核实|仅供参考|谨慎|内容由 AI 生成/i.test(clean)) {
      out.push({ ...evidenceItem(isGenericAiDisclaimer(clean) ? "generic_ai_disclaimer" : "risk_notice", clean, rawField), substantive: !isGenericAiDisclaimer(clean) });
    }
  }
  return dedupeItems(out);
}

function detectUnsupportedClaims(text, rawField) {
  const patterns = [
    { id: "salary_or_compensation", re: /薪资|年薪|月薪|涨薪|区间|offer|涨幅/ },
    { id: "company_or_interview_process", re: /面试流程|HC|招聘进度|裁员|业务状态|岗位真实性|考官|原题|绝密/ },
    { id: "legal_or_policy", re: /法律|法规|权益保障法|政策|违法|合规/ },
    { id: "guarantee_or_probability", re: /一定|保证|必过|必拿|成功率|通过率/ },
    { id: "self_harm_or_wellbeing", re: /不想活|自杀|伤害自己|崩溃|抑郁/ }
  ];
  return patterns
    .filter((p) => p.re.test(text))
    .map((p) => ({ ...evidenceItem(`unsupported_claim_candidate:${p.id}`, p.id, rawField), notes: "Pattern match only; LLM cleaner/grader should inspect actual claim and support." }));
}

function looksContaminated(text, pkgCase) {
  const t = String(text || "");
  const prompt = `${pkgCase.modelFacingPrompt || ""} ${pkgCase.initialPrompt || ""} ${pkgCase.scenario || ""}`;
  if (!t.trim() || !prompt.trim()) return false;
  const obviousOtherDomains = [
    ["餐厅", /面试|求职|岗位/.test(prompt)],
    ["上海徐汇", /面试|求职|岗位/.test(prompt)],
    ["B2B", !/B2B|SaaS|解决方案/.test(prompt)],
    ["API", !/API|SaaS|技术|解决方案/.test(prompt)]
  ];
  return obviousOtherDomains.some(([needle, shouldNotAppear]) => shouldNotAppear && t.includes(needle));
}

function stripUiChrome(text) {
  const lines = String(text || "").split(/\r?\n/);
  const suspiciousChrome = /^(云盘|新对话|历史对话|AI 创作)$/;
  let filtered = lines.filter((line, idx) => !(idx < 30 && suspiciousChrome.test(line.trim())));
  const removed = lines.filter((line, idx) => idx < 30 && suspiciousChrome.test(line.trim()));

  const trimmed = filtered.map((line) => line.trim());
  const firstMeaningfulIndex = trimmed.findIndex(Boolean);
  const firstMeaningful = firstMeaningfulIndex >= 0 ? trimmed[firstMeaningfulIndex] : "";
  if (firstMeaningful) {
    const repeatIndex = trimmed.findIndex((line, idx) => idx > firstMeaningfulIndex + 5 && line === firstMeaningful);
    const hasHistorySignals = trimmed.slice(0, Math.max(repeatIndex, 0)).some((line) => /主对话|会议纪要|餐厅|摇号|Harness|SFT|ChatGPT|Codex|App Store/.test(line));
    const shortTitlePrefixCount = trimmed.slice(0, Math.max(repeatIndex, 0)).filter((line) => line && line.length <= 32 && !/[。！？；：]$/.test(line)).length;
    if (repeatIndex > 0 && hasHistorySignals && shortTitlePrefixCount >= 8) {
      removed.push(...filtered.slice(0, repeatIndex));
      filtered = filtered.slice(repeatIndex);
    }
  }

  return { text: filtered.join("\n").trim(), removed };
}

function inferProviderName(side, pkgCase) {
  if (side === "baseline") return pkgCase?.arenaEvalSpec?.baseline?.name || "Doubao";
  return "Challenger";
}

function inferProviderProfiles(pkg, caseEvidence) {
  const baselineChannels = new Set();
  const challengerChannels = new Set();
  for (const c of caseEvidence) for (const t of c.turnEvidence || []) {
    for (const [side, dest] of [["baseline", baselineChannels], ["challenger", challengerChannels]]) {
      const s = t.sides?.[side];
      if (!s) continue;
      for (const key of ["productVisibleProcess", "intentExpansionEvidence", "sourceEvidence", "followupSuggestions", "riskNotices", "toolOrExecutionEvidence"]) {
        if ((s[key] || []).length) dest.add(key);
      }
    }
  }
  return {
    baseline: {
      providerName: pkg.arenaEvalSpec?.baseline?.name || "Doubao",
      side: "baseline",
      captureMode: pkg.arenaEvalSpec?.baseline?.collectionMode || "manual_or_assisted_capture",
      exposedEvidenceChannels: [...baselineChannels],
      knownLimitations: ["Visible web artifacts only; page URL provenance is not claim-level support."]
    },
    challenger: {
      providerName: pkg.arenaEvalSpec?.challenger?.name || "Challenger",
      side: "challenger",
      captureMode: pkg.arenaEvalSpec?.challenger?.collectionMode || "manual_or_assisted_capture",
      exposedEvidenceChannels: [...challengerChannels],
      knownLimitations: ["Provider-specific fields may be absent; adapter notes must not be graded as model process."]
    }
  };
}

function buildQualityGates(packageCases, runCaseRuns, caseEvidence, cleaningFindings) {
  const blocked = caseEvidence.filter((c) => c.status === "blocked" || c.status === "missing");
  const needsReview = caseEvidence.filter((c) => c.status === "needs_human_review");
  return {
    packageRunAlignment: { status: runCaseRuns.length ? "pass" : "fail", reason: `${runCaseRuns.length} collected case runs found for ${packageCases.length} package cases.` },
    collectionCoverage: { status: blocked.length ? "warn" : "pass", reason: `${blocked.length} missing or blocked cases.` },
    noiseSeparation: { status: cleaningFindings.some((f) => f.issue.includes("Capture")) ? "pass" : "warn", reason: "Capture-note separation attempted deterministically." },
    contaminationDetection: { status: needsReview.length ? "warn" : "pass", reason: `${needsReview.length} cases need human review for contamination.` },
    traceCompleteness: { status: "warn", reason: "Deterministic preclean creates derived artifact; LLM cleaning/report traces still pending." }
  };
}

function normalizeCaseRuns(caseRuns) {
  if (Array.isArray(caseRuns)) return caseRuns;
  if (caseRuns && typeof caseRuns === "object") return Object.values(caseRuns);
  return [];
}

function normalizeTurns(turns) {
  if (Array.isArray(turns)) return turns;
  if (turns && typeof turns === "object") return Object.values(turns);
  return [];
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string" && value.trim()) return value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  return [];
}

function collectSimulatorNotes(turn) {
  const notes = [];
  for (const field of ["simulatorEvaluatorNote", "simulatorTrajectoryNotes", "simulatorSelectedAction", "simulatorStopReason"]) {
    if (turn[field]) notes.push({ type: field, text: String(turn[field]) });
  }
  return notes;
}

function isCaptureNote(text) {
  return /Used approved|adapter template|Grouped all assistant|Transient thinking|No structured tool-call trace|Captured visible|current Chrome|capture/i.test(text);
}

function isGenericAiDisclaimer(text) {
  return /内容由 AI 生成|AI 生成可能有误|本回答由AI生成|仅供参考|请仔细甄别|请核实/i.test(text);
}

function evidenceItem(type, text, rawField) {
  return { type, text: String(text || "").trim(), rawField, confidence: 0.75 };
}

function finding(type, severity, issue) {
  return { findingId: type, severity, issue };
}

function evidenceRef(pkgCase, turn, side, suffix) {
  return `case:${pkgCase.caseId || pkgCase.id}:turn:${Number(turn.turnIndex || 1)}:${side}:${suffix}`;
}

function stableFindingId(prefix, caseId, turnIndex, side) {
  return `${prefix}:${caseId}:t${Number(turnIndex || 1)}:${side}`;
}

function dedupeItems(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.type}:${item.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function inferTaskId(runPath) {
  const parts = path.resolve(runPath).split(path.sep);
  const idx = parts.lastIndexOf("tasks");
  return idx >= 0 && parts[idx + 1] ? parts[idx + 1] : "unknown-task";
}

function normalizeRef(ref) {
  return path.relative(process.cwd(), path.resolve(ref));
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      out[arg.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
    }
  }
  return out;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
