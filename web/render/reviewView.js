export function renderReviewView(root, packageState, graderBundle, handlers = {}) {
  const cleaned = graderBundle?.cleanedEvidence;
  const summary = graderBundle?.summary;
  const job = handlers.job;
  const running = job?.status === "running";
  const cases = cleaned?.caseEvidence || [];
  const stats = summarizeCases(cases);

  root.innerHTML = `
    <div class="view-heading">
      <div>
        <p class="eyebrow">Evidence Review</p>
        <h2>Cleaned Evidence</h2>
      </div>
      <div class="view-actions">
        ${renderRunControls(running)}
      </div>
    </div>

    ${summary?.stale ? staleBanner() : ""}
    ${renderJobPanel(job)}

    <section class="section-band">
      <h3>Review Readiness</h3>
      <div class="metric-row">
        ${metric("Cleaned cases", cases.length || "None")}
        ${metric("Ready", stats.ready)}
        ${metric("Needs review", stats.needsReview)}
        ${metric("Missing / blocked", stats.blocked)}
      </div>
      <p class="muted">Review uses cleaned evidence. Raw collection is preserved and still available to the grader through artifact refs. Treat yellow cases as spot-check candidates and red cases as coverage caveats.</p>
    </section>

    ${
      cleaned
        ? renderCleanedEvidence(cleaned)
        : `<section class="empty-state">
            <h2>No cleaned evidence yet</h2>
            <p>Run Review + Report once. SBS will call local Codex with the full chatbot-sbs-grader skill, write cleaned evidence first, then continue generating the report in the same background job.</p>
          </section>`
    }
  `;

  root.querySelector("#runGrader")?.addEventListener("click", () => {
    handlers.onRunGrader?.({ settings: readSettings(root) });
  });
}

function renderRunControls(running) {
  return `
    <div class="run-controls">
      <label class="compact-label" for="communicationFitMode">Communication fit</label>
      <select id="communicationFitMode" ${running ? "disabled" : ""}>
        <option value="diagnostic_only" selected>Diagnostic only</option>
        <option value="scored">Score it</option>
        <option value="disabled">Ignore</option>
      </select>
      <button id="runGrader" class="primary-button" type="button" ${running ? "disabled" : ""}>
        ${running ? "Running..." : "Run Review + Report"}
      </button>
    </div>
  `;
}

function renderJobPanel(job) {
  if (!job) return "";
  const logs = job.logs || [];
  return `
    <section class="section-band job-panel">
      <div class="split-heading">
        <div>
          <h3>Local Codex Grader</h3>
          <p class="muted">${escapeHtml(stageCopy(job.phase))}</p>
        </div>
        <span class="status-pill ${statusTone(job.status)}">${escapeHtml(job.status || "idle")}</span>
      </div>
      <div class="log-list">
        ${logs.map((item) => `<div class="log-line"><span>${escapeHtml(formatTime(item.at))}</span>${escapeHtml(item.message)}</div>`).join("") || `<p class="muted">Waiting for local Codex logs...</p>`}
      </div>
    </section>
  `;
}

function renderCleanedEvidence(cleaned) {
  return `
    <section class="section-band">
      <h3>Coverage</h3>
      <div class="summary-grid">
        ${field("Coverage status", cleaned.coverageSummary?.coverageStatus || "")}
        ${field("Missing cases", (cleaned.coverageSummary?.missingCaseIds || []).join(", ") || "None")}
        ${field("Quality gates", summarizeGates(cleaned.qualityGateResults))}
        ${field("Human review queue", (cleaned.humanReviewQueue || []).length)}
      </div>
    </section>

    <section class="section-band">
      <h3>Case Evidence</h3>
      <div class="grader-case-list">
        ${(cleaned.caseEvidence || []).map(renderCaseEvidence).join("")}
      </div>
    </section>
  `;
}

function renderCaseEvidence(item) {
  const needsAttention = ["missing", "blocked", "low_confidence", "needs_human_review"].includes(item.status);
  const findingsCount = (item.caseFindings || []).length;
  return `
    <details class="grader-case-card" ${needsAttention ? "open" : ""}>
      <summary>
        <strong>${escapeHtml(item.caseId)}</strong>
        <span>${escapeHtml(item.caseType || "")}</span>
        <span class="status-pill ${statusTone(item.status)}">${escapeHtml(item.status || "")}</span>
        ${findingsCount ? `<span class="muted">${findingsCount} note${findingsCount === 1 ? "" : "s"}</span>` : ""}
      </summary>
      ${needsAttention ? `<p class="review-action-hint">${escapeHtml(reviewActionHint(item.status))}</p>` : ""}
      ${(item.caseFindings || []).map((finding) => `<p class="muted">${escapeHtml(finding.issue || finding.type || JSON.stringify(finding))}</p>`).join("")}
      ${(item.turnEvidence || []).map(renderTurnEvidence).join("")}
    </details>
  `;
}

function reviewActionHint(status) {
  if (status === "missing") return "Missing evidence: this case should be excluded or collected before relying on multi-turn conclusions.";
  if (status === "blocked") return "Blocked evidence: inspect raw collection before grading.";
  if (status === "low_confidence") return "Low confidence: grader can use it, but a human spot-check is recommended.";
  return "Needs review: inspect cleaned fields before trusting downstream conclusions.";
}

function renderTurnEvidence(turn) {
  return `
    <div class="turn-evidence">
      <h4>Turn ${Number(turn.turnIndex || 1)}</h4>
      ${field("User message", turn.userMessage || "")}
      <div class="sbs-grid">
        ${renderSide("Baseline", turn.sides?.baseline)}
        ${renderSide("Challenger", turn.sides?.challenger)}
      </div>
    </div>
  `;
}

function renderSide(label, side) {
  if (!side) return `<div class="side-output"><h4>${label}</h4><p class="muted">No evidence.</p></div>`;
  return `
    <div class="side-output">
      <div class="split-heading">
        <h4>${escapeHtml(label)}</h4>
        <span class="status-pill ${statusTone(side.gradeReadiness)}">${escapeHtml(side.gradeReadiness || "")}</span>
      </div>
      ${field("Clean final output", side.cleanFinalOutput || "")}
      <div class="summary-grid">
        ${field("Query evidence", count(side.intentExpansionEvidence))}
        ${field("Sources", count(side.sourceEvidence))}
        ${field("Follow-ups", count(side.followupSuggestions))}
        ${field("Noise removed", count(side.removedNoise))}
      </div>
      ${(side.humanReviewHints || []).length ? `<p class="warning-text">${escapeHtml(side.humanReviewHints.join("；"))}</p>` : ""}
    </div>
  `;
}

function readSettings(root) {
  return {
    communicationFit: root.querySelector("#communicationFitMode")?.value || "diagnostic_only",
    reportLanguage: "zh",
    evidenceMode: "auto_minimal",
  };
}

function summarizeCases(cases) {
  return cases.reduce(
    (acc, item) => {
      if (item.status === "ready") acc.ready += 1;
      else if (item.status === "blocked" || item.status === "missing") acc.blocked += 1;
      else acc.needsReview += 1;
      return acc;
    },
    { ready: 0, needsReview: 0, blocked: 0 },
  );
}

function summarizeGates(gates) {
  if (Array.isArray(gates)) return `${gates.filter((g) => g.ok !== false).length}/${gates.length} ok`;
  if (gates && typeof gates === "object") return Object.values(gates).some((v) => v === false) ? "Has warnings" : "Present";
  return "Not available";
}

function staleBanner() {
  return `<section class="section-band warning-band"><strong>Stale grader artifacts.</strong> Collection or package data changed after this review/report was generated. Rerun Review + Report before relying on conclusions.</section>`;
}

function stageCopy(phase) {
  return {
    queued: "Queued.",
    preclean: "Separating obvious capture noise before local LLM review.",
    preclean_complete: "Deterministic pre-clean completed.",
    cleaning: "Local Codex is cleaning collected evidence.",
    cleaned_ready: "Cleaned evidence is ready; report generation continues in the background.",
    reporting: "Local Codex is judging cases and drafting the report.",
    validating_report: "Validating report artifacts.",
    completed: "Report artifacts are ready.",
    failed: "The grader job failed.",
  }[phase] || phase || "Idle.";
}

function field(label, value) {
  return `<div class="field"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value || ""))}</strong></div>`;
}

function metric(label, value) {
  return `<div class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong></div>`;
}

function count(value) {
  return Array.isArray(value) ? value.length : 0;
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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
