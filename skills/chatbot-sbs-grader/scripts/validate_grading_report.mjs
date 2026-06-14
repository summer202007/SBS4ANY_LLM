#!/usr/bin/env node
import fs from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("Usage: validate_grading_report.mjs <grading-report.json>");
  process.exit(1);
}

const report = JSON.parse(fs.readFileSync(file, "utf8"));
const errors = [];
const warnings = [];
const verdicts = new Set(["challenger_wins", "baseline_wins", "meaningful_niche_win", "tie_or_inconclusive", "insufficient_evidence"]);

check(report.artifactType === "GradingReport", "artifactType must be GradingReport");
check(verdicts.has(report.executiveVerdict?.verdict), "executiveVerdict.verdict invalid");
check(report.decisionVerdicts?.taskUtility?.winner, "decisionVerdicts.taskUtility.winner required");
check(report.decisionVerdicts?.taskUtility?.summary, "decisionVerdicts.taskUtility.summary required");
check(report.decisionVerdicts?.releaseSafetyReadiness?.winner, "decisionVerdicts.releaseSafetyReadiness.winner required");
check(report.decisionVerdicts?.releaseSafetyReadiness?.summary, "decisionVerdicts.releaseSafetyReadiness.summary required");
check(
  typeof report.executiveVerdict?.sideOverallConclusions?.baseline === "string" &&
    report.executiveVerdict.sideOverallConclusions.baseline.trim(),
  "executiveVerdict.sideOverallConclusions.baseline is required"
);
check(
  typeof report.executiveVerdict?.sideOverallConclusions?.challenger === "string" &&
    report.executiveVerdict.sideOverallConclusions.challenger.trim(),
  "executiveVerdict.sideOverallConclusions.challenger is required"
);
check(report.aggregateScores?.scale === "0-100", "aggregateScores.scale must be 0-100");
check(typeof report.aggregateScores?.overall?.baselineScore === "number", "aggregateScores.overall.baselineScore required");
check(typeof report.aggregateScores?.overall?.challengerScore === "number", "aggregateScores.overall.challengerScore required");
check(report.aggregateScores?.overall?.winner, "aggregateScores.overall.winner required");
check(report.scoreInterpretation?.policy === "directional_scores", "scoreInterpretation.policy must be directional_scores unless externally calibrated");
check(typeof report.scoreInterpretation?.precisionCaveat === "string" && report.scoreInterpretation.precisionCaveat.trim(), "scoreInterpretation.precisionCaveat required");
check(Array.isArray(report.keyEvidenceSnippets), "keyEvidenceSnippets must be array");
check((report.keyEvidenceSnippets || []).length >= 2, "keyEvidenceSnippets should include at least 2 inspectable excerpts for major claims");
check(Array.isArray(report.taskSpaceDimensionVerdicts), "taskSpaceDimensionVerdicts must be array");
check(Array.isArray(report.caseTable), "caseTable must be array");
check(Array.isArray(report.challengerOptimizationPlan), "challengerOptimizationPlan must be array");
check(Array.isArray(report.uncertaintyAndCaveats), "uncertaintyAndCaveats must be array");

if (!report.challengerOptimizationPlan?.length) {
  warnings.push("challengerOptimizationPlan is empty; acceptable only if evidence is insufficient or challenger already wins strongly with no clear optimization.");
}

for (const [idx, row] of (report.taskSpaceDimensionVerdicts || []).entries()) {
  check(row.dimensionId, `taskSpaceDimensionVerdicts[${idx}].dimensionId required`);
  check(typeof row.baselineScore === "number", `taskSpaceDimensionVerdicts[${idx}].baselineScore required`);
  check(typeof row.challengerScore === "number", `taskSpaceDimensionVerdicts[${idx}].challengerScore required`);
  check(row.winner, `taskSpaceDimensionVerdicts[${idx}].winner required`);
  check(row.challengerDiagnosis, `taskSpaceDimensionVerdicts[${idx}].challengerDiagnosis required`);
}

for (const [idx, row] of (report.caseTable || []).entries()) {
  const notScored = row.gradeReadiness === "skipped" || row.gradeReadiness === "blocked" || row.winner === "not_scored" || row.pairwiseWinner === "not_scored";
  if (notScored) {
    check(row.baselineScore == null, `caseTable[${idx}] ${row.caseId || ""} baselineScore must be null for not-scored cases`);
    check(row.challengerScore == null, `caseTable[${idx}] ${row.caseId || ""} challengerScore must be null for not-scored cases`);
  }
}

for (const [idx, snippet] of (report.keyEvidenceSnippets || []).entries()) {
  check(snippet.caseId, `keyEvidenceSnippets[${idx}].caseId required`);
  check(["baseline", "challenger"].includes(snippet.side), `keyEvidenceSnippets[${idx}].side invalid`);
  check(snippet.field, `keyEvidenceSnippets[${idx}].field required`);
  check(typeof snippet.quote === "string" && snippet.quote.trim(), `keyEvidenceSnippets[${idx}].quote required`);
  check(snippet.whyItMatters, `keyEvidenceSnippets[${idx}].whyItMatters required`);
}

for (const [idx, item] of (report.challengerOptimizationPlan || []).entries()) {
  check(["high", "medium", "low"].includes(item.priority), `challengerOptimizationPlan[${idx}].priority invalid`);
  check(item.theme, `challengerOptimizationPlan[${idx}].theme required`);
  check(item.recommendation, `challengerOptimizationPlan[${idx}].recommendation required`);
  check(Array.isArray(item.linkedDimensions), `challengerOptimizationPlan[${idx}].linkedDimensions must be array`);
  check(Array.isArray(item.evidenceRefs), `challengerOptimizationPlan[${idx}].evidenceRefs must be array`);
}

const result = {
  ok: errors.length === 0,
  checkerType: "lightweight_custom_checker",
  coverage: ["report top-level shape", "verdict enum", "dual verdicts", "side overall conclusions", "overall score completeness", "directional score caveat", "score scale", "scoreboard row completeness", "not-scored case handling", "key evidence snippets", "optimization plan presence"],
  errors,
  warnings
};
console.log(JSON.stringify(result, null, 2));
process.exit(errors.length ? 1 : 0);

function check(condition, message) {
  if (!condition) errors.push(message);
}
