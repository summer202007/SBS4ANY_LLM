import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { rootDir } from "./storage.mjs";

const skillPath = path.join(rootDir, "skills", "chatbot-website-capture-adapter-builder", "SKILL.md");

export async function buildAdapterTemplateWithLocalCodex({ snapshot, caseId, turnIndex, userMessage, targetUrl }) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "sbs-adapter-builder-"));
  const outputPath = path.join(tempDir, "adapter-builder-output.json");
  const stdoutPath = path.join(tempDir, "stdout.txt");
  const stderrPath = path.join(tempDir, "stderr.txt");
  const prompt = buildPrompt({ snapshot, caseId, turnIndex, userMessage, targetUrl });
  const codexPath = process.env.SBS_CODEX_PATH || "/Applications/Codex.app/Contents/Resources/codex";
  const args = [
    "exec",
    "--cd",
    rootDir,
    "--sandbox",
    "read-only",
    "--output-last-message",
    outputPath,
    "-",
  ];
  const { stdout, stderr } = await runCodex(codexPath, args, prompt, 120000);
  await writeFile(stdoutPath, stdout, "utf8");
  await writeFile(stderrPath, stderr, "utf8");
  const raw = await readFile(outputPath, "utf8");
  const output = parseJson(raw);
  return {
    prompt,
    output,
    rawLastMessage: raw,
    artifactRefs: [outputPath, stdoutPath, stderrPath],
    validatorResult: validateBuilderOutput(output),
  };
}

function buildPrompt({ snapshot, caseId, turnIndex, userMessage, targetUrl }) {
  const compactSnapshot = {
    url: snapshot.url,
    title: snapshot.title,
    host: snapshot.host,
    caseContext: { caseId, turnIndex, userMessage, targetUrl },
    rawVisibleTextPreview: String(snapshot.rawVisibleText || "").slice(0, 5000),
    messageItems: (snapshot.messageItems || []).slice(-12),
    domSummary: (snapshot.domSummary || []).slice(-80),
    anchors: (snapshot.anchors || []).slice(0, 80),
    buttons: (snapshot.buttons || []).slice(0, 80),
    artifactRef: snapshot.artifactRef,
  };
  return [
    "Use the repo-local chatbot-website-capture-adapter-builder skill.",
    `Skill path: ${skillPath}`,
    "You are building a safe capture-template draft for the SBS workbench.",
    "Do not generate executable code. Do not auto-send prompts. Do not claim hidden traces.",
    "Return strict JSON only, with keys: providerId, providerName, urlPatterns, status, fieldInventory, extractionPlan, normalizationMapper, qaResult, knownLimitations, manualFallbackInstructions.",
    "urlPatterns must contain host/domain patterns only, such as dots.ai. Do not include chat paths, conversation IDs, query strings, or fragments.",
    "status must be one of ready, partial, blocked.",
    "Use ready only if the snapshot has enough message/container evidence to support future safe capture. Otherwise use partial or blocked.",
    "qaResult must include ok, adapterReadiness, fieldResults, blockingIssues, warnings, developerInstructions.",
    "",
    "Snapshot packet:",
    JSON.stringify(compactSnapshot, null, 2),
  ].join("\n");
}

function validateBuilderOutput(output) {
  const errors = [];
  if (!output || typeof output !== "object") errors.push("output must be an object");
  if (!String(output?.providerId || "").trim()) errors.push("providerId required");
  if (!String(output?.providerName || "").trim()) errors.push("providerName required");
  if (!["ready", "partial", "blocked"].includes(output?.status)) errors.push("status invalid");
  if (!Array.isArray(output?.urlPatterns) || !output.urlPatterns.length) errors.push("urlPatterns required");
  if (!output?.qaResult || typeof output.qaResult !== "object") errors.push("qaResult required");
  return { ok: errors.length === 0, errors };
}

function parseJson(raw) {
  const value = String(raw || "").trim();
  try {
    return JSON.parse(value);
  } catch {
    const match = value.match(/```(?:json)?\s*([\s\S]*?)```/) || value.match(/(\{[\s\S]*\})/);
    if (match) return JSON.parse(match[1]);
    throw new Error("Local Codex adapter builder did not return parseable JSON.");
  }
}

function runCodex(command, args, input, timeoutMs) {
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
      reject(new Error("Local Codex adapter builder timed out."));
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
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
      reject(new Error(`Local Codex adapter builder failed with exit code ${code}: ${stderr || stdout}`));
    });
    child.stdin.end(input);
  });
}
