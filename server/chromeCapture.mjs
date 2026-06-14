import { execFile } from "node:child_process";

const NAVIGATION_TEXT = new Set([
  "豆包",
  "新对话",
  "AI 创作",
  "历史对话",
  "登录",
  "下载电脑版",
  "快速",
  "PPT 生成",
  "图像生成",
  "帮我写作",
  "视频生成",
  "翻译",
  "更多",
]);

const NAVIGATION_PATTERNS = [
  /^豆包$/,
  /^新对话$/,
  /^AI\s*创作$/,
  /^历史对话$/,
  /^打开侧边栏$/,
  /^关闭侧边栏$/,
  /^展开$/,
  /^收起$/,
  /^搜索$/,
  /^设置$/,
  /^帮助$/,
];

export async function captureDoubaoCurrentChrome({ caseId, turnIndex, userMessage, nextUserMessage = "" }) {
  const page = await readCurrentChromeTab(userMessage, nextUserMessage);
  if (!page.url?.includes("doubao.com")) {
    throw new Error("Current Chrome tab does not look like a Doubao page. Click the Doubao tab and retry capture.");
  }
  const rawVisibleText = String(page.rawVisibleText || "");
  const scopedVisibleText = scopeVisibleTextToCurrentTurn(rawVisibleText, userMessage, nextUserMessage);
  const scopedPage = {
    ...page,
    anchors: filterDomItemsToScope(page.anchors, page.scope),
    buttons: filterDomItemsToScope(page.buttons, page.scope),
    evidenceCandidates: filterEvidenceCandidatesToScope(page.evidenceCandidates, scopedVisibleText, page.scope),
    searchResultBlocks: filterSearchResultBlocksToScope(page.searchResultBlocks, scopedVisibleText, page.scope),
    followupCandidates: filterDomItemsToScope(page.followupCandidates, page.scope),
  };
  const expandedSearchQueries = extractSearchQueries(scopedVisibleText, scopedPage);
  const referenceMaterials = extractReferenceMaterials(scopedPage, scopedVisibleText);
  const riskNotices = extractRiskNotices(scopedVisibleText);
  const followupSuggestions = extractFollowupSuggestions(scopedPage.buttons || [], scopedVisibleText, scopedPage.followupCandidates || []);
  const finalAnswer = extractFinalAnswer(scopedVisibleText, userMessage, {
    expandedSearchQueries,
    referenceMaterials,
    riskNotices,
    followupSuggestions,
  });
  const captureNotes = [];

  if (page.expandedClickTargets?.length) {
    captureNotes.push(`Auto-expanded ${page.expandedClickTargets.length} visible evidence control(s) before capture.`);
  }
  if (hasSearchReferenceHeader(scopedVisibleText) && (!expandedSearchQueries.length || !referenceMaterials.length)) {
    captureNotes.push(
      "Doubao search/reference header was visible, but query/reference details were not fully expanded or readable in captured text. Manually expand the search/reference block and capture again if those details matter.",
    );
  }
  if (!finalAnswer) {
    captureNotes.push("Could not confidently isolate final answer; inspect raw visible text.");
  }

  return {
    captureId: `capture-${new Date().toISOString().replaceAll(":", "").replaceAll(".", "")}`,
    provider: "doubao_web",
    side: "baseline",
    caseId,
    turnIndex,
    capturedAt: new Date().toISOString(),
    url: page.url || "",
    title: page.title || "",
    finalAnswer,
    intentExpansionQueries: expandedSearchQueries,
    expandedSearchQueries,
    referenceMaterials,
    riskNotices,
    followupSuggestions,
    visibleProcessNotes: formatVisibleProcessNotes({
      expandedSearchQueries,
      riskNotices,
      followupSuggestions,
    }),
    sourceNotes: formatSourceNotes(referenceMaterials, page.url),
    toolcallNotes: "No structured tool-call trace was visible. Captured visible Doubao web artifacts only.",
    evidenceLevel: referenceMaterials.length ? "L2" : "L1",
    rawVisibleText,
    scopedVisibleText,
    captureNotes,
  };
}

function readCurrentChromeTab(userMessage = "", nextUserMessage = "") {
  const targetUserMessage = String(userMessage || "");
  const targetNextUserMessage = String(nextUserMessage || "");
  const expandScript = `(() => {
    const text = (node) => (node && (node.innerText || node.textContent) || "").trim();
    const targetUserMessage = "${escapeBrowserJsString(targetUserMessage)}";
    const targetNextUserMessage = "${escapeBrowserJsString(targetNextUserMessage)}";
    const expandedClickTargets = [];
    const allNodes = Array.from(document.querySelectorAll("body *"));
    const findBestNodeIndex = (target, afterIndex = -1) => {
      if (!target) return -1;
      return allNodes.reduce((best, node, index) => {
          if (index <= afterIndex) return best;
          const value = text(node);
          if (!value.includes(target)) return best;
          const score = Math.abs(value.length - target.length);
          if (!best || score <= best.score) return { index, score };
          return best;
        }, null)?.index ?? -1;
    };
    const targetIndex = findBestNodeIndex(targetUserMessage);
    const nextTargetIndex = findBestNodeIndex(targetNextUserMessage, targetIndex);
    const isInScope = (index) => targetIndex < 0 || (index > targetIndex && (nextTargetIndex < 0 || index < nextTargetIndex));
    const fireClick = (node) => {
      if (!node) return;
      try {
        node.scrollIntoView({ block: "center", inline: "center" });
      } catch {}
      try {
        node.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, view: window }));
        node.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true, view: window }));
      } catch {}
      try {
        node.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
        node.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
        node.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
      } catch {}
    };
    const expandedNear = (node) => {
      const value = text(node);
      if (!/搜索\\s*\\d+\\s*个关键词/.test(value)) return false;
      return /[“"][^”"]+[”"]/.test(value) || /\\n\\s*1[.、]/.test(value);
    };
    const clickSearchResultBlocks = () => {
      const blocks = Array.from(document.querySelectorAll("[data-plugin-identifier*='search_query_result_block']"))
        .map((node) => ({ node, index: allNodes.indexOf(node), label: text(node) }))
        .filter((item) => item.label && /搜索\\s*\\d+\\s*个关键词/.test(item.label) && /参考\\s*\\d+\\s*篇资料/.test(item.label))
        .filter((item) => isInScope(item.index));
      for (const { node, index, label } of blocks.slice(0, 3)) {
        if (expandedNear(node)) continue;
        const clickable = node.querySelector(".cursor-pointer") || node.firstElementChild?.firstElementChild || node;
        try {
          fireClick(clickable);
          expandedClickTargets.push({ index: index + 1, label: "search-result-block:" + label.slice(0, 160) });
        } catch {}
      }
    };
    const clickReferenceEntryButtons = () => {
      const entries = allNodes
        .map((node, index) => ({ node, index, label: text(node) }))
        .filter((item) => isInScope(item.index))
        .filter((item) => /^参考\\s*\\d+\\s*篇资料$/.test(item.label))
        .sort((a, b) => a.label.length - b.label.length);
      for (const { node, index, label } of entries.slice(0, 4)) {
        let clickable = node;
        for (let i = 0; clickable && i < 5; i += 1, clickable = clickable.parentElement) {
          const className = String(clickable.className || "");
          if (className.includes("entry-btn") || className.includes("message-action")) break;
        }
        clickable = clickable || node;
        try {
          fireClick(clickable);
          expandedClickTargets.push({ index: index + 1, label: "reference-entry:" + label.slice(0, 160) });
        } catch {}
      }
    };
    const maybeClick = (node, index) => {
      if (node.closest && node.closest("[data-plugin-identifier*='search_query_result_block']")) return;
      if (!isInScope(index)) return;
      const label = [text(node), node.getAttribute && node.getAttribute("aria-label"), node.getAttribute && node.getAttribute("title")]
        .filter(Boolean)
        .join(" ");
      if (!/(参考|资料|关键词|搜索)/.test(label)) return;
      if (node.getAttribute && node.getAttribute("aria-expanded") === "true") return;
      if (expandedNear(node)) return;
      try {
        fireClick(node);
        expandedClickTargets.push({ index: index + 1, label });
      } catch {}
    };
    clickSearchResultBlocks();
    Array.from(document.querySelectorAll("button, [role='button'], summary")).forEach((node) => maybeClick(node, allNodes.indexOf(node)));
    const allEvidenceHeaders = allNodes
      .map((node, index) => ({ node, index, label: text(node) }))
      .filter((item) => !(item.node.closest && item.node.closest("[data-plugin-identifier*='search_query_result_block']")))
      .filter((item) => /搜索\\s*\\d+\\s*个关键词/.test(item.label) && /参考\\s*\\d+\\s*篇资料/.test(item.label))
      .sort((a, b) => a.label.length - b.label.length);
    const scopedEvidenceHeaders = allEvidenceHeaders.filter((item) => isInScope(item.index));
    const evidenceHeadersToClick = scopedEvidenceHeaders.slice(0, 5)
    evidenceHeadersToClick.forEach(({ node, index, label }) => {
      if (expandedNear(node)) return;
      try {
        fireClick(node);
        expandedClickTargets.push({ index: index + 1, label: "evidence-header:" + label.slice(0, 160) });
      } catch {}
    });
    window.__sbsDoubaoExpandedClickTargets = expandedClickTargets;
    window.__sbsDoubaoScope = { targetIndex, nextTargetIndex };
    return JSON.stringify({ targetIndex, nextTargetIndex, expandedClickTargets });
  })()`;

  const collectScript = `(() => {
    const text = (node) => (node && node.innerText || "").trim();
    const allNodes = Array.from(document.querySelectorAll("body *"));
    const domIndex = (node) => allNodes.indexOf(node);
    const anchors = Array.from(document.querySelectorAll("a"))
      .map((a, index) => ({
        index: index + 1,
        domIndex: domIndex(a),
        text: text(a),
        href: a.href || "",
        ariaLabel: a.getAttribute("aria-label") || "",
        title: a.getAttribute("title") || ""
      }))
      .filter((item) => item.text || item.href)
      .slice(0, 120);
    const buttons = Array.from(document.querySelectorAll("button, [role='button']"))
      .map((button, index) => ({
        index: index + 1,
        domIndex: domIndex(button),
        text: text(button),
        ariaLabel: button.getAttribute("aria-label") || "",
        title: button.getAttribute("title") || ""
      }))
      .filter((item) => item.text || item.ariaLabel || item.title)
      .slice(0, 120);
    const evidenceCandidates = Array.from(document.querySelectorAll("body *"))
      .map((node, index) => {
        const nodeText = text(node);
        if (!/搜索\\s*\\d+\\s*个关键词/.test(nodeText) || !/参考\\s*\\d+\\s*篇资料/.test(nodeText)) return null;
        const siblingTexts = [];
        let sibling = node.nextElementSibling;
        for (let i = 0; sibling && i < 30; i += 1, sibling = sibling.nextElementSibling) {
          const siblingText = text(sibling);
          if (siblingText) siblingTexts.push(siblingText);
        }
        const ancestorTexts = [];
        let ancestor = node.parentElement;
        for (let i = 0; ancestor && i < 7; i += 1, ancestor = ancestor.parentElement) {
          const ancestorText = text(ancestor);
          if (ancestorText && ancestorText.includes("搜索") && ancestorText.includes("关键词")) {
            ancestorTexts.push(ancestorText);
          }
        }
        return {
          index: index + 1,
          domIndex: index,
          text: nodeText,
          ancestorText: ancestorTexts.join("\\n"),
          siblingText: siblingTexts.join("\\n")
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.text.length - b.text.length)
      .slice(0, 12);
    const followupCandidates = Array.from(document.querySelectorAll("body *"))
      .map((node, index) => ({ index: index + 1, domIndex: index, text: text(node) }))
      .filter((item) => item.text && item.text.length >= 6 && item.text.length <= 90)
      .filter((item) => /[？?]$/.test(item.text) || /^(推荐|如何|怎么|哪些|查询|公积金|上海|北京|广州|深圳|杭州)/.test(item.text))
      .slice(0, 200);
    const searchResultBlocks = Array.from(document.querySelectorAll("[data-plugin-identifier*='search_query_result_block']"))
      .map((node, index) => ({
        index: index + 1,
        domIndex: domIndex(node),
        text: text(node),
        anchors: Array.from(node.querySelectorAll("a")).map((a, anchorIndex) => ({
          index: anchorIndex + 1,
          domIndex: domIndex(a),
          text: text(a),
          href: a.href || "",
          ariaLabel: a.getAttribute("aria-label") || "",
          title: a.getAttribute("title") || ""
        })).filter((item) => item.text || item.href)
      }))
      .filter((item) => item.text)
      .slice(0, 12);
    return JSON.stringify({
      url: location.href,
      title: document.title,
      rawVisibleText: document.body ? document.body.innerText : "",
      anchors,
      buttons,
      evidenceCandidates,
      searchResultBlocks,
      followupCandidates,
      scope: window.__sbsDoubaoScope || {},
      expandedClickTargets: window.__sbsDoubaoExpandedClickTargets || []
    });
  })()`;

  const appleScript = `
tell application "Google Chrome"
  if not (exists front window) then error "Google Chrome has no front window."
  set activeTab to active tab of front window
  if (URL of activeTab does not contain "doubao.com") then
    repeat with candidateTab in tabs of front window
      if (URL of candidateTab contains "doubao.com") then
        set activeTab to candidateTab
        exit repeat
      end if
    end repeat
  end if
  set expandCode to "${escapeAppleScriptString(expandScript)}"
  execute activeTab javascript expandCode
  delay 0.8
  set collectCode to "${escapeAppleScriptString(collectScript)}"
  return execute activeTab javascript collectCode
end tell
`;

  return new Promise((resolve, reject) => {
    execFile("osascript", ["-e", appleScript], { encoding: "utf8", timeout: 15000 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(cleanAppleScriptError(stderr || error.message)));
        return;
      }
      try {
        resolve(JSON.parse(stdout.trim()));
      } catch (parseError) {
        reject(new Error(`Chrome capture returned non-JSON output: ${parseError.message}`));
      }
    });
  });
}

function extractSearchQueries(rawVisibleText, page = {}) {
  const evidenceText = getEvidenceCandidateText(page);
  for (const sourceText of uniqueStrings([evidenceText, rawVisibleText])) {
    const lines = splitVisibleLines(sourceText);
    const headerIndex = findSearchReferenceHeaderIndex(lines);
    const candidateLines = headerIndex >= 0 ? lines.slice(headerIndex, headerIndex + 8) : lines;
    const quoted = uniqueStrings(
      candidateLines.flatMap((line) =>
        [...line.matchAll(/[“"]([^”"]+)[”"]/g)].map((match) => match[1].trim()).filter(Boolean),
      ),
    ).filter(isLikelyIntentExpansionQuery);
    if (quoted.length) return quoted.slice(0, 8);
  }
  return [];
}

function extractReferenceMaterials(page, rawVisibleText) {
  const evidenceText = getEvidenceCandidateText(page);
  const lines = splitVisibleLines(evidenceText || "");
  const lineRefs = extractReferenceLineItems(lines)
    .map((item) => {
      return {
        rank: item.rank,
        title: cleanReferenceTitle(item.title),
        href: "",
        sourceName: "",
      };
    })
    .filter(Boolean)
    .filter((item) => item.rank >= 1 && item.rank <= 30);

  const blockAnchors = getSearchResultBlockAnchors(page);
  const linkRefs = [...blockAnchors, ...(page.anchors || [])]
    .map((anchor) => ({
      rank: undefined,
      title: cleanReferenceTitle(anchor.text || anchor.title || anchor.ariaLabel || ""),
      href: String(anchor.href || "").trim(),
      sourceName: hostname(anchor.href),
    }))
    .filter((item) => item.title && item.href && !NAVIGATION_TEXT.has(item.title))
    .filter((item) => !isDoubaoChatHistoryLink(item))
    .filter((item) => !isDoubaoInternalLink(item))
    .filter((item) => rawVisibleText.includes(item.title) || lineRefs.some((ref) => normalizeReferenceTitle(ref.title) === normalizeReferenceTitle(item.title)))
    .slice(0, 20);

  if (lineRefs.length) {
    const usedLinkIndexes = new Set();
    const rankedRefs = lineRefs.map((item) => {
      const normalized = normalizeReferenceTitle(item.title);
      const linkIndex = linkRefs.findIndex((candidate, index) => !usedLinkIndexes.has(index) && normalizeReferenceTitle(candidate.title) === normalized);
      const link = linkIndex >= 0 ? linkRefs[linkIndex] : null;
      if (linkIndex >= 0) usedLinkIndexes.add(linkIndex);
      return {
        ...item,
        href: link?.href || "",
        sourceName: link?.sourceName || "",
      };
    });
    return rankedRefs.slice(0, 30);
  }

  const merged = [];
  for (const item of [...lineRefs, ...linkRefs]) {
    const key = normalizeReferenceTitle(item.title);
    const existing = merged.find((candidate) => normalizeReferenceTitle(candidate.title) === key);
    if (existing) {
      if (!existing.href && item.href) {
        existing.href = item.href;
        existing.sourceName = item.sourceName;
      }
      if (!existing.rank && item.rank) existing.rank = item.rank;
      continue;
    }
    merged.push(item);
  }
  return merged.slice(0, 24);
}

function extractReferenceLineItems(lines) {
  const headerIndex = findSearchReferenceHeaderIndex(lines);
  if (headerIndex < 0) return [];
  const refs = [];
  let sawQueryLine = false;
  const candidateLines = lines.slice(headerIndex + 1);
  for (let index = 0; index < candidateLines.length; index += 1) {
    const line = candidateLines[index];
    if (isSearchQueryLine(line)) {
      sawQueryLine = true;
      continue;
    }
    if (!sawQueryLine) continue;
    const sameLineMatch = line.match(/^(\d+)[.、]\s*(\S.+)$/);
    if (sameLineMatch) {
      refs.push({ rank: Number(sameLineMatch[1]), title: sameLineMatch[2] });
      continue;
    }
    const rankOnlyMatch = line.match(/^(\d+)[.、]$/);
    if (rankOnlyMatch && candidateLines[index + 1]) {
      refs.push({ rank: Number(rankOnlyMatch[1]), title: candidateLines[index + 1] });
      index += 1;
      continue;
    }
    if (refs.length) break;
  }
  return refs;
}

function findSearchReferenceHeaderIndex(lines) {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (line.includes("搜索") && line.includes("关键词") && line.includes("参考") && line.includes("资料")) {
      return index;
    }
  }
  return -1;
}

function hasSearchReferenceHeader(value) {
  return splitVisibleLines(value).some((line) => findSearchReferenceHeaderIndex([line]) === 0);
}

function isSearchQueryLine(line) {
  return /[“"][^”"]+[”"]/.test(line);
}

function getEvidenceCandidateText(page = {}) {
  const searchBlocks = Array.isArray(page.searchResultBlocks)
    ? page.searchResultBlocks.map((block) => ({ text: block.text, ancestorText: "", siblingText: "" }))
    : [];
  const candidates = [...searchBlocks, ...(Array.isArray(page.evidenceCandidates) ? page.evidenceCandidates : [])];
  const scored = candidates
    .map((candidate) => {
      const text = [candidate.text, candidate.ancestorText, candidate.siblingText].filter(Boolean).join("\n");
      const score =
        (/[“"][^”"]+[”"]/.test(text) ? 10 : 0) +
        ((text.match(/^\d+[.、]\s*/gm) || []).length * 2) -
        Math.floor(text.length / 2000);
      return { text, score };
    })
    .filter((item) => item.text.includes("搜索") && item.text.includes("关键词") && item.text.includes("参考"))
    .sort((a, b) => b.score - a.score);
  return scored[0]?.text || "";
}

function getSearchResultBlockAnchors(page = {}) {
  return (Array.isArray(page.searchResultBlocks) ? page.searchResultBlocks : [])
    .flatMap((block) => block.anchors || [])
    .filter((anchor) => anchor.text || anchor.href);
}

function filterEvidenceCandidatesToScope(candidates = [], scopedVisibleText = "", scope = {}) {
  if (!Array.isArray(candidates) || !scopedVisibleText) return candidates || [];
  const domScoped = filterDomItemsToScope(candidates, scope);
  const source = hasDomScope(scope) ? domScoped : candidates;
  return source.filter((candidate) => {
    const text = [candidate.text, candidate.ancestorText, candidate.siblingText].filter(Boolean).join("\n");
    const queryHeader = splitVisibleLines(text).find((line) => findSearchReferenceHeaderIndex([line]) === 0);
    return !queryHeader || scopedVisibleText.includes(queryHeader);
  });
}

function filterSearchResultBlocksToScope(blocks = [], scopedVisibleText = "", scope = {}) {
  if (!Array.isArray(blocks) || !scopedVisibleText) return blocks || [];
  const domScoped = filterDomItemsToScope(blocks, scope);
  const source = hasDomScope(scope) ? domScoped : blocks;
  return source.filter((block) => {
    const text = String(block.text || "");
    const header = splitVisibleLines(text).find((line) => findSearchReferenceHeaderIndex([line]) === 0);
    if (!header) return true;
    return scopedVisibleText.includes(header) && hasScopedOverlapAfterHeader(text, scopedVisibleText, header);
  });
}

function hasScopedOverlapAfterHeader(text, scopedVisibleText, header) {
  const lines = splitVisibleLines(text);
  const headerIndex = lines.findIndex((line) => line === header);
  const candidateLines = headerIndex >= 0 ? lines.slice(headerIndex + 1, headerIndex + 8) : lines.slice(0, 8);
  return candidateLines.some((line) => scopedVisibleText.includes(line));
}

function filterDomItemsToScope(items = [], scope = {}) {
  if (!Array.isArray(items)) return [];
  if (!hasDomScope(scope)) return items;
  const targetIndex = Number(scope.targetIndex);
  const nextTargetIndex = Number(scope.nextTargetIndex ?? -1);
  return items.filter((item) => {
    const index = Number(item.domIndex ?? -1);
    if (index < 0) return false;
    if (index <= targetIndex) return false;
    if (nextTargetIndex >= 0 && index >= nextTargetIndex) return false;
    return true;
  });
}

function hasDomScope(scope = {}) {
  return Number.isFinite(Number(scope.targetIndex)) && Number(scope.targetIndex) >= 0;
}

function scopeVisibleTextToCurrentTurn(rawVisibleText, userMessage, nextUserMessage = "") {
  const lines = splitVisibleLines(rawVisibleText);
  const userIndex = findUserMessageIndex(lines, userMessage);
  if (userIndex < 0) return rawVisibleText;
  let endIndex = lines.length;
  const nextUserIndex = nextUserMessage ? findUserMessageIndex(lines.slice(userIndex + 1), nextUserMessage) : -1;
  if (nextUserIndex >= 0) {
    endIndex = userIndex + 1 + nextUserIndex;
  }
  return lines.slice(userIndex, endIndex).join("\n");
}

function isDoubaoChatHistoryLink(item) {
  try {
    const url = new URL(item.href);
    return url.hostname.endsWith("doubao.com") && /^\/chat\/\d+/.test(url.pathname);
  } catch {
    return false;
  }
}

function isDoubaoInternalLink(item) {
  try {
    const url = new URL(item.href);
    return url.hostname.endsWith("doubao.com");
  } catch {
    return false;
  }
}

function cleanReferenceTitle(value) {
  return String(value || "")
    .replace(/^\s*\d+[.、]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeReferenceTitle(value) {
  return cleanReferenceTitle(value).toLowerCase();
}

function looksLikeNavigationText(value) {
  return NAVIGATION_TEXT.has(value) || NAVIGATION_PATTERNS.some((pattern) => pattern.test(value));
}

function isLikelyIntentExpansionQuery(value) {
  const item = String(value || "").trim();
  if (!item || looksLikeNavigationText(item)) return false;
  if (/^[A-Za-z_.$-]{1,30}$/.test(item)) return false;
  if (/^(data|namedChunks|chunks|props|state|children|payload|undefined|null|true|false)$/i.test(item)) return false;
  if (/[{}[\]]/.test(item)) return false;
  if (item.length < 4 || item.length > 120) return false;
  return /[\u4e00-\u9fff]/.test(item) || /\s/.test(item);
}

function extractRiskNotices(rawVisibleText) {
  return splitVisibleLines(rawVisibleText)
    .filter((line) => /AI生成|AI 生成|仅供参考|仔细甄别|谨慎|请核实|可能有误|不构成/.test(line))
    .slice(0, 8);
}

function extractFollowupSuggestions(buttons, scopedVisibleText = "", followupCandidates = []) {
  const buttonSuggestions = buttons
    .map((button) => String(button.text || button.ariaLabel || button.title || "").trim())
    .filter(Boolean)
    .flatMap(splitPossibleSuggestionText)
    .filter((item) => !scopedVisibleText || scopedVisibleText.includes(item))
    .filter(isLikelyFollowupSuggestion);
  const domSuggestions = followupCandidates
    .map((item) => String(item.text || "").trim())
    .flatMap(splitPossibleSuggestionText)
    .filter((item) => !scopedVisibleText || scopedVisibleText.includes(item))
    .filter(isLikelyFollowupSuggestion);
  const textSuggestions = extractFollowupSuggestionsFromText(scopedVisibleText);
  return uniqueStrings([...buttonSuggestions, ...domSuggestions, ...textSuggestions]).slice(-8);
}

function splitPossibleSuggestionText(value) {
  return String(value || "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function extractFollowupSuggestionsFromText(scopedVisibleText) {
  const lines = splitVisibleLines(scopedVisibleText);
  const markerIndex = findLastIndex(lines, (line) => /相关视频|猜你想问|你可能还想问|推荐问题|继续问|^参考\s*\d+\s*篇资料$/.test(line));
  const markerSuggestions = markerIndex < 0
    ? []
    : lines
      .slice(markerIndex + 1)
      .filter(isLikelyFollowupSuggestion)
      .slice(0, 8);
  const tailSuggestions = lines
    .slice(-24)
    .filter(isLikelyFollowupSuggestion)
    .slice(-6);
  return uniqueStrings([...markerSuggestions, ...tailSuggestions]);
}

function findLastIndex(values, predicate) {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (predicate(values[index], index)) return index;
  }
  return -1;
}

function isLikelyFollowupSuggestion(text) {
  const value = String(text || "").trim();
  if (value.length < 6 || value.length > 90) return false;
  if (NAVIGATION_TEXT.has(value) || NAVIGATION_PATTERNS.some((pattern) => pattern.test(value))) return false;
  if (/^复制|重新|点赞|点踩|分享|展开|收起|下载豆包/.test(value)) return false;
  if (/^要不要|如果你愿意|我可以|需要我/.test(value)) return false;
  if (/^周末不知道吃什么|#/.test(value)) return false;
  return /[？?]$/.test(value) || /^(推荐|如何|怎么|哪些|查询)/.test(value);
}

function extractFinalAnswer(rawVisibleText, userMessage, artifacts) {
  const lines = splitVisibleLines(rawVisibleText);
  const userIndex = findUserMessageIndex(lines, userMessage);
  const candidates = userIndex >= 0 ? lines.slice(userIndex + 1) : lines;
  const blocked = new Set([
    ...artifacts.expandedSearchQueries,
    ...artifacts.riskNotices,
    ...artifacts.followupSuggestions,
  ]);
  const refTitles = new Set(artifacts.referenceMaterials.map((item) => item.title));
  const answerLines = [];

  for (const line of candidates) {
    if (isBlockedUiLine(line)) continue;
    if (blocked.has(line)) continue;
    if (refTitles.has(line)) continue;
    if (isReferenceTitleLine(line, refTitles)) continue;
    if (/^搜索\s*\d+\s*个关键词/.test(line)) continue;
    if (/^参考\s*\d+\s*篇资料$/.test(line)) continue;
    if (isSearchQueryLine(line)) continue;
    if (/^\d+[.、]$/.test(line)) continue;
    if (/^本回答由AI生成/.test(line)) continue;
    if (/^如需更多信息/.test(line)) continue;
    if (line === userMessage) continue;
    answerLines.push(line);
  }

  return trimAnswer(answerLines.join("\n"));
}

function isBlockedUiLine(line) {
  if (!line) return true;
  if (NAVIGATION_TEXT.has(line)) return true;
  if (NAVIGATION_PATTERNS.some((pattern) => pattern.test(line))) return true;
  if (line === "新") return true;
  if (/^https?:\/\//.test(line)) return true;
  if (/^⌘/.test(line)) return true;
  return false;
}

function isReferenceTitleLine(line, refTitles) {
  if (refTitles.has(line)) return true;
  const numbered = line.match(/^\d+[.、]\s*(.+)$/);
  return numbered ? refTitles.has(numbered[1].trim()) : false;
}

function findUserMessageIndex(lines, userMessage) {
  const normalized = normalizeText(userMessage);
  if (!normalized) return -1;
  let bestIndex = -1;
  let bestScore = 0;
  lines.forEach((line, index) => {
    const candidate = normalizeText(line);
    if (!candidate) return;
    const score = candidate.includes(normalized) || normalized.includes(candidate) ? Math.min(candidate.length, normalized.length) : 0;
    if (score > bestScore || (score === bestScore && score > 0 && index > bestIndex)) {
      bestScore = score;
      bestIndex = index;
    }
  });
  return bestScore >= Math.min(20, normalized.length) ? bestIndex : -1;
}

function formatVisibleProcessNotes({ expandedSearchQueries, riskNotices, followupSuggestions }) {
  const sections = [];
  if (riskNotices.length) {
    sections.push(`Risk notices:\n${riskNotices.map((item) => `- ${item}`).join("\n")}`);
  }
  if (followupSuggestions.length) {
    sections.push(`Follow-up suggestions:\n${followupSuggestions.map((item) => `- ${item}`).join("\n")}`);
  }
  return sections.join("\n\n");
}

function formatSourceNotes(referenceMaterials, pageUrl) {
  const refs = referenceMaterials
    .map((item) => {
      const prefix = item.rank ? `${item.rank}. ` : "- ";
      const href = item.href ? ` (${item.href})` : "";
      return `${prefix}${item.title}${href}`;
    })
    .join("\n");
  return [`Captured from: ${pageUrl || "unknown Chrome tab"}`, refs].filter(Boolean).join("\n\n");
}

function splitVisibleLines(value) {
  return String(value || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function trimAnswer(value) {
  return String(value || "").trim().slice(0, 20000);
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, "");
}

function uniqueStrings(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const item = String(value || "").trim();
    if (!item || seen.has(item)) continue;
    seen.add(item);
    result.push(item);
  }
  return result;
}

function hostname(value) {
  try {
    return new URL(value).hostname;
  } catch {
    return "";
  }
}

function escapeAppleScriptString(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

function escapeBrowserJsString(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "");
}

function cleanAppleScriptError(value) {
  const message = String(value || "").trim();
  if (message.includes("not allowed assistive access") || message.includes("not authorized")) {
    return "Chrome capture needs macOS Automation permission to control Google Chrome.";
  }
  if (
    message.includes("execute javascript") ||
    message.includes("执行 JavaScript") ||
    message.includes("Apple 事件中的 JavaScript") ||
    message.includes("AppleScript 执行 JavaScript")
  ) {
    return "Chrome capture permission is off. Click the Doubao tab so Chrome is the foreground app, then enable Chrome menu bar: Display/View > Developer > Allow JavaScript from Apple Events. Retry after enabling it.";
  }
  return message || "Chrome capture failed.";
}

export const __testHooks = {
  extractSearchQueries,
  extractReferenceMaterials,
  extractFollowupSuggestions,
  scopeVisibleTextToCurrentTurn,
  hasSearchReferenceHeader,
};
