#!/usr/bin/env node
import fs from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("Usage: validate_cleaned_evidence.mjs <cleaned-evidence.json>");
  process.exit(1);
}

const artifact = JSON.parse(fs.readFileSync(file, "utf8"));
const errors = [];
const warnings = [];

check(artifact.artifactType === "CleanedEvidencePackage", "artifactType must be CleanedEvidencePackage");
check(typeof artifact.schemaVersion === "string", "schemaVersion is required");
check(typeof artifact.taskId === "string", "taskId is required");
check(artifact.coverageSummary && typeof artifact.coverageSummary === "object", "coverageSummary is required");
check(Array.isArray(artifact.caseEvidence), "caseEvidence must be an array");

if (artifact.coverageSummary) {
  if ((artifact.coverageSummary.missingCaseIds || []).length) {
    warnings.push(`Missing cases: ${artifact.coverageSummary.missingCaseIds.join(", ")}`);
  }
}

for (const [idx, c] of (artifact.caseEvidence || []).entries()) {
  check(c.caseId, `caseEvidence[${idx}].caseId is required`);
  check(c.caseType, `caseEvidence[${idx}].caseType is required`);
  check(["ready", "low_confidence", "needs_human_review", "blocked", "missing"].includes(c.status), `caseEvidence[${idx}].status is invalid`);
  check(Array.isArray(c.turnEvidence), `caseEvidence[${idx}].turnEvidence must be an array`);
  for (const [tidx, t] of (c.turnEvidence || []).entries()) {
    check(Number.isInteger(t.turnIndex), `${c.caseId}.turnEvidence[${tidx}].turnIndex must be integer`);
    check(t.sides && typeof t.sides === "object", `${c.caseId}.turnEvidence[${tidx}].sides is required`);
    for (const side of ["baseline", "challenger"]) {
      const s = t.sides?.[side];
      check(s, `${c.caseId}.turn ${t.turnIndex} missing side ${side}`);
      if (!s) continue;
      check(s.side === side, `${c.caseId}.turn ${t.turnIndex}.${side}.side mismatch`);
      check(typeof s.cleanFinalOutput === "string", `${c.caseId}.turn ${t.turnIndex}.${side}.cleanFinalOutput required`);
      check(["complete", "partial", "minimal", "missing"].includes(s.evidenceCompleteness), `${c.caseId}.turn ${t.turnIndex}.${side}.evidenceCompleteness invalid`);
      check(["ready", "low_confidence", "needs_human_review", "blocked"].includes(s.gradeReadiness), `${c.caseId}.turn ${t.turnIndex}.${side}.gradeReadiness invalid`);
      for (const key of ["productVisibleProcess", "intentExpansionEvidence", "sourceEvidence", "followupSuggestions", "riskNotices", "toolOrExecutionEvidence", "captureNotes", "removedNoise", "suspectedContamination", "unsupportedClaims", "humanReviewHints"]) {
        check(Array.isArray(s[key]), `${c.caseId}.turn ${t.turnIndex}.${side}.${key} must be an array`);
      }
      if (!s.cleanFinalOutput.trim()) warnings.push(`${c.caseId} turn ${t.turnIndex} ${side} final output is empty`);
    }
  }
}

const result = {
  ok: errors.length === 0,
  checkerType: "lightweight_custom_checker",
  coverage: [
    "top-level contract",
    "case/turn/side presence",
    "grade readiness enums",
    "evidence channel array shape",
    "missing final output warnings"
  ],
  errors,
  warnings
};

console.log(JSON.stringify(result, null, 2));
process.exit(errors.length ? 1 : 0);

function check(condition, message) {
  if (!condition) errors.push(message);
}

