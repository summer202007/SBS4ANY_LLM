export function renderPackageView(root, packageState, handlers = {}) {
  const runtimePackage = packageState?.package;
  if (!runtimePackage) {
    const activeTask = packageState?.activeTask;
    root.innerHTML = `
      ${renderPackageBuilder(activeTask, handlers)}
    `;
    attachPackageBuilderHandlers(root, handlers);
    return;
  }

  const activeTask = packageState?.activeTask;
  const arena = runtimePackage.arenaEvalSpec || {};
  const coverage = runtimePackage.evalSetCoveragePlan || {};
  const validation = packageState.validation || {};
  const selfCritique = runtimePackage.selfCritiqueTrace || {};
  const backlog = runtimePackage.confirmationBacklog || [];
  const cases = runtimePackage.evalCases || [];
  const gates = selfCritique.qualityGateResults || {};

  root.innerHTML = `
    <section class="view-heading">
      <div>
        <p class="eyebrow">Checkpoint 1</p>
        <h2>Package Overview</h2>
      </div>
      ${renderValidation(validation)}
    </section>

    ${activeTask ? taskContext(activeTask) : ""}

    ${packageDecisionSummary(runtimePackage, validation, cases, backlog)}

    <section class="section-band">
      <h3>Arena</h3>
      <div class="summary-grid">
        ${field("Decision Question", arena.decisionQuestion)}
        ${field("Task Space", arena.taskSpace)}
        ${field("Scenario", arena.evaluationScenario)}
        ${field("Baseline", arena.baseline?.name)}
        ${field("Challenger", arena.challenger?.name)}
        ${field("Product Surface", arena.productSurface)}
      </div>
      ${listBlock("Target Users", arena.targetUsers)}
      ${listBlock("User Jobs", arena.userJobs)}
      ${listBlock("Known Unknowns", arena.knownUnknowns)}
    </section>

    <section class="section-band">
      <h3>Coverage</h3>
      <div class="metric-row">
        ${metric("Cases", String(cases.length))}
        ${metric("Target", String(coverage.caseCountTarget || cases.length))}
        ${metric("Scale", coverage.scalePreset || "mvp")}
        ${metric("Multi-turn", percent(coverage.multiTurnRatio))}
      </div>
      <div class="two-column">
        ${objectBlock("Case Mix", coverage.caseMix)}
        ${objectBlock("Dimension Weights", coverage.dimensionWeights)}
      </div>
      ${listBlock("Scored Dimensions", coverage.scoredDimensions)}
      ${listBlock("Diagnostic Dimensions", coverage.diagnosticDimensions)}
      ${listBlock("Disabled Dimensions", coverage.disabledDimensions)}
      ${taskFitBlock(coverage.taskFitModule)}
    </section>

    <details class="section-band disclosure-section">
      <summary>Self-Critique And Quality Gates</summary>
      <div class="gate-list">
        ${Object.entries(gates).map(([name, result]) => gate(name, result)).join("")}
      </div>
      ${listBlock("Revision Summary", [selfCritique.revisionSummary].filter(Boolean))}
    </details>

    <details class="section-band disclosure-section" ${backlog.length ? "open" : ""}>
      <summary>Confirmation Backlog ${backlog.length ? `<span class="status-pill warn">${backlog.length}</span>` : ""}</summary>
      ${backlog.length ? backlog.map(backlogItem).join("") : `<p class="muted">No open confirmation items.</p>`}
    </details>

    <details class="section-band disclosure-section">
      <summary>Trace Artifacts</summary>
      ${listBlock("Generation Trace", runtimePackage.generationTrace?.artifactRefs)}
      ${listBlock("Self-Critique Trace", selfCritique.traceArtifactRefs)}
    </details>
  `;
}

function packageDecisionSummary(runtimePackage, validation, cases, backlog) {
  const arena = runtimePackage.arenaEvalSpec || {};
  const coverage = runtimePackage.evalSetCoveragePlan || {};
  const caseMix = coverage.caseMix || {};
  const scoredDimensions = coverage.scoredDimensions || [];
  const ok = Boolean(validation.ok);
  const multiTurnCount = Number(caseMix.scripted_multi_turn || 0) + Number(caseMix.adaptive_multi_turn || 0);
  return `
    <section class="section-band package-summary-hero">
      <div class="split-heading">
        <div>
          <p class="eyebrow">Package Readiness</p>
          <h3>${ok ? "Ready for human curation" : "Needs package review"}</h3>
          <p class="muted">${escapeHtml(arena.successDefinition || arena.decisionQuestion || "")}</p>
        </div>
        <span class="status-pill ${ok ? "ok" : "bad"}">${ok ? "validation passed" : "validation issue"}</span>
      </div>
      <div class="metric-row package-summary-metrics">
        ${metric("Cases", String(cases.length))}
        ${metric("Case Types", String(Object.keys(caseMix).filter((key) => caseMix[key]).length || "None"))}
        ${metric("Multi-turn", String(multiTurnCount))}
        ${metric("Open Questions", String(backlog.length))}
      </div>
      <div class="package-chip-row">
        ${(coverage.scoredDimensions || []).slice(0, 6).map((item) => `<span class="capture-site-chip"><strong>${escapeHtml(item)}</strong></span>`).join("")}
        ${scoredDimensions.length > 6 ? `<span class="capture-site-chip"><strong>+${scoredDimensions.length - 6}</strong></span>` : ""}
      </div>
    </section>
  `;
}

function renderPackageBuilder(activeTask, options = {}) {
  const generationJob = options.generationJob || null;
  if (!activeTask) {
    return `
      <section class="empty-state">
        <h2>No eval package loaded</h2>
        <p>Create an evaluation task first, then generate or import an eval package.</p>
      </section>
    `;
  }
  return `
    <section class="view-heading">
      <div>
        <p class="eyebrow">Checkpoint 1</p>
        <h2>Build Eval Package</h2>
      </div>
    </section>
    ${taskContext(activeTask)}
    <section class="section-band package-builder-panel">
      <h3>Generate With Local Codex</h3>
      <p class="muted">SBS will call local Codex with the chatbot eval-set generator skill. This usually takes 10-15 minutes for a 15-case package. The result is a draft package: review the package, confirmation backlog, and cases before collection.</p>
      <div class="two-column">
        <label class="field-label">
          <span>Case count</span>
          <select id="packageCaseCount">
            <option value="12">12 cases</option>
            <option value="15" selected>15 cases</option>
            <option value="20">20 cases</option>
          </select>
        </label>
        <div class="field">
          <span>Local requirement</span>
          <strong>Codex + chatbot-eval-set-generator skill</strong>
        </div>
      </div>
      <button id="generateEvalPackage" class="primary-button" type="button" ${generationJob?.status === "running" ? "disabled" : ""}>${generationJob?.status === "running" ? "Generating..." : "Generate Eval Package"}</button>
      <p class="field-hint">If generation fails, the app will keep this task and let you retry.</p>
      ${generationMonitor(generationJob)}
    </section>
    <section class="section-band package-builder-panel">
      <h3>Import From Local Template</h3>
      <p class="muted">Use this when you already have cases or want to draft cases manually. The template uses an Excel-compatible XML workbook with separate sheets for case types.</p>
      <div class="button-row">
        <a class="secondary-button link-button" href="/api/package/template" download="sbs-eval-package-template.xml">Download Template</a>
        <label class="secondary-button file-button">
          Upload Filled Template
          <input id="packageTemplateUpload" type="file" accept=".xml,.xls,text/xml,application/xml" hidden />
        </label>
      </div>
      <p class="field-hint">MVP parser supports the SBS-generated XML template. Keep the workbook in XML Spreadsheet format when uploading.</p>
    </section>
  `;
}

function attachPackageBuilderHandlers(root, handlers) {
  root.querySelector("#generateEvalPackage")?.addEventListener("click", () => {
    const caseCountTarget = Number(root.querySelector("#packageCaseCount")?.value || 15);
    handlers.onGeneratePackage?.({ caseCountTarget });
  });
  root.querySelector("#packageTemplateUpload")?.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const xmlText = await file.text();
    handlers.onImportTemplate?.({ xmlText, fileName: file.name });
    event.target.value = "";
  });
}

function generationMonitor(job) {
  if (!job) return "";
  const elapsed = elapsedLabel(job.startedAt, job.finishedAt);
  const logs = [...(job.logs || [])].reverse();
  const tone = job.status === "succeeded" ? "ok" : job.status === "fallback" || job.status === "failed" ? "bad" : "neutral";
  return `
    <div class="generation-monitor generation-monitor-${tone}">
      <div class="generation-monitor-header">
        <div>
          <strong>${escapeHtml(generationStatusLabel(job.status))}</strong>
          <span>${escapeHtml(job.phase || "Starting")}</span>
        </div>
        <span>${escapeHtml(elapsed)}</span>
      </div>
      ${job.status === "running" ? generationHeartbeat(job) : ""}
      ${job.warning ? `<p class="generation-warning">${escapeHtml(job.warning)}</p>` : ""}
      ${job.error ? `<p class="generation-warning">${escapeHtml(job.error)}</p>` : ""}
      <div class="generation-log">
        ${logs.length ? logs.map((item) => `<div><span>${escapeHtml(shortTime(item.at))}</span>${escapeHtml(item.message)}</div>`).join("") : `<div><span>now</span>Waiting for local Codex...</div>`}
      </div>
    </div>
  `;
}

function generationHeartbeat(job) {
  const elapsedSeconds = elapsedSecondsSince(job.startedAt);
  const quietStage =
    !job.phase ||
    job.phase === "Starting local Codex package generation." ||
    job.phase === "queued";
  const message = quietStage
    ? "Local Codex may be quiet while it drafts cases, turn scripts, rubrics, and self-critique. No final package has been written yet."
    : "SBS is still waiting for the final package, then it will validate and repair the contract if needed.";
  const expectation = elapsedSeconds >= 600
    ? "Still within the 20-minute timeout; 15-case packages can take 10-15 minutes."
    : "Expected runtime for 15 cases is usually 10-15 minutes.";
  return `
    <div class="generation-heartbeat">
      <strong>Still running</strong>
      <span>${escapeHtml(message)} ${escapeHtml(expectation)}</span>
    </div>
  `;
}

function generationStatusLabel(status) {
  return {
    running: "Local Codex Running",
    succeeded: "Package Ready",
    fallback: "Fallback Package Ready",
    failed: "Generation Failed",
  }[status] || "Generation";
}

function elapsedLabel(startedAt, finishedAt) {
  if (!startedAt) return "";
  const seconds = elapsedSecondsSince(startedAt, finishedAt);
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes ? `${minutes}m ${rest}s` : `${rest}s`;
}

function elapsedSecondsSince(startedAt, finishedAt) {
  if (!startedAt) return 0;
  const end = finishedAt ? new Date(finishedAt).getTime() : Date.now();
  return Math.max(0, Math.round((end - new Date(startedAt).getTime()) / 1000));
}

function shortTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function taskContext(task) {
  return `
    <section class="section-band task-context-band">
      <h3>Evaluation Task</h3>
      <div class="summary-grid">
        ${field("Task", task.title)}
        ${field("Task Space", task.taskSpace?.label)}
        ${field("Baseline Surface", surfaceLabel(task.arena?.baseline?.surface))}
        ${field("Challenger Surface", surfaceLabel(task.arena?.challenger?.surface))}
      </div>
      <p class="muted">${escapeHtml(task.taskSpace?.decisionQuestion || task.taskSpace?.concreteScenario || "")}</p>
    </section>
  `;
}

function surfaceLabel(value) {
  return (
    {
      web_chat: "Web chat",
      mobile_app: "Mobile app",
      desktop_app: "Desktop app",
      api: "API",
      other: "Other",
    }[value] || value || "Not specified"
  );
}

function renderValidation(validation) {
  const ok = Boolean(validation.ok);
  const schemaErrors = validation.schemaErrors || [];
  const consistencyErrors = validation.consistencyErrors || [];
  const warnings = validation.warnings || [];
  return `
    <div class="validation ${ok ? "validation-ok" : "validation-bad"}">
      <strong>${ok ? "Validation Passed" : "Validation Needs Attention"}</strong>
      <span>${schemaErrors.length} schema / ${consistencyErrors.length} consistency / ${warnings.length} warnings</span>
    </div>
  `;
}

function field(label, value) {
  return `
    <div class="field">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value || "Not specified")}</strong>
    </div>
  `;
}

function metric(label, value) {
  return `
    <div class="metric">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function objectBlock(title, value) {
  if (!value || !Object.keys(value).length) return `<div>${listBlock(title, [])}</div>`;
  return `
    <div>
      <h4>${escapeHtml(title)}</h4>
      <dl class="key-values">
        ${Object.entries(value)
          .map(([key, item]) => `<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(String(item))}</dd></div>`)
          .join("")}
      </dl>
    </div>
  `;
}

function listBlock(title, values = []) {
  const items = Array.isArray(values) ? values.filter(Boolean) : [];
  return `
    <div class="list-block">
      <h4>${escapeHtml(title)}</h4>
      ${
        items.length
          ? `<ul>${items.map((item) => `<li>${escapeHtml(String(item))}</li>`).join("")}</ul>`
          : `<p class="muted">None</p>`
      }
    </div>
  `;
}

function taskFitBlock(module) {
  if (!module) return "";
  return `
    <div class="task-fit">
      <h4>Task Fit Module</h4>
      <p><strong>Status:</strong> ${escapeHtml(module.status || "Not specified")}</p>
      <p><strong>Boundary:</strong> ${escapeHtml(module.relationshipToProductExperience || "Not specified")}</p>
      <p><strong>Reward:</strong> ${escapeHtml(module.rewardPolicy || "Not specified")}</p>
      <p><strong>Penalty:</strong> ${escapeHtml(module.penaltyPolicy || "Not specified")}</p>
    </div>
  `;
}

function gate(name, result) {
  const status = result?.status || "unknown";
  return `
    <div class="gate gate-${escapeHtml(status)}">
      <strong>${escapeHtml(name)}</strong>
      <span>${escapeHtml(status)}</span>
      <p>${escapeHtml(result?.reason || "")}</p>
    </div>
  `;
}

function backlogItem(item) {
  return `
    <article class="backlog-item">
      <div>
        <strong>${escapeHtml(item.itemId || item.id || "confirmation")}</strong>
        <span>${escapeHtml(item.status || "open")}</span>
      </div>
      <p>${escapeHtml(item.question || item.description || item.reason || JSON.stringify(item))}</p>
    </article>
  `;
}

function percent(value) {
  if (typeof value !== "number") return "n/a";
  return `${Math.round(value * 100)}%`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
