import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { rootDir } from "./storage.mjs";

const skillPath = path.join(rootDir, "skills", "chatbot-eval-set-generator", "SKILL.md");
const generationTimeoutMs = 20 * 60 * 1000;

export async function generatePackageWithLocalCodex({ activeTask, caseCountTarget = 15, onEvent } = {}) {
  if (!activeTask) throw new Error("Create or select an evaluation task first.");
  const intake = buildGeneratorIntake(activeTask, caseCountTarget);
  onEvent?.({ type: "phase", message: "Preparing generator intake." });
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "sbs-package-generation-"));
  const inputPath = path.join(tempDir, "input.json");
  const outputPath = path.join(tempDir, "revised-package.json");
  const stdoutPath = path.join(tempDir, "stdout.txt");
  const stderrPath = path.join(tempDir, "stderr.txt");
  const prompt = buildPrompt(intake);
  await writeFile(inputPath, JSON.stringify(intake, null, 2), "utf8");
  onEvent?.({ type: "artifact", message: `Input saved: ${inputPath}` });
  const codexPath = process.env.SBS_CODEX_PATH || "/Applications/Codex.app/Contents/Resources/codex";
  const args = [
    "exec",
    "--cd",
    rootDir,
    "--skip-git-repo-check",
    "--ignore-user-config",
    "--ephemeral",
    ...buildModelArgs(activeTask?.arena?.localCodexModel),
    "--sandbox",
    "workspace-write",
    "--output-last-message",
    outputPath,
    "-",
  ];
  let stdout = "";
  let stderr = "";
  try {
    onEvent?.({ type: "phase", message: "Starting local Codex package generation." });
    const result = await runCodex(codexPath, args, prompt, generationTimeoutMs, onEvent);
    stdout = result.stdout;
    stderr = result.stderr;
  } catch (error) {
    stdout = error.stdout || "";
    stderr = error.stderr || "";
    await writeFile(stdoutPath, stdout, "utf8");
    await writeFile(stderrPath, stderr, "utf8");
    throw new Error(buildCodexFailureMessage(error, { tempDir, stdoutPath, stderrPath }));
  }
  await writeFile(stdoutPath, stdout, "utf8");
  await writeFile(stderrPath, stderr, "utf8");
  onEvent?.({ type: "artifact", message: `Codex logs saved: ${tempDir}` });
  const rawLastMessage = await readFile(outputPath, "utf8");
  onEvent?.({ type: "phase", message: "Parsing local Codex package output." });
  const runtimePackage = parseJson(rawLastMessage);
  const repairResult = repairRuntimePackageContract(runtimePackage);
  if (repairResult.appliedFixes.length) {
    onEvent?.({
      type: "phase",
      message: `Applied ${repairResult.appliedFixes.length} package contract repair(s).`,
    });
  }
  return {
    runtimePackage,
    prompt,
    intake,
    rawLastMessage,
    artifactRefs: [inputPath, outputPath, stdoutPath, stderrPath],
    artifactFiles: {
      "input.json": JSON.stringify(intake, null, 2),
      "prompt.txt": prompt,
      "revised-package.raw.json": rawLastMessage,
      "contract-repair.json": JSON.stringify(repairResult, null, 2),
      "stdout.txt": stdout,
      "stderr.txt": stderr,
    },
  };
}

function buildModelArgs(localCodexModel) {
  const model = ["gpt-5.4", "gpt-5.5"].includes(localCodexModel) ? localCodexModel : "gpt-5.5";
  return ["--model", model];
}

export function buildGeneratorIntake(activeTask, caseCountTarget = 15) {
  const arena = activeTask.arena || {};
  const taskSpace = activeTask.taskSpace || {};
  return {
    invocationMode: "sbs_product_package_generation",
    caseCountTarget: normalizeCaseCount(caseCountTarget),
    productType: arena.productType || "chatbot",
    baseline: {
      name: arena.baseline?.name || "Doubao",
      surface: arena.baseline?.surface || "web_chat",
      chatUrl: arena.baseline?.chatUrl || "",
      accessNotes: arena.baseline?.accessNotes || "",
      evidenceAvailability: arena.baseline?.evidenceAvailability || "L0",
    },
    challenger: {
      name: arena.challenger?.name || "Challenger",
      surface: arena.challenger?.surface || "web_chat",
      chatUrl: arena.challenger?.chatUrl || "",
      accessNotes: arena.challenger?.accessNotes || "",
      evidenceAvailability: arena.challenger?.evidenceAvailability || "L0",
      expectedAdvantage: arena.challenger?.expectedAdvantage || "",
    },
    taskSpace: {
      label: taskSpace.label || "",
      concreteScenario: taskSpace.concreteScenario || "",
      targetAudience: taskSpace.targetAudience || "",
      decisionQuestion: taskSpace.decisionQuestion || "",
      winningCriteria: taskSpace.winningCriteria || "",
      mustCoverCapabilities: taskSpace.mustCoverCapabilities || [],
      riskAreas: taskSpace.riskAreas || [],
      evaluateConversationExperience: Boolean(taskSpace.evaluateConversationExperience),
      nativeContextPolicy: taskSpace.nativeContextPolicy || "",
      supplementalNotes: taskSpace.supplementalNotes || "",
    },
    mvpConstraints: {
      defaultCaseCount: 15,
      allowedCaseCountPresets: [12, 15, 20],
      humanApprovalRequired: true,
      collectionMode: "manual_or_assisted_capture",
      baselineCeilingFixed: "Doubao",
    },
  };
}

function buildPrompt(intake) {
  return [
    "Use the repo-local chatbot-eval-set-generator skill.",
    `Skill path: ${skillPath}`,
    "Ignore unrelated global/user skills. This invocation is only for the repo-local SBS eval-set generator contract.",
    "You are invoked by the SBS workbench backend to generate a RuntimeEvalPackage.",
    "Return strict JSON only. Do not wrap in Markdown.",
    "Work efficiently. Read only the repo-local skill and directly relevant schema/reference files. Do not inspect unrelated global skills, plugins, or app code.",
    "Generate a complete package with the exact top-level contract required by the skill.",
    "The package is a draft for human review; record uncertainty in confirmationBacklog instead of stopping.",
    "Default to 15 cases unless intake.caseCountTarget says otherwise.",
    "Do not grade model outputs; only produce eval cases, turn scripts, rubric suggestions, report metadata, trace refs, and self-critique.",
    "In product mode, artifact refs may be product-store refs or local artifact filenames, but include a human-readable case-index/audit-index ref.",
    "",
    "Validator contract reminders:",
    "- Every multi-turn harnessExecutionContract.preSendValidation must include package_binding, branch_rule_exists when branch_rules_only, no_evaluator_leakage, no_unapproved_exposure, no_unapproved_constraints, tracked_state_whitelist, and max_turns_stop_condition.",
    "- If decisionPolicy is fixed_sequence, preSendValidation still must include no_unapproved_exposure but does not need branch_rule_exists.",
    "- Each rubric.appliesToCaseTypes must exactly match the case types represented by its caseRefs. Do not declare case types that are not present in caseRefs.",
    "- Human sampling recommendations are advisory, not mandatory gates.",
    "- dimensionWeights must include only scored dimensions and sum to 1.",
    "",
    "Normalized intake:",
    JSON.stringify(intake, null, 2),
  ].join("\n");
}

function normalizeCaseCount(value) {
  const count = Number(value || 15);
  if ([12, 15, 20].includes(count)) return count;
  return 15;
}

function parseJson(raw) {
  const value = String(raw || "").trim();
  try {
    return JSON.parse(value);
  } catch {
    const match = value.match(/```(?:json)?\s*([\s\S]*?)```/) || value.match(/(\{[\s\S]*\})/);
    if (match) return JSON.parse(match[1]);
    throw new Error("Local Codex package generator did not return parseable JSON.");
  }
}

function buildCodexFailureMessage(error, { tempDir, stdoutPath, stderrPath }) {
  const raw = `${error.stderr || ""}\n${error.stdout || ""}\n${error.message || ""}`;
  const usefulLine =
    raw
      .split("\n")
      .map((line) => line.trim())
      .find((line) => isUsefulErrorLine(line)) ||
    "Local Codex exited before returning a package.";
  return [
    "Local Codex package generation failed.",
    usefulLine.slice(0, 500),
    `Debug artifacts: ${tempDir}`,
    `stdout: ${stdoutPath}`,
    `stderr: ${stderrPath}`,
  ].join(" ");
}

function isUsefulErrorLine(line) {
  if (!line) return false;
  if (line.includes(" WARN ")) return false;
  if (line.includes("OpenAI Codex v")) return false;
  if (line.startsWith("--------")) return false;
  if (line === "user") return false;
  if (line.startsWith("Use the repo-local")) return false;
  return /(error|failed|timed out|timeout|exit|invalid|cannot|permission|denied)/i.test(line);
}

function runCodex(command, args, input, timeoutMs, onEvent) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, NO_COLOR: "1" },
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      const error = new Error("Local Codex package generation timed out.");
      error.stdout = stdout;
      error.stderr = stderr;
      reject(error);
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;
      emitProcessLines("stdout", text, onEvent);
    });
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      emitProcessLines("stderr", text, onEvent);
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      const error = new Error(`Local Codex package generation failed with exit code ${code}.`);
      error.stdout = stdout;
      error.stderr = stderr;
      reject(error);
    });
    child.stdin.end(input);
  });
}

export function repairRuntimePackageContract(runtimePackage) {
  const appliedFixes = [];
  repairTurnScriptContracts(runtimePackage, appliedFixes);
  repairRubricCaseTypeAlignment(runtimePackage, appliedFixes);
  softenHumanSamplingRecommendations(runtimePackage, appliedFixes);
  annotateRepairTrace(runtimePackage, appliedFixes);
  return {
    appliedFixes,
    skipped: appliedFixes.length === 0,
  };
}

function repairTurnScriptContracts(runtimePackage, appliedFixes) {
  const turnScripts = Array.isArray(runtimePackage.turnScripts) ? runtimePackage.turnScripts : [];
  for (const script of turnScripts) {
    const contract = script.harnessExecutionContract;
    if (!contract || typeof contract !== "object" || Array.isArray(contract)) continue;
    const required = [
      "package_binding",
      ...(contract.decisionPolicy === "fixed_sequence" ? [] : ["branch_rule_exists"]),
      "no_evaluator_leakage",
      "no_unapproved_exposure",
      "no_unapproved_constraints",
      "tracked_state_whitelist",
      "max_turns_stop_condition",
    ];
    const current = Array.isArray(contract.preSendValidation) ? contract.preSendValidation : [];
    const next = [...current];
    for (const check of required) {
      if (!next.includes(check)) next.push(check);
    }
    if (next.length !== current.length) {
      contract.preSendValidation = next;
      appliedFixes.push({
        component: "turnScripts",
        objectId: script.caseId || "<unknown>",
        fix: "added_missing_preSendValidation_checks",
        added: next.filter((check) => !current.includes(check)),
      });
    }
  }
}

function repairRubricCaseTypeAlignment(runtimePackage, appliedFixes) {
  const casesById = new Map(
    (Array.isArray(runtimePackage.evalCases) ? runtimePackage.evalCases : [])
      .filter((evalCase) => evalCase?.caseId)
      .map((evalCase) => [evalCase.caseId, evalCase]),
  );
  const rubrics = Array.isArray(runtimePackage.rubricSuggestions) ? runtimePackage.rubricSuggestions : [];
  for (const rubric of rubrics) {
    if (!Array.isArray(rubric.caseRefs) || !rubric.caseRefs.length) continue;
    const actualCaseTypes = [
      ...new Set(
        rubric.caseRefs
          .map((caseRef) => casesById.get(caseRef)?.caseType)
          .filter(Boolean),
      ),
    ].sort();
    const declaredCaseTypes = Array.isArray(rubric.appliesToCaseTypes)
      ? [...new Set(rubric.appliesToCaseTypes)].sort()
      : [];
    if (!sameStringArray(actualCaseTypes, declaredCaseTypes)) {
      rubric.appliesToCaseTypes = actualCaseTypes;
      appliedFixes.push({
        component: "rubricSuggestions",
        objectId: rubric.dimensionId || "<unknown>",
        fix: "aligned_appliesToCaseTypes_to_caseRefs",
        before: declaredCaseTypes,
        after: actualCaseTypes,
      });
    }
  }
}

function softenHumanSamplingRecommendations(runtimePackage, appliedFixes) {
  const rubrics = Array.isArray(runtimePackage.rubricSuggestions) ? runtimePackage.rubricSuggestions : [];
  for (const rubric of rubrics) {
    const plan = rubric.judgePlan;
    if (!plan || typeof plan !== "object" || Array.isArray(plan)) continue;
    const text = String(plan.humanSamplingRecommendation || "");
    if (!text) continue;
    const lower = text.toLowerCase();
    const saysOptional = /(not required|optional|advisory|recommended|suggested|not mandatory)/.test(lower);
    if (!saysOptional && /(must|required|mandatory|block|gate)/.test(lower)) {
      plan.humanSamplingRecommendation = `${text} Human sampling is advisory for MVP and should not block the eval run unless the user chooses to review manually.`;
      appliedFixes.push({
        component: "rubricSuggestions",
        objectId: rubric.dimensionId || "<unknown>",
        fix: "softened_human_sampling_recommendation",
      });
    }
  }
}

function annotateRepairTrace(runtimePackage, appliedFixes) {
  if (!appliedFixes.length) return;
  runtimePackage.generationTrace = runtimePackage.generationTrace || {};
  runtimePackage.generationTrace.postGenerationRepairs = [
    ...(Array.isArray(runtimePackage.generationTrace.postGenerationRepairs)
      ? runtimePackage.generationTrace.postGenerationRepairs
      : []),
    {
      repairId: `contract-repair-${new Date().toISOString()}`,
      repairType: "deterministic_contract_alignment",
      fixCount: appliedFixes.length,
      note: "SBS applied deterministic post-generation repairs for validator contract consistency without changing eval case intent or model-facing prompts.",
    },
  ];
}

function sameStringArray(left, right) {
  if (left.length !== right.length) return false;
  return left.every((item, index) => item === right[index]);
}

function emitProcessLines(stream, text, onEvent) {
  if (!onEvent) return;
  for (const line of String(text || "").split(/\r?\n/)) {
    const cleaned = compactCodexLogLine(line);
    if (!cleaned) continue;
    onEvent({ type: "log", stream, message: cleaned });
  }
}

function compactCodexLogLine(line) {
  const value = String(line || "").trim();
  if (!value) return "";
  if (value.includes(" WARN ")) {
    if (value.includes("invalid openai.yaml")) return "Ignoring an unrelated global skill config warning.";
    if (value.includes("defaultPrompt")) return "";
    if (value.includes("interface.icon_")) return "";
    if (value.includes("remote installed plugins cache")) return "Plugin catalog refresh skipped; continuing locally.";
    if (value.includes("git sync failed")) return "Plugin sync skipped; continuing locally.";
    return "";
  }
  if (value.includes("OpenAI Codex v")) return "Local Codex started.";
  if (value.startsWith("workdir:")) return value;
  if (value.startsWith("model:")) return value;
  if (value.startsWith("sandbox:")) return value;
  if (value.startsWith("exec")) return "Codex is reading local skill files.";
  if (value.includes("succeeded in")) return "Local context read completed.";
  if (value.length > 240) return `${value.slice(0, 240)}...`;
  return value;
}
