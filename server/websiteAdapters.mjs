import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildAdapterTemplateWithLocalCodex } from "./adapterBuilder.mjs";
import { readAdapterRegistry, rootDir } from "./storage.mjs";

const artifactDir = path.join(rootDir, "artifacts", "capture-calibration");
const APPLESCRIPT_MAX_BUFFER = 20 * 1024 * 1024;

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

export async function captureChallengerCurrentChrome({ caseId, turnIndex, userMessage, nextUserMessage = "", firstTimeCalibration = false, targetUrl = "", localCodexModel } = {}) {
  if (firstTimeCalibration) {
    const targetCheck = checkSetupTargetUrl(targetUrl);
    if (!targetCheck.ok) throw new Error(targetCheck.message);
  }
  const snapshot = await captureCurrentChromeSnapshot({ userMessage, nextUserMessage });
  const urlCheck = checkTargetUrl(snapshot.url, targetUrl);
  if (!urlCheck.ok) {
    throw new Error(urlCheck.message);
  }
  const adapter = detectWebsiteAdapter(snapshot);
  const savedTemplate = findSavedTemplateForSnapshot(snapshot);
  if (firstTimeCalibration) {
    const turnCheck = checkCaseUserMessageVisible(snapshot, userMessage);
    if (!turnCheck.ok) {
      throw new Error(turnCheck.message);
    }
    if (adapter && hasSavedTemplateForSnapshot(snapshot, adapter.providerId)) {
      return adapter.capture({
        snapshot,
        caseId,
        turnIndex,
        userMessage,
        nextUserMessage,
        firstTimeCalibration: true,
        targetUrl,
      });
    }
    if (!adapter && savedTemplate) {
      return genericWebChatAdapter.capture({
        snapshot,
        caseId,
        turnIndex,
        userMessage,
        nextUserMessage,
        firstTimeCalibration: true,
        builderOutput: savedTemplate.adapterBuilderOutput || savedTemplate,
      });
    }
    return buildUnknownWebsiteTemplateCapture({
      snapshot,
      caseId,
      turnIndex,
      userMessage,
      nextUserMessage,
      targetUrl,
      localCodexModel,
    });
  }
  if (!adapter && !savedTemplate) {
    throw new Error("No approved website capture adapter matched this page. Try first-time setup or paste manually.");
  }
  if (!adapter && savedTemplate) {
    return genericWebChatAdapter.capture({
      snapshot,
      caseId,
      turnIndex,
      userMessage,
      nextUserMessage,
      firstTimeCalibration,
      builderOutput: savedTemplate.adapterBuilderOutput || savedTemplate,
    });
  }

  return adapter.capture({ snapshot, caseId, turnIndex, userMessage, nextUserMessage, firstTimeCalibration, targetUrl });
}

function hasSavedTemplateForSnapshot(snapshot, providerId = "") {
  return Boolean(findSavedTemplateForSnapshot(snapshot, providerId));
}

function findSavedTemplateForSnapshot(snapshot, providerId = "") {
  const host = String(snapshot?.host || "").trim().toLowerCase().replace(/^www\./, "");
  if (!host) return null;
  const registry = readAdapterRegistry();
  return (registry.items || []).find((item) => {
    const patterns = Array.isArray(item.urlPatterns) ? item.urlPatterns : [];
    const matchesHost = patterns.some((pattern) => {
      const normalized = String(pattern || "").trim().toLowerCase().replace(/^www\./, "");
      return normalized && (host === normalized || host.endsWith(`.${normalized}`));
    });
    if (!matchesHost) return false;
    if (providerId && item.providerId && item.providerId !== providerId) return false;
    return ["ready", "partial"].includes(item.status);
  }) || null;
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
  if (/deepseek\.com$/i.test(snapshot.host) || /deepseek/i.test(snapshot.url) || /DeepSeek/i.test(snapshot.title || "")) {
    return deepseekWebAdapter;
  }
  return null;
}

async function buildUnknownWebsiteTemplateCapture({
  snapshot,
  caseId,
  turnIndex,
  userMessage,
  nextUserMessage = "",
  targetUrl,
  localCodexModel,
}) {
  let effectiveSnapshot = snapshot;
  let builderResult = await buildAdapterTemplateWithLocalCodex({
    snapshot: effectiveSnapshot,
    caseId,
    turnIndex,
    userMessage,
    nextUserMessage,
    targetUrl,
    localCodexModel,
  });
  let output = builderResult.output || {};
  let validator = builderResult.validatorResult || { ok: false, errors: ["Missing builder validator result."] };

  const reconConfig = buildReconConfig(output);
  if (shouldRetryRefinedSnapshot(effectiveSnapshot, reconConfig)) {
    const refinedSnapshot = await captureCurrentChromeSnapshot({
      userMessage,
      nextUserMessage,
      reconConfig,
    });
    if (snapshotImproved(effectiveSnapshot, refinedSnapshot)) {
      effectiveSnapshot = refinedSnapshot;
      builderResult = await buildAdapterTemplateWithLocalCodex({
        snapshot: effectiveSnapshot,
        caseId,
        turnIndex,
        userMessage,
        nextUserMessage,
        targetUrl,
        localCodexModel,
      });
      output = builderResult.output || {};
      validator = builderResult.validatorResult || { ok: false, errors: ["Missing builder validator result."] };
    }
  }

  const readyish = validator.ok && ["ready", "partial"].includes(output.status);
  const qaResult = normalizeBuilderQa(output.qaResult, readyish, validator);
  if (!qaResult.ok) {
    const issue = qaResult.blockingIssues?.[0];
    throw new Error(issue?.message || "Website structure setup did not pass QA. Retry on the correct page or paste manually.");
  }

  const executableAdapter = detectWebsiteAdapter(effectiveSnapshot) || genericWebChatAdapter;

  const capture = executableAdapter.capture({
    snapshot: effectiveSnapshot,
    caseId,
    turnIndex,
    userMessage,
    nextUserMessage,
    firstTimeCalibration: false,
    builderOutput: output,
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
    snapshotArtifactRef: effectiveSnapshot.artifactRef,
  };
}

function normalizeBuilderQa(qaResult, readyish, validator) {
  const qa = qaResult && typeof qaResult === "object" ? qaResult : {};
  const blockingIssues = Array.isArray(qa.blockingIssues) ? qa.blockingIssues : [];
  const validatorIssues = validator.ok
    ? []
    : validator.errors.map((message) => ({ field: "builderOutput", code: "invalid_builder_output", message }));
  const readiness = qa.adapterReadiness || (readyish ? "partial" : "blocked");
  const warningMessages = Array.isArray(qa.warnings)
    ? qa.warnings.map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") return String(item.message || item.code || JSON.stringify(item));
        return String(item);
      })
    : [];
  return {
    ok: readyish && validatorIssues.length === 0 && blockingIssues.length === 0 && ["ready", "partial"].includes(readiness),
    adapterReadiness: readiness,
    fieldResults: qa.fieldResults && typeof qa.fieldResults === "object" ? qa.fieldResults : {},
    blockingIssues: [...blockingIssues, ...validatorIssues],
    warnings: warningMessages,
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

const deepseekWebAdapter = {
  providerId: "deepseek_web",
  providerName: "DeepSeek Web",
  capture({ snapshot, caseId, turnIndex, userMessage, nextUserMessage = "", firstTimeCalibration = false }) {
    const rawVisibleText = String(snapshot.rawVisibleText || "");
    const scopedVisibleText = scopeVisibleTextToCurrentTurn(rawVisibleText, userMessage, nextUserMessage);
    const answerContainers = extractDeepseekAnswerContainers(snapshot, userMessage, nextUserMessage);
    const riskNotices = extractDeepseekRiskNotices(scopedVisibleText, rawVisibleText);
    const visibleProcessNotes = extractDeepseekVisibleProcessNotes(scopedVisibleText);
    const followupSuggestions = extractDeepseekFollowupSuggestions(scopedVisibleText, snapshot.buttons || []);
    const referenceMaterials = extractDeepseekReferenceMaterials(snapshot, scopedVisibleText);
    const finalAnswer = extractDeepseekFinalAnswer(scopedVisibleText, userMessage, answerContainers, {
      riskNotices,
      visibleProcessNotes,
      followupSuggestions,
    });
    const qaResult = qaDeepseekCapture({
      rawVisibleText,
      scopedVisibleText,
      expectedUserMessage: userMessage,
      finalAnswer,
    });
    return {
      captureId: buildId("capture"),
      provider: "deepseek_web",
      side: "challenger",
      caseId,
      turnIndex,
      capturedAt: new Date().toISOString(),
      url: snapshot.url,
      title: snapshot.title,
      userMessage,
      finalAnswer,
      visibleProcessNotes,
      intentExpansionQueries: [],
      referenceMaterials,
      riskNotices,
      followupSuggestions,
      sourceNotes: formatReferenceMaterials(referenceMaterials),
      toolcallNotes: "No structured tool-call trace was visible in the final DeepSeek web DOM.",
      evidenceLevel: referenceMaterials.length ? "L2" : "L1",
      rawVisibleText,
      scopedVisibleText,
      captureNotes: [
        firstTimeCalibration
          ? "First-time setup test: ran the DeepSeek Web adapter path without saving a new reusable template."
          : "Used approved DeepSeek Web adapter template.",
        "Scoped the answer to the current user turn using the visible prompt boundary.",
        "Transient thinking/status is not claimed unless still visible in the final DOM snapshot.",
      ],
      adapterInfo: {
        providerId: "deepseek_web",
        providerName: "DeepSeek Web",
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

const genericWebChatAdapter = {
  providerId: "generic_web_chat",
  providerName: "Generic Web Chat",
  capture({ snapshot, caseId, turnIndex, userMessage, nextUserMessage = "", firstTimeCalibration = false, builderOutput = {} }) {
    const rawVisibleText = String(snapshot.rawVisibleText || "");
    const scopedVisibleText = scopeVisibleTextToCurrentTurn(rawVisibleText, userMessage, nextUserMessage);
    const candidateContainers = Array.isArray(snapshot.candidateMessageContainers) ? snapshot.candidateMessageContainers : [];
    const answerContainers = deriveGenericAnswerContainers(candidateContainers, userMessage, nextUserMessage);
    const riskNotices = extractGenericRiskNotices(scopedVisibleText, rawVisibleText);
    const followupSuggestions = extractGenericFollowupSuggestions(scopedVisibleText, snapshot.buttons || []);
    const referenceMaterials = extractGenericReferenceMaterials({
      snapshot,
      scopedVisibleText,
      builderOutput,
    });
    const visibleProcessNotes = extractGenericVisibleProcessNotes(scopedVisibleText);
    const finalAnswer = extractGenericFinalAnswer({
      scopedVisibleText,
      answerContainers,
      userMessage,
      riskNotices,
      followupSuggestions,
      visibleProcessNotes,
    });
    const qaResult = qaGenericCapture({
      rawVisibleText,
      scopedVisibleText,
      expectedUserMessage: userMessage,
      finalAnswer,
      answerContainers,
    });
    return {
      captureId: buildId("capture"),
      provider: "generic_web_chat",
      side: "challenger",
      caseId,
      turnIndex,
      capturedAt: new Date().toISOString(),
      url: snapshot.url,
      title: snapshot.title,
      userMessage,
      finalAnswer,
      visibleProcessNotes,
      intentExpansionQueries: [],
      referenceMaterials,
      riskNotices,
      followupSuggestions,
      sourceNotes: formatReferenceMaterials(referenceMaterials),
      toolcallNotes: "No structured tool-call trace was visible in the final generic web DOM.",
      evidenceLevel: referenceMaterials.length ? "L2" : "L1",
      rawVisibleText,
      scopedVisibleText,
      captureNotes: [
        firstTimeCalibration
          ? "First-time setup test: SBS used the generic web-chat adapter as a conservative fallback."
          : "Used generic web-chat adapter fallback after builder-approved structural understanding.",
        "Current turn was scoped using visible prompt boundaries plus candidate message containers.",
        ...stringArray(builderOutput.reconRetryAdvice).map((item) => `Builder recon advice: ${item}`),
      ],
      adapterInfo: {
        providerId: String(builderOutput.providerId || "generic_web_chat").trim() || "generic_web_chat",
        providerName: String(builderOutput.providerName || snapshot.title || "Generic Web Chat").trim() || "Generic Web Chat",
        status: qaResult.ok ? "partial" : "blocked",
        templateSource: firstTimeCalibration ? "first_time_setup_test" : "local_codex_builder",
        requiresHumanReview: true,
        doNotPersist: Boolean(firstTimeCalibration),
        urlPatterns: Array.isArray(builderOutput.urlPatterns) ? builderOutput.urlPatterns : [],
      },
      qaResult,
      snapshotArtifactRef: snapshot.artifactRef,
    };
  },
};

function buildReconConfig(output = {}) {
  const selectorHints = output.selectorHints && typeof output.selectorHints === "object" ? output.selectorHints : {};
  const snapshotRequirements =
    output.snapshotRequirements && typeof output.snapshotRequirements === "object" ? output.snapshotRequirements : {};
  return {
    selectorHints,
    snapshotRequirements,
    turnBoundaryPlan: output.turnBoundaryPlan && typeof output.turnBoundaryPlan === "object" ? output.turnBoundaryPlan : {},
    providerUiPatterns: output.providerUiPatterns && typeof output.providerUiPatterns === "object" ? output.providerUiPatterns : {},
  };
}

function shouldRetryRefinedSnapshot(snapshot, reconConfig = {}) {
  const hasHints = Object.values(reconConfig.selectorHints || {}).some((value) => Array.isArray(value) && value.length);
  const hasRequirements = Object.keys(reconConfig.snapshotRequirements || {}).length > 0;
  const weakMessageStructure =
    !Array.isArray(snapshot.messageItems) ||
    snapshot.messageItems.length === 0 ||
    !Array.isArray(snapshot.candidateMessageContainers) ||
    snapshot.candidateMessageContainers.length < 2;
  return (hasHints || hasRequirements) && weakMessageStructure;
}

function snapshotImproved(previousSnapshot, nextSnapshot) {
  const previousMessages = Array.isArray(previousSnapshot?.messageItems) ? previousSnapshot.messageItems.length : 0;
  const nextMessages = Array.isArray(nextSnapshot?.messageItems) ? nextSnapshot.messageItems.length : 0;
  const previousCandidates = Array.isArray(previousSnapshot?.candidateMessageContainers)
    ? previousSnapshot.candidateMessageContainers.length
    : 0;
  const nextCandidates = Array.isArray(nextSnapshot?.candidateMessageContainers)
    ? nextSnapshot.candidateMessageContainers.length
    : 0;
  return nextMessages > previousMessages || nextCandidates > previousCandidates;
}

function deriveGenericAnswerContainers(candidateContainers = [], userMessage = "", nextUserMessage = "") {
  const items = Array.isArray(candidateContainers) ? [...candidateContainers] : [];
  const sorted = items.sort((a, b) => (a.rect?.y || 0) - (b.rect?.y || 0));
  const normalizedUser = normalizeText(userMessage);
  const normalizedNextUser = normalizeText(nextUserMessage);
  let userIndex = -1;
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    const text = normalizeText(sorted[i].text || "");
    if (!text) continue;
    if (normalizedUser && (text.includes(normalizedUser) || normalizedUser.includes(text))) {
      userIndex = i;
      break;
    }
  }
  const scoped = [];
  for (let i = userIndex >= 0 ? userIndex + 1 : 0; i < sorted.length; i += 1) {
    const item = sorted[i];
    const text = normalizeText(item.text || "");
    if (!text) continue;
    if (normalizedNextUser && i > userIndex && (text.includes(normalizedNextUser) || normalizedNextUser.includes(text))) break;
    if (item.roleHint === "user" && i > userIndex) break;
    if (item.roleHint === "assistant" || item.score >= 6) scoped.push(item);
  }
  return scoped.slice(0, 12);
}

function extractGenericRiskNotices(scopedVisibleText, rawVisibleText = "") {
  return unique(
    [...splitVisibleLines(scopedVisibleText), ...splitVisibleLines(rawVisibleText)].filter((line) =>
      /本回答由 AI 生成|内容由 AI 生成|仅供参考|请仔细甄别|请核实|AI 生成|verify|double-check/i.test(line),
    ),
  );
}

function extractGenericFollowupSuggestions(scopedVisibleText, buttons = []) {
  const lineSuggestions = splitVisibleLines(scopedVisibleText)
    .filter((line) => /[？?]$/.test(line) && line.length >= 6 && line.length <= 100)
    .slice(-6);
  const buttonSuggestions = (Array.isArray(buttons) ? buttons : [])
    .map((item) => String(item.text || item.title || item.ariaLabel || "").trim())
    .filter((text) => text && text.length >= 4 && text.length <= 100)
    .filter((text) => /[？?]$/.test(text) || /继续|更多|查看|了解|推荐|方案|步骤/.test(text));
  return unique([...lineSuggestions, ...buttonSuggestions]).slice(0, 8);
}

function extractGenericReferenceMaterials({ snapshot, scopedVisibleText = "", builderOutput = {} } = {}) {
  const anchors = Array.isArray(snapshot?.anchors) ? snapshot.anchors : [];
  const candidateContainers = Array.isArray(snapshot?.candidateMessageContainers) ? snapshot.candidateMessageContainers : [];
  const selectorHints = builderOutput?.selectorHints && typeof builderOutput.selectorHints === "object"
    ? builderOutput.selectorHints
    : {};
  const sourceCardSelectors = []
    .concat(selectorHints.sourceCards?.selectors || [])
    .map((item) => String(item || "").trim())
    .filter(Boolean);
  const inlineCitationSelectors = []
    .concat(selectorHints.inlineCitations?.selectors || [])
    .map((item) => String(item || "").trim())
    .filter(Boolean);

  const materials = [];
  const seen = new Set();
  const push = (item) => {
    const normalized = {
      rank: Number.isFinite(item.rank) ? item.rank : undefined,
      title: String(item.title || "").trim(),
      href: String(item.href || "").trim(),
      sourceName: String(item.sourceName || "").trim(),
      snippet: String(item.snippet || "").trim(),
      date: String(item.date || "").trim(),
      type: String(item.type || "").trim() || "visible_reference",
    };
    if (!normalized.title && !normalized.href) return;
    const key = `${normalized.type}|${normalized.rank || ""}|${normalized.title}|${normalized.href}`;
    if (seen.has(key)) return;
    seen.add(key);
    materials.push(normalized);
  };

  const sourceCards = parseVisibleSourceCardsFromContainers(candidateContainers, anchors, sourceCardSelectors);
  sourceCards.forEach(push);

  const inlineCitations = parseInlineCitationsFromAnchors(anchors, inlineCitationSelectors);
  inlineCitations.forEach(push);

  if (!materials.length) {
    for (const [index, item] of anchors.entries()) {
      const title = String(item.text || "").trim();
      const href = String(item.href || "").trim();
      if (!title && !href) continue;
      if (title.length < 3 && !href) continue;
      if (/^(新对话|历史|登录|注册|帮助|复制|重试)$/.test(title)) continue;
      if (/chat\.deepseek\.com\/a\/chat\/s\//.test(href)) continue;
      push({
        rank: index + 1,
        title: title || href,
        href,
        sourceName: "",
        type: href ? "url_citation" : "visible_reference",
      });
    }
  }

  if (!materials.length) {
    const match = scopedVisibleText.match(/已阅读\s*(\d+)\s*个网页/);
    if (match) {
      push({
        title: `已阅读 ${match[1]} 个网页`,
        sourceName: "visible source summary",
        href: "",
        type: "visible_search_summary",
      });
    }
  }

  return materials.slice(0, 20);
}

function parseVisibleSourceCardsFromContainers(candidateContainers = [], anchors = [], sourceCardSelectors = []) {
  const cards = [];
  const selectorTokens = sourceCardSelectors
    .map((selector) => selector.replace(/^[a-z]+\./i, "").replace(/^\./, "").trim())
    .filter(Boolean);
  const containers = candidateContainers
    .filter((item) => {
      const className = String(item.className || "");
      const text = String(item.text || "");
      const bySelector = selectorTokens.some((token) => className.includes(token));
      const byText = /搜索结果|新浪网|TrendForce|Market Research Reports|数字储能网|手机搜狐网|中国储能网|台州新闻/.test(text);
      return bySelector || byText;
    })
    .sort((a, b) => (a.rect?.y || 0) - (b.rect?.y || 0) || (a.rect?.x || 0) - (b.rect?.x || 0));

  for (const container of containers) {
    const lines = splitVisibleLines(container.text || "");
    if (lines.length < 4) continue;
    const first = lines[0] || "";
    const second = lines[1] || "";
    const third = lines[2] || "";
    const date = /^\d{4}\/\d{2}\/\d{2}$/.test(second) ? second : "";
    const rank = /^\d+$/.test(third) ? Number(third) : undefined;
    const titleIndex = date ? 3 : 1;
    const title = lines[titleIndex] || "";
    const snippet = lines.slice(titleIndex + 1).join(" ").trim();
    const href = inferHrefFromSourceCard({ sourceName: first, title, snippet, anchors });
    cards.push({
      rank,
      sourceName: first,
      date,
      title,
      snippet,
      href,
      type: "search_result",
    });
  }
  return cards;
}

function inferHrefFromSourceCard({ sourceName = "", title = "", snippet = "", anchors = [] } = {}) {
  const normalizedTitle = normalizeText(title);
  const normalizedSource = normalizeText(sourceName);
  const normalizedSnippet = normalizeText(snippet).slice(0, 80);
  for (const anchor of anchors) {
    const text = String(anchor.text || "").trim();
    const href = String(anchor.href || "").trim();
    if (!href || /chat\.deepseek\.com\/a\/chat\/s\//.test(href)) continue;
    const normalizedAnchor = normalizeText(text);
    if (normalizedTitle && (normalizedAnchor.includes(normalizedTitle) || normalizedTitle.includes(normalizedAnchor))) {
      return href;
    }
    if (normalizedSource && normalizedAnchor.includes(normalizedSource) && normalizedSnippet && normalizedAnchor.includes(normalizedSnippet)) {
      return href;
    }
  }
  return "";
}

function parseInlineCitationsFromAnchors(anchors = [], inlineCitationSelectors = []) {
  const hintsExist = inlineCitationSelectors.length > 0;
  return anchors
    .map((item) => {
      const title = String(item.text || "").trim();
      const href = String(item.href || "").trim();
      const isInline = /^-\s*\d+$/.test(title.replace(/\n/g, " ").trim());
      if (!href || !isInline) return null;
      return {
        title: title.replace(/\s+/g, " ").trim(),
        href,
        sourceName: "",
        type: hintsExist ? "inline_citation" : "url_citation",
      };
    })
    .filter(Boolean);
}

function extractGenericVisibleProcessNotes(scopedVisibleText = "") {
  return splitVisibleLines(scopedVisibleText)
    .filter((line) => /已阅读\s*\d+\s*个网页|搜索|思考|推理|检索|分析中|联网|正在/.test(line))
    .slice(0, 8)
    .join("\n");
}

function extractGenericFinalAnswer({ scopedVisibleText, answerContainers, userMessage, riskNotices, followupSuggestions, visibleProcessNotes }) {
  const blocked = new Set([
    ...riskNotices,
    ...followupSuggestions,
    ...splitVisibleLines(visibleProcessNotes || ""),
  ]);
  const containerText = answerContainers
    .map((item) => String(item.text || "").trim())
    .filter(Boolean)
    .filter((text) => !blocked.has(text))
    .join("\n\n")
    .trim();
  if (containerText.length >= 120) return trimLongText(containerText, 20000);

  const lines = splitVisibleLines(scopedVisibleText);
  const userIndex = findUserMessageIndex(lines, userMessage);
  const candidates = userIndex >= 0 ? lines.slice(userIndex + 1) : lines;
  const answerLines = [];
  for (const line of candidates) {
    if (!line || blocked.has(line)) continue;
    if (/^(开启新对话|今天|快速模式|历史对话|搜索|深度思考|智能搜索)$/.test(line)) continue;
    if (/^已阅读\s*\d+\s*个网页$/.test(line)) continue;
    answerLines.push(line);
  }
  return trimLongText(answerLines.join("\n"), 20000);
}

function qaGenericCapture({ rawVisibleText, scopedVisibleText, expectedUserMessage, finalAnswer, answerContainers }) {
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
  const visibleUserMessage = normalizeText(scopedVisibleText).includes(normalizeText(expectedUserMessage || ""));
  if (!expectedUserMessage || visibleUserMessage) {
    result.fieldResults.userMessage = "pass";
  } else {
    fail("userMessage", "fail_wrong_turn", "Captured page does not visibly contain the expected current-turn user prompt.");
  }
  if (!finalAnswer || finalAnswer.length < 80) {
    fail("finalAnswer", "fail_empty", "Generic adapter could not isolate a strong final answer.");
  } else if (/^(开启新对话|今天|历史对话)/.test(finalAnswer)) {
    fail("finalAnswer", "fail_polluted", "Generic adapter final answer still contains obvious navigation text.");
  } else {
    result.fieldResults.finalAnswer = "pass";
  }
  result.fieldResults.messageContainers = Array.isArray(answerContainers) && answerContainers.length ? "pass" : "low_confidence";
  result.fieldResults.referenceMaterials = /已阅读\s*\d+\s*个网页/.test(rawVisibleText) ? "pass" : "unsupported";
  result.fieldResults.followupSuggestions = "unsupported";
  result.fieldResults.visibleProcessNotes = "best_effort";
  result.fieldResults.toolcallNotes = "pass";
  if (result.blockingIssues.length) {
    result.developerInstructions.push("Retry after keeping the active answer centered in view, or fall back to manual paste if the site does not expose stable turn containers.");
  } else {
    result.ok = true;
    result.adapterReadiness = "partial";
    if (!Array.isArray(answerContainers) || !answerContainers.length) {
      result.warnings.push("Generic adapter succeeded via visible-text scoping but did not recover stable answer containers.");
    }
  }
  return result;
}

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

async function captureCurrentChromeSnapshot({ userMessage, nextUserMessage, reconConfig = null }) {
  mkdirSync(artifactDir, { recursive: true });
  const js = buildSnapshotJs({ userMessage, nextUserMessage, reconConfig });
  const dir = mkdtempSync(path.join(tmpdir(), "sbs-web-adapter-snapshot-"));
  const jsPath = path.join(dir, "snapshot.js");
  writeFileSync(jsPath, js, "utf8");
  let snapshot = runChromeJavascriptFile(jsPath);
  const expansionResult = tryExpandVisibleEvidence();
  if (expansionResult.expanded) {
    snapshot = runChromeJavascriptFile(jsPath);
  }
  snapshot.caseContext = { userMessage: String(userMessage || ""), nextUserMessage: String(nextUserMessage || "") };
  snapshot.currentTurnVisibleTextCandidate = scopeVisibleTextToCurrentTurn(
    snapshot.rawVisibleText,
    snapshot.caseContext.userMessage,
    snapshot.caseContext.nextUserMessage,
  );
  snapshot.reconMetadata = {
    ...(snapshot.reconMetadata || {}),
    visibleEvidenceExpansion: expansionResult,
  };
  const stamp = new Date().toISOString().replaceAll(":", "").replaceAll(".", "");
  const host = snapshot.host || "unknown-host";
  const outPath = path.join(artifactDir, `${stamp}-${host}-adapter-snapshot.json`);
  writeFileSync(outPath, JSON.stringify(snapshot, null, 2), "utf8");
  snapshot.artifactRef = path.relative(rootDir, outPath);
  return snapshot;
}

function runChromeJavascriptFile(jsPath) {
  const appleScript = `
set jsPath to POSIX file "${jsPath}"
set snapshotCode to read jsPath as «class utf8»
tell application "Google Chrome"
  if not (exists front window) then error "Google Chrome has no front window."
  set activeTab to active tab of front window
  return execute activeTab javascript snapshotCode
end tell
`;
  const stdout = execFileSync("osascript", ["-e", appleScript], {
    encoding: "utf8",
    timeout: 15000,
    maxBuffer: APPLESCRIPT_MAX_BUFFER,
  });
  return JSON.parse(stdout);
}

function tryExpandVisibleEvidence() {
  const expandJs = `
(() => {
  function clean(value) {
    return String(value || "").replace(/\\s+/g, " ").trim();
  }
  function visible(node) {
    if (!node) return false;
    var style = window.getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity || 1) === 0) return false;
    var rect = node.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }
  function classText(node) {
    return String(node && node.className || "");
  }
  function isSafeEvidenceTrigger(node, text) {
    var tag = String(node && node.tagName || "").toUpperCase();
    var role = String(node && typeof node.getAttribute === "function" ? (node.getAttribute("role") || "") : "").toLowerCase();
    var lowerClass = classText(node).toLowerCase();
    var lowerText = text.toLowerCase();
    var interactive = tag === "BUTTON" || tag === "A" || role === "button";
    if (!interactive) return false;
    var classHint = /cite|citation|source|reference|ref|drawer|popover|tooltip|link|button|trigger/.test(lowerClass);
    var textHint = /^(参考\\s*\\d+\\s*篇资料|参考资料|引用|来源|已阅读\\s*\\d+\\s*个网页|\\d+\\s*篇资料|\\d+\\s*个网页)$/.test(text) || /展开来源|查看来源|查看引用/.test(lowerText);
    return classHint || textHint;
  }
  var nodes = Array.prototype.slice.call(document.querySelectorAll("button, [role='button'], a"));
  for (var i = 0; i < nodes.length; i += 1) {
    var node = nodes[i];
    if (!visible(node)) continue;
    var text = clean(node.innerText || node.textContent || "");
    if (!text || text.length > 40) continue;
    if (!isSafeEvidenceTrigger(node, text)) continue;
    try {
      node.click();
      return JSON.stringify({ expanded: true, matchedText: text });
    } catch (error) {
      return JSON.stringify({ expanded: false, matchedText: text, error: String(error && error.message || error || "") });
    }
  }
  return JSON.stringify({ expanded: false, matchedText: "" });
})()
`;
  const appleScript = `
tell application "Google Chrome"
  if not (exists front window) then error "Google Chrome has no front window."
  set activeTab to active tab of front window
  return execute activeTab javascript ${JSON.stringify(expandJs)}
end tell
`;
  try {
    const stdout = execFileSync("osascript", ["-e", appleScript], {
      encoding: "utf8",
      timeout: 5000,
      maxBuffer: APPLESCRIPT_MAX_BUFFER,
    });
    return JSON.parse(stdout);
  } catch {
    return { expanded: false, matchedText: "", error: "visible_evidence_expansion_failed" };
  }
}

function extractDeepseekVisibleProcessNotes(scopedVisibleText) {
  const lines = splitVisibleLines(scopedVisibleText);
  const matches = [];
  for (const line of lines) {
    if (/^已阅读\s*\d+\s*个网页$/.test(line) || /^深度思考$/.test(line) || /^智能搜索$/.test(line)) {
      matches.push(line);
    }
  }
  return matches.join("\n");
}

function extractDeepseekRiskNotices(scopedVisibleText, rawVisibleText = "") {
  return unique(
    [...splitVisibleLines(scopedVisibleText), ...splitVisibleLines(rawVisibleText)].filter((line) =>
      /本回答由 AI 生成|内容由 AI 生成|仅供参考|请仔细甄别|请核实/.test(line),
    ),
  );
}

function extractDeepseekAnswerContainers(snapshot, userMessage, nextUserMessage = "") {
  const markdownNodes = Array.isArray(snapshot?.descendantMarkdownNodes) ? snapshot.descendantMarkdownNodes : [];
  const topLevelAssistantNodes = markdownNodes
    .filter((item) => String(item.className || "").includes("ds-assistant-message-main-content"))
    .sort((a, b) => (a.rect?.y || 0) - (b.rect?.y || 0));
  if (topLevelAssistantNodes.length) return topLevelAssistantNodes.slice(-1);

  const candidateContainers = Array.isArray(snapshot?.candidateMessageContainers) ? snapshot.candidateMessageContainers : [];
  const assistantContainers = candidateContainers
    .filter((item) => item.roleHint === "assistant" || String(item.className || "").includes("assistant"))
    .sort((a, b) => (a.rect?.y || 0) - (b.rect?.y || 0));
  if (assistantContainers.length) return assistantContainers.slice(-1);

  return deriveGenericAnswerContainers(candidateContainers, userMessage, nextUserMessage).slice(-1);
}

function extractDeepseekReferenceMaterials(snapshot, scopedVisibleText) {
  const materials = extractGenericReferenceMaterials({
    snapshot,
    scopedVisibleText,
    builderOutput: {
      selectorHints: {
        sourceCards: {
          selectors: [".c64652fe", "div.c2da4a0a", "[class*='source']", "[class*='reference']"],
        },
        inlineCitations: {
          selectors: [".ds-markdown-cite", "[class*='cite']", "[class*='citation']"],
        },
      },
    },
  });
  if (materials.length) return materials;
  const matches = [];
  const countMatch = scopedVisibleText.match(/已阅读\s*(\d+)\s*个网页/);
  if (countMatch) {
    matches.push({
      title: `已阅读 ${countMatch[1]} 个网页`,
      sourceName: "DeepSeek visible search summary",
      href: "",
      type: "visible_search_summary",
    });
  }
  return matches;
}

function extractDeepseekFollowupSuggestions(scopedVisibleText, buttons = []) {
  const lineSuggestions = splitVisibleLines(scopedVisibleText)
    .filter((line) => /[？?]$/.test(line) && line.length >= 6 && line.length <= 90)
    .filter((line) => !normalizeText(line).includes(normalizeText("本回答由AI生成")))
    .slice(-6);
  const buttonSuggestions = (Array.isArray(buttons) ? buttons : [])
    .map((item) => String(item.text || item.title || item.ariaLabel || "").trim())
    .filter((text) => text && text.length >= 4 && text.length <= 100)
    .filter((text) => /[？?]$/.test(text) || /更多|延伸|推荐|如何|怎么|哪些|下一步/.test(text));
  return unique([...lineSuggestions, ...buttonSuggestions]).slice(0, 8);
}

function extractDeepseekFinalAnswer(scopedVisibleText, userMessage, answerContainers = [], artifacts = {}) {
  const scopedAnswer = extractAnswerFromScopedVisibleText(scopedVisibleText, userMessage, artifacts);
  if (scopedAnswer.length >= 120) return trimLongText(scopedAnswer, 20000);

  const containerText = (Array.isArray(answerContainers) ? answerContainers : [])
    .map((item) => String(item.text || "").trim())
    .filter(Boolean)
    .join("\n\n")
    .trim();
  if (containerText.length >= 120) return trimLongText(containerText, 20000);

  return trimLongText(scopedAnswer, 20000);
}

function extractAnswerFromScopedVisibleText(scopedVisibleText, userMessage, artifacts = {}) {
  const lines = splitVisibleLines(scopedVisibleText);
  const userIndex = findUserMessageIndex(lines, userMessage);
  if (userMessage && userIndex < 0) return "";
  const candidates = userIndex >= 0 ? lines.slice(userIndex + 1) : lines;
  const blocked = new Set([
    ...(artifacts.riskNotices || []),
    ...(artifacts.followupSuggestions || []),
    ...splitVisibleLines(artifacts.visibleProcessNotes || ""),
  ]);
  const answerLines = [];
  for (const line of candidates) {
    if (!line || blocked.has(line)) continue;
    if (/^已阅读\s*\d+\s*个网页$/.test(line)) continue;
    if (/^本回答由 AI 生成/.test(line)) break;
    if (/^内容由 AI 生成/.test(line)) break;
    if (/^深度思考$/.test(line) || /^智能搜索$/.test(line)) continue;
    if (/^(开启新对话|今天|快速模式)$/.test(line)) continue;
    if (/^\d{4}-\d{2}$/.test(line)) continue;
    if (/^\d+$/.test(line)) continue;
    if (/^-$/.test(line)) continue;
    answerLines.push(line);
  }
  return answerLines.join("\n").trim();
}

function qaDeepseekCapture({ rawVisibleText, scopedVisibleText, expectedUserMessage, finalAnswer }) {
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
  const visibleUserMessage = normalizeText(scopedVisibleText).includes(normalizeText(expectedUserMessage || ""));
  if (!expectedUserMessage || visibleUserMessage) {
    result.fieldResults.userMessage = "pass";
  } else {
    fail("userMessage", "fail_wrong_turn", "Captured page does not visibly contain the expected current-turn user prompt.");
  }
  if (!finalAnswer || finalAnswer.length < 120) {
    fail("finalAnswer", "fail_empty", "Final answer is missing or too short.");
  } else if (/^(开启新对话|今天|快速模式)/.test(finalAnswer) || finalAnswer.includes("本回答由 AI 生成")) {
    fail("finalAnswer", "fail_polluted", "Final answer still contains non-answer UI text.");
  } else {
    result.fieldResults.finalAnswer = "pass";
  }
  result.fieldResults.referenceMaterials = /已阅读\s*\d+\s*个网页/.test(rawVisibleText) ? "pass" : "unsupported";
  result.fieldResults.riskNotices = /本回答由 AI 生成|内容由 AI 生成/.test(rawVisibleText) ? "pass" : "unsupported";
  result.fieldResults.followupSuggestions = "unsupported";
  result.fieldResults.intentExpansionQueries = "unsupported";
  result.fieldResults.visibleProcessNotes = "pass";
  result.fieldResults.toolcallNotes = "pass";
  if (result.blockingIssues.length) {
    result.developerInstructions.push("If the visible page still contains a lot of history or sidebar text, keep the target conversation open and retry after scrolling the current answer fully into view.");
  } else {
    result.ok = true;
    result.adapterReadiness = "ready";
  }
  return result;
}

function trimLongText(value, limit = 20000) {
  return String(value || "").trim().slice(0, limit);
}

function buildSnapshotJs({ userMessage = "", nextUserMessage = "", reconConfig = null } = {}) {
  const payload = JSON.stringify({
    userMessage: String(userMessage || ""),
    nextUserMessage: String(nextUserMessage || ""),
    reconConfig: reconConfig || {},
  });
  return `(() => {
  const input = ${payload};
  const reconConfig = input.reconConfig || {};
  const selectorHints = reconConfig.selectorHints || {};
  const snapshotRequirements = reconConfig.snapshotRequirements || {};
  const clean = (value) => String(value || "").replace(/\\s+\\n/g, "\\n").replace(/\\n\\s+/g, "\\n").trim();
  const nodeText = (node) => clean(node && (node.innerText || node.textContent) || "");
  const classText = (node) => String(node && node.className || "");
  const normalize = (value) => String(value || "").replace(/\\s+/g, "");
  const visible = (node) => {
    if (!node) return false;
    const style = window.getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity || 1) === 0) return false;
    const rect = node.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };
  const safeSelectors = (value) => Array.isArray(value) ? value.map((item) => String(item || "").trim()).filter(Boolean) : [];
  const queryMany = (selectors) => {
    const nodes = [];
    for (const selector of selectors) {
      try {
        nodes.push(...document.querySelectorAll(selector));
      } catch {
        // ignore invalid selector hints
      }
    }
    return nodes;
  };
  const uniqueNodes = (nodes) => {
    const seen = new Set();
    return nodes.filter((node) => {
      if (!node || seen.has(node)) return false;
      seen.add(node);
      return true;
    });
  };
  const all = Array.from(document.querySelectorAll("body *"));
  const explicitMessageSelectors = [".user-message-item", ".assistant-message-item"];
  const userSelectors = safeSelectors(selectorHints.userMessage);
  const assistantSelectors = safeSelectors(selectorHints.assistantMessage);
  const sharedSelectors = safeSelectors(selectorHints.messageContainer);
  const explicitMessageNodes = uniqueNodes(queryMany([...explicitMessageSelectors, ...userSelectors, ...assistantSelectors, ...sharedSelectors]));
  const inferRole = (node) => {
    const attrText = [
      classText(node),
      node && typeof node.getAttribute === "function" ? (node.getAttribute("data-role") || "") : "",
      node && typeof node.getAttribute === "function" ? (node.getAttribute("role") || "") : "",
      node && typeof node.getAttribute === "function" ? (node.getAttribute("aria-label") || "") : "",
      node && typeof node.getAttribute === "function" ? (node.getAttribute("data-testid") || "") : "",
    ].join(" ").toLowerCase();
    const text = nodeText(node);
    if (/user-message-item|\\buser\\b|\\bhuman\\b|query|question|prompt/.test(attrText)) return "user";
    if (/assistant-message-item|assistant|answer|response|markdown|bot|result/.test(attrText)) return "assistant";
    const normalizedText = normalize(text);
    if (input.userMessage && normalizedText.includes(normalize(input.userMessage))) return "user";
    return "unknown";
  };
  const scoreCandidate = (node, text, roleHint) => {
    let score = 0;
    const dataTestId = node && typeof node.getAttribute === "function" ? (node.getAttribute("data-testid") || "") : "";
    const role = node && typeof node.getAttribute === "function" ? (node.getAttribute("role") || "") : "";
    const lower = [classText(node), dataTestId, role].join(" ").toLowerCase();
    if (/message|chat|answer|response|bubble|markdown|content|query/.test(lower)) score += 3;
    if (roleHint === "assistant" || roleHint === "user") score += 2;
    if (node.querySelector && node.querySelector("a")) score += 1;
    if (node.querySelector && node.querySelector("button, [role='button']")) score += 1;
    if (node.querySelector && node.querySelector("[class*='markdown'], article, pre, code")) score += 2;
    if (text.length >= 40) score += 2;
    if (text.length >= 120) score += 1;
    return score;
  };
  const cloneWithoutKnownNoise = (node) => {
    const clone = node.cloneNode(true);
    clone.querySelectorAll(".message-card__featured-note, [class*='featured-note']").forEach((item) => item.remove());
    return clone;
  };
  const messageItems = explicitMessageNodes.map((node, index) => {
    const clone = cloneWithoutKnownNoise(node);
    const inlineQuotes = Array.from(node.querySelectorAll(".cite-tag, .cite-tag-text, [class*='cite-tag']"))
      .map((item) => nodeText(item))
      .filter(Boolean);
    const className = classText(node);
    const role = /user-message-item/.test(className) ? "user" : /assistant-message-item/.test(className) ? "assistant" : inferRole(node);
    const text = nodeText(node);
    return {
      index,
      role,
      className: className.slice(0, 180),
      text,
      answerText: nodeText(clone),
      isFeaturedNote: Boolean(node.querySelector(".message-card__featured-note, [class*='featured-note']")),
      inlineQuotes,
    };
  }).filter((item) => item.text);
  const genericCandidates = all
    .filter(visible)
    .map((node, index) => {
      const text = nodeText(node);
      if (!text || text.length < 8 || text.length > 2200) return null;
      const rect = node.getBoundingClientRect();
      const roleHint = inferRole(node);
      const score = scoreCandidate(node, text, roleHint);
      if (score < 4) return null;
      return {
        index,
        tag: node.tagName,
        roleHint,
        className: classText(node).slice(0, 180),
        text: text.slice(0, 1200),
        score,
        rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
      };
    })
    .filter(Boolean)
    .sort((a, b) => (a.rect.y - b.rect.y) || (a.rect.x - b.rect.x) || (b.score - a.score))
    .slice(0, snapshotRequirements.needMessageContainers === false ? 24 : 48);
  const descendantMarkdownNodes = all
    .filter(visible)
    .filter((node) => {
      const className = classText(node).toLowerCase();
      if (node.matches && node.matches("article, markdown, pre, code, blockquote")) return true;
      return /markdown|prose|answer|response|content|article/.test(className);
    })
    .map((node, index) => {
      const text = nodeText(node);
      if (!text || text.length < 8 || text.length > 2400) return null;
      const rect = node.getBoundingClientRect();
      return {
        index,
        tag: node.tagName,
        className: classText(node).slice(0, 180),
        text: text.slice(0, 1200),
        rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
      };
    })
    .filter(Boolean)
    .slice(0, 36);
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
  const visibleLines = String(document.body ? document.body.innerText : "").split("\\n").map((line) => clean(line)).filter(Boolean);
  const expectedUser = normalize(input.userMessage);
  const expectedNextUser = normalize(input.nextUserMessage);
  const turnBoundaryCandidates = visibleLines
    .map((line, index) => ({ index, line, normalized: normalize(line) }))
    .filter((item) => {
      if (!item.normalized) return false;
      if (expectedUser && (item.normalized.includes(expectedUser) || expectedUser.includes(item.normalized))) return true;
      if (expectedNextUser && (item.normalized.includes(expectedNextUser) || expectedNextUser.includes(item.normalized))) return true;
      return false;
    })
    .slice(0, 20)
    .map(({ index, line }) => ({ index, line }));
  return JSON.stringify({
    capturedAt: new Date().toISOString(),
    url: location.href,
    host: location.hostname.replace(/[^a-z0-9.-]+/gi, "_"),
    title: document.title,
    rawVisibleText: document.body ? document.body.innerText : "",
    messageItems,
    candidateMessageContainers: genericCandidates,
    descendantMarkdownNodes,
    turnBoundaryCandidates,
    domSummary,
    anchors: Array.from(document.querySelectorAll("a")).map((a) => ({ text: nodeText(a), href: a.href || "" })).filter((item) => item.text || item.href).slice(0, 120),
    buttons: Array.from(document.querySelectorAll("button, [role='button']")).map((button) => ({ text: nodeText(button), title: button.getAttribute("title") || "", ariaLabel: button.getAttribute("aria-label") || "" })).filter((item) => item.text || item.title || item.ariaLabel).slice(0, 120),
    reconMetadata: {
      selectorHintsApplied: selectorHints,
      snapshotRequirementsApplied: snapshotRequirements
    }
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

function scopeVisibleTextToCurrentTurn(rawVisibleText, userMessage, nextUserMessage = "") {
  const lines = splitVisibleLines(rawVisibleText);
  const userIndex = findUserMessageIndexForScope(lines, userMessage, nextUserMessage);
  if (userIndex < 0) return rawVisibleText;
  let endIndex = lines.length;
  const nextUserIndex = nextUserMessage ? findUserMessageIndex(lines.slice(userIndex + 1), nextUserMessage) : -1;
  if (nextUserIndex >= 0) {
    endIndex = userIndex + 1 + nextUserIndex;
  }
  const repeatedUserIndex = findUserMessageIndex(lines.slice(userIndex + 1), userMessage);
  if (repeatedUserIndex >= 0) {
    endIndex = Math.min(endIndex, userIndex + 1 + repeatedUserIndex);
  }
  return lines.slice(userIndex, endIndex).join("\n");
}

function splitVisibleLines(value) {
  return String(value || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function findUserMessageIndex(lines, userMessage) {
  const normalized = normalizeText(userMessage);
  if (!normalized) return -1;
  let bestIndex = -1;
  let bestScore = 0;
  lines.forEach((line, index) => {
    const candidate = normalizeText(line);
    if (!candidate) return;
    const score =
      candidate.includes(normalized) || normalized.includes(candidate)
        ? Math.min(candidate.length, normalized.length)
        : 0;
    if (score > bestScore || (score === bestScore && score > 0 && index > bestIndex)) {
      bestScore = score;
      bestIndex = index;
    }
  });
  return bestScore >= Math.min(20, normalized.length) ? bestIndex : -1;
}

function findUserMessageIndexForScope(lines, userMessage, nextUserMessage = "") {
  const normalized = normalizeText(userMessage);
  if (!normalized) return -1;
  const matches = [];
  lines.forEach((line, index) => {
    const candidate = normalizeText(line);
    if (!candidate) return;
    const score =
      candidate.includes(normalized) || normalized.includes(candidate)
        ? Math.min(candidate.length, normalized.length)
        : 0;
    if (score >= Math.min(20, normalized.length)) matches.push(index);
  });
  if (!matches.length) return -1;

  for (let i = matches.length - 1; i >= 0; i -= 1) {
    const start = matches[i];
    const nextSame = matches.find((index) => index > start) ?? lines.length;
    const nextExplicit = nextUserMessage ? findUserMessageIndex(lines.slice(start + 1), nextUserMessage) : -1;
    const end = nextExplicit >= 0 ? Math.min(nextSame, start + 1 + nextExplicit) : nextSame;
    if (hasSubstantialFollowingAnswer(lines.slice(start + 1, end))) return start;
  }
  return matches[matches.length - 1];
}

function hasSubstantialFollowingAnswer(lines) {
  const text = lines
    .filter((line) => {
      if (!line) return false;
      if (/^(开启新对话|今天|快速模式)$/.test(line)) return false;
      if (/^\d{4}-\d{2}$/.test(line)) return false;
      if (/^本回答由 AI 生成/.test(line) || /^内容由 AI 生成/.test(line)) return false;
      return true;
    })
    .join("");
  return normalizeText(text).length >= 80;
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, "");
}

function unique(values = []) {
  return [...new Set(values.map((item) => String(item || "").trim()).filter(Boolean))];
}

function buildId(prefix) {
  return `${prefix}-${new Date().toISOString().replaceAll(":", "").replaceAll(".", "")}`;
}
