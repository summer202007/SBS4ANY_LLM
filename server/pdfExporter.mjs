import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { getCurrentState, rootDir } from "./storage.mjs";
import { getGraderPaths } from "./graderRunner.mjs";

export async function exportCurrentGraderPdf() {
  const taskId = getCurrentState().activeTask?.taskId;
  if (!taskId) throw new Error("Create or select an evaluation task first.");
  const p = getGraderPaths(taskId);
  if (!existsSync(p.gradingReportPath)) {
    throw new Error("No grading report found. Run Review + Report before exporting PDF.");
  }
  const markdownPath = existsSync(p.reportZhMarkdownPath) ? p.reportZhMarkdownPath : p.reportMarkdownPath;
  if (!existsSync(markdownPath)) {
    throw new Error("No report markdown found. Run Review + Report before exporting PDF.");
  }

  mkdirSync(p.graderDir, { recursive: true });
  const report = JSON.parse(readFileSync(p.gradingReportPath, "utf8"));
  const markdown = readFileSync(markdownPath, "utf8");
  const filename = buildPdfFilename();
  const namedPdfPath = path.join(p.graderDir, filename);
  writeFileSync(p.reportPrintHtmlPath, buildReportDocumentHtml({ report, markdown }), "utf8");
  rmSync(p.reportPdfPath, { force: true });
  rmSync(namedPdfPath, { force: true });

  const chromePath = findChromeExecutable();
  const userDataDir = path.join(os.tmpdir(), `sbs-report-pdf-${process.pid}-${Date.now()}`);
  const chromeArgs = [
    "--headless=new",
    "--disable-gpu",
    "--disable-background-networking",
    "--disable-component-update",
    "--disable-crash-reporter",
    "--disable-sync",
    "--metrics-recording-only",
    "--no-first-run",
    "--no-default-browser-check",
    `--user-data-dir=${userDataDir}`,
    "--no-pdf-header-footer",
    `--print-to-pdf=${namedPdfPath}`,
    pathToFileUrl(p.reportPrintHtmlPath),
  ];
  const result = await runChromeUntilPdfReady(chromePath, chromeArgs, namedPdfPath);
  cleanupTempDir(userDataDir);
  if (!existsSync(namedPdfPath)) {
    throw new Error(
      [
        "PDF export failed.",
        result.stderr?.trim(),
        result.stdout?.trim(),
      ].filter(Boolean).join("\n"),
    );
  }
  copyFileSync(namedPdfPath, p.reportPdfPath);

  // In the desktop app, revealing the generated file is more reliable than relying
  // on WKWebView's download handling.
  spawnSync("open", ["-R", namedPdfPath], { encoding: "utf8" });
  const stat = statSync(namedPdfPath);
  return {
    ok: true,
    taskId,
    pdfPath: path.relative(rootDir, namedPdfPath),
    compatibilityPdfPath: path.relative(rootDir, p.reportPdfPath),
    htmlPath: path.relative(rootDir, p.reportPrintHtmlPath),
    filename,
    downloadUrl: `/api/grader/report-pdf?t=${encodeURIComponent(String(stat.mtimeMs))}`,
    size: stat.size,
    updatedAt: stat.mtime.toISOString(),
  };
}

function cleanupTempDir(dir) {
  try {
    rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
  } catch {
    // Chrome helpers can release files a moment after the PDF is ready. Temp
    // cleanup must not turn a successful PDF export into a user-facing failure.
  }
}

function runChromeUntilPdfReady(chromePath, args, pdfPath) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const child = spawn(chromePath, args, { cwd: rootDir, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let lastSize = -1;
    let stableTicks = 0;
    let settled = false;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearInterval(interval);
      clearTimeout(timeout);
      if (child.exitCode === null) child.kill("SIGTERM");
      resolve(result);
    };

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("exit", (status) => {
      if (settled) return;
      if (existsSync(pdfPath)) {
        finish({ status, stdout, stderr });
      } else {
        settled = true;
        clearInterval(interval);
        clearTimeout(timeout);
        reject(new Error([`Chrome PDF renderer exited with status ${status}.`, stderr.trim(), stdout.trim()].filter(Boolean).join("\n")));
      }
    });

    const interval = setInterval(() => {
      if (!existsSync(pdfPath)) return;
      const size = statSync(pdfPath).size;
      if (size > 0 && size === lastSize) stableTicks += 1;
      else stableTicks = 0;
      lastSize = size;
      if (stableTicks >= 2) {
        finish({ status: 0, stdout, stderr, elapsedMs: Date.now() - startedAt });
      }
    }, 250);

    const timeout = setTimeout(() => {
      if (existsSync(pdfPath)) {
        finish({ status: null, stdout, stderr, timedOutAfterPdfReady: true });
        return;
      }
      if (child.exitCode === null) child.kill("SIGTERM");
      settled = true;
      clearInterval(interval);
      reject(new Error(["Timed out while generating PDF.", stderr.trim(), stdout.trim()].filter(Boolean).join("\n")));
    }, 30000);
  });
}

function findChromeExecutable() {
  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error("No Chrome/Chromium executable found for PDF export.");
  }
  return found;
}

function pathToFileUrl(filePath) {
  return `file://${filePath.split(path.sep).map(encodeURIComponent).join("/")}`;
}

export function readCurrentGraderPdf() {
  const taskId = getCurrentState().activeTask?.taskId;
  if (!taskId) throw new Error("Create or select an evaluation task first.");
  const p = getGraderPaths(taskId);
  const filename = buildPdfFilename();
  const namedPdfPath = path.join(p.graderDir, filename);
  const pdfPath = existsSync(namedPdfPath) ? namedPdfPath : p.reportPdfPath;
  if (!existsSync(pdfPath)) throw new Error("No exported PDF found. Export PDF first.");
  return {
    path: pdfPath,
    filename,
    bytes: readFileSync(pdfPath),
  };
}

function buildPdfFilename() {
  const task = getCurrentState().activeTask;
  const label = String(task?.title || task?.taskSpace?.label || "sbs-report")
    .replace(/[^\p{Letter}\p{Number}._-]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "sbs-report";
  return `${label}-SBS-report.pdf`;
}

function buildReportDocumentHtml({ report, markdown }) {
  const title = report.executiveVerdict?.headline || report.executiveVerdict?.verdict || "SBS Grading Report";
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page {
      size: A4;
      margin: 0;
    }
    * { box-sizing: border-box; }
    body {
      color: #1f2933;
      font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Segoe UI", sans-serif;
      font-size: 12.2px;
      line-height: 1.62;
      margin: 0;
      padding: 18mm 17mm 18mm 17mm;
    }
    .doc-meta {
      border-bottom: 1px solid #d8dee7;
      color: #627083;
      font-size: 11px;
      margin-bottom: 16px;
      padding-bottom: 8px;
    }
    h1 {
      color: #111827;
      font-size: 28px;
      line-height: 1.2;
      margin: 0 0 14px;
      page-break-after: avoid;
    }
    h2 {
      border-top: 1px solid #d8dee7;
      color: #111827;
      font-size: 19px;
      margin: 26px 0 10px;
      padding-top: 14px;
      page-break-after: avoid;
    }
    h3 {
      color: #182230;
      font-size: 15px;
      margin: 18px 0 8px;
      page-break-after: avoid;
    }
    h4 {
      color: #263445;
      font-size: 13px;
      margin: 14px 0 6px;
      page-break-after: avoid;
    }
    p { margin: 0 0 9px; }
    ul, ol { margin: 6px 0 11px 18px; padding: 0; }
    li { margin: 3px 0; }
    strong { color: #111827; }
    blockquote {
      border-left: 3px solid #cbd5e1;
      color: #475569;
      margin: 10px 0;
      padding: 6px 0 6px 12px;
    }
    table {
      border-collapse: collapse;
      font-size: 11px;
      margin: 10px 0 16px;
      page-break-inside: avoid;
      width: 100%;
    }
    th {
      background: #f3f5f8;
      color: #475569;
      font-weight: 700;
      text-align: left;
    }
    th, td {
      border: 1px solid #d8dee7;
      padding: 6px 7px;
      vertical-align: top;
    }
    tr { page-break-inside: avoid; }
    code {
      background: #f3f5f8;
      border-radius: 4px;
      color: #334155;
      font-family: "SFMono-Regular", Consolas, monospace;
      font-size: 10.8px;
      padding: 1px 3px;
    }
    pre {
      background: #f8fafc;
      border: 1px solid #d8dee7;
      border-radius: 8px;
      font-family: "SFMono-Regular", Consolas, monospace;
      font-size: 10.5px;
      line-height: 1.5;
      overflow-wrap: anywhere;
      padding: 10px;
      white-space: pre-wrap;
    }
    .report-body > :first-child { margin-top: 0; }
  </style>
</head>
<body>
  <div class="doc-meta">SBS 4 Any Agent · Document-grade PDF export · ${escapeHtml(new Date().toLocaleString())}</div>
  <article class="report-body">
    ${markdownToHtml(markdown)}
  </article>
</body>
</html>`;
}

function markdownToHtml(markdown) {
  const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let paragraph = [];
  let listType = "";
  let tableBuffer = [];
  let inCode = false;
  let codeBuffer = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    html.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (!listType) return;
    html.push(`</${listType}>`);
    listType = "";
  };
  const flushTable = () => {
    if (!tableBuffer.length) return;
    if (tableBuffer.length >= 2 && isMarkdownTableSeparator(tableBuffer[1])) {
      const rows = tableBuffer.filter((_, idx) => idx !== 1).map(parseTableRow);
      const [header, ...body] = normalizeTableRows(rows);
      html.push(
        `<table><thead><tr>${header.map((cell) => `<th>${inlineMarkdown(cell)}</th>`).join("")}</tr></thead><tbody>${body.map((row) => `<tr>${row.map((cell) => `<td>${inlineMarkdown(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>`,
      );
    } else {
      html.push(...tableBuffer.map((line) => `<p>${inlineMarkdown(line)}</p>`));
    }
    tableBuffer = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (line.startsWith("```")) {
      flushParagraph();
      flushList();
      flushTable();
      if (inCode) {
        html.push(`<pre><code>${escapeHtml(codeBuffer.join("\n"))}</code></pre>`);
        codeBuffer = [];
        inCode = false;
      } else {
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeBuffer.push(rawLine);
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      flushList();
      flushTable();
      continue;
    }
    if (line.includes("|") && !/^[-*]\s+/.test(line.trim())) {
      flushParagraph();
      flushList();
      tableBuffer.push(line);
      continue;
    }
    flushTable();
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }
    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      if (listType !== "ul") {
        flushList();
        listType = "ul";
        html.push("<ul>");
      }
      html.push(`<li>${inlineMarkdown(bullet[1])}</li>`);
      continue;
    }
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (ordered) {
      flushParagraph();
      if (listType !== "ol") {
        flushList();
        listType = "ol";
        html.push("<ol>");
      }
      html.push(`<li>${inlineMarkdown(ordered[1])}</li>`);
      continue;
    }
    if (line.startsWith(">")) {
      flushParagraph();
      flushList();
      html.push(`<blockquote>${inlineMarkdown(line.replace(/^>\s?/, ""))}</blockquote>`);
      continue;
    }
    paragraph.push(line.trim());
  }
  if (inCode) html.push(`<pre><code>${escapeHtml(codeBuffer.join("\n"))}</code></pre>`);
  flushParagraph();
  flushList();
  flushTable();
  return html.join("\n");
}

function parseTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isMarkdownTableSeparator(line) {
  const cells = parseTableRow(line);
  if (cells.length < 2) return false;
  return cells.every((cell) => /^:?-+:?$/.test(cell.trim()));
}

function normalizeTableRows(rows) {
  const width = Math.max(...rows.map((row) => row.length));
  return rows.map((row) => {
    if (row.length === width) return row;
    return [...row, ...Array.from({ length: width - row.length }, () => "")];
  });
}

function inlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
