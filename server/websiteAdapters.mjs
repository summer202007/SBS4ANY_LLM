import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildAdapterTemplateWithLocalCodex } from "./adapterBuilder.mjs";
import { rootDir } from "./storage.mjs";

const artifactDir = path.join(rootDir, "artifacts", "capture-calibration");

function checkTargetUrl(actualUrl, targetUrl) {
  const target = String(targetUrl || "").trim();
  if (!target) return { ok: true };
  try {
    const actualHost = new URL(actualUrl).hostname.replace(/^www\./, "");
    const targetHost = new URL(target).hostname.replace(/^www\./, "");
    if (actualHost === targetHost || actualHost.endsWith(`.${targetHost}`)) return { ok: true };
    return {
      ok: false,
      message: `Current Chrome tab is ${actualHost}, but the entered challenger URL is ${targetHost}. Open the target challenger page in Chrome and retry.`,
    };
  } catch {
    return { ok: true };
  }
}

export async function captureChallengerCurrentChrome({ caseId, turnIndex, userMessage, nextUserMessage = "", firstTimeCalibration = false, targetUrl = "" } = {}) {
  if (firstTimeCalibration) {
    const targetCheck = checkSetupTargetUrl(targetUrl);
    if (!targetCheck.ok) throw new Error(targetCheck.message);
  }
  const snapshot = await captureCurrentChromeSnapshot({ userMessage, nextUserMessage });
  const urlCheck = checkTargetUrl(snapshot.url, targetUrl);
  if (!urlCheck.ok) {
    throw new Error(urlCheck.message);
  }
  if (firstTimeCalibration) {
    const turnCheck = checkCaseUserMessageVisible(snapshot, userMessage);
    if (!turnCheck.ok) {
      throw new Error(turnCheck.message);
    }
    return buildUnknownWebsiteTemplateCapture({ snapshot, caseId, turnIndex, userMessage, targetUrl });
  }
  const adapter = detectWebsiteAdapter(snapshot);
  if (!adapter) {
    throw new Error("No approved website capture adapter matched this page. Try first-time setup or paste manually.");
  }

  return adapter.capture({ snapshot, caseId, turnIndex, userMessage, nextUserMessage, firstTimeCalibration, targetUrl });
}

function checkSetupTargetUrl(targetUrl) {
  const value = String(targetUrl || "").trim();
  if (!value) {
    return {
      ok: false,
      message: "Paste a challenger chat URL before starting capture setup.",
    };
  }
  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:") return { ok: true };
  } catch {
    // handled below
  }
  return {
    ok: false,
    message: "Paste a valid http(s) challenger chat URL before starting capture setup.",
  };
}

function checkCaseUserMessageVisible(snapshot, userMessage) {
  const expected = normalizeForMatch(userMessage);
  if (!expected) return { ok: true };
  const messageMatch = (snapshot.messageItems || []).some((item) =>
    item.role === "user" && normalizeForMatch(item.text).includes(expected),
  );
  if (messageMatch) return { ok: true };
  const rawMatch = normalizeForMatch(snapshot.rawVisibleText).includes(expected);
  if (rawMatch) return { ok: true };
  return {
    ok: false,
    message: "Current page does not show the user prompt for this case. Open the correct chatbot conversation/turn and retry capture setup.",
  };
}

function normalizeForMatch(value) {
  return String(value || "").replace(/\s+/g, "").trim();
}

function detectWebsiteAdapter(snapshot) {
  if (/dots\.ai$/i.test(snapshot.host) || /dots\.ai/i.test(snapshot.url) || snapshot.title === "点点") {
    return dotsAiWebAdapter;
  }
  return null;
}

async function buildUnknownWebsiteTemplateCapture({ snapshot, caseId, turnIndex, userMessage, targetUrl }) {
  const builderResult = await buildAdapterTemplateWithLocalCodex({
    snapshot,
    caseId,
    turnIndex,
    userMessage,
    targetUrl,
  });
  const output = builderResult.output || {};
  const validator = builderResult.validatorResult || { ok: false, errors: ["Missing builder validator result."] };
  const readyish = validator.ok && ["ready", "partial"].includes(output.status);
  const qaResult = normalizeBuilderQa(output.qaResult, readyish, validator);
  if (!qaResult.ok) {
    const issue = qaResult.blockingIssues?.[0];
    throw new Error(issue?.message || "Website structure setup did not pass QA. Retry on the correct page or paste manually.");
  }

  const executableAdapter = detectWebsiteAdapter(snapshot);
  if (!executableAdapter) {
    throw new Error("Website structure was understood, but no executable capture adapter is available yet. Paste manually for this run.");
  }

  const capture = executableAdapter.capture({
    snapshot,
    caseId,
    turnIndex,
    userMessage,
    firstTimeCalibration: false,
  });
  return {
    ...capture,
    captureNotes: [
      "Local Codex verified the website capture structure, then SBS executed the matching capture adapter immediately.",
      ...(capture.captureNotes || []),
      ...((output.knownLimitations || []).map((item) => `Setup limitation: ${String(item)}`)),
    ],
    adapterInfo: {
      ...(capture.adapterInfo || {}),
      templateSource: "local_codex_builder",
      requiresHumanReview: true,
      doNotPersist: false,
      urlPatterns: Array.isArray(output.urlPatterns) ? output.urlPatterns : capture.adapterInfo?.urlPatterns || [],
    },
    adapterBuilderOutput: output,
    adapterBuilderArtifacts: builderResult.artifactRefs,
    snapshotArtifactRef: snapshot.artifactRef,
  };
}

function normalizeBuilderQa(qaResult, readyish, validator) {
  const qa = qaResult && typeof qaResult === "object" ? qaResult : {};
  const blockingIssues = Array.isArray(qa.blockingIssues) ? qa.blockingIssues : [];
  const validatorIssues = validator.ok
    ? []
    : validator.errors.map((message) => ({ field: "builderOutput", code: "invalid_builder_output", message }));
  return {
    ok: Boolean(qa.ok) && readyish && validatorIssues.length === 0,
    adapterReadiness: qa.adapterReadiness || (readyish ? "partial" : "blocked"),
    fieldResults: qa.fieldResults && typeof qa.fieldResults === "object" ? qa.fieldResults : {},
    blockingIssues: [...blockingIssues, ...validatorIssues],
    warnings: Array.isArray(qa.warnings) ? qa.warnings.map((item) => String(item)) : [],
    developerInstructions: Array.isArray(qa.developerInstructions)
      ? qa.developerInstructions.map((item) => String(item))
      : ["Review the generated adapter template before relying on automatic capture."],
  };
}

function blockedCapture({ caseId, turnIndex, snapshot, reason, code }) {
  const captureId = buildId("capture");
  return {
    captureId,
    provider: "unknown_web_chatbot",
    side: "challenger",
    caseId,
    turnIndex,
    capturedAt: new Date().toISOString(),
    url: snapshot.url,
    title: snapshot.title,
    finalAnswer: "",
    intentExpansionQueries: [],
    referenceMaterials: [],
    riskNotices: [],
    followupSuggestions: [],
    visibleProcessNotes: "",
    sourceNotes: "",
    toolcallNotes: "",
    evidenceLevel: "L0",
    rawVisibleText: snapshot.rawVisibleText,
    captureNotes: [
      reason,
      "Calibration snapshot was captured for future adapter building; use manual paste for this run.",
    ],
    adapterInfo: {
      providerId: "unknown_web_chatbot",
      providerName: "Unknown web chatbot",
      status: "blocked",
      templateSource: "none",
      requiresHumanReview: true,
      doNotPersist: true,
    },
    qaResult: {
      ok: false,
      adapterReadiness: "blocked",
      fieldResults: { providerDetection: "fail_empty" },
      blockingIssues: [
        {
          field: "providerDetection",
          code,
          message: reason,
        },
      ],
      warnings: [],
      developerInstructions: [
        "Run the website capture adapter builder skill with the saved snapshot before enabling automatic capture for this provider.",
      ],
    },
    snapshotArtifactRef: snapshot.artifactRef,
  };
}

const dotsAiWebAdapter = {
  providerId: "dots_ai_web",
  providerName: "dots.ai / 点点 Web",
  capture({ snapshot, caseId, turnIndex, userMessage, firstTimeCalibration = false }) {
    const currentUserMessage = String(userMessage || "");
    const messages = (snapshot.messageItems || []).filter((item) => item.text);
    let userIndex = -1;
    if (currentUserMessage) {
      for (let i = messages.length - 1; i >= 0; i -= 1) {
        if (messages[i].role === "user" && messages[i].text.includes(currentUserMessage)) {
          userIndex = i;
          break;
        }
      }
    }
    if (userIndex < 0) {
      for (let i = messages.length - 1; i >= 0; i -= 1) {
        if (messages[i].role === "user") {
          userIndex = i;
          break;
        }
      }
    }

    const scoped = [];
    for (let i = userIndex + 1; i < messages.length; i += 1) {
      if (messages[i].role === "user") break;
      scoped.push(messages[i]);
    }

    const answerParts = [];
    const relatedCards = [];
    const inlineQuotes = [];
    const followupSuggestions = [];

    for (const item of scoped) {
      if (item.isFeaturedNote) {
        relatedCards.push(...parseRelatedNoteCards(item.text));
        continue;
      }
      if (item.answerText) {
        answerParts.push(item.answerText);
        if (item.answerText.length <= 80 && /[?？]/.test(item.answerText)) {
          followupSuggestions.push(item.answerText);
        }
      }
      for (const quote of item.inlineQuotes || []) {
        if (quote && !inlineQuotes.some((existing) => existing.title === quote)) {
          inlineQuotes.push({ title: quote, sourceName: "", href: "", type: "inline_quote" });
        }
      }
    }

    if (!inlineQuotes.length) {
      const answerJoined = answerParts.join("\n\n");
      for (const match of answerJoined.matchAll(/[“"][^”"]{10,240}[”"]/g)) {
        const title = match[0];
        if (!inlineQuotes.some((existing) => existing.title === title)) {
          inlineQuotes.push({ title, sourceName: "", href: "", type: "inline_quote" });
        }
      }
    }

    const referenceMaterials = [...relatedCards, ...inlineQuotes];
    const riskNotices = /内容由 AI 生成/.test(snapshot.rawVisibleText) ? ["内容由 AI 生成"] : [];
    const finalAnswer = answerParts.join("\n\n").trim();
    const qaResult = qaDotsAiCapture({
      userMessage: messages[userIndex]?.text || "",
      expectedUserMessage: currentUserMessage,
      finalAnswer,
      referenceMaterials,
      riskNotices,
      followupSuggestions,
    });
    const captureId = buildId("capture");

    return {
      captureId,
      provider: "dots_ai_web",
      side: "challenger",
      caseId,
      turnIndex,
      capturedAt: new Date().toISOString(),
      url: snapshot.url,
      title: snapshot.title,
      userMessage: messages[userIndex]?.text || "",
      finalAnswer,
      visibleProcessNotes: "",
      intentExpansionQueries: [],
      referenceMaterials,
      riskNotices,
      followupSuggestions: unique(followupSuggestions),
      sourceNotes: formatReferenceMaterials(referenceMaterials),
      toolcallNotes: "No structured tool-call trace was visible in the final dots.ai DOM.",
      evidenceLevel: referenceMaterials.length ? "L2" : "L1",
      rawVisibleText: snapshot.rawVisibleText,
      captureNotes: [
        firstTimeCalibration
          ? "First-time setup test: ran the dots.ai Web adapter path without saving a new reusable template."
          : "Used approved dots.ai Web adapter template.",
        "Grouped all assistant bubbles after the matching user message into one eval turn.",
        "Transient thinking/status is not claimed unless captured from final visible DOM.",
      ],
      adapterInfo: {
        providerId: "dots_ai_web",
        providerName: "dots.ai / 点点 Web",
        status: qaResult.ok ? "ready" : "blocked",
        templateSource: firstTimeCalibration ? "first_time_setup_test" : "built_in",
        requiresHumanReview: true,
        doNotPersist: Boolean(firstTimeCalibration),
      },
      qaResult,
      snapshotArtifactRef: snapshot.artifactRef,
    };
  },
};

function parseRelatedNoteCards(text) {
  const lines = String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line !== "相关笔记推荐");
  const cards = [];
  for (let i = 0; i < lines.length; i += 2) {
    const title = lines[i];
    const sourceName = lines[i + 1] || "";
    if (title) cards.push({ title, sourceName, href: "", type: "related_note_card" });
  }
  return cards;
}

function qaDotsAiCapture({ userMessage, expectedUserMessage, finalAnswer, referenceMaterials, riskNotices, followupSuggestions }) {
  const result = {
    ok: false,
    adapterReadiness: "blocked",
    fieldResults: {},
    blockingIssues: [],
    warnings: [],
    developerInstructions: [],
  };
  const fail = (field, code, message) => {
    result.fieldResults[field] = code;
    result.blockingIssues.push({ field, code, message });
  };
  if (expectedUserMessage && userMessage !== expectedUserMessage) {
    fail("userMessage", "fail_wrong_turn", "Captured user message does not match the current eval turn.");
  } else {
    result.fieldResults.userMessage = "pass";
  }
  if (!finalAnswer || finalAnswer.length < 80) {
    fail("finalAnswer", "fail_empty", "Final answer is missing or too short.");
  } else if (["任务\n收藏", "新建对话", "相关笔记推荐", "内容由 AI 生成"].some((noise) => finalAnswer.includes(noise))) {
    fail("finalAnswer", "fail_polluted", "Final answer contains navigation, source-only, or risk-notice text.");
  } else {
    result.fieldResults.finalAnswer = "pass";
  }
  if (!referenceMaterials.length) {
    result.fieldResults.referenceMaterials = "unsupported";
    result.warnings.push("No reference materials were captured. This may be valid for pages without visible source evidence.");
  } else {
    result.fieldResults.referenceMaterials = "pass";
  }
  result.fieldResults.riskNotices = riskNotices.length ? "pass" : "unsupported";
  result.fieldResults.followupSuggestions = followupSuggestions.length ? "pass" : "unsupported";
  result.fieldResults.intentExpansionQueries = "unsupported";
  result.fieldResults.visibleProcessNotes = "unsupported";
  result.fieldResults.toolcallNotes = "pass";

  if (result.blockingIssues.length) {
    result.developerInstructions.push("Fix blocking capture issues or use manual challenger paste for this run.");
  } else {
    result.ok = true;
    result.adapterReadiness = "ready";
  }
  return result;
}

async function captureCurrentChromeSnapshot({ userMessage, nextUserMessage }) {
  mkdirSync(artifactDir, { recursive: true });
  const js = buildSnapshotJs();
  const dir = mkdtempSync(path.join(tmpdir(), "sbs-web-adapter-snapshot-"));
  const jsPath = path.join(dir, "snapshot.js");
  writeFileSync(jsPath, js, "utf8");
  const appleScript = `
set jsPath to POSIX file "${jsPath}"
set snapshotCode to read jsPath as «class utf8»
tell application "Google Chrome"
  if not (exists front window) then error "Google Chrome has no front window."
  set activeTab to active tab of front window
  return execute activeTab javascript snapshotCode
end tell
`;
  const stdout = execFileSync("osascript", ["-e", appleScript], { encoding: "utf8", timeout: 15000 });
  const snapshot = JSON.parse(stdout);
  snapshot.caseContext = { userMessage: String(userMessage || ""), nextUserMessage: String(nextUserMessage || "") };
  const stamp = new Date().toISOString().replaceAll(":", "").replaceAll(".", "");
  const host = snapshot.host || "unknown-host";
  const outPath = path.join(artifactDir, `${stamp}-${host}-adapter-snapshot.json`);
  writeFileSync(outPath, JSON.stringify(snapshot, null, 2), "utf8");
  snapshot.artifactRef = path.relative(rootDir, outPath);
  return snapshot;
}

function buildSnapshotJs() {
  return `(() => {
  const clean = (value) => String(value || "").replace(/\\s+\\n/g, "\\n").replace(/\\n\\s+/g, "\\n").trim();
  const nodeText = (node) => clean(node && (node.innerText || node.textContent) || "");
  const classText = (node) => String(node && node.className || "");
  const visible = (node) => {
    if (!node) return false;
    const style = window.getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity || 1) === 0) return false;
    const rect = node.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };
  const all = Array.from(document.querySelectorAll("body *"));
  const messageNodes = Array.from(document.querySelectorAll(".user-message-item, .assistant-message-item"));
  const messageItems = messageNodes.map((node, index) => {
    const clone = node.cloneNode(true);
    clone.querySelectorAll(".message-card__featured-note, [class*='featured-note']").forEach((item) => item.remove());
    const inlineQuotes = Array.from(node.querySelectorAll(".cite-tag, .cite-tag-text, [class*='cite-tag']"))
      .map((item) => nodeText(item))
      .filter(Boolean);
    const className = classText(node);
    const isFeaturedNote = Boolean(node.querySelector(".message-card__featured-note, [class*='featured-note']"));
    return {
      index,
      role: /user-message-item/.test(className) ? "user" : "assistant",
      className: className.slice(0, 180),
      text: nodeText(node),
      answerText: nodeText(clone),
      isFeaturedNote,
      inlineQuotes,
    };
  }).filter((item) => item.text);
  const domSummary = all
    .filter(visible)
    .map((node, index) => {
      const text = nodeText(node);
      if (!text || text.length < 2 || text.length > 1200) return null;
      const rect = node.getBoundingClientRect();
      return {
        index,
        tag: node.tagName,
        role: node.getAttribute("role") || "",
        className: classText(node).slice(0, 180),
        text: text.slice(0, 500),
        rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
      };
    })
    .filter(Boolean)
    .slice(0, 180);
  return JSON.stringify({
    capturedAt: new Date().toISOString(),
    url: location.href,
    host: location.hostname.replace(/[^a-z0-9.-]+/gi, "_"),
    title: document.title,
    rawVisibleText: document.body ? document.body.innerText : "",
    messageItems,
    domSummary,
    anchors: Array.from(document.querySelectorAll("a")).map((a) => ({ text: nodeText(a), href: a.href || "" })).filter((item) => item.text || item.href).slice(0, 120),
    buttons: Array.from(document.querySelectorAll("button, [role='button']")).map((button) => ({ text: nodeText(button), title: button.getAttribute("title") || "", ariaLabel: button.getAttribute("aria-label") || "" })).filter((item) => item.text || item.title || item.ariaLabel).slice(0, 120)
  }, null, 2);
})()`;
}

function formatReferenceMaterials(values = []) {
  return values
    .map((item, index) => {
      const suffix = item.sourceName ? ` - ${item.sourceName}` : "";
      const href = item.href ? `\n   ${item.href}` : "";
      return `${index + 1}. [${item.type || "reference"}] ${item.title || item.href || ""}${suffix}${href}`;
    })
    .join("\n");
}

function unique(values = []) {
  return [...new Set(values.map((item) => String(item || "").trim()).filter(Boolean))];
}

function buildId(prefix) {
  return `${prefix}-${new Date().toISOString().replaceAll(":", "").replaceAll(".", "")}`;
}
