export function renderCasesView(root, packageState, handlers = {}) {
  const runtimePackage = packageState?.package;
  if (!runtimePackage) {
    root.innerHTML = `
      <section class="empty-state">
        <h2>No eval package loaded</h2>
        <p>Load the restaurant fixture before reviewing cases.</p>
      </section>
    `;
    return;
  }

  const originalCases = runtimePackage.evalCases || [];
  const caseStatuses = packageState.curation?.caseStatuses || {};
  const cases = originalCases.map((evalCase) => mergeEditedCase(evalCase, caseStatuses[evalCase.caseId]));
  const selectedCaseId = handlers.selectedCaseId || cases[0]?.caseId;
  const selectedCase = cases.find((item) => item.caseId === selectedCaseId) || cases[0];
  const selectedScript = (runtimePackage.turnScripts || []).find(
    (script) => script.caseId === selectedCase?.caseId,
  );
  const selectedStatus = caseStatuses[selectedCase?.caseId] || {};
  const stats = summarizeStatuses(cases, caseStatuses);
  const visibleCases = cases.filter((evalCase) => matchesFilters(evalCase, caseStatuses, handlers));

  root.innerHTML = `
    <section class="view-heading">
      <div>
        <p class="eyebrow">Checkpoint 2</p>
        <h2>Case Curation</h2>
      </div>
      <div class="metric-row compact-metrics">
        ${metric("Total", String(cases.length))}
        ${metric("Approved", String(stats.approved))}
        ${metric("Draft", String(stats.draft))}
        ${metric("Rejected", String(stats.rejected))}
      </div>
    </section>

    <section class="curation-completion-bar">
      <div>
        <strong>${escapeHtml(completionText(stats, cases.length))}</strong>
        <p class="muted">${escapeHtml(completionHint(stats))}</p>
      </div>
      <div class="button-row">
        <button id="generateMoreCases" class="secondary-button" type="button">Generate More Cases</button>
        <button id="startCollection" class="primary-button" type="button" ${stats.draft > 0 || stats.approved === 0 ? "disabled" : ""}>Start Collection</button>
      </div>
    </section>

    <section class="case-workbench">
      <div class="case-list-panel">
        <div class="case-toolbar">
          <select id="caseTypeFilter" aria-label="Case type filter">
            ${option("all", "All types", handlers.caseTypeFilter)}
            ${unique(cases.map((item) => item.caseType)).map((type) => option(type, type, handlers.caseTypeFilter)).join("")}
          </select>
          <select id="caseStatusFilter" aria-label="Case status filter">
            ${option("all", "All status", handlers.caseStatusFilter)}
            ${["draft", "approved", "rejected"].map((status) => option(status, status, handlers.caseStatusFilter)).join("")}
          </select>
        </div>
        <div class="case-table" role="list">
          ${visibleCases.length
            ? visibleCases.map((evalCase) =>
              caseRow(evalCase, caseStatuses[evalCase.caseId], evalCase.caseId === selectedCase?.caseId),
            ).join("")
            : `<p class="muted case-empty-filter">No cases match the current filters.</p>`}
        </div>
      </div>

      <div class="case-detail-panel">
        ${selectedCase ? detail(selectedCase, selectedStatus, selectedScript) : `<p class="muted">No case selected.</p>`}
      </div>
    </section>

    <dialog id="generateMoreDialog" class="modal">
      <form method="dialog">
        <div class="modal-heading">
          <h3>Generate More Cases</h3>
          <button class="icon-button" value="close" type="submit">x</button>
        </div>
        <p class="muted">Frontend placeholder only. The eval generator backend will be connected later.</p>
        <label class="edit-field">
          <span>Case type</span>
          <select>
            ${["single_turn", "scripted_multi_turn", "capability_probe", "boundary_risk", "regression_like"].map((type) => option(type, type, "single_turn")).join("")}
          </select>
        </label>
        <label class="edit-field">
          <span>Count</span>
          <input type="number" min="1" max="10" value="3" />
        </label>
        <label class="edit-field">
          <span>Supplemental instruction</span>
          <textarea placeholder="e.g. add more Beijing/Shanghai high-risk cases"></textarea>
        </label>
        <div class="button-row">
          <button class="secondary-button" value="close" type="submit">Close</button>
          <button class="primary-button" disabled type="button">Backend Not Connected</button>
        </div>
      </form>
    </dialog>
  `;

  root.querySelector("#caseTypeFilter")?.addEventListener("change", (event) => {
    handlers.onFilterChange?.({ caseTypeFilter: event.target.value });
  });
  root.querySelector("#caseStatusFilter")?.addEventListener("change", (event) => {
    handlers.onFilterChange?.({ caseStatusFilter: event.target.value });
  });
  root.querySelectorAll("[data-case-id]").forEach((button) => {
    button.addEventListener("click", () => handlers.onSelectCase?.(button.dataset.caseId));
  });
  root.querySelectorAll("[data-status-action]").forEach((button) => {
    button.addEventListener("click", () => {
      handlers.onSaveCuration?.({
        caseId: button.dataset.statusCaseId,
        status: button.dataset.statusAction,
        reviewerNotes: root.querySelector("#reviewerNotes")?.value || "",
        editedCase: readEditedCase(root),
        advanceAfterSave: button.dataset.statusAction === "approved" || button.dataset.statusAction === "rejected",
      });
    });
  });
  root.querySelector("#saveCaseNotes")?.addEventListener("click", () => {
    handlers.onSaveCuration?.({
      caseId: selectedCase.caseId,
      status: selectedStatus.status || "draft",
      reviewerNotes: root.querySelector("#reviewerNotes")?.value || "",
      editedCase: readEditedCase(root),
      advanceAfterSave: false,
    });
  });
  root.querySelector("#startCollection")?.addEventListener("click", () => {
    handlers.onStartCollection?.();
  });
  root.querySelector("#generateMoreCases")?.addEventListener("click", () => {
    root.querySelector("#generateMoreDialog")?.showModal();
  });
}

function caseRow(evalCase, status = {}, selected) {
  return `
    <button class="case-row ${selected ? "selected" : ""}" data-case-id="${escapeHtml(evalCase.caseId)}" type="button">
      <span>
        <strong>${escapeHtml(evalCase.caseId)}</strong>
        <small>${escapeHtml(evalCase.caseType)} / ${escapeHtml(evalCase.capabilityCluster || "uncategorized")}</small>
      </span>
      <span class="status-pill status-${escapeHtml(status.status || "draft")}">${escapeHtml(status.status || "draft")}</span>
    </button>
  `;
}

function detail(evalCase, status = {}, turnScript) {
  const hasEdits = Object.keys(status.editedCase || {}).length > 0;
  return `
    <article class="case-detail">
      <div class="case-detail-heading">
        <div>
          <p class="eyebrow">${escapeHtml(evalCase.caseType)}</p>
          <h3>${escapeHtml(evalCase.caseId)}</h3>
        </div>
        <span class="status-pill status-${escapeHtml(status.status || "draft")}">${escapeHtml(status.status || "draft")}</span>
      </div>
      ${hasEdits ? `<p class="edit-note">This case has human edits saved as an overlay. The original package is preserved.</p>` : ""}

      ${caseBrief(evalCase)}

      <div class="summary-grid">
        ${field("Capability", evalCase.capabilityCluster)}
        ${field("Difficulty", evalCase.difficulty)}
        ${field("Risk", evalCase.riskLevel)}
        ${field("Collection", evalCase.collectionMode)}
      </div>

      ${turnScript ? turnScriptSummary(turnScript) : ""}

      <section class="model-facing-box">
        <h4>Editable Model-Facing</h4>
        <p class="fairness-note">Anything the tested model should be strictly judged on must be visible here or in later model-facing turns.</p>
        <label>Prompt to copy</label>
        <textarea id="editModelFacingPrompt">${escapeHtml(evalCase.modelFacingPrompt || evalCase.initialPrompt || "")}</textarea>
        ${listBlock("Collection Instructions", evalCase.collectionInstructions)}
      </section>

      <section class="evaluator-facing-box">
        <h4>Editable Evaluator-Facing</h4>
        ${textInput("Scenario", "editScenario", evalCase.scenario)}
        ${textInput("User Persona / evaluator context", "editUserPersona", evalCase.userPersona, "Visible to evaluator only. Do not use as a hard scoring requirement unless it is also expressed or reasonably implied in Model-Facing content.")}
        ${textInput("User Goal", "editUserGoal", evalCase.userGoal)}
        ${textInput("Expected Outcome", "editExpectedOutcome", evalCase.expectedOutcome)}
        <div class="summary-grid">
          ${selectInput("Risk", "editRiskLevel", evalCase.riskLevel, ["low", "medium", "high"])}
          ${selectInput("Difficulty", "editDifficulty", evalCase.difficulty, ["easy", "medium", "hard"])}
        </div>
        ${arrayInput("Must Do", "editMustDo", evalCase.mustDo)}
        ${arrayInput("Must Not Do", "editMustNotDo", evalCase.mustNotDo)}
        ${arrayInput("Failure Modes To Probe", "editFailureModesToProbe", evalCase.failureModesToProbe)}
        <div class="read-only-reference">
          <h4>Read-Only References</h4>
          <p class="fairness-note">Hidden/evaluator fields explain why the case exists. They should guide grading only through information the tested model could see, infer, clarify, or safely caveat.</p>
          ${field("Evaluator Intent", evalCase.evaluatorIntent)}
          ${field("Hidden Intent", evalCase.hiddenIntent)}
        </div>
        ${listBlock("Grader Refs", evalCase.graderRefs)}
      </section>

      <section class="curation-actions">
        <label for="reviewerNotes">Reviewer Notes</label>
        <textarea id="reviewerNotes">${escapeHtml(status.reviewerNotes || "")}</textarea>
        <div class="button-row">
          <button data-status-action="approved" data-status-case-id="${escapeHtml(evalCase.caseId)}" class="primary-button" type="button">Approve</button>
          <button data-status-action="draft" data-status-case-id="${escapeHtml(evalCase.caseId)}" class="secondary-button" type="button">Keep Draft</button>
          <button data-status-action="rejected" data-status-case-id="${escapeHtml(evalCase.caseId)}" class="danger-button" type="button">Reject</button>
          <button id="saveCaseNotes" class="secondary-button" type="button">Save Notes</button>
        </div>
      </section>
    </article>
  `;
}

function caseBrief(evalCase) {
  const prompt = evalCase.modelFacingPrompt || evalCase.initialPrompt || "";
  const signal =
    evalCase.discriminativeSignal ||
    evalCase.expectedOutcome ||
    "This case should reveal whether the product can satisfy the user's task better than the baseline.";
  return `
    <section class="case-brief">
      <div class="case-brief-main">
        <div>
          <p class="eyebrow">Case Brief</p>
          <h4>${escapeHtml(evalCase.scenario || evalCase.userFacingIntent || evalCase.caseId)}</h4>
        </div>
        <span class="status-pill status-${escapeHtml(evalCase.riskLevel || "draft")}">${escapeHtml(evalCase.riskLevel || "risk unknown")}</span>
      </div>
      <div class="case-brief-prompt">${escapeHtml(prompt)}</div>
      <div class="summary-grid case-brief-grid">
        ${field("What this tests", evalCase.evaluatorIntent || evalCase.userGoal || evalCase.capabilityCluster)}
        ${field("Expected signal", signal)}
      </div>
    </section>
  `;
}

function turnScriptSummary(turnScript) {
  return `
    <section class="turn-script-summary">
      <h4>Multi-Turn Script</h4>
      <div class="summary-grid">
        ${field("Script Mode", turnScript.scriptMode)}
        ${field("Max Turns", String(turnScript.maxTurns || ""))}
        ${field("Runtime Mode", turnScript.harnessExecutionContract?.runtimeModelMode)}
        ${field("Decision Policy", turnScript.harnessExecutionContract?.decisionPolicy)}
      </div>
      <p class="muted">${escapeHtml(turnScript.harnessExecutionContract?.mvpExecutionNote || "Multi-turn execution is handled in Collect.")}</p>
    </section>
  `;
}

function textInput(label, id, value, hint = "") {
  return `
    <label class="edit-field" for="${escapeHtml(id)}">
      <span>${escapeHtml(label)}</span>
      ${hint ? `<small class="field-hint">${escapeHtml(hint)}</small>` : ""}
      <textarea id="${escapeHtml(id)}">${escapeHtml(value || "")}</textarea>
    </label>
  `;
}

function arrayInput(label, id, value = []) {
  const text = Array.isArray(value) ? value.join("\n") : String(value || "");
  return `
    <label class="edit-field" for="${escapeHtml(id)}">
      <span>${escapeHtml(label)} <small>one per line</small></span>
      <textarea id="${escapeHtml(id)}">${escapeHtml(text)}</textarea>
    </label>
  `;
}

function selectInput(label, id, value, options) {
  return `
    <label class="edit-field" for="${escapeHtml(id)}">
      <span>${escapeHtml(label)}</span>
      <select id="${escapeHtml(id)}">
        ${options.map((item) => option(item, item, value)).join("")}
      </select>
    </label>
  `;
}

function readEditedCase(root) {
  return {
    modelFacingPrompt: root.querySelector("#editModelFacingPrompt")?.value || "",
    scenario: root.querySelector("#editScenario")?.value || "",
    userPersona: root.querySelector("#editUserPersona")?.value || "",
    userGoal: root.querySelector("#editUserGoal")?.value || "",
    expectedOutcome: root.querySelector("#editExpectedOutcome")?.value || "",
    mustDo: splitLines(root.querySelector("#editMustDo")?.value || ""),
    mustNotDo: splitLines(root.querySelector("#editMustNotDo")?.value || ""),
    failureModesToProbe: splitLines(root.querySelector("#editFailureModesToProbe")?.value || ""),
    riskLevel: root.querySelector("#editRiskLevel")?.value || "",
    difficulty: root.querySelector("#editDifficulty")?.value || "",
  };
}

function mergeEditedCase(evalCase, status = {}) {
  return { ...evalCase, ...(status.editedCase || {}) };
}

function splitLines(value) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function matchesFilters(evalCase, caseStatuses, handlers) {
  const status = caseStatuses[evalCase.caseId]?.status || "draft";
  return (
    (!handlers.caseTypeFilter || handlers.caseTypeFilter === "all" || evalCase.caseType === handlers.caseTypeFilter) &&
    (!handlers.caseStatusFilter || handlers.caseStatusFilter === "all" || status === handlers.caseStatusFilter)
  );
}

function summarizeStatuses(cases, caseStatuses) {
  return cases.reduce(
    (acc, evalCase) => {
      const status = caseStatuses[evalCase.caseId]?.status || "draft";
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    },
    { draft: 0, approved: 0, rejected: 0 },
  );
}

function completionText(stats, total) {
  if (!total) return "No cases";
  if (stats.draft > 0) return `${stats.draft} draft cases remaining`;
  return `Curation complete: ${stats.approved} approved / ${stats.rejected} rejected`;
}

function completionHint(stats) {
  if (stats.draft > 0) return "Approve or reject every case before starting collection.";
  if (stats.approved === 0) return "Rejected cases do not block completion, but collection needs at least one approved case.";
  return "Rejected cases will be skipped. Approved cases will enter manual collection.";
}

function metric(label, value) {
  return `
    <div class="metric">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
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

function option(value, label, selectedValue) {
  return `<option value="${escapeHtml(value)}" ${value === selectedValue ? "selected" : ""}>${escapeHtml(label)}</option>`;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
