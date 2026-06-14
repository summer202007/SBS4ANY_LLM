import { readFileSync } from "node:fs";
import path from "node:path";

function usage() {
  console.error("Usage: node scripts/capture/qa-capture-result.mjs --capture <capture.json> --expect <expectations.json>");
  process.exit(2);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key.startsWith("--") || !value) usage();
    args[key.slice(2)] = value;
    i += 1;
  }
  if (!args.capture || !args.expect) usage();
  return args;
}

function loadJson(file) {
  return JSON.parse(readFileSync(path.resolve(file), "utf8"));
}

function textOf(value) {
  if (Array.isArray(value)) return value.map(textOf).join("\n");
  if (value && typeof value === "object") return Object.values(value).map(textOf).join("\n");
  return String(value ?? "");
}

function addIssue(result, field, code, message) {
  result.fieldResults[field] = code;
  result.blockingIssues.push({ field, code, message });
}

function addWarning(result, message) {
  result.warnings.push(message);
}

function checkType(value, expectedType) {
  if (expectedType === "array") return Array.isArray(value);
  if (expectedType === "string") return typeof value === "string";
  if (expectedType === "object") return value && typeof value === "object" && !Array.isArray(value);
  return true;
}

function checkRequiredField(result, capture, field, spec) {
  const value = capture[field];
  if (!checkType(value, spec.type)) {
    addIssue(result, field, "fail_invalid_type", `Expected ${field} to be ${spec.type}.`);
    return;
  }

  if (spec.type === "string") {
    const valueText = String(value ?? "");
    if (valueText.length < (spec.minLength || 1)) {
      addIssue(result, field, "fail_empty", `${field} is shorter than required minimum length.`);
      return;
    }
    for (const needle of spec.mustContain || []) {
      if (!valueText.includes(needle)) {
        addIssue(result, field, "fail_missing_visible_field", `${field} is missing required visible text: ${needle}`);
        return;
      }
    }
    for (const needle of spec.mustNotContain || []) {
      if (valueText.includes(needle)) {
        addIssue(result, field, "fail_polluted", `${field} contains forbidden UI/source/noise text: ${needle}`);
        return;
      }
    }
  }

  if (spec.type === "array") {
    if (value.length < (spec.minItems || 1)) {
      addIssue(result, field, "fail_missing_visible_field", `${field} has ${value.length} items; expected at least ${spec.minItems || 1}.`);
      return;
    }
    const joined = textOf(value);
    for (const needle of spec.mustContainText || []) {
      if (!joined.includes(needle)) {
        addIssue(result, field, "fail_missing_visible_field", `${field} is missing required visible text: ${needle}`);
        return;
      }
    }
  }

  result.fieldResults[field] = "pass";
}

function main() {
  const args = parseArgs(process.argv);
  const capture = loadJson(args.capture);
  const expect = loadJson(args.expect);
  const result = {
    ok: false,
    adapterReadiness: "blocked",
    providerId: expect.providerId || capture.provider || capture.providerId || "",
    fieldResults: {},
    blockingIssues: [],
    warnings: [],
    developerInstructions: [],
  };

  const expectedUser = expect.caseContext?.currentUserMessage;
  if (expectedUser && capture.userMessage !== expectedUser) {
    addIssue(result, "userMessage", "fail_wrong_turn", "Capture userMessage does not match expected current turn.");
  } else if (expectedUser) {
    result.fieldResults.userMessage = "pass";
  }

  for (const [field, spec] of Object.entries(expect.requiredFields || {})) {
    checkRequiredField(result, capture, field, spec);
  }

  for (const [field, spec] of Object.entries(expect.optionalOrUnsupportedFields || {})) {
    const value = capture[field];
    const empty = value == null || value === "" || (Array.isArray(value) && value.length === 0);
    if (spec.expectedEmpty && !empty) {
      addIssue(result, field, "fail_missing_visible_field", `${field} should be empty unless visible evidence exists.`);
    } else if (spec.expectedEmptyOrManualOnly && !empty) {
      addWarning(result, `${field} is non-empty; verify it is automatically captured visible evidence or marked manual-only.`);
      result.fieldResults[field] = "warn";
    } else {
      result.fieldResults[field] = "unsupported";
    }
  }

  if (result.blockingIssues.length === 0) {
    result.ok = true;
    result.adapterReadiness = "ready";
  } else {
    result.developerInstructions.push("Fix blocking fields before marking this adapter ready. Use manual fallback or partial readiness only if unsupported fields are explicit.");
  }

  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}

main();
