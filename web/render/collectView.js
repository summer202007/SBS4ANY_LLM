export function renderCollectView(root, packageState, handlers = {}) {
  const runtimePackage = packageState?.package;
  const curation = packageState?.curation;
  const run = packageState?.run;
  if (!runtimePackage || !curation) {
    root.innerHTML = `
      <section class="empty-state">
        <h2>No approved eval package</h2>
        <p>Load and curate an eval package before collection.</p>
      </section>
    `;
    return;
  }

  const approvedCases = (runtimePackage.evalCases || [])
    .filter((evalCase) => curation.caseStatuses?.[evalCase.caseId]?.status === "approved")
    .map((evalCase) => mergeEditedCase(evalCase, curation.caseStatuses?.[evalCase.caseId]));

  if (!approvedCases.length) {
    root.innerHTML = `
      <section class="empty-state">
        <h2>No approved cases</h2>
        <p>Approve at least one case before starting collection.</p>
      </section>
    `;
    return;
  }

  const selectedCaseId = handlers.selectedCaseId || approvedCases[0]?.caseId;
  const selectedCase = approvedCases.find((item) => item.caseId === selectedCaseId) || approvedCases[0];
  const turnScript = (runtimePackage.turnScripts || []).find((script) => script.caseId === selectedCase.caseId);
  const caseRun = ensureDisplayCaseRun(run?.caseRuns?.[selectedCase.caseId], selectedCase, turnScript);
  const stats = summarizeRun(approvedCases, run?.caseRuns || {});
  const selectedIndex = approvedCases.findIndex((item) => item.caseId === selectedCase.caseId);
  const collectUi = {
    challengerCaptureSetup: handlers.challengerCaptureSetup || {},
    adapters: handlers.adapters || packageState?.adapters || {},
    activeTask: packageState?.activeTask || null,
  };

  root.innerHTML = `
    <section class="view-heading">
      <div>
        <p class="eyebrow">Checkpoint 3</p>
        <h2>Manual Collection</h2>
      </div>
      <div class="metric-row compact-metrics">
        ${metric("Approved", String(approvedCases.length))}
        ${metric("Completed", String(stats.completed))}
        ${metric("In Progress", String(stats.inProgress))}
        ${metric("Not Started", String(stats.notStarted))}
      </div>
    </section>

    <section class="collect-workbench">
      <div class="case-list-panel">
        <div class="case-table" role="list">
          ${approvedCases.map((evalCase) => collectCaseRow(evalCase, run?.caseRuns?.[evalCase.caseId], evalCase.caseId === selectedCase.caseId)).join("")}
        </div>
      </div>
      <div class="collect-detail-panel">
        ${collectionProgressPanel(stats, approvedCases.length, Math.max(0, selectedIndex) + 1, selectedCase, caseRun)}
        ${turnScript ? multiTurnDetail(selectedCase, turnScript, caseRun, run?.captureSession, collectUi) : singleTurnDetail(selectedCase, caseRun, run?.captureSession, collectUi)}
      </div>
    </section>
  `;

  root.querySelectorAll("[data-collect-case-id]").forEach((button) => {
    button.addEventListener("click", () => handlers.onSelectCase?.(button.dataset.collectCaseId));
  });
  root.querySelectorAll("[data-copy-turn-message]").forEach((button) => {
    button.addEventListener("click", async () => {
      const value = button.closest(".turn-editor")?.querySelector("[data-turn-user-message]")?.value || "";
      await navigator.clipboard?.writeText(value);
      showToast(root, "User message copied.");
      flashButton(button);
    });
  });
  root.querySelectorAll("[data-caveat-type]").forEach((select) => {
    select.addEventListener("change", () => updateSideCaveatVisibility(select.closest(".side-output")));
    updateSideCaveatVisibility(select.closest(".side-output"));
  });
  root.querySelectorAll("[data-capture-doubao]").forEach((button) => {
    button.addEventListener("click", () => {
      flashButton(button);
      handlers.onCaptureDoubao?.({
        caseId: button.dataset.caseId,
        turnIndex: Number(button.dataset.turnIndex || 1),
      });
    });
  });
  root.querySelectorAll("[data-capture-challenger]").forEach((button) => {
    button.addEventListener("click", () => {
      flashButton(button);
      const isSetup = button.dataset.firstTimeCalibration === "true";
      const targetUrl = button.dataset.targetUrl || button.closest(".assisted-capture")?.querySelector("[data-challenger-capture-url]")?.value || "";
      if (isSetup && !isValidHttpUrl(targetUrl)) {
        showToast(root, "Paste a valid challenger chat URL before starting setup.", "bad");
        button.closest(".assisted-capture")?.querySelector("[data-challenger-capture-url]")?.focus?.();
        return;
      }
      button.disabled = true;
      button.textContent = isSetup ? "Setting up... 30-90s" : "Capturing... 5-15s";
      handlers.onCaptureChallenger?.({
        caseId: button.dataset.caseId,
        turnIndex: Number(button.dataset.turnIndex || 1),
        firstTimeCalibration: isSetup,
        targetUrl,
      });
    });
  });
  root.querySelectorAll("[data-open-challenger-capture]").forEach((button) => {
    button.addEventListener("click", () => {
      flashButton(button);
      handlers.onOpenChallengerCapture?.({
        caseId: button.dataset.caseId,
        turnIndex: Number(button.dataset.turnIndex || 1),
      });
    });
  });
  root.querySelectorAll("[data-challenger-capture-url]").forEach((input) => {
    const update = () => {
      handlers.onChallengerCaptureUrlChange?.({
        caseId: input.dataset.caseId,
        turnIndex: Number(input.dataset.turnIndex || 1),
        url: input.value,
      });
    };
    input.addEventListener("input", () => {
      const captureCard = input.closest(".assisted-capture");
      const setupButton = captureCard?.querySelector("[data-capture-challenger][data-first-time-calibration='true']");
      if (setupButton) {
        setupButton.disabled = !isValidHttpUrl(input.value);
        setupButton.dataset.targetUrl = input.value;
      }
    });
    input.addEventListener("change", update);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        input.blur();
        update();
      }
    });
  });
  root.querySelectorAll("[data-local-model-reply]").forEach((button) => {
    button.addEventListener("click", () => {
      const turnIndex = Number(button.dataset.turnIndex || 1);
      const validation = validatePreviousTurnForSimulator(root, turnIndex);
      if (!validation.ok) {
        showToast(root, validation.message, "bad");
        validation.element?.scrollIntoView({ block: "center", behavior: "smooth" });
        validation.element?.focus?.();
        return;
      }
      flashButton(button);
      button.textContent = "Generating...";
      button.disabled = true;
      const payload = readCaseRun(root, selectedCase, caseRun, false);
      payload.status = "in_progress";
      handlers.onLocalModelReply?.({
        caseId: selectedCase.caseId,
        turnIndex,
        draftRun: payload,
      });
    });
  });
  root.querySelector("[data-accept-capture]")?.addEventListener("click", (event) => {
    flashButton(event.currentTarget);
    handlers.onAcceptCapture?.({ sessionId: event.currentTarget.dataset.sessionId });
  });
  root.querySelector("[data-discard-capture]")?.addEventListener("click", (event) => {
    flashButton(event.currentTarget);
    handlers.onDiscardCapture?.({ sessionId: event.currentTarget.dataset.sessionId });
  });
  root.querySelector("#saveCaseRun")?.addEventListener("click", () => {
    flashButton(root.querySelector("#saveCaseRun"));
    handlers.onSaveCaseRun?.(readCaseRun(root, selectedCase, caseRun, false));
  });
  root.querySelector("#completeCaseRun")?.addEventListener("click", () => {
    const payload = readCaseRun(root, selectedCase, caseRun, true);
    const validation = validateCaseRunForm(root);
    if (!validation.ok) {
      showToast(root, validation.message, "bad");
      validation.element?.scrollIntoView({ block: "center", behavior: "smooth" });
      validation.element?.focus?.();
      return;
    }
    flashButton(root.querySelector("#completeCaseRun"));
    handlers.onSaveCaseRun?.({ ...payload, autoAdvance: true });
  });
  root.querySelector("#addTurn")?.addEventListener("click", () => {
    flashButton(root.querySelector("#addTurn"));
    const payload = readCaseRun(root, selectedCase, caseRun, false);
    const nextTurnIndex = payload.turns.length + 1;
    const seed = getNextTurnSeed(turnScript, nextTurnIndex);
    payload.turns.push(
      createBlankTurn(
        nextTurnIndex,
        seed.userMessage,
        seed.messageSource,
        seed.newlyExposedFacts,
      ),
    );
    payload.status = "in_progress";
    handlers.onSaveCaseRun?.(payload);
  });
  root.querySelectorAll("[data-delete-turn]").forEach((button) => {
    button.addEventListener("click", () => {
      flashButton(button);
      const payload = readCaseRun(root, selectedCase, caseRun, false);
      const turnIndex = Number(button.dataset.deleteTurn);
      payload.turns = payload.turns
        .filter((turn) => turn.turnIndex !== turnIndex)
        .map((turn, index) => ({ ...turn, turnIndex: index + 1 }));
      payload.status = "in_progress";
      handlers.onSaveCaseRun?.(payload);
    });
  });
}

function collectionProgressPanel(stats, totalCases, currentNumber, evalCase, caseRun) {
  const completed = Number(stats.completed || 0);
  const percent = totalCases ? Math.round((completed / totalCases) * 100) : 0;
  const turnCount = caseRun?.turns?.length || 1;
  return `
    <section class="collection-progress-panel">
      <div class="split-heading">
        <div>
          <p class="eyebrow">Collection Progress</p>
          <h3>Case ${currentNumber} of ${totalCases} · ${escapeHtml(evalCase.caseId)}</h3>
          <p class="muted">${escapeHtml(evalCase.caseType || "")} / ${escapeHtml(evalCase.capabilityCluster || "uncategorized")} · ${turnCount} turn${turnCount === 1 ? "" : "s"}</p>
        </div>
        <span class="status-pill status-${escapeHtml(caseRun.status || "not_started")}">${escapeHtml(caseRun.status || "not_started")}</span>
      </div>
      <div class="progress-bar" aria-label="Collection progress">
        <span style="width: ${percent}%"></span>
      </div>
      <div class="collection-progress-meta">
        <span>${completed}/${totalCases} completed</span>
        <span>${stats.notStarted} not started</span>
      </div>
    </section>
  `;
}

function getNextTurnSeed(turnScript, nextTurnIndex) {
  const planned = (turnScript?.turns || []).find((turn) => turn.turnIndex === nextTurnIndex);
  const firstTurnMessage = (turnScript?.turns || []).find((turn) => turn.turnIndex === 1)?.modelFacingUserMessage || "";
  if (!planned) {
    return { userMessage: "", messageSource: "manual", newlyExposedFacts: [] };
  }
  const plannedMessage = planned.modelFacingUserMessage || "";
  return {
    userMessage: nextTurnIndex > 1 && plannedMessage === firstTurnMessage ? "" : plannedMessage,
    messageSource: plannedMessage ? "script_default" : "manual",
    newlyExposedFacts: planned.exposureDelta?.newlyExposedFacts || [],
  };
}

function singleTurnDetail(evalCase, caseRun, captureSession, collectUi) {
  return `
    <article class="collection-detail">
      <div class="case-detail-heading">
        <div>
          <p class="eyebrow">single_turn collection</p>
          <h3>${escapeHtml(evalCase.caseId)}</h3>
        </div>
        <span class="status-pill status-${escapeHtml(caseRun.status)}">${escapeHtml(caseRun.status)}</span>
      </div>
      ${caseSummary(evalCase)}
      ${turnEditor(caseRun.turns[0], 0, false, null, captureSession, evalCase.caseId, collectUi)}
      ${collectionFooter(caseRun, false)}
    </article>
  `;
}

function multiTurnDetail(evalCase, turnScript, caseRun, captureSession, collectUi) {
  return `
    <article class="collection-detail">
      <div class="case-detail-heading">
        <div>
          <p class="eyebrow">shared multi-turn collection</p>
          <h3>${escapeHtml(evalCase.caseId)}</h3>
        </div>
        <span class="status-pill status-${escapeHtml(caseRun.status)}">${escapeHtml(caseRun.status)}</span>
      </div>
      ${caseSummary(evalCase)}
      <section class="turn-script-summary">
        <h4>Execution</h4>
        <div class="summary-grid">
          ${field("Strategy", "shared_user_turns")}
          ${field("Planned Max Turns", String(turnScript.maxTurns || caseRun.plannedMaxTurns))}
          ${field("Actual Turns", String(caseRun.turns.length))}
          ${field("Runtime", "manual guided; local model button reserved")}
        </div>
        <p class="fairness-note">Both products receive the same user message each turn. Fill both outputs, then decide whether the next shared user turn still feels fair.</p>
      </section>
      ${caseRun.turns.map((turn, index) => turnEditor(turn, index, true, turnScript.turns?.[index], captureSession, evalCase.caseId, collectUi)).join("")}
      <div class="button-row">
        <button id="addTurn" class="secondary-button" type="button">Add Turn</button>
      </div>
      ${collectionFooter(caseRun, true)}
    </article>
  `;
}

function caseSummary(evalCase) {
  return `
    <section class="section-inline">
      <div class="summary-grid">
        ${field("Capability", evalCase.capabilityCluster)}
        ${field("Risk", evalCase.riskLevel)}
        ${field("Difficulty", evalCase.difficulty)}
        ${field("Collection", evalCase.collectionMode)}
      </div>
    </section>
  `;
}

function turnEditor(turn, index, isMultiTurn, scriptTurn, captureSession, caseId, collectUi = {}) {
  const progress = isMultiTurn ? `Turn ${turn.turnIndex}${scriptTurn ? ` / ${escapeHtml(scriptTurn.progressLabel || "")}` : ""}` : "Prompt";
  const newlyExposedFacts = turn.newlyExposedFacts || [];
  const allowedExposureCount = scriptTurn?.exposureDelta?.allowedNewFactsToExpose?.length || 0;
  return `
    <section class="turn-editor" data-turn-index="${turn.turnIndex}" data-simulator-should-stop="${turn.simulatorShouldStop ? "true" : "false"}">
      <div class="turn-heading">
        <h4>${progress}</h4>
        <div class="turn-actions">
          <span class="status-pill status-draft">${escapeHtml(turn.messageSource || "manual")}</span>
          ${isMultiTurn && index > 0 ? `<button data-delete-turn="${turn.turnIndex}" class="danger-button compact-button" type="button">Delete Turn</button>` : ""}
        </div>
      </div>
      ${scriptTurn ? scriptGuidance(scriptTurn) : ""}
      ${turn.simulatorShouldStop ? simulatorStopBlock(turn) : ""}
      <div class="prompt-panel">
        <div class="prompt-panel-head">
          <div>
            <span>Shared user message ${requiredBadge()}</span>
            <small>Both products receive this same message.</small>
          </div>
          <button data-copy-turn-message class="secondary-button copy-button" type="button">Copy User Message</button>
        </div>
        <textarea data-turn-user-message>${escapeHtml(turn.userMessage || "")}</textarea>
      </div>
      <div class="button-row input-adjacent-actions">
        ${
          isMultiTurn && index > 0
            ? `<span class="tooltip-wrap"><button data-local-model-reply data-turn-index="${escapeHtml(turn.turnIndex)}" class="secondary-button copy-button" type="button">Local Model Reply</button><span class="help-icon" tabindex="0" aria-label="Local model reply requirement">?</span><span class="tooltip">Requires local Codex and the SBS chatbot-runtime-user-simulator skill. It suggests the next shared user message after both previous replies are collected.</span></span>`
            : ""
        }
      </div>
      ${supportedCaptureWebsites(collectUi.adapters)}
      ${turn.simulatorEvaluatorNote ? simulatorNoteBlock(turn) : ""}
      <div class="sbs-input-grid">
        ${sideFields("baseline", "Doubao / Baseline", turn, { captureSession, caseId, turnIndex: turn.turnIndex })}
        ${sideFields("challenger", "Challenger", turn, {
          captureSession,
          caseId,
          turnIndex: turn.turnIndex,
          adapters: collectUi.adapters,
          challengerCaptureSetup: collectUi.challengerCaptureSetup,
          activeTask: collectUi.activeTask,
        })}
      </div>
      <details class="advanced-exposure">
        <summary>Advanced: model-visible facts for grader eligibility</summary>
        <div class="exposure-summary">
          <span class="status-pill status-draft">${newlyExposedFacts.length} newly exposed</span>
          <span class="status-pill status-draft">${allowedExposureCount} allowed by script</span>
          <span class="status-pill status-draft">${scriptTurn ? "script-derived" : "manual"}</span>
        </div>
        <p class="muted">These facts define what both tested products have actually seen by this turn. Graders should only hard-score requirements after they are exposed here, reasonably inferable, or general safety norms.</p>
        <label class="edit-field">
          <span>Newly exposed facts ${optionalBadge()}</span>
          <textarea data-newly-exposed-facts>${escapeHtml((turn.newlyExposedFacts || []).join("\n"))}</textarea>
        </label>
        ${scriptTurn?.exposureDelta ? listBlock("Allowed New Facts To Expose", scriptTurn.exposureDelta.allowedNewFactsToExpose) : ""}
      </details>
    </section>
  `;
}

function supportedCaptureWebsites(adapters = {}) {
  const readyAdapters = (Array.isArray(adapters.items) ? adapters.items : [])
    .filter((adapter) => adapter.status === "ready" && (adapter.urlPatterns || []).length)
    .sort((a, b) => String(a.providerName || a.providerId).localeCompare(String(b.providerName || b.providerId)));
  if (!readyAdapters.length) return "";
  return `
    <div class="supported-capture-sites">
      <span>Auto-capture ready</span>
      <div>
        ${readyAdapters.map(captureSiteChip).join("")}
      </div>
    </div>
  `;
}

function captureSiteChip(adapter) {
  const sides = Array.isArray(adapter.sideSupport) && adapter.sideSupport.length
    ? adapter.sideSupport.join("/")
    : "any side";
  const patterns = (adapter.urlPatterns || []).join(", ");
  const source = adapter.templateSource || "local";
  return `
    <span class="capture-site-chip" title="${escapeHtml(`${adapter.providerName || adapter.providerId}: ${patterns}`)}">
      <strong>${escapeHtml(adapter.providerName || adapter.providerId || "Website")}</strong>
      <small>${escapeHtml(patterns)} · ${escapeHtml(sides)} · ${escapeHtml(source)}</small>
    </span>
  `;
}

function simulatorNoteBlock(turn) {
  return `
    <div class="simulator-note">
      <strong>Local model note</strong>
      <p>${escapeHtml(turn.simulatorEvaluatorNote)}</p>
      ${turn.branchRuleId ? `<small>Branch: ${escapeHtml(turn.branchRuleId)}</small>` : ""}
      ${turn.simulatorSelectedAction ? `<small>Action: ${escapeHtml(turn.simulatorSelectedAction)}</small>` : ""}
    </div>
  `;
}

function simulatorStopBlock(turn) {
  return `
    <div class="simulator-stop-note">
      <strong>Local model suggests ending this case</strong>
      <p>${escapeHtml(turn.simulatorStopReason || turn.simulatorEvaluatorNote || "The prior responses appear sufficient for this case.")}</p>
      <small>You can mark the case complete now, or ignore this suggestion and add another turn.</small>
    </div>
  `;
}

function scriptGuidance(scriptTurn) {
  return `
    <details class="script-guidance">
      <summary>Turn script guidance</summary>
      ${scriptTurn.exposureDelta ? listBlock("Allowed New Facts", scriptTurn.exposureDelta.allowedNewFactsToExpose) : ""}
      ${listBlock("Allowed Adaptive Moves", scriptTurn.allowedAdaptiveMoves)}
      ${branchRulesBlock(scriptTurn.branchRules)}
    </details>
  `;
}

function branchRulesBlock(branchRules = []) {
  if (!branchRules.length) return "";
  return `
    <div class="list-block">
      <h4>Branch Rules</h4>
      <ul>
        ${branchRules.map((rule) => `<li><strong>${escapeHtml(rule.branchRuleId)}</strong>: ${escapeHtml(rule.modelFacingReply || rule.action || "")}</li>`).join("")}
      </ul>
    </div>
  `;
}

function sideFields(prefix, title, turn, options = {}) {
  const caveatType = turn[`${prefix}CaveatType`] || "none";
  const captureSession = options.captureSession;
  const captureMatches =
    captureSession?.side === prefix &&
    captureSession?.caseId === options.caseId &&
    Number(captureSession?.turnIndex) === Number(options.turnIndex);
  const displayTurn = captureMatches ? mergeCaptureIntoDisplayedTurn(turn, captureSession?.pendingCapture, prefix) : turn;
  return `
    <div class="side-output" data-side-prefix="${escapeHtml(prefix)}">
      <div class="side-heading">
        <h4>${escapeHtml(title)}</h4>
        ${prefix === "baseline" ? `<span class="status-pill status-draft">Doubao semi-auto</span>` : ""}
      </div>
      ${prefix === "baseline" ? assistedDoubaoCapture(options, captureMatches ? captureSession : null) : ""}
      ${prefix === "challenger" ? assistedChallengerCapture(options, captureMatches ? captureSession : null) : ""}
      <label class="edit-field">
        <span>Collection caveat ${requiredBadge()}</span>
        <select data-field="${prefix}CaveatType" data-caveat-type>
          ${caveatOptions().map(([value, label]) => option(value, label, caveatType)).join("")}
        </select>
        <small class="field-hint">Use a caveat when this side cannot provide a normal answer. If caveated, only the caveat reason is required.</small>
      </label>
      <label class="edit-field caveat-reason">
        <span>Caveat reason ${conditionalBadge("required if caveated")}</span>
        <textarea data-field="${prefix}Caveat">${escapeHtml(displayTurn[`${prefix}Caveat`] || "")}</textarea>
      </label>
      <div class="normal-collection-fields">
      <label class="edit-field">
        <span>Final output / response ${requiredBadge()}</span>
        <textarea data-field="${prefix}Output">${escapeHtml(displayTurn[`${prefix}Output`] || "")}</textarea>
      </label>
      <label class="edit-field">
        <span>Evidence level ${requiredBadge()}</span>
        <select data-field="${prefix}EvidenceLevel">
          ${["L0", "L1", "L2", "L3"].map((level) => option(level, evidenceLabel(level), displayTurn[`${prefix}EvidenceLevel`] || "L0")).join("")}
        </select>
      </label>
      ${optionalEvidenceFields(prefix, displayTurn)}
      </div>
    </div>
  `;
}

function optionalEvidenceFields(prefix, turn) {
  const values = [
    turn[`${prefix}VisibleProcessNotes`],
    turn[`${prefix}IntentExpansionNotes`],
    turn[`${prefix}FollowupSuggestionNotes`],
    turn[`${prefix}SourceNotes`],
    turn[`${prefix}ToolcallNotes`],
  ];
  const hasEvidence = values.some((value) => String(value || "").trim());
  return `
    <details class="optional-evidence-fields">
      <summary>Evidence details ${hasEvidence ? `<span class="status-pill status-completed">captured</span>` : `<span class="status-pill status-draft">optional</span>`}</summary>
      ${textareaField(prefix, "Visible process notes", "VisibleProcessNotes", turn, true)}
      ${textareaField(prefix, "Intent / query expansion notes", "IntentExpansionNotes", turn, true)}
      ${textareaField(prefix, "Follow-up suggestion notes", "FollowupSuggestionNotes", turn, true)}
      ${textareaField(prefix, "Source / citation notes", "SourceNotes", turn, true)}
      ${textareaField(prefix, "Toolcall / execution notes", "ToolcallNotes", turn, true)}
    </details>
  `;
}

function mergeCaptureIntoDisplayedTurn(turn, capture, prefix = "baseline") {
  if (!capture) return turn;
  return {
    ...turn,
    [`${prefix}FollowupSuggestionNotes`]:
      turn[`${prefix}FollowupSuggestionNotes`] || formatCaptureFollowupSuggestionNotes(capture.followupSuggestions),
  };
}

function formatCaptureFollowupSuggestionNotes(suggestions = []) {
  const items = Array.isArray(suggestions) ? suggestions.map((item) => String(item).trim()).filter(Boolean) : [];
  if (!items.length) return "";
  return `Follow-up suggestions captured from product UI:\n${items.map((item) => `- ${item}`).join("\n")}`;
}

function assistedDoubaoCapture({ caseId, turnIndex }, captureSession) {
  return `
    <section class="assisted-capture">
      <div>
        <strong>Assisted Doubao capture</strong>
        <small>Open the Doubao answer in Chrome, click the Doubao tab so Chrome is the foreground app, then capture visible artifacts. First time: in Chrome menu bar, enable Display/View &gt; Developer &gt; Allow JavaScript from Apple Events. Human still sends the prompt.</small>
      </div>
      <div class="button-row compact-actions">
        <button data-capture-doubao data-case-id="${escapeHtml(caseId)}" data-turn-index="${escapeHtml(turnIndex)}" class="secondary-button compact-button" type="button">Capture Current Chrome Tab</button>
      </div>
      ${captureSession ? captureSessionPanel(captureSession) : ""}
    </section>
  `;
}

function assistedChallengerCapture({ caseId, turnIndex }, captureSession) {
  const setupState = arguments[0]?.challengerCaptureSetup || {};
  const adapters = arguments[0]?.adapters || {};
  const activeTask = arguments[0]?.activeTask || {};
  const taskTemplate = activeTask?.arena?.challenger?.captureTemplate || null;
  const setupKey = captureSetupKey(caseId, turnIndex);
  const setup = setupState[setupKey] || {};
  const url = setup.url || "";
  const opened = Boolean(setup.open);
  const matchedTemplate = findAdapterTemplateForUrl(adapters, url);
  const hasCurrentResult = Boolean(captureSession?.pendingCapture);
  const isActiveCapture = captureSession?.status === "active";
  const acceptedTemplate = captureSession?.status === "accepted" && Boolean(captureSession?.pendingCapture?.adapterBuilderOutput);
  const acceptedReady = acceptedTemplate && captureSession?.pendingCapture?.adapterInfo?.status === "ready";
  const boundTemplate = taskTemplate?.providerId && taskTemplate.status === "ready" ? taskTemplate : null;
  const boundTargetUrl = boundTemplate?.lastVerifiedUrl || activeTask?.arena?.challenger?.chatUrl || url || "";

  if (boundTemplate && !hasCurrentResult && !isActiveCapture) {
    return `
      <section class="assisted-capture experimental-capture template-bound-capture">
        <div>
          <strong>Challenger website capture</strong>
          <small>Using ${escapeHtml(boundTemplate.providerName || boundTemplate.providerId)} for this evaluation task. Open the current case answer in Chrome, keep that tab active, then capture visible artifacts.</small>
        </div>
        <div class="button-row compact-actions">
          <button data-capture-challenger data-target-url="${escapeHtml(boundTargetUrl)}" data-case-id="${escapeHtml(caseId)}" data-turn-index="${escapeHtml(turnIndex)}" class="secondary-button compact-button" type="button">Capture Current Chrome Tab</button>
        </div>
      </section>
    `;
  }

  if (boundTemplate && isActiveCapture) {
    return `
      <section class="assisted-capture experimental-capture template-bound-capture">
        <div>
          <strong>Challenger website capture</strong>
          <small>Using ${escapeHtml(boundTemplate.providerName || boundTemplate.providerId)} for this evaluation task.</small>
        </div>
        <div class="button-row compact-actions">
          <button data-capture-challenger data-target-url="${escapeHtml(boundTargetUrl)}" data-case-id="${escapeHtml(caseId)}" data-turn-index="${escapeHtml(turnIndex)}" class="secondary-button compact-button" type="button" disabled>Capturing... 5-15s</button>
        </div>
        ${activeCapturePanel(captureSession)}
      </section>
    `;
  }

  if (boundTemplate && hasCurrentResult) {
    return `
      <section class="assisted-capture experimental-capture template-bound-capture">
        <div>
          <strong>Challenger website capture</strong>
          <small>Using ${escapeHtml(boundTemplate.providerName || boundTemplate.providerId)} for this evaluation task.</small>
        </div>
        ${captureSessionPanel(captureSession)}
      </section>
    `;
  }

  if (!opened && !hasCurrentResult && !acceptedReady) {
    return `
      <section class="assisted-capture experimental-capture minimal-capture-entry">
        <div class="button-row compact-actions">
          <button data-open-challenger-capture data-case-id="${escapeHtml(caseId)}" data-turn-index="${escapeHtml(turnIndex)}" class="secondary-button compact-button" type="button">Try Automated Capture</button>
        </div>
      </section>
    `;
  }

  return `
    <section class="assisted-capture experimental-capture">
      <label class="edit-field compact-url-field">
        <span>Challenger chat URL ${optionalBadge()}</span>
        <input data-challenger-capture-url data-case-id="${escapeHtml(caseId)}" data-turn-index="${escapeHtml(turnIndex)}" value="${escapeHtml(url)}" placeholder="i.e. https://dots.ai/chat/..." />
        <small class="field-hint">${matchedTemplate ? `Supported website: ${escapeHtml(matchedTemplate.providerName || matchedTemplate.providerId)}` : url ? "No saved template found for this URL yet. You can try building one from the current Chrome page." : "Paste the challenger chat URL to check whether a capture template already exists."}</small>
      </label>
      ${
        matchedTemplate || acceptedReady
          ? `<div class="button-row compact-actions">
              <button data-capture-challenger data-case-id="${escapeHtml(caseId)}" data-turn-index="${escapeHtml(turnIndex)}" class="secondary-button compact-button" type="button" ${isActiveCapture ? "disabled" : ""}>${isActiveCapture ? "Capturing... 5-15s" : "Capture Current Chrome Tab"}</button>
            </div>`
          : ""
      }
      ${
        !matchedTemplate && !acceptedReady && !hasCurrentResult
          ? `<div class="capture-setup-note">
              <strong>No capture template yet</strong>
              <small>Open Chrome to the exact challenger answer page for this case. The page should already contain the first user prompt and the model answer. SBS will ask local Codex to inspect the page snapshot and draft a reusable capture template. This usually takes 30-90 seconds and may fail.</small>
            </div>
            <div class="button-row compact-actions">
              <button data-capture-challenger data-first-time-calibration="true" data-target-url="${escapeHtml(url)}" data-case-id="${escapeHtml(caseId)}" data-turn-index="${escapeHtml(turnIndex)}" class="secondary-button compact-button" type="button" ${isValidHttpUrl(url) && !isActiveCapture ? "" : "disabled"}>${isActiveCapture ? "Setting up... 30-90s" : "Start Template Setup"}</button>
            </div>`
          : ""
      }
      ${isActiveCapture ? activeCapturePanel(captureSession) : ""}
      ${captureSession && !acceptedTemplate && !isActiveCapture ? captureSessionPanel(captureSession) : ""}
    </section>
  `;
}

function activeCapturePanel(session) {
  return `
    <div class="capture-panel">
      <strong>${session?.provider === "website_adapter" ? "Setting up website capture" : "Capturing current page"}</strong>
      <p>SBS is reading the current Chrome page and preparing captured fields. Keep Chrome on the target answer page.</p>
    </div>
  `;
}

function captureSetupKey(caseId, turnIndex) {
  return `${caseId}::${turnIndex}`;
}

function findAdapterTemplateForUrl(adapters = {}, url = "") {
  const value = String(url || "").trim();
  if (!value) return null;
  const host = normalizeHostPattern(value);
  if (!host) return null;
  const items = Array.isArray(adapters.items) ? adapters.items : [];
  return items.find((item) => {
    if (item.status !== "ready") return false;
    if (Array.isArray(item.sideSupport) && !item.sideSupport.includes("challenger")) return false;
    const patterns = Array.isArray(item.urlPatterns) ? item.urlPatterns : [];
    return patterns.some((pattern) => {
      const patternHost = normalizeHostPattern(pattern);
      return patternHost && (host === patternHost || host.endsWith(`.${patternHost}`));
    });
  }) || null;
}

function isValidHttpUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeHostPattern(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    return new URL(raw).hostname.toLowerCase().replace(/^www\./, "").replace(/^\*\./, "");
  } catch {
    return raw
      .replace(/^https?:\/\//i, "")
      .split(/[/?#]/)[0]
      .toLowerCase()
      .replace(/^www\./, "")
      .replace(/^\*\./, "");
  }
}

function captureSessionPanel(session) {
  if (session.status === "failed") {
    return `
      <div class="capture-panel capture-failed">
        <strong>Capture failed</strong>
        <p>${escapeHtml(session.lastError || "Unknown capture error.")}</p>
        <small>You can retry after opening the correct page, or paste the model output manually below.</small>
      </div>
    `;
  }
  if (!session.pendingCapture) {
    return `<div class="capture-panel"><small>Capture status: ${escapeHtml(session.status || "active")}</small></div>`;
  }
  const capture = session.pendingCapture;
  const accepted = session.status === "accepted";
  const templateOnly = Boolean(capture.adapterBuilderOutput) && !String(capture.finalAnswer || "").trim();
  const blockedCapture = capture.adapterInfo?.status === "blocked" || (capture.qaResult?.ok === false && capture.qaResult?.adapterReadiness === "blocked");
  return `
    <div class="capture-panel">
      <div class="capture-panel-heading">
        <strong>${accepted ? "Accepted capture" : "Pending capture preview"}</strong>
        <span class="status-pill ${accepted ? "status-completed" : "status-in_progress"}">${escapeHtml(capture.evidenceLevel || "L1")}</span>
      </div>
      ${capture.adapterInfo ? adapterInfoBlock(capture.adapterInfo, capture.qaResult) : ""}
      <div class="summary-grid capture-summary">
        ${field("URL", capture.url)}
        ${field("Intent Expansion Queries", (capture.intentExpansionQueries || capture.expandedSearchQueries || []).join(" / ") || "Not found")}
        ${field("References", String((capture.referenceMaterials || []).length))}
        ${field("Follow-up Suggestions", String((capture.followupSuggestions || []).length))}
      </div>
      ${capture.captureNotes?.length ? listBlock("Capture Notes", capture.captureNotes) : ""}
      ${capture.qaResult ? qaResultBlock(capture.qaResult) : ""}
      <div class="capture-readable-preview">
        <h5>${templateOnly ? "Template setup preview" : "Final answer preview"}</h5>
        <pre class="capture-pre">${escapeHtml(templateOnly ? formatTemplateSetupPreview(capture) : capture.finalAnswer || "No final answer extracted.")}</pre>
      </div>
      <details class="capture-raw-details">
        <summary>References / suggestions / raw checks</summary>
        ${readonlyCaptureTextarea("Intent / query expansion text", formatLines(capture.intentExpansionQueries || capture.expandedSearchQueries))}
        ${readonlyCaptureTextarea("Follow-up suggestion text", formatLines(capture.followupSuggestions))}
        ${readonlyCaptureTextarea("Citation / reference text", formatReferenceText(capture.referenceMaterials))}
        ${listBlock("Intent Expansion Queries", capture.intentExpansionQueries || capture.expandedSearchQueries)}
        ${referenceBlock(capture.referenceMaterials)}
        ${listBlock("Risk Notices", capture.riskNotices)}
        ${listBlock("Follow-up Suggestions", capture.followupSuggestions)}
      </details>
      ${
        accepted && !blockedCapture
          ? `<p class="field-hint">${templateOnly ? "This capture template has been approved. You can now use Capture Current Chrome Tab for this website." : `This capture has been written into the ${escapeHtml(session.side === "challenger" ? "Challenger" : "Doubao")} fields below. You can still edit those fields manually.`}</p>`
          : blockedCapture
            ? `<div class="button-row compact-actions">
                <button data-discard-capture data-session-id="${escapeHtml(session.sessionId)}" class="secondary-button compact-button" type="button">Discard Blocked Capture</button>
              </div>`
          : `<div class="button-row compact-actions">
              <button data-accept-capture data-session-id="${escapeHtml(session.sessionId)}" class="primary-button compact-button" type="button">${templateOnly ? "Approve Template" : `Accept Into ${escapeHtml(session.side === "challenger" ? "Challenger" : "Doubao")} Fields`}</button>
              <button data-discard-capture data-session-id="${escapeHtml(session.sessionId)}" class="secondary-button compact-button" type="button">Discard</button>
            </div>`
      }
    </div>
  `;
}

function formatTemplateSetupPreview(capture) {
  const output = capture.adapterBuilderOutput || {};
  return [
    `Provider: ${output.providerName || capture.adapterInfo?.providerName || capture.provider || "Unknown"}`,
    `Status: ${output.status || capture.adapterInfo?.status || "unknown"}`,
    `URL patterns: ${(output.urlPatterns || capture.adapterInfo?.urlPatterns || []).join(", ") || "Not provided"}`,
    "",
    "Known limitations:",
    ...((output.knownLimitations || capture.captureNotes || []).map((item) => `- ${item}`)),
    "",
    "Manual fallback:",
    ...((output.manualFallbackInstructions || []).map((item) => `- ${item}`)),
  ].join("\n");
}

function adapterInfoBlock(adapterInfo, qaResult) {
  const status = adapterInfo.status || qaResult?.adapterReadiness || "partial";
  return `
    <div class="adapter-info">
      <div>
        <strong>${escapeHtml(adapterInfo.providerName || adapterInfo.providerId || "Website adapter")}</strong>
        <small>${escapeHtml(adapterInfo.templateSource || "local")} template · ${adapterInfo.doNotPersist ? "test run, not saved" : "first capture needs human review"}</small>
      </div>
      <span class="status-pill status-${escapeHtml(status === "ready" ? "completed" : status === "blocked" ? "rejected" : "in_progress")}">${escapeHtml(status)}</span>
    </div>
  `;
}

function qaResultBlock(qaResult) {
  const issues = Array.isArray(qaResult.blockingIssues) ? qaResult.blockingIssues : [];
  const warnings = Array.isArray(qaResult.warnings) ? qaResult.warnings : [];
  return `
    <details class="qa-result" ${issues.length ? "open" : ""}>
      <summary>Adapter QA ${qaResult.ok ? "passed" : "needs review"}</summary>
      <div class="summary-grid capture-summary">
        ${field("Readiness", qaResult.adapterReadiness || (qaResult.ok ? "ready" : "blocked"))}
        ${field("Blocking Issues", String(issues.length))}
      </div>
      ${issues.length ? listBlock("Blocking Issues", issues.map((issue) => `${issue.field}: ${issue.message}`)) : ""}
      ${warnings.length ? listBlock("Warnings", warnings) : ""}
    </details>
  `;
}

function readonlyCaptureTextarea(label, value) {
  return `
    <label class="edit-field capture-text-field">
      <span>${escapeHtml(label)}</span>
      <textarea readonly>${escapeHtml(value || "Not found")}</textarea>
    </label>
  `;
}

function formatLines(values = []) {
  return (Array.isArray(values) ? values : [])
    .filter(Boolean)
    .map((item) => `- ${item}`)
    .join("\n");
}

function formatReferenceText(values = []) {
  return (Array.isArray(values) ? values : [])
    .filter(Boolean)
    .map((item) => {
      const rank = item.rank ? `${item.rank}. ` : "- ";
      const href = item.href ? `\n   ${item.href}` : "";
      const type = item.type ? `[${item.type}] ` : "";
      return `${rank}${type}${item.title || item.href || ""}${href}`;
    })
    .join("\n");
}

function referenceBlock(values = []) {
  const refs = Array.isArray(values) ? values : [];
  if (!refs.length) return listBlock("Reference Materials", []);
  return `
    <div class="list-block">
      <h4>Reference Materials</h4>
      <ul>
        ${refs.map((item) => `<li>${escapeHtml(item.rank ? `${item.rank}. ` : "")}${item.type ? `<small>${escapeHtml(item.type)}</small> ` : ""}${escapeHtml(item.title || item.href || "")}${item.href ? ` <small>${escapeHtml(item.href)}</small>` : ""}</li>`).join("")}
      </ul>
    </div>
  `;
}

function textareaField(prefix, label, suffix, turn, optional = false) {
  const key = `${prefix}${suffix}`;
  return `
    <label class="edit-field">
      <span>${escapeHtml(label)} ${optional ? optionalBadge() : requiredBadge()}</span>
      <textarea data-field="${escapeHtml(key)}">${escapeHtml(turn[key] || "")}</textarea>
    </label>
  `;
}

function collectionFooter(caseRun, isMultiTurn) {
  return `
    <section class="curation-actions">
      <label class="edit-field">
        <span>Stop reason ${optionalBadge()}</span>
        <input id="stopReason" value="${escapeHtml(caseRun.stopReason || "")}" />
      </label>
      <label class="edit-field">
        <span>Collection notes ${optionalBadge()}</span>
        <textarea id="collectionNotes">${escapeHtml(caseRun.collectionNotes || "")}</textarea>
      </label>
      <div class="button-row">
        <button id="saveCaseRun" class="secondary-button" type="button">Save ${isMultiTurn ? "Transcript" : "Outputs"}</button>
        <button id="completeCaseRun" class="primary-button" type="button">Mark Complete</button>
      </div>
    </section>
  `;
}

function readCaseRun(root, evalCase, caseRun, complete) {
  const turns = [...root.querySelectorAll(".turn-editor")].map((section, index) => {
    const current = caseRun.turns[index] || createBlankTurn(index + 1);
    const getField = (field) => section.querySelector(`[data-field="${field}"]`)?.value || "";
    return {
      ...current,
      turnIndex: Number(section.dataset.turnIndex || index + 1),
      userMessage: section.querySelector("[data-turn-user-message]")?.value || "",
      messageSource: current.messageSource || "manual",
      baselineOutput: getField("baselineOutput"),
      challengerOutput: getField("challengerOutput"),
      baselineCaveatType: getField("baselineCaveatType") || "none",
      challengerCaveatType: getField("challengerCaveatType") || "none",
      baselineEvidenceLevel: getField("baselineEvidenceLevel") || "L0",
      challengerEvidenceLevel: getField("challengerEvidenceLevel") || "L0",
      baselineIntentExpansionNotes: getField("baselineIntentExpansionNotes"),
      challengerIntentExpansionNotes: getField("challengerIntentExpansionNotes"),
      baselineFollowupSuggestionNotes: getField("baselineFollowupSuggestionNotes"),
      challengerFollowupSuggestionNotes: getField("challengerFollowupSuggestionNotes"),
      baselineVisibleProcessNotes: getField("baselineVisibleProcessNotes"),
      challengerVisibleProcessNotes: getField("challengerVisibleProcessNotes"),
      baselineSourceNotes: getField("baselineSourceNotes"),
      challengerSourceNotes: getField("challengerSourceNotes"),
      baselineToolcallNotes: getField("baselineToolcallNotes"),
      challengerToolcallNotes: getField("challengerToolcallNotes"),
      baselineCaveat: getField("baselineCaveat"),
      challengerCaveat: getField("challengerCaveat"),
      branchRuleId: current.branchRuleId || "",
      simulatorArtifactId: current.simulatorArtifactId || "",
      simulatorEvaluatorNote: current.simulatorEvaluatorNote || "",
      simulatorTrajectoryNotes: current.simulatorTrajectoryNotes || "",
      simulatorSelectedAction: current.simulatorSelectedAction || "",
      simulatorShouldStop: Boolean(current.simulatorShouldStop),
      simulatorStopReason: current.simulatorStopReason || "",
      newlyExposedFacts: splitLines(section.querySelector("[data-newly-exposed-facts]")?.value || ""),
    };
  });
  return {
    caseId: evalCase.caseId,
    status: complete ? "completed" : "in_progress",
    executionStrategy: caseRun.executionStrategy,
    plannedMaxTurns: caseRun.plannedMaxTurns,
    turns,
    stopReason: root.querySelector("#stopReason")?.value || "",
    collectionNotes: root.querySelector("#collectionNotes")?.value || "",
  };
}

function collectCaseRow(evalCase, caseRun = {}, selected) {
  const status = caseRun.status || "not_started";
  return `
    <button class="case-row ${selected ? "selected" : ""}" data-collect-case-id="${escapeHtml(evalCase.caseId)}" type="button">
      <span>
        <strong>${escapeHtml(evalCase.caseId)}</strong>
        <small>${escapeHtml(evalCase.caseType)} / ${escapeHtml(evalCase.capabilityCluster || "uncategorized")}</small>
      </span>
      <span class="status-pill status-${escapeHtml(status)}">${escapeHtml(status)}</span>
    </button>
  `;
}

function ensureDisplayCaseRun(caseRun, evalCase, turnScript) {
  const firstMessage = turnScript?.turns?.[0]?.modelFacingUserMessage || evalCase.modelFacingPrompt || evalCase.initialPrompt || "";
  if (caseRun) {
    return hydrateCaseRunMessages(caseRun, evalCase, turnScript, firstMessage);
  }
  return {
    caseId: evalCase.caseId,
    status: "not_started",
    executionStrategy: turnScript ? "shared_user_turns" : "single_turn",
    collectionMode: evalCase.collectionMode,
    plannedMaxTurns: turnScript?.maxTurns || 1,
    turns: [createBlankTurn(1, firstMessage, turnScript ? "script_default" : "model_facing_prompt")],
    stopReason: "",
    collectionNotes: "",
  };
}

function hydrateCaseRunMessages(caseRun, evalCase, turnScript, firstMessage) {
  const turns = (caseRun.turns || []).map((turn, index) => {
    const turnIndex = Number(turn.turnIndex || index + 1);
    const seed = turnIndex === 1
      ? {
          userMessage: firstMessage,
          messageSource: turnScript ? "script_default" : "model_facing_prompt",
          newlyExposedFacts: turnScript
            ? turnScript.turns?.[0]?.exposureDelta?.newlyExposedFacts || []
            : evalCase.exposureContract?.modelVisibleFactsAtStart || [],
        }
      : getNextTurnSeed(turnScript, turnIndex);
    return {
      ...turn,
      userMessage: turn.userMessage || seed.userMessage || "",
      messageSource: turn.messageSource || seed.messageSource || "manual",
      newlyExposedFacts: (turn.newlyExposedFacts || []).length
        ? turn.newlyExposedFacts
        : seed.newlyExposedFacts || [],
    };
  });
  if (!turns.length) {
    turns.push(createBlankTurn(1, firstMessage, turnScript ? "script_default" : "model_facing_prompt"));
  }
  return { ...caseRun, turns };
}

function createBlankTurn(turnIndex, userMessage = "", messageSource = "manual", newlyExposedFacts = []) {
  return {
    turnIndex,
    userMessage,
    messageSource,
    baselineOutput: "",
    challengerOutput: "",
    baselineCaveatType: "none",
    challengerCaveatType: "none",
    baselineEvidenceLevel: "L0",
    challengerEvidenceLevel: "L0",
    baselineIntentExpansionNotes: "",
    challengerIntentExpansionNotes: "",
    baselineFollowupSuggestionNotes: "",
    challengerFollowupSuggestionNotes: "",
    baselineVisibleProcessNotes: "",
    challengerVisibleProcessNotes: "",
    baselineSourceNotes: "",
    challengerSourceNotes: "",
    baselineToolcallNotes: "",
    challengerToolcallNotes: "",
    baselineCaveat: "",
    challengerCaveat: "",
    branchRuleId: "",
    simulatorArtifactId: "",
    simulatorEvaluatorNote: "",
    simulatorTrajectoryNotes: "",
    simulatorSelectedAction: "",
    simulatorShouldStop: false,
    simulatorStopReason: "",
    newlyExposedFacts,
  };
}

function validateCaseRunForm(root) {
  clearValidationErrors(root);
  for (const turn of root.querySelectorAll(".turn-editor")) {
    if (turn.dataset.simulatorShouldStop === "true") continue;
    const userMessage = turn.querySelector("[data-turn-user-message]");
    if (!userMessage?.value.trim()) {
      return failField(userMessage, "Shared user message is required.");
    }
    for (const side of turn.querySelectorAll(".side-output")) {
      const prefix = side.dataset.sidePrefix;
      const caveatType = side.querySelector(`[data-field="${prefix}CaveatType"]`);
      const caveatReason = side.querySelector(`[data-field="${prefix}Caveat"]`);
      const output = side.querySelector(`[data-field="${prefix}Output"]`);
      if (caveatType?.value && caveatType.value !== "none") {
        if (!caveatReason?.value.trim()) {
          return failField(caveatReason, "Caveat reason is required when this side is caveated.");
        }
      } else if (!output?.value.trim()) {
        return failField(output, "Final output is required unless this side has a collection caveat.");
      }
    }
  }
  return { ok: true };
}

function validatePreviousTurnForSimulator(root, currentTurnIndex) {
  if (currentTurnIndex <= 1) {
    return { ok: false, message: "Local Model Reply is only available for turn 2+." };
  }
  const previousTurn = root.querySelector(`.turn-editor[data-turn-index="${currentTurnIndex - 1}"]`);
  if (!previousTurn) {
    return { ok: false, message: `Turn ${currentTurnIndex - 1} is missing.` };
  }
  for (const side of previousTurn.querySelectorAll(".side-output")) {
    const prefix = side.dataset.sidePrefix;
    const label = prefix === "baseline" ? "Doubao / Baseline" : "Challenger";
    const caveatType = side.querySelector(`[data-field="${prefix}CaveatType"]`);
    const caveatReason = side.querySelector(`[data-field="${prefix}Caveat"]`);
    const output = side.querySelector(`[data-field="${prefix}Output"]`);
    if (caveatType?.value && caveatType.value !== "none") {
      if (!caveatReason?.value.trim()) {
        return failField(caveatReason, `${label} caveat reason is required before Local Model Reply.`);
      }
    } else if (!output?.value.trim()) {
      return failField(output, `${label} previous response is required before Local Model Reply.`);
    }
  }
  return { ok: true };
}

function failField(element, message) {
  element?.classList.add("field-invalid");
  const error = document.createElement("div");
  error.className = "field-error";
  error.textContent = message;
  element?.insertAdjacentElement("afterend", error);
  return { ok: false, element, message };
}

function clearValidationErrors(root) {
  root.querySelectorAll(".field-invalid").forEach((element) => element.classList.remove("field-invalid"));
  root.querySelectorAll(".field-error").forEach((element) => element.remove());
}

function updateSideCaveatVisibility(side) {
  if (!side) return;
  const prefix = side.dataset.sidePrefix;
  const caveatType = side.querySelector(`[data-field="${prefix}CaveatType"]`)?.value || "none";
  side.classList.toggle("has-caveat", caveatType !== "none");
}

function showToast(root, message, tone = "neutral") {
  let toast = root.querySelector(".toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    root.appendChild(toast);
  }
  toast.textContent = message;
  toast.dataset.tone = tone;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 1800);
}

function flashButton(button) {
  button?.classList.add("button-busy");
  setTimeout(() => button?.classList.remove("button-busy"), 240);
}

function caveatOptions() {
  return [
    ["none", "No caveat"],
    ["refused", "Model refused"],
    ["no_output", "No usable output"],
    ["truncated", "Output truncated"],
    ["access_issue", "Access/login issue"],
    ["other", "Other caveat"],
  ];
}

function summarizeRun(cases, caseRuns) {
  return cases.reduce(
    (acc, evalCase) => {
      const status = caseRuns[evalCase.caseId]?.status || "not_started";
      if (status === "completed") acc.completed += 1;
      else if (status === "in_progress") acc.inProgress += 1;
      else acc.notStarted += 1;
      return acc;
    },
    { completed: 0, inProgress: 0, notStarted: 0 },
  );
}

function mergeEditedCase(evalCase, status = {}) {
  return { ...evalCase, ...(status?.editedCase || {}) };
}

function evidenceLabel(level) {
  return {
    L0: "L0 Final output only",
    L1: "L1 Visible process / transcript",
    L2: "L2 Sources / tool calls / execution traces",
    L3: "L3 Full replayable trace",
  }[level] || level;
}

function requiredBadge() {
  return `<b class="field-badge required-badge">required</b>`;
}

function optionalBadge() {
  return `<b class="field-badge optional-badge">optional</b>`;
}

function conditionalBadge(label) {
  return `<b class="field-badge conditional-badge">${escapeHtml(label)}</b>`;
}

function metric(label, value) {
  return `<div class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function field(label, value) {
  return `<div class="field"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || "Not specified")}</strong></div>`;
}

function listBlock(title, values = []) {
  const items = Array.isArray(values) ? values.filter(Boolean) : [];
  return `
    <div class="list-block">
      <h4>${escapeHtml(title)}</h4>
      ${items.length ? `<ul>${items.map((item) => `<li>${escapeHtml(String(item))}</li>`).join("")}</ul>` : `<p class="muted">None</p>`}
    </div>
  `;
}

function option(value, label, selectedValue) {
  return `<option value="${escapeHtml(value)}" ${value === selectedValue ? "selected" : ""}>${escapeHtml(label)}</option>`;
}

function splitLines(value) {
  return value.split("\n").map((item) => item.trim()).filter(Boolean);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
