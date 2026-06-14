#!/usr/bin/env node
import fs from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("Usage: validate_case_judgments.mjs <case-judgments.json>");
  process.exit(1);
}

const artifact = JSON.parse(fs.readFileSync(file, "utf8"));
const errors = [];
const warnings = [];
const winners = new Set(["baseline", "challenger", "tie", "inconclusive", "not_scored"]);

check(artifact.artifactType === "CaseJudgmentSet", "artifactType must be CaseJudgmentSet");
check(Array.isArray(artifact.caseJudgments), "caseJudgments must be an array");
check(artifact.scoringConfig?.caseScoreScale === "1-5", "caseScoreScale must be 1-5");

let snippetCount = 0;

for (const [idx, c] of (artifact.caseJudgments || []).entries()) {
  check(c.caseId, `caseJudgments[${idx}].caseId is required`);
  check(winners.has(c.pairwiseWinner), `${c.caseId}.pairwiseWinner invalid`);
  check(Array.isArray(c.dimensionJudgments), `${c.caseId}.dimensionJudgments must be array`);
  check(Array.isArray(c.evidenceRefs), `${c.caseId}.evidenceRefs must be array`);
  check(Array.isArray(c.inferenceChain), `${c.caseId}.inferenceChain must be array`);
  const skipped = ["skipped", "blocked"].includes(c.gradeReadiness) || c.pairwiseWinner === "not_scored";
  if (skipped) {
    check(c.pairwiseWinner === "not_scored" || c.gradeReadiness === "blocked", `${c.caseId} skipped/blocked cases must not have a scored pairwise winner`);
    check(!scoreOk(c.sideScores?.baseline), `${c.caseId}.sideScores.baseline must be null/absent when case is skipped or not scored`);
    check(!scoreOk(c.sideScores?.challenger), `${c.caseId}.sideScores.challenger must be null/absent when case is skipped or not scored`);
    const fakeOutputRefs = (c.evidenceRefs || []).filter((ref) => /cleanFinalOutput|finalOutput|Output/.test(ref));
    check(fakeOutputRefs.length === 0, `${c.caseId} skipped/missing cases must not cite nonexistent output refs`);
  } else {
    check(scoreOk(c.sideScores?.baseline), `${c.caseId}.sideScores.baseline must be 1-5 when case is scored`);
    check(scoreOk(c.sideScores?.challenger), `${c.caseId}.sideScores.challenger must be 1-5 when case is scored`);
  }
  if (!c.dimensionJudgments?.length && c.gradeReadiness !== "blocked" && c.gradeReadiness !== "skipped") {
    warnings.push(`${c.caseId} has no dimension judgments`);
  }
  for (const [didx, d] of (c.dimensionJudgments || []).entries()) {
    check(d.dimensionId, `${c.caseId}.dimensionJudgments[${didx}].dimensionId required`);
    check(scoreOk(d.baselineScore), `${c.caseId}.${d.dimensionId}.baselineScore must be 1-5`);
    check(scoreOk(d.challengerScore), `${c.caseId}.${d.dimensionId}.challengerScore must be 1-5`);
    check(winners.has(d.pairwiseWinner), `${c.caseId}.${d.dimensionId}.pairwiseWinner invalid`);
    check(Array.isArray(d.evidenceRefs), `${c.caseId}.${d.dimensionId}.evidenceRefs must be array`);
    snippetCount += Array.isArray(d.evidenceSnippets) ? d.evidenceSnippets.length : 0;
  }
  snippetCount += Array.isArray(c.evidenceSnippets) ? c.evidenceSnippets.length : 0;
}

if (snippetCount < 2) {
  warnings.push("CaseJudgmentSet has fewer than 2 evidenceSnippets; major claims may be hard to audit.");
}

const result = {
  ok: errors.length === 0,
  checkerType: "lightweight_custom_checker",
  coverage: ["case judgment shape", "score ranges", "winner enums", "not-scored case handling", "evidence ref arrays", "evidence snippet presence"],
  errors,
  warnings
};
console.log(JSON.stringify(result, null, 2));
process.exit(errors.length ? 1 : 0);

function scoreOk(value) {
  return typeof value === "number" && value >= 1 && value <= 5;
}
function check(condition, message) {
  if (!condition) errors.push(message);
}
