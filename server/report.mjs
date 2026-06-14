export function buildReportMarkdown(state) {
  const runtimePackage = state.package;
  if (!runtimePackage) return "# SBS Report\n\nNo runtime eval package loaded.\n";

  const arena = runtimePackage.arenaEvalSpec || {};
  const coverage = runtimePackage.evalSetCoveragePlan || {};
  const validation = state.validation || {};
  const curation = state.curation || {};
  const caseStatuses = curation.caseStatuses || {};
  const cases = runtimePackage.evalCases || [];
  const approved = cases.filter((evalCase) => caseStatuses[evalCase.caseId]?.status === "approved");

  return [
    `# SBS Evaluation Report`,
    ``,
    `## Arena`,
    ``,
    `- Decision question: ${arena.decisionQuestion || "Not specified"}`,
    `- Task space: ${arena.taskSpace || "Not specified"}`,
    `- Baseline: ${arena.baseline?.name || "Not specified"}`,
    `- Challenger: ${arena.challenger?.name || "Not specified"}`,
    ``,
    `## Validation`,
    ``,
    `- Status: ${validation.ok ? "passed" : "not passed"}`,
    `- Schema errors: ${(validation.schemaErrors || []).length}`,
    `- Consistency errors: ${(validation.consistencyErrors || []).length}`,
    `- Warnings: ${(validation.warnings || []).length}`,
    ``,
    `## Coverage`,
    ``,
    `- Case target: ${coverage.caseCountTarget || cases.length}`,
    `- Scored dimensions: ${(coverage.scoredDimensions || []).join(", ") || "Not specified"}`,
    `- Disabled dimensions: ${(coverage.disabledDimensions || []).join(", ") || "None"}`,
    ``,
    `## Curation`,
    ``,
    `- Total cases: ${cases.length}`,
    `- Approved cases: ${approved.length}`,
    `- Draft/rejected cases: ${cases.length - approved.length}`,
    ``,
    `## Grader`,
    ``,
    `Automatic grading is intentionally deferred. Use this report as the audit shell for manual SBS review.`,
    ``,
  ].join("\n");
}
