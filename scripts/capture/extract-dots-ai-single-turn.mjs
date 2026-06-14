import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..", "..");
const outDir = path.join(rootDir, "artifacts", "capture-calibration");
mkdirSync(outDir, { recursive: true });

const js = `(() => {
  const text = (node) => (node && (node.innerText || node.textContent) || "").trim();
  const cleanLines = (value) => String(value || "")
    .split("\\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const unique = (values) => {
    const seen = new Set();
    const out = [];
    for (const value of values.map((item) => String(item || "").trim()).filter(Boolean)) {
      if (seen.has(value)) continue;
      seen.add(value);
      out.push(value);
    }
    return out;
  };
  const messageNodes = Array.from(document.querySelectorAll(".user-message-item, .assistant-message-item"))
    .map((node, index) => ({
      index,
      role: node.className.includes("user-message-item") ? "user" : "assistant",
      className: String(node.className || ""),
      text: text(node),
      isFeaturedNote: Boolean(node.querySelector(".message-card__featured-note")) || String(node.className || "").includes("featured-note"),
    }))
    .filter((item) => item.text);
  const lastUserIndex = Math.max(...messageNodes.map((item, index) => item.role === "user" ? index : -1));
  const currentUser = messageNodes[lastUserIndex] || null;
  const currentTurnAssistantMessages = messageNodes
    .slice(lastUserIndex + 1)
    .filter((item) => item.role === "assistant");
  const visibleProcessCandidates = currentTurnAssistantMessages
    .filter((item) => /再查查|正在|思考|查询|搜索|候选|详情|分析/.test(item.text) && item.text.length <= 80)
    .map((item) => item.text);
  const featuredNotes = currentTurnAssistantMessages.filter((item) => item.isFeaturedNote || item.text.includes("相关笔记推荐"));
  const answerMessages = currentTurnAssistantMessages.filter((item) => !featuredNotes.includes(item));
  const followupSuggestions = unique(
    answerMessages
      .map((item) => item.text)
      .filter((value) => value.length >= 8 && value.length <= 80 && /[？?]$/.test(value)),
  );
  const citeTexts = unique(Array.from(document.querySelectorAll(".cite-tag-text, .cite-tag"))
    .map((node) => text(node))
    .filter((value) => value && value.length >= 8));
  const referenceMaterials = [];
  for (const note of featuredNotes) {
    const lines = cleanLines(note.text).filter((line) => line !== "相关笔记推荐");
    for (let i = 0; i < lines.length; i += 2) {
      const title = lines[i];
      const sourceName = lines[i + 1] || "";
      if (!title || title === "🔥") continue;
      referenceMaterials.push({
        title,
        sourceName,
        href: "",
        type: "related_note_card",
      });
    }
  }
  for (const quote of citeTexts) {
    referenceMaterials.push({
      title: quote,
      sourceName: "",
      href: "",
      type: "inline_quote",
    });
  }
  const riskNotices = cleanLines(document.body ? document.body.innerText : "")
    .filter((line) => /内容由\\s*AI\\s*生成|AI生成|仅供参考|请核实|可能有误/.test(line));
  return JSON.stringify({
    provider: "dots_ai_web",
    url: location.href,
    title: document.title,
    userMessage: currentUser?.text || "",
    finalAnswer: answerMessages.map((item) => item.text).join("\\n\\n"),
    visibleProcessNotes: visibleProcessCandidates.join("\\n"),
    intentExpansionQueries: [],
    referenceMaterials,
    riskNotices: unique(riskNotices),
    followupSuggestions,
    sourceNotes: referenceMaterials.length
      ? referenceMaterials.map((item, index) => String(index + 1) + ". [" + item.type + "] " + item.title + (item.sourceName ? " - " + item.sourceName : "")).join("\\n")
      : "",
    toolcallNotes: "No structured tool-call trace was visible in the final dots.ai DOM.",
    rawVisibleText: document.body ? document.body.innerText : "",
    captureNotes: [
      "dots.ai may expose transient thinking/status text during generation; final DOM may not preserve it.",
      "Grouped all assistant bubbles after the latest user message into one eval turn.",
    ],
    evidenceLevel: referenceMaterials.length ? "L2" : "L1",
    messageDebug: messageNodes,
  }, null, 2);
})()`;

const dir = mkdtempSync(path.join(tmpdir(), "sbs-dots-extract-"));
const jsPath = path.join(dir, "extract.js");
writeFileSync(jsPath, js, "utf8");

const appleScript = `
set jsPath to POSIX file "${jsPath}"
set extractCode to read jsPath as «class utf8»
tell application "Google Chrome"
  if not (exists front window) then error "Google Chrome has no front window."
  set activeTab to active tab of front window
  return execute activeTab javascript extractCode
end tell
`;

const stdout = execFileSync("osascript", ["-e", appleScript], { encoding: "utf8", timeout: 15000 });
const capture = JSON.parse(stdout);
const stamp = new Date().toISOString().replaceAll(":", "").replaceAll(".", "");
const outPath = path.join(outDir, `${stamp}-dots-ai-single-turn-capture.json`);
writeFileSync(outPath, JSON.stringify(capture, null, 2), "utf8");

console.log(JSON.stringify({
  artifactPath: path.relative(rootDir, outPath),
  url: capture.url,
  userMessage: capture.userMessage,
  finalAnswerLength: capture.finalAnswer.length,
  referenceCount: capture.referenceMaterials.length,
  followupSuggestions: capture.followupSuggestions,
  riskNotices: capture.riskNotices,
  visibleProcessNotes: capture.visibleProcessNotes,
  captureNotes: capture.captureNotes,
}, null, 2));
