import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const js = `(() => {
  const text = (node) => (node && (node.innerText || node.textContent) || "").trim();
  const blocks = Array.from(document.querySelectorAll("[data-plugin-identifier*='search_query_result_block']"));
  const target = blocks.find((node) => text(node).includes("参考 18 篇资料"));
  if (!target) return JSON.stringify({ ok: false, error: "no target block" }, null, 2);
  const candidates = [
    target.querySelector(".cursor-pointer"),
    target.firstElementChild,
    target.firstElementChild?.firstElementChild,
    target,
  ].filter(Boolean);
  const before = text(target);
  const results = [];
  const fire = (node, method) => {
    try { node.scrollIntoView({ block: "center", inline: "center" }); } catch {}
    if (method === "nativeClick") {
      try { node.click(); } catch (error) { results.push({ method, error: error.message }); }
      return;
    }
    if (method === "mouseEvents") {
      try {
        node.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
        node.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
        node.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
      } catch (error) { results.push({ method, error: error.message }); }
      return;
    }
    if (method === "pointerMouseEvents") {
      try {
        node.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, view: window }));
        node.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true, view: window }));
        node.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
        node.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
        node.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
      } catch (error) { results.push({ method, error: error.message }); }
    }
  };
  for (const [candidateIndex, node] of candidates.entries()) {
    for (const method of ["nativeClick", "mouseEvents", "pointerMouseEvents"]) {
      fire(node, method);
      results.push({
        candidateIndex,
        method,
        className: String(node.className || ""),
        afterLength: text(target).length,
        afterText: text(target).slice(0, 300),
        htmlHint: target.outerHTML.slice(0, 400),
      });
      if (/[“"][^”"]+[”"]/.test(text(target)) || /\\n\\s*1[.、]/.test(text(target))) {
        return JSON.stringify({ ok: true, before, results }, null, 2);
      }
    }
  }
  return JSON.stringify({ ok: false, before, results }, null, 2);
})()`;

const dir = mkdtempSync(path.join(tmpdir(), "sbs-doubao-click-"));
const jsPath = path.join(dir, "click.js");
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

console.log(execFileSync("osascript", ["-e", appleScript], { encoding: "utf8", timeout: 15000 }));
