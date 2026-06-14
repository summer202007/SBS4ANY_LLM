#!/usr/bin/env node
import fs from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("Usage: validate_report_markdown.mjs <report.md>");
  process.exit(1);
}

const text = fs.readFileSync(file, "utf8");
const errors = [];
const warnings = [];
const isZh = /[\u4e00-\u9fff]/.test(text);

check(text.trim().length >= 3000, "report markdown is too short for memo-grade output");
check(/^#\s+.+/m.test(text), "report must have a title");

if (isZh) {
  check(hasHeading(text, "(结论摘要|Executive Summary)"), "Chinese report must include 结论摘要");
  check(hasHeading(text, "(方法说明|如何阅读分数|Methodology)"), "Chinese report must include 方法说明/如何阅读分数");
  check(hasHeading(text, "(总分与维度分|Scoreboard)"), "Chinese report must include 总分与维度分");
  check(/总体表现/.test(text), "Chinese report score table must include 总体表现 row");
  check(hasHeading(text, "(关键原因|Why This Verdict|Key Reasons)"), "Chinese report must include dedicated 关键原因 section");
  check(hasHeading(text, "(关键证据摘录|Evidence Excerpts|Key Evidence)"), "Chinese report must include 关键证据摘录");
  check(/方向性分数|directional/i.test(text), "Chinese report must explain that scores are directional unless calibrated");
  check(/任务效用|task utility/i.test(text), "Chinese report must separate task utility verdict");
  check(/安全|上线|release|readiness/i.test(text), "Chinese report must separate safety/release readiness verdict");
  check(hasHeading(text, ".*优化建议"), "Chinese report must include challenger optimization section");
  check(/^###\s*(?:\\d+[.)、]\\s*)?(高优先级|中优先级|低优先级)/m.test(text), "Chinese optimization section should group recommendations by priority headings");
  check(hasHeading(text, "(Case\\s*类型拆解|Case Type Breakdown)"), "Chinese report must include Case 类型拆解");
  check(hasHeading(text, "(失败簇与红线|Failure Clusters)"), "Chinese report must include 失败簇与红线");
  check(hasHeading(text, "(局部优势|Strength Pockets)"), "Chinese report must include 局部优势");
  check(hasHeading(text, "(Case\\s*明细表|Case Table)"), "Chinese report must include Case 明细表");
  check(hasHeading(text, "(不确定性|Uncertainty)"), "Chinese report must include 不确定性/caveats");
  if (/\|\s*coreTaskSuccess\s*\|/.test(text) || /\|\s*trustworthinessSafety\s*\|/.test(text)) {
    warnings.push("Chinese memo appears to expose raw dimension enum IDs in the main score table; prefer Chinese labels.");
  }
} else {
  check(hasHeading(text, "(Executive Summary|Conclusion)", "i"), "report must include executive summary");
  check(hasHeading(text, "(Methodology|How To Read Scores)", "i"), "report must include methodology / score interpretation");
  check(hasHeading(text, "(Scoreboard|Scores)", "i"), "report must include scoreboard");
  check(hasHeading(text, "(Why This Verdict|Key Reasons)", "i"), "report must include dedicated key reasons section");
  check(hasHeading(text, "(Evidence Excerpts|Key Evidence)", "i"), "report must include key evidence excerpts");
  check(/directional/i.test(text), "report must explain that scores are directional unless calibrated");
  check(hasHeading(text, ".*Optimization", "i"), "report must include optimization section");
  check(hasHeading(text, "(Case Type Breakdown|Case Breakdown)", "i"), "report must include case type breakdown");
  check(hasHeading(text, "(Uncertainty|Caveats)", "i"), "report must include uncertainty/caveats");
}

const caseRefs = text.match(/\b[a-z]+[a-z0-9-]*-\d{3}\b/gi) || [];
if (new Set(caseRefs).size < 6) {
  warnings.push("report has few case refs; check whether evidence linkage is too thin.");
}

const tableIssues = findMalformedMarkdownTables(text);
warnings.push(...tableIssues);

const result = {
  ok: errors.length === 0,
  checkerType: "memo_quality_checker",
  coverage: [
    "memo length",
    "title",
    "executive summary",
    "methodology and directional score caveat",
    "scoreboard with overall row",
    "dedicated key reasons",
    "key evidence excerpts",
    "priority-grouped optimization",
    "case breakdown",
    "red lines",
    "case table",
    "caveats",
  ],
  errors,
  warnings,
};

console.log(JSON.stringify(result, null, 2));
process.exit(errors.length ? 1 : 0);

function check(condition, message) {
  if (!condition) errors.push(message);
}

function hasHeading(markdown, pattern, flags = "") {
  return new RegExp(`^##\\s*(?:\\d+[.)、]?\\s*)?${pattern}`, `m${flags}`).test(markdown);
}

function findMalformedMarkdownTables(markdown) {
  const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
  const issues = [];
  for (let i = 0; i < lines.length - 1; i += 1) {
    const header = lines[i].trim();
    const separator = lines[i + 1].trim();
    if (!looksLikeTableRow(header)) continue;
    if (!separator.includes("|")) continue;
    if (isMarkdownTableSeparator(separator)) continue;
    if (/^-+$/.test(separator.replace(/\|/g, "").trim())) {
      issues.push(`possible malformed markdown table separator near line ${i + 2}; renderer accepts one dash per column, but this row is ambiguous`);
    }
  }
  return issues;
}

function looksLikeTableRow(line) {
  return line.startsWith("|") && line.endsWith("|") && line.split("|").length >= 4;
}

function isMarkdownTableSeparator(line) {
  const cells = line
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
  if (cells.length < 2) return false;
  return cells.every((cell) => /^:?-+:?$/.test(cell));
}
