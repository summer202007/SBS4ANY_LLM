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
  const clean = (value) => String(value || "").replace(/\\s+/g, " ").trim();
  const all = Array.from(document.querySelectorAll("body *"));
  const visible = (node) => {
    if (!node) return false;
    const style = window.getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity || 1) === 0) return false;
    const rect = node.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };
  const nodeSummary = all
    .map((node, index) => {
      const value = text(node);
      if (!value || value.length < 2 || !visible(node)) return null;
      const rect = node.getBoundingClientRect();
      return {
        index,
        tag: node.tagName,
        role: node.getAttribute("role") || "",
        className: String(node.className || "").slice(0, 160),
        dataAttrs: Array.from(node.attributes || [])
          .filter((attr) => attr.name.startsWith("data-"))
          .slice(0, 8)
          .map((attr) => [attr.name, attr.value]),
        textLength: value.length,
        text: value.slice(0, 500),
        rect: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        },
      };
    })
    .filter(Boolean)
    .filter((item) => item.textLength <= 3000)
    .slice(0, 220);
  const anchors = Array.from(document.querySelectorAll("a"))
    .map((a, index) => ({
      index,
      domIndex: all.indexOf(a),
      text: text(a),
      href: a.href || "",
      title: a.getAttribute("title") || "",
      ariaLabel: a.getAttribute("aria-label") || "",
    }))
    .filter((item) => item.text || item.href || item.title || item.ariaLabel)
    .slice(0, 120);
  const buttons = Array.from(document.querySelectorAll("button, [role='button']"))
    .map((button, index) => ({
      index,
      domIndex: all.indexOf(button),
      text: text(button),
      title: button.getAttribute("title") || "",
      ariaLabel: button.getAttribute("aria-label") || "",
      className: String(button.className || "").slice(0, 160),
    }))
    .filter((item) => item.text || item.title || item.ariaLabel)
    .slice(0, 120);
  const candidateMessages = nodeSummary
    .filter((item) => item.textLength >= 8 && item.textLength <= 1800)
    .filter((item) => {
      const cls = item.className.toLowerCase();
      const role = item.role.toLowerCase();
      return /message|chat|bubble|answer|markdown|content|dialog|reply|card/.test(cls + " " + role) ||
        /推荐|餐厅|人均|静安|约会|网红|安静|引用|搜索|来源|再查查/.test(item.text);
    })
    .slice(0, 80);
  return JSON.stringify({
    capturedAt: new Date().toISOString(),
    url: location.href,
    title: document.title,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    rawVisibleText: document.body ? document.body.innerText : "",
    anchors,
    buttons,
    nodeSummary,
    candidateMessages,
  }, null, 2);
})()`;

const dir = mkdtempSync(path.join(tmpdir(), "sbs-webchat-probe-"));
const jsPath = path.join(dir, "probe.js");
writeFileSync(jsPath, js, "utf8");

const appleScript = `
set jsPath to POSIX file "${jsPath}"
set probeCode to read jsPath as «class utf8»
tell application "Google Chrome"
  if not (exists front window) then error "Google Chrome has no front window."
  set activeTab to active tab of front window
  return execute activeTab javascript probeCode
end tell
`;

const stdout = execFileSync("osascript", ["-e", appleScript], { encoding: "utf8", timeout: 15000 });
const artifact = JSON.parse(stdout);
const safeHost = new URL(artifact.url).hostname.replace(/[^a-z0-9.-]+/gi, "_");
const stamp = new Date().toISOString().replaceAll(":", "").replaceAll(".", "");
const outPath = path.join(outDir, `${stamp}-${safeHost}-snapshot.json`);
writeFileSync(outPath, JSON.stringify(artifact, null, 2), "utf8");

console.log(JSON.stringify({
  artifactPath: path.relative(rootDir, outPath),
  url: artifact.url,
  title: artifact.title,
  rawVisibleTextLength: artifact.rawVisibleText.length,
  anchors: artifact.anchors.length,
  buttons: artifact.buttons.length,
  candidateMessages: artifact.candidateMessages.length,
}, null, 2));
