export function renderReportView(root, packageState, graderBundle, handlers = {}) {
  const report = graderBundle?.gradingReport;
  const markdown = graderBundle?.reportZhMarkdown || graderBundle?.reportMarkdown || "";
  const job = handlers.job;
  const running = job?.status === "running";
  const pdfExporting = Boolean(handlers.pdfExporting);

  root.innerHTML = `
    <div class="view-heading">
      <div>
        <p class="eyebrow">Grader Report</p>
        <h2>Task-Space Verdict</h2>
      </div>
      <div class="view-actions">
        <button id="runGrader" class="primary-button" type="button" ${running ? "disabled" : ""}>
          ${running ? "Running..." : report ? "Rerun Review + Report" : "Run Review + Report"}
        </button>
      </div>
    </div>

    ${graderBundle?.summary?.stale ? staleBanner() : ""}
    ${renderJobPanel(job)}

    ${
      report
        ? renderStructuredReport(report, markdown, { ...graderBundle, pdfExporting })
        : `<section class="empty-state">
            <h2>No grader report yet</h2>
            <p>Run the grader pipeline once. SBS will clean evidence first, then generate case judgments, aggregate scores, quality audit, and a downloadable report.</p>
          </section>`
    }
  `;

  root.querySelector("#runGrader")?.addEventListener("click", () => {
    handlers.onRunGrader?.({
      settings: {
        communicationFit: "diagnostic_only",
        reportLanguage: "zh",
        evidenceMode: "auto_minimal",
      },
    });
  });
  root.querySelector("#downloadPdf")?.addEventListener("click", () => {
    handlers.onExportPdf?.();
  });
  root.querySelector("#downloadJson")?.addEventListener("click", () => {
    downloadText("sbs-grading-report.json", JSON.stringify(report || {}, null, 2));
  });
}

function renderStructuredReport(report, markdown, bundle) {
  const overall = resolveOverall(report);
  const sideConclusions = resolveSideConclusions(report);
  return `
    <section class="section-band verdict-band">
      <p class="eyebrow">Executive Verdict</p>
      <h3>${escapeHtml(report.executiveVerdict?.verdict || "Unknown")}</h3>
      <p>${escapeHtml(report.executiveVerdict?.oneSentenceReason || report.executiveVerdict?.summary || "")}</p>
      <div class="metric-row">
        ${metric("Baseline Overall", scoreValue(overall.baseline))}
        ${metric("Challenger Overall", scoreValue(overall.challenger))}
        ${metric("Confidence", report.executiveVerdict?.confidence || report.evaluationValidity?.confidence || "unknown")}
        ${metric("Cases", (report.caseTable || []).length)}
      </div>
      <div class="summary-grid">
        ${field("Baseline conclusion", sideConclusions.baseline)}
        ${field("Challenger conclusion", sideConclusions.challenger)}
      </div>
      ${renderDecisionVerdicts(report)}
      ${renderScoreInterpretation(report)}
    </section>

    <section class="section-band">
      <h3>Dimension Scoreboard</h3>
      ${renderScoreboard(report)}
    </section>

    <section class="section-band">
      <h3>Challenger Optimization Plan</h3>
      ${renderOptimization(report.challengerOptimizationPlan || [])}
    </section>

    <section class="section-band">
      <h3>Case Type Breakdown</h3>
      ${renderCaseTypeBreakdown(report.caseTypeBreakdown || [])}
    </section>

    <section class="section-band">
      <h3>Failure Clusters / Red Lines</h3>
      ${renderFailureClusters([...(report.failureClusters || []), ...(report.redLineSummary || [])])}
    </section>

    <section class="section-band">
      <h3>Key Evidence Excerpts</h3>
      ${renderEvidenceSnippets(report.keyEvidenceSnippets || [])}
    </section>

    <section class="section-band">
      <h3>Case Table</h3>
      ${renderCaseTable(report.caseTable || [])}
    </section>

    <section class="section-band">
      <h3>Downloads</h3>
      <div class="button-row">
        <button id="downloadPdf" class="secondary-button" type="button" ${bundle?.pdfExporting ? "disabled" : ""}>
          ${bundle?.pdfExporting ? "Preparing PDF..." : "Export PDF"}
        </button>
        <button id="downloadJson" class="secondary-button" type="button">Download JSON</button>
      </div>
      <p class="muted">PDF export generates a document-grade report file from the full report artifact and reveals it in Finder.</p>
    </section>

    <details class="section-band disclosure-section">
      <summary>Quality Audit</summary>
      ${renderJsonBlocks(bundle?.qualityAudit ? [bundle.qualityAudit.auditSummary || bundle.qualityAudit] : [])}
    </details>
  `;
}

function renderScoreboard(report) {
  const rows = resolveScoreboardRows(report);
  if (!rows.length) return `<p class="muted">No dimension rows available.</p>`;
  return `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Dimension</th>
            <th>Baseline</th>
            <th>Challenger</th>
            <th>Winner</th>
            <th>Challenger diagnosis</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td>${escapeHtml(row.dimensionId || row.dimension || row.name || "")}</td>
              <td>${escapeHtml(scoreValue(row.baselineScore ?? row.baseline))}</td>
              <td>${escapeHtml(scoreValue(row.challengerScore ?? row.challenger))}</td>
              <td>${escapeHtml(row.winner || row.pairwiseWinner || row.verdict || "")}</td>
              <td>${escapeHtml(row.challengerDiagnosis || row.challengerComment || row.rationale || row.reason || "")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderOptimization(items) {
  if (!items.length) return `<p class="muted">No optimization plan available.</p>`;
  return items.map((item) => `
    <div class="recommendation-card">
      <strong>${escapeHtml(item.priority || "")} · ${escapeHtml(item.theme || "")}</strong>
      <p>${escapeHtml(item.recommendation || "")}</p>
      <p class="muted">${escapeHtml(item.whyItMatters || "")}</p>
    </div>
  `).join("");
}

function renderCaseTypeBreakdown(items) {
  if (!items.length) return `<p class="muted">No case type breakdown available.</p>`;
  return `
    <div class="insight-card-grid">
      ${items.map((item) => `
        <article class="insight-card">
          <div class="split-heading">
            <strong>${escapeHtml(item.caseType || item.type || item.name || "Case type")}</strong>
            <span class="status-pill">${escapeHtml(item.winner || item.verdict || "")}</span>
          </div>
          <p>${escapeHtml(item.summary || item.rationale || item.reason || "")}</p>
          <div class="summary-grid compact-summary-grid">
            ${field("Baseline", item.baselineSignal || item.baselineSummary || item.baseline || "")}
            ${field("Challenger", item.challengerSignal || item.challengerSummary || item.challenger || "")}
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function renderFailureClusters(items) {
  if (!items.length) return `<p class="muted">No major failure clusters available.</p>`;
  return `
    <div class="insight-card-grid">
      ${items.map((item) => `
        <article class="insight-card ${item.severity === "high" || item.redLineId ? "insight-card-risk" : ""}">
          <div class="split-heading">
            <strong>${escapeHtml(item.clusterId || item.redLineId || item.theme || "Failure cluster")}</strong>
            <span class="status-pill ${item.severity === "high" ? "bad" : "warn"}">${escapeHtml(item.affectedSide || item.side || item.severity || "watch")}</span>
          </div>
          <p>${escapeHtml(item.summary || item.description || item.finding || "")}</p>
          ${item.impact ? `<p class="muted">${escapeHtml(item.impact)}</p>` : ""}
          ${(item.evidenceRefs || item.caseIds || []).length ? `<small class="evidence-ref-line">${escapeHtml((item.evidenceRefs || item.caseIds || []).join(" · "))}</small>` : ""}
        </article>
      `).join("")}
    </div>
  `;
}

function renderCaseTable(rows) {
  if (!rows.length) return `<p class="muted">No case table available.</p>`;
  return `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr><th>Case</th><th>Type</th><th>Winner</th><th>Baseline</th><th>Challenger</th><th>Caveat</th></tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td>${escapeHtml(row.caseId || "")}</td>
              <td>${escapeHtml(row.caseType || "")}</td>
              <td>${escapeHtml(row.winner || row.pairwiseWinner || "")}</td>
              <td>${escapeHtml(caseScoreValue(row, "baselineScore"))}</td>
              <td>${escapeHtml(caseScoreValue(row, "challengerScore"))}</td>
              <td>${escapeHtml(caseCaveatText(row))}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderDecisionVerdicts(report) {
  const verdicts = report.decisionVerdicts;
  if (!verdicts?.taskUtility && !verdicts?.releaseSafetyReadiness) return "";
  return `
    <div class="summary-grid">
      ${field("Task utility verdict", formatDecisionVerdict(verdicts.taskUtility))}
      ${field("Safety / readiness verdict", formatDecisionVerdict(verdicts.releaseSafetyReadiness))}
    </div>
  `;
}

function renderScoreInterpretation(report) {
  const interpretation = report.scoreInterpretation;
  if (!interpretation?.precisionCaveat) return "";
  return `<p class="muted">${escapeHtml(interpretation.precisionCaveat)}</p>`;
}

function formatDecisionVerdict(value) {
  if (!value) return "";
  return [value.winner, value.confidence ? `(${value.confidence})` : "", value.summary].filter(Boolean).join(" ");
}

function renderEvidenceSnippets(items) {
  if (!items.length) return `<p class="muted">No key evidence snippets available.</p>`;
  return items.map((item) => `
    <blockquote class="evidence-snippet">
      <p>${escapeHtml(item.quote || "")}</p>
      <footer>${escapeHtml([item.caseId, item.side, item.field].filter(Boolean).join(" · "))}</footer>
      <small>${escapeHtml(item.whyItMatters || item.linkedClaim || "")}</small>
    </blockquote>
  `).join("");
}

function renderJsonBlocks(items) {
  if (!items.length) return `<p class="muted">None.</p>`;
  return items.map((item) => `<pre class="json-block">${escapeHtml(JSON.stringify(item, null, 2))}</pre>`).join("");
}

function renderJobPanel(job) {
  if (!job) return "";
  const logs = job.logs || [];
  return `
    <section class="section-band job-panel">
      <div class="split-heading">
        <div>
          <h3>Local Codex Grader</h3>
          <p class="muted">${escapeHtml(job.phase || "Idle")}</p>
        </div>
        <span class="status-pill ${statusTone(job.status)}">${escapeHtml(job.status || "idle")}</span>
      </div>
      <div class="log-list">
        ${logs.map((item) => `<div class="log-line"><span>${escapeHtml(formatTime(item.at))}</span>${escapeHtml(item.message)}</div>`).join("") || `<p class="muted">Waiting for local Codex logs...</p>`}
      </div>
    </section>
  `;
}

function list(items) {
  if (!items.length) return `<p class="muted">No key reasons available.</p>`;
  return `<ul>${items.map((item) => `<li>${escapeHtml(typeof item === "string" ? item : item.reason || item.summary || JSON.stringify(item))}</li>`).join("")}</ul>`;
}

function resolveOverall(report) {
  const overall = report.aggregateScores?.overall || {};
  return {
    baseline:
      overall.baselineScore ??
      overall.baseline ??
      report.aggregateScores?.baselineOverall ??
      report.aggregateScores?.overallBaseline ??
      "",
    challenger:
      overall.challengerScore ??
      overall.challenger ??
      report.aggregateScores?.challengerOverall ??
      report.aggregateScores?.overallChallenger ??
      "",
    winner: overall.winner || report.executiveVerdict?.verdict || "",
  };
}

function resolveSideConclusions(report) {
  const direct = report.executiveVerdict?.sideOverallConclusions || {};
  const overall = resolveOverall(report);
  return {
    baseline:
      direct.baseline ||
      report.executiveVerdict?.baselineOverallConclusion ||
      `Baseline ${scoreValue(overall.baseline)}: ${report.aggregateScores?.overall?.winner === "baseline" ? "overall stronger in this task space" : "see detailed dimensions"}.`,
    challenger:
      direct.challenger ||
      report.executiveVerdict?.challengerOverallConclusion ||
      report.executiveVerdict?.summary ||
      "See detailed dimensions and optimization plan.",
  };
}

function resolveScoreboardRows(report) {
  const byId = new Map();
  for (const row of report.aggregateScores?.dimensions || []) {
    const id = row.dimensionId || row.dimension || row.name;
    if (!id) continue;
    byId.set(id, {
      dimensionId: id,
      baselineScore: row.baselineScore ?? row.baseline,
      challengerScore: row.challengerScore ?? row.challenger,
      winner: row.winner || row.pairwiseWinner || "",
      challengerDiagnosis: row.challengerDiagnosis || row.challengerComment || row.reason || row.rationale || "",
      ...row,
    });
  }
  for (const row of report.taskSpaceDimensionVerdicts || report.dimensionBreakdown || []) {
    const id = row.dimensionId || row.dimension || row.name;
    if (!id) continue;
    byId.set(id, {
      ...(byId.get(id) || {}),
      ...row,
      dimensionId: id,
      baselineScore: row.baselineScore ?? row.baseline ?? byId.get(id)?.baselineScore,
      challengerScore: row.challengerScore ?? row.challenger ?? byId.get(id)?.challengerScore,
      winner: row.winner || row.pairwiseWinner || byId.get(id)?.winner || row.verdict || "",
      challengerDiagnosis:
        row.challengerDiagnosis ||
        row.challengerComment ||
        byId.get(id)?.challengerDiagnosis ||
        row.rationale ||
        row.reason ||
        "",
    });
  }
  return [...byId.values()];
}

function staleBanner() {
  return `<section class="section-band warning-band"><strong>Stale report.</strong> Collection or package data changed after this report was generated. Rerun Review + Report before relying on conclusions.</section>`;
}

function metric(label, value) {
  return `<div class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value ?? ""))}</strong></div>`;
}

function field(label, value) {
  return `<div class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value ?? ""))}</strong></div>`;
}

function scoreValue(value) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(1);
  return String(value);
}

function caseScoreValue(row, field) {
  const notScored = row.gradeReadiness === "skipped" ||
    row.gradeReadiness === "blocked" ||
    row.winner === "not_scored" ||
    row.pairwiseWinner === "not_scored";
  if (notScored) return "N/A";
  return scoreValue(row[field]);
}

function caseCaveatText(row) {
  const caveats = Array.isArray(row.caveats) ? row.caveats.filter(Boolean).join("; ") : "";
  return caveats || row.caveat || row.confidence || "";
}

function statusTone(status) {
  if (["succeeded", "ready", "completed"].includes(status)) return "ok";
  if (["failed", "blocked", "missing"].includes(status)) return "bad";
  if (["needs_human_review", "low_confidence", "succeeded_with_warnings"].includes(status)) return "warn";
  return "";
}

function formatTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function exportReportPdf(report, markdown) {
  const win = window.open("", "_blank");
  if (!win) {
    window.alert("Unable to open PDF export window. Please allow pop-ups for this local app.");
    return;
  }
  win.document.write(buildPrintableReportHtml(report, markdown));
  win.document.close();
  win.focus();
  window.setTimeout(() => win.print(), 350);
}

function buildPrintableReportHtml(report, markdown) {
  const overall = resolveOverall(report);
  const sideConclusions = resolveSideConclusions(report);
  const rows = resolveScoreboardRows(report);
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>SBS Grading Report</title>
  <style>
    @page { margin: 18mm; }
    body { color: #17202a; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.55; }
    h1 { font-size: 28px; margin: 0 0 8px; }
    h2 { border-top: 1px solid #d8dee7; font-size: 18px; margin: 28px 0 10px; padding-top: 16px; }
    .meta, .muted { color: #617080; }
    .summary { background: #f6f7f9; border: 1px solid #d8dee7; border-radius: 8px; padding: 14px; }
    .grid { display: grid; gap: 10px; grid-template-columns: repeat(2, 1fr); margin-top: 12px; }
    .box { border: 1px solid #d8dee7; border-radius: 8px; padding: 10px; }
    .box span { color: #617080; display: block; font-size: 12px; font-weight: 700; margin-bottom: 4px; text-transform: uppercase; }
    table { border-collapse: collapse; margin: 10px 0 18px; width: 100%; }
    th, td { border-bottom: 1px solid #d8dee7; padding: 8px; text-align: left; vertical-align: top; }
    th { color: #617080; font-size: 12px; text-transform: uppercase; }
    li { margin-bottom: 6px; }
    .pre { white-space: pre-wrap; }
  </style>
</head>
<body>
  <p class="meta">SBS 4 Any Agent · Grader Report</p>
  <h1>${escapeHtml(report.executiveVerdict?.headline || report.executiveVerdict?.verdict || "SBS Report")}</h1>
  <div class="summary">
    <strong>${escapeHtml(report.executiveVerdict?.verdict || "")}</strong>
    <p>${escapeHtml(report.executiveVerdict?.oneSentenceReason || report.executiveVerdict?.summary || "")}</p>
    <div class="grid">
      <div class="box"><span>Baseline Overall</span>${escapeHtml(scoreValue(overall.baseline))}</div>
      <div class="box"><span>Challenger Overall</span>${escapeHtml(scoreValue(overall.challenger))}</div>
      <div class="box"><span>Baseline conclusion</span>${escapeHtml(sideConclusions.baseline)}</div>
      <div class="box"><span>Challenger conclusion</span>${escapeHtml(sideConclusions.challenger)}</div>
    </div>
  </div>
  <h2>Dimension Scoreboard</h2>
  ${printTable(["Dimension", "Baseline", "Challenger", "Winner", "Challenger diagnosis"], rows.map((row) => [
    row.dimensionId || "",
    scoreValue(row.baselineScore ?? row.baseline),
    scoreValue(row.challengerScore ?? row.challenger),
    row.winner || row.pairwiseWinner || row.verdict || "",
    row.challengerDiagnosis || row.challengerComment || row.rationale || row.reason || "",
  ]))}
  <h2>Challenger Optimization Plan</h2>
  <ul>${(report.challengerOptimizationPlan || []).map((item) => `<li><strong>${escapeHtml(item.priority || "")} · ${escapeHtml(item.theme || "")}</strong><br>${escapeHtml(item.recommendation || "")}<br><span class="muted">${escapeHtml(item.whyItMatters || "")}</span></li>`).join("")}</ul>
  <h2>Case Type Breakdown</h2>
  <div class="pre">${escapeHtml(JSON.stringify(report.caseTypeBreakdown || [], null, 2))}</div>
  <h2>Failure Clusters And Red Lines</h2>
  <div class="pre">${escapeHtml(JSON.stringify([...(report.failureClusters || []), ...(report.redLineSummary || [])], null, 2))}</div>
  <h2>Case Table</h2>
  ${printTable(["Case", "Type", "Winner", "Baseline", "Challenger", "Caveat"], (report.caseTable || []).map((row) => [
    row.caseId || "",
    row.caseType || "",
    row.winner || row.pairwiseWinner || "",
    scoreValue(row.baselineScore),
    scoreValue(row.challengerScore),
    row.caveat || row.confidence || "",
  ]))}
  <h2>Uncertainty And Caveats</h2>
  <ul>${(report.uncertaintyAndCaveats || []).map((item) => `<li>${escapeHtml(item.detail || item.summary || JSON.stringify(item))}</li>`).join("")}</ul>
</body>
</html>`;
}

function printTable(headers, rows) {
  return `<table><thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
