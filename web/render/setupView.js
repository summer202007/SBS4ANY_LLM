const sample = {
  challengerName: "小红书点点",
  challengerAdvantageDetail: "例如：小红书原生内容、生活方式判断、本地探店语境",
  baselineAccessNotes: "i.e. 默认网页版豆包；手动粘贴最终回答、可见引用和可见过程。",
  challengerAccessNotes: "i.e. 手机 App 使用默认推荐/对话入口；手动粘贴最终回答、可见引用和可见过程。",
  taskLabel: "i.e. 餐厅推荐",
  scenario: "i.e. 评估点点面向小红书主流用户做餐厅推荐时，是否整体胜出豆包。",
  audience: "i.e. 18-35 岁，一二线城市，中高知识和收入，小红书主流用户",
  winningCriteria: "i.e. 更懂用户场景和生活方式偏好，能在预算、位置、氛围、忌口、排队和不确定性之间做清楚取舍。",
  capabilities: "i.e. 约会/朋友聚餐/团队聚餐/长辈同行/本地化发现/预算约束/忌口约束",
  risks: "i.e. 实时营业、排队、价格、人均、是否有位、来源可靠性、过度确定地编造信息",
  nativePolicy: "i.e. 如果答案体现小红书原生内容优势且提升决策质量，奖励 task fit；但未核验的实时/来源确定性仍要惩罚。",
  supplemental: "例如：先不评价对话体验，优先评价任务结果、意图理解、证据可靠性和风险处理。",
};

const evidenceOptions = [
  ["L0", "L0 - Final output only"],
  ["L1", "L1 - Visible process / transcript"],
  ["L2", "L2 - Sources / tool calls / execution traces"],
  ["L3", "L3 - Full replayable trace"],
];

const challengerAdvantageOptions = [
  ["native_content", "Native content/source advantage", "Eval generator may create cases probing whether native content improves task value."],
  ["audience_fit", "Target-audience fit", "Eval generator may include audience/taste/workflow fit in outcome-quality cases."],
  ["local_context", "Local/domain context", "Eval generator may add domain-specific or local-context probes."],
  ["workflow_integration", "Workflow/product integration", "Eval generator may add cases that test whether product context changes task success."],
];

const generatorFocusOptions = [
  ["no_product_experience", "Do not score conversation experience", "Generator disables productExperience as a scored dimension unless later re-enabled."],
  ["include_multi_turn", "Include multi-turn cases", "Generator includes scripted multi-turn tasks and turn scripts."],
  ["include_boundary_risk", "Include risk/boundary cases", "Generator includes pushback, uncertainty, and unsupported-claim probes."],
  ["stress_evidence", "Stress evidence and recency", "Generator adds cases that test source, freshness, and verification behavior."],
  ["include_regression", "Include regression-like cases", "Generator adds generic-list or known-failure probes for future iteration."],
];

export function renderArenaSetupForm(root, handlers = {}) {
  root.innerHTML = `
    <div class="modal-heading">
      <div>
        <p class="eyebrow">New Evaluation</p>
        <h3>Create Arena</h3>
      </div>
      <button id="closeArenaSetup" class="icon-button" type="button">x</button>
    </div>
    <p class="muted">Choose the challenger, baseline ceiling, and task space. The evaluation task starts after this arena is confirmed.</p>
    <form id="arenaSetupForm" class="setup-form setup-form-modal">
      ${arenaSetupSections()}
      <section class="setup-actions">
        <button class="secondary-button" id="cancelArenaSetup" type="button">Cancel</button>
        <button class="primary-button" type="submit">Create Evaluation Task</button>
      </section>
    </form>
  `;

  root.querySelector("#closeArenaSetup")?.addEventListener("click", () => handlers.onCancel?.());
  root.querySelector("#cancelArenaSetup")?.addEventListener("click", () => handlers.onCancel?.());
  attachArenaSetupHandlers(root, handlers);
}

function arenaSetupSections() {
  return `
    <section class="section-band">
      <h3>Required</h3>
      <p class="muted">These fields define the arena and the minimum viable input for eval-set generation.</p>
      <div class="two-column">
        ${selectField("Product type", "productType", [["chatbot", "Chatbot"]], "chatbot", "required")}
        ${textField("Challenger name", "challengerName", `i.e. ${sample.challengerName}`, "required")}
        ${selectField("Baseline app", "baselineName", [["Doubao", "豆包"]], "Doubao", "required")}
        ${selectField(
          "Baseline surface",
          "baselineSurface",
          [
            ["web_chat", "Web chat"],
            ["mobile_app", "Mobile app"],
            ["desktop_app", "Desktop app"],
            ["api", "API"],
            ["other", "Other"],
          ],
          "web_chat",
          "required",
        )}
        ${selectField(
          "Challenger surface",
          "challengerSurface",
          [
            ["mobile_app", "Mobile app"],
            ["web_chat", "Web chat"],
            ["desktop_app", "Desktop app"],
            ["api", "API"],
            ["other", "Other"],
          ],
          "mobile_app",
          "required",
        )}
        ${selectField(
          "Local Codex model",
          "localCodexModel",
          [
            ["gpt-5.5", "gpt-5.5 (default)"],
            ["gpt-5.4", "gpt-5.4 (fallback when 5.5 is busy)"],
          ],
          "gpt-5.5",
          "required",
        )}
      </div>
      <p class="field-hint">This setting is used for local package generation, simulator suggestions, capture-template setup, and grader/report jobs for this task.</p>
      ${textField("Task space", "taskLabel", sample.taskLabel, "required")}
      ${textareaField("Concrete scenario", "scenario", sample.scenario, "required")}
      ${textareaField("Target audience", "audience", sample.audience, "required")}
      <div class="derived-field">
        <span>Auto-generated decision question</span>
        <strong id="decisionQuestionPreview">${escapeHtml(buildDecisionQuestion("Challenger", "Doubao", "该任务空间"))}</strong>
      </div>
    </section>

    <section class="section-band">
      <h3>Recommended</h3>
      <p class="muted">These fields strongly improve coverage planning and case quality.</p>
      ${textareaField("What counts as winning", "winningCriteria", sample.winningCriteria, "recommended")}
      ${textareaField("Must-cover capabilities", "capabilities", sample.capabilities, "recommended")}
      ${textareaField("Risk areas", "risks", sample.risks, "recommended")}
      ${textareaField("Native-context / audience-fit policy", "nativePolicy", sample.nativePolicy, "recommended")}
      <label class="checkbox-field">
        <input id="evaluateConversationExperience" name="evaluateConversationExperience" type="checkbox" />
        <span>Also evaluate conversation experience / persona feel</span>
      </label>
    </section>

    <section class="section-band">
      <h3>Optional</h3>
      <p class="muted">These fields are not scoring dimensions by themselves. They become harness instructions, eval-generator hints, or report caveats.</p>
      <div class="subsection-box">
        <h4>Baseline access</h4>
        <p class="field-hint">Used by the collection workflow/harness, and passed to the local eval generator as evidence assumptions for fair case design and report caveats.</p>
        ${textField("Baseline chat URL", "baselineChatUrl", "i.e. https://www.doubao.com/chat/", "optional")}
        ${selectField("Baseline evidence available", "baselineEvidenceAvailability", evidenceOptions, "L0", "optional")}
        <p class="field-hint">The local model will use this to decide what evidence-dependent cases are fair and what report caveats are needed.</p>
        ${textareaField("Baseline access / evidence notes", "baselineAccessNotes", sample.baselineAccessNotes, "optional")}
      </div>
      <div class="subsection-box">
        <h4>Challenger access</h4>
        <p class="field-hint">Used by the collection workflow/harness, and passed to the local eval generator as evidence assumptions for fair case design and report caveats.</p>
        ${textField("Challenger URL / entry", "challengerChatUrl", "i.e. 小红书 App 点点入口、Web chat URL、或 API endpoint", "optional")}
        ${selectField("Challenger evidence available", "challengerEvidenceAvailability", evidenceOptions, "L0", "optional")}
        <p class="field-hint">The local model will use this to decide what evidence-dependent cases are fair and what report caveats are needed.</p>
        ${textareaField("Challenger access / evidence notes", "challengerAccessNotes", sample.challengerAccessNotes, "optional")}
      </div>
      <div class="subsection-box">
        <h4>Eval generator hints</h4>
        <p class="field-hint">Used by the eval-set generator to decide coverage, source-advantage probes, confirmation backlog, and report caveats. It does not automatically become a scoring rule unless reflected in the generated rubric.</p>
        ${checkboxGroup("Expected challenger advantage", "challengerAdvantageSignals", challengerAdvantageOptions)}
        ${textareaField("Advantage details", "challengerAdvantageDetail", sample.challengerAdvantageDetail, "optional")}
        ${checkboxGroup("Generator focus", "generatorFocus", generatorFocusOptions)}
        ${textareaField("Supplemental generation notes", "supplemental", `i.e. ${sample.supplemental.replace(/^例如：/, "")}`, "optional")}
      </div>
    </section>
  `;
}

function attachArenaSetupHandlers(root, handlers) {
  attachClearOnFocus(root);
  root.querySelector("#arenaSetupForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    handlers.onCreateTask?.(readSetupForm(root));
  });
  ["challengerName", "baselineName", "taskLabel"].forEach((name) => {
    root.querySelector(`[name="${name}"]`)?.addEventListener("input", () => updateDecisionPreview(root));
    root.querySelector(`[name="${name}"]`)?.addEventListener("change", () => updateDecisionPreview(root));
  });
}

function readSetupForm(root) {
  const value = (name) => {
    const field = root.querySelector(`[name="${name}"]`);
    if (!field) return "";
    return field.value?.trim() || "";
  };
  const checkedLabels = (name) =>
    [...root.querySelectorAll(`[name="${name}"]:checked`)].map((field) => field.dataset.label || field.value);
  const challengerName = value("challengerName") || "Challenger";
  const baselineName = value("baselineName") || "Doubao";
  const taskLabel = value("taskLabel");
  const challengerAdvantage = compactLines([
    ...checkedLabels("challengerAdvantageSignals"),
    value("challengerAdvantageDetail"),
  ]).join("\n");
  const supplementalNotes = compactLines([
    ...checkedLabels("generatorFocus").map((item) => `Generator focus: ${item}`),
    value("supplemental"),
  ]).join("\n");
  return {
    title: `${taskLabel || "任务空间"}：${challengerName} vs ${baselineName}`,
    arena: {
      productType: value("productType") || "chatbot",
      localCodexModel: value("localCodexModel") || "gpt-5.5",
      baseline: {
        name: baselineName,
        surface: value("baselineSurface") || "web_chat",
        chatUrl: value("baselineChatUrl"),
        accessNotes: value("baselineAccessNotes"),
        evidenceAvailability: value("baselineEvidenceAvailability") || "L0",
      },
      challenger: {
        name: challengerName,
        surface: value("challengerSurface") || "mobile_app",
        chatUrl: value("challengerChatUrl"),
        accessNotes: value("challengerAccessNotes"),
        evidenceAvailability: value("challengerEvidenceAvailability") || "L0",
        expectedAdvantage: challengerAdvantage,
      },
    },
    taskSpace: {
      label: taskLabel,
      concreteScenario: value("scenario"),
      targetAudience: value("audience"),
      decisionQuestion: buildDecisionQuestion(challengerName, baselineName, taskLabel),
      winningCriteria: value("winningCriteria"),
      mustCoverCapabilities: value("capabilities"),
      riskAreas: value("risks"),
      nativeContextPolicy: value("nativePolicy"),
      supplementalNotes,
      evaluateConversationExperience: root.querySelector("#evaluateConversationExperience")?.checked || false,
    },
  };
}

function updateDecisionPreview(root) {
  const value = (name) => {
    const field = root.querySelector(`[name="${name}"]`);
    if (!field) return "";
    return field.value?.trim() || "";
  };
  const preview = root.querySelector("#decisionQuestionPreview");
  if (!preview) return;
  preview.textContent = buildDecisionQuestion(
    value("challengerName") || "Challenger",
    value("baselineName") || "Doubao",
    value("taskLabel") || "该任务空间",
  );
}

function buildDecisionQuestion(challengerName, baselineName, taskLabel) {
  return `${challengerName || "Challenger"} 在「${taskLabel || "该任务空间"}」任务空间里，是否整体胜出 ${baselineName || "Doubao"}？`;
}

function textField(label, name, value, level) {
  const required = level === "required";
  return `
    <label class="edit-field">
      <span>${escapeHtml(label)} ${badge(level)}</span>
      <input name="${escapeHtml(name)}" placeholder="${escapeHtml(value)}" ${required ? "required" : ""} data-example="${escapeHtml(value)}" />
    </label>
  `;
}

function textareaField(label, name, value, level) {
  const required = level === "required";
  return `
    <label class="edit-field">
      <span>${escapeHtml(label)} ${badge(level)}</span>
      <textarea name="${escapeHtml(name)}" placeholder="${escapeHtml(value)}" ${required ? "required" : ""} data-example="${escapeHtml(value)}"></textarea>
    </label>
  `;
}

function selectField(label, name, options, selected, level = "required") {
  return `
    <label class="edit-field">
      <span>${escapeHtml(label)} ${badge(level)}</span>
      <select name="${escapeHtml(name)}">
        ${options.map(([value, text]) => `<option value="${escapeHtml(value)}" ${value === selected ? "selected" : ""}>${escapeHtml(text)}</option>`).join("")}
      </select>
    </label>
  `;
}

function checkboxGroup(label, name, options) {
  return `
    <fieldset class="choice-group">
      <legend>${escapeHtml(label)} <em class="optional-badge">Optional</em></legend>
      ${options
        .map(
          ([value, text, use]) => `
            <label class="choice-option">
              <input type="checkbox" name="${escapeHtml(name)}" value="${escapeHtml(value)}" data-label="${escapeHtml(text)}" />
              <span>
                <strong>${escapeHtml(text)}</strong>
                <small>${escapeHtml(use)}</small>
              </span>
            </label>
          `,
        )
        .join("")}
    </fieldset>
  `;
}

function badge(level) {
  if (level === "required") return `<em class="required-badge">Required</em>`;
  if (level === "recommended") return `<em class="recommended-badge">Recommended</em>`;
  return `<em class="optional-badge">Optional</em>`;
}

function attachClearOnFocus(root) {
  root.querySelectorAll("[data-example]").forEach((field) => {
    field.addEventListener("focus", () => {
      field.dataset.savedPlaceholder = field.placeholder;
      field.placeholder = "";
    });
    field.addEventListener("blur", () => {
      if (!field.value.trim()) field.placeholder = field.dataset.savedPlaceholder || field.dataset.example || "";
    });
  });
}

function compactLines(values) {
  return values.map((item) => String(item || "").trim()).filter(Boolean);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
