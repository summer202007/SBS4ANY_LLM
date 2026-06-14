import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const js = `(() => {
  const text = (node) => (node && (node.innerText || node.textContent) || "").trim();
  const all = Array.from(document.querySelectorAll("body *"));
  const rows = [];
  const pattern = /今晚|徐汇|朝阳|三里屯|搜索\\s*\\d+\\s*个关键词|参考\\s*\\d+\\s*篇资料|预订方式|团队聚餐|西餐厅|餐厅/;
  all.forEach((node, index) => {
    const value = text(node);
    if (!value || !pattern.test(value)) return;
    rows.push({
      index,
      tag: node.tagName,
      className: String(node.className || "").slice(0, 80),
      role: node.getAttribute("role") || "",
      dataPlugin: node.getAttribute("data-plugin-identifier") || "",
      length: value.length,
      text: value.slice(0, 240),
    });
  });
  const searchBlocks = Array.from(document.querySelectorAll("[data-plugin-identifier*='search_query_result_block']"))
    .map((node, index) => ({
      index,
      domIndex: all.indexOf(node),
      length: text(node).length,
      text: text(node).slice(0, 500),
      html: node.outerHTML.slice(0, 2500),
      anchors: Array.from(node.querySelectorAll("a")).slice(0, 5).map((a) => ({ text: text(a), href: a.href || "" })),
      reactKeys: Object.keys(node).filter((key) => key.startsWith("__react")).slice(0, 8),
      childReactKeys: Array.from(node.querySelectorAll("*"))
        .slice(0, 4)
        .map((child) => ({
          text: text(child).slice(0, 40),
          keys: Object.keys(child).filter((key) => key.startsWith("__react")).slice(0, 6),
        })),
    }));
  const scriptHits = Array.from(document.scripts)
    .map((script, index) => ({ index, text: script.textContent || "" }))
    .filter((item) => item.text.includes("北京朝阳") || item.text.includes("庆春朴门") || item.text.includes("search_query"))
    .map((item) => {
      const hitIndex = Math.max(item.text.indexOf("北京朝阳"), item.text.indexOf("庆春朴门"), item.text.indexOf("search_query"));
      return {
        index: item.index,
        length: item.text.length,
        hitIndex,
        sample: item.text.slice(Math.max(0, hitIndex - 400), hitIndex + 1600),
      };
    })
    .slice(0, 4);
  return JSON.stringify({
    url: location.href,
    title: document.title,
    bodyChecks: [
      "帮我找个今晚团队聚餐的餐厅，6个人，人均 250 左右，别太吵，最好有素食选择。",
      "区域优先朝阳/三里屯附近，如果不好选，国贸也可以。",
      "区域优先朝阳",
    ].map((query) => ({
      query,
      index: (document.body?.innerText || "").indexOf(query),
      around: (document.body?.innerText || "").slice(
        Math.max(0, (document.body?.innerText || "").indexOf(query) - 180),
        Math.max(0, (document.body?.innerText || "").indexOf(query) + 360),
      ),
    })),
    rows: rows.slice(0, 180),
    searchBlocks,
    scriptHits,
  }, null, 2);
})()`;

const dir = mkdtempSync(path.join(tmpdir(), "sbs-doubao-probe-"));
const jsPath = path.join(dir, "probe.js");
writeFileSync(jsPath, js, "utf8");

const appleScript = `
set jsPath to POSIX file "${jsPath}"
set probeCode to read jsPath as «class utf8»
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
  return execute activeTab javascript probeCode
end tell
`;

console.log(execFileSync("osascript", ["-e", appleScript], { encoding: "utf8", timeout: 15000 }));
