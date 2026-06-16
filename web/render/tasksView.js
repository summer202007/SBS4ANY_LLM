export function renderTasksView(root, packageState, handlers = {}) {
  const tasks = packageState?.tasks?.items || [];
  const activeTaskId = packageState?.activeTask?.taskId;
  const activeRun = packageState?.run;
  const activePackage = packageState?.package;
  const featuredTask = selectFeaturedTask(tasks, activeTaskId);
  const featuredIsActive = featuredTask?.taskId === activeTaskId;
  const featuredRun = featuredIsActive ? activeRun : null;
  const featuredPackage = featuredIsActive ? activePackage : null;
  const featuredReport = featuredIsActive ? handlers.graderBundle?.gradingReport : null;

  root.innerHTML = `
    <section class="view-heading">
      <div>
        <p class="eyebrow">SBS Decision Workbench</p>
        <h2>Does this AI product deserve the task space?</h2>
      </div>
      <button id="newEvaluationTask" class="primary-button" type="button">New Evaluation</button>
    </section>

    ${renderDecisionHero()}
    ${renderFeaturedDemo(featuredTask, {
      active: featuredIsActive,
      run: featuredRun,
      runtimePackage: featuredPackage,
      report: featuredReport,
    })}
    ${renderCapabilityLayer()}

    <section class="section-band">
      <div class="section-heading-row">
        <div>
          <p class="eyebrow">Advanced Workbench</p>
          <h3>Evaluation Tasks</h3>
        </div>
        <span class="soft-pill">package · cases · collect · review · report</span>
      </div>
      <p class="muted">Use the full workflow when you want to generate a new package, inspect cases, continue collection, or audit the report pipeline.</p>
      ${
        tasks.length
          ? `<div class="task-list task-dashboard">${tasks.map((task) =>
            taskCard(task, {
              active: task.taskId === activeTaskId,
              activeRun,
              activePackage,
            }),
          ).join("")}</div>`
          : `<div class="empty-inline"><strong>No evaluation task yet.</strong><p>Create one to choose challenger, baseline, and task space.</p></div>`
      }
    </section>

    <dialog id="newEvaluationDialog" class="modal setup-modal">
      <div id="arenaSetupMount"></div>
    </dialog>
  `;

  root.querySelectorAll("#newEvaluationTask, #newEvaluationTaskFromDemo").forEach((button) => button.addEventListener("click", () => {
    handlers.onNewTask?.({
      dialog: root.querySelector("#newEvaluationDialog"),
      mount: root.querySelector("#arenaSetupMount"),
    });
  }));
  root.querySelectorAll("[data-select-task]").forEach((button) => {
    button.addEventListener("click", () => handlers.onSelectTask?.(button.dataset.selectTask));
  });
  root.querySelectorAll("[data-open-task]").forEach((button) => {
    button.addEventListener("click", () => handlers.onOpenTask?.(button.dataset.openTask));
  });
  root.querySelectorAll("[data-open-report]").forEach((button) => {
    button.addEventListener("click", () => handlers.onOpenReport?.(button.dataset.openReport));
  });
  root.querySelectorAll("[data-delete-task]").forEach((button) => {
    button.addEventListener("click", () => handlers.onDeleteTask?.(button.dataset.deleteTask));
  });
}

function renderDecisionHero() {
  return `
    <section class="demo-hero">
      <div class="demo-hero-copy">
        <p class="eyebrow">Philosophy</p>
        <h3>Evaluate the challenger against the strongest baseline in one concrete task space.</h3>
        <p>
          SBS 4 Any Agent turns a PM question into a runnable eval: define the task space, generate discriminative cases,
          collect both products side by side, then produce a decision-grade report against the SOTA baseline.
        </p>
      </div>
      <div class="demo-hero-panel" aria-label="Guided run summary">
        ${demoStat("1", "Task space")}
        ${demoStat("15", "Eval cases")}
        ${demoStat("SBS", "Judgment")}
        ${demoStat("PDF", "Report")}
      </div>
    </section>
  `;
}

function renderFeaturedDemo(task, context = {}) {
  const hasTask = Boolean(task?.taskId);
  const showcaseSummary = task?.showcaseSummary || null;
  const report = context.report;
  const arena = task?.arena || {};
  const taskSpace = task?.taskSpace || {};
  const runStats = summarizeRun(context.run, context.runtimePackage);
  const caseCount = task?.packageSummary?.caseCount || context.runtimePackage?.evalCases?.length || 15;
  const collected = runStats
    ? `${runStats.completed}/${runStats.total}`
    : showcaseSummary?.collected
      ? `${showcaseSummary.collected.completed}/${showcaseSummary.collected.total}`
      : hasTask
        ? task?.status === "setup"
          ? "Not started"
          : "Sample ready"
        : "13/15 sample";
  const baseline = arena.baseline?.name || task?.packageSummary?.baselineName || "Doubao";
  const challenger = arena.challenger?.name || task?.packageSummary?.challengerName || (hasTask ? "Challenger" : "小红书点点");
  const title = task?.title || "Guided demo: 求职面试经验 · 小红书点点 vs Doubao";
  const verdict = report?.executiveVerdict?.verdict || showcaseSummary?.verdict || taskVerdictFallback(task);
  const reason =
    report?.executiveVerdict?.oneSentenceReason ||
    showcaseSummary?.headline ||
    report?.executiveVerdict?.summary ||
    (hasTask
      ? "Open a completed task to see eval-set coverage, collected evidence, SBS verdict, and downloadable report in one path."
      : "Preview: Doubao is stronger on structured interview preparation and capability decomposition; 小红书点点 has useful emotional support and safety pockets but lacks stable task-space advantage.");
  const taskId = task?.taskId || "";

  return `
    <section class="featured-demo-card">
      <div class="featured-demo-header">
        <div>
          <p class="eyebrow">Featured Demo</p>
          <h3>${escapeHtml(title)}</h3>
        </div>
        <span class="status-pill status-${escapeHtml(task?.status || "demo")}">${escapeHtml(task?.status || "demo")}</span>
      </div>
      <div class="featured-demo-grid">
        <div class="demo-verdict">
          <span>Decision</span>
          <strong>${escapeHtml(verdict)}</strong>
          <p>${escapeHtml(reason)}</p>
        </div>
        <div class="guided-flow" aria-label="Guided run flow">
          ${flowStep("Task Space", taskSpace.label || "求职面试经验", "Define a concrete arena")}
          ${flowStep("Eval Set", `${caseCount} cases`, "Generated by local Codex skill")}
          ${flowStep("Collection", collected, "Manual or browser-assisted capture")}
          ${flowStep("Report", report || showcaseSummary?.reportReady || !hasTask ? "Ready" : "Pending", "SBS verdict + PDF")}
        </div>
      </div>
      <div class="summary-grid demo-context-grid">
        ${field("Decision Question", taskSpace.decisionQuestion || `${challenger} 在该任务空间里是否整体胜出 ${baseline}？`)}
        ${field("Baseline", baseline)}
        ${field("Challenger", challenger)}
        ${field("Local Codex", arena.localCodexModel || "gpt-5.5")}
      </div>
      <div class="button-row">
        ${
          taskId
            ? `<button class="primary-button" data-open-report="${escapeHtml(taskId)}" type="button">View SBS Verdict</button>
               <button class="secondary-button" data-open-task="${escapeHtml(taskId)}" type="button">Open Workbench</button>`
            : `<button class="primary-button" id="newEvaluationTaskFromDemo" type="button">Create Evaluation</button>`
        }
      </div>
    </section>
  `;
}

function renderCapabilityLayer() {
  return `
    <section class="capability-layer">
      ${capabilityCard(
        "Task-space decision",
        "The product question is not generic model quality. It is whether a challenger beats the ceiling product in a specific task space.",
        ["baseline-anchored", "winner-takes-task-space", "PM decision report"],
      )}
      ${capabilityCard(
        "Local Codex automation",
        "When Codex is available locally, high-cost steps can be delegated: eval-set drafting, user-simulator turns, capture adapter setup, evidence cleaning, and report generation.",
        ["local-first", "human-approved", "no auto-send"],
      )}
      ${capabilityCard(
        "Systematic eval skills",
        "The generator builds coverage plans, case-type mixes, hidden/visible fact contracts, rubrics, and self-critique. The grader cleans noisy evidence, scores case types separately, preserves red lines, and writes a PM-ready report.",
        ["coverage", "exposure contract", "red-line aware"],
      )}
    </section>
  `;
}

function taskCard(task, context = {}) {
  const active = Boolean(context.active);
  const arena = task.arena || {};
  const taskSpace = task.taskSpace || {};
  const summary = task.packageSummary || {};
  const runStats = active ? summarizeRun(context.activeRun, context.activePackage) : null;
  const phase = resolveTaskPhase(task, runStats);
  const nextAction = resolveNextAction(task, runStats);
  const reportReady = active && Boolean(context.activeRun) ? inferReportReady(context.activeRun) : task.status === "reported";
  return `
    <article class="task-card ${active ? "active" : ""}">
      <div class="task-card-main">
        <div>
          <p class="eyebrow">${escapeHtml(phase)}</p>
          <h3>${escapeHtml(task.title || "Untitled evaluation")}</h3>
        </div>
        <span class="status-pill status-${escapeHtml(task.status || "setup")}">${escapeHtml(task.status || "setup")}</span>
      </div>
      <div class="task-progress-strip">
        ${miniMetric("Cases", summary.caseCount ? String(summary.caseCount) : "Not generated")}
        ${miniMetric("Collected", runStats ? `${runStats.completed}/${runStats.total}` : "Open to view")}
        ${miniMetric("Report", reportReady ? "Ready" : task.status === "setup" ? "Not started" : "Pending")}
      </div>
      <div class="summary-grid task-card-grid">
        ${field("Task Space", taskSpace.label || summary.taskSpace)}
        ${field("Baseline", arena.baseline?.name || summary.baselineName)}
        ${field("Challenger", arena.challenger?.name || summary.challengerName)}
        ${field("Local Codex", arena.localCodexModel || "gpt-5.5")}
      </div>
      <p class="muted">${escapeHtml(taskSpace.decisionQuestion || taskSpace.concreteScenario || "No task-space decision question yet.")}</p>
      <div class="button-row">
        <button class="primary-button" data-open-task="${escapeHtml(task.taskId)}" type="button">${escapeHtml(nextAction)}</button>
        ${
          task.showcase?.type === "real_completed_run"
            ? ""
            : `<button class="secondary-button" data-delete-task="${escapeHtml(task.taskId)}" type="button">Delete</button>`
        }
      </div>
    </article>
  `;
}

function selectFeaturedTask(tasks, activeTaskId) {
  if (!tasks.length) return null;
  const showcase = tasks.find((task) => task.showcase?.type === "real_completed_run");
  if (showcase) return showcase;
  const active = tasks.find((task) => task.taskId === activeTaskId && task.status !== "setup");
  if (active) return active;
  return tasks.find((task) => ["report_ready", "reviewed", "collecting"].includes(task.status)) || tasks[0];
}

function summarizeRun(run, runtimePackage) {
  const cases = runtimePackage?.evalCases || [];
  const caseRuns = run?.caseRuns || {};
  if (!cases.length) return null;
  return cases.reduce(
    (acc, evalCase) => {
      const status = caseRuns[evalCase.caseId]?.status || "not_started";
      acc.total += 1;
      if (status === "completed") acc.completed += 1;
      if (status === "in_progress") acc.inProgress += 1;
      return acc;
    },
    { total: 0, completed: 0, inProgress: 0 },
  );
}

function taskVerdictFallback(task) {
  if (!task) return "baseline_wins preview";
  if (task.status === "report_ready" || task.status === "reviewed") return "SBS verdict ready";
  if (task.status === "collecting") return "Evidence collection in progress";
  if (task.packageSummary?.caseCount) return "Eval set ready";
  return "Arena setup ready";
}

function resolveTaskPhase(task, runStats) {
  if (runStats?.completed && runStats.completed < runStats.total) return "collecting";
  if (runStats?.completed === runStats?.total && runStats?.total) return "ready for review";
  if (task.status === "package_loaded") return "package loaded";
  return task.status || "setup";
}

function resolveNextAction(task, runStats) {
  if (task.status === "setup") return "Generate Package";
  if (runStats?.completed && runStats.completed < runStats.total) return "Continue Collecting";
  if (runStats?.completed === runStats?.total && runStats?.total) return "Review Evidence";
  if (task.packageSummary?.caseCount) return "Continue";
  return "Open Task";
}

function inferReportReady(run) {
  return Boolean(run?.report || run?.reportGeneratedAt || run?.graderStatus === "completed");
}

function miniMetric(label, value) {
  return `
    <div class="mini-metric">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value || "None")}</strong>
    </div>
  `;
}

function demoStat(value, label) {
  return `
    <div class="demo-stat">
      <strong>${escapeHtml(value)}</strong>
      <span>${escapeHtml(label)}</span>
    </div>
  `;
}

function flowStep(label, value, note) {
  return `
    <div class="flow-step">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value || "Pending")}</strong>
      <small>${escapeHtml(note)}</small>
    </div>
  `;
}

function capabilityCard(title, body, chips = []) {
  return `
    <article class="capability-card">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(body)}</p>
      <div class="chip-row">
        ${chips.map((chip) => `<span class="soft-pill">${escapeHtml(chip)}</span>`).join("")}
      </div>
    </article>
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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
