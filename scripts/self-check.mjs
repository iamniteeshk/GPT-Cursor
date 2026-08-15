import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// Inline copies of pure helpers so this runs without Playwright/browser.
function agentIdFromUrl(url) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] || "";
  } catch {
    const noQuery = String(url).split("?")[0].split("#")[0];
    const parts = noQuery.split("/").filter(Boolean);
    return parts[parts.length - 1] || "";
  }
}

function resolvePromptNumber(assistantText, loopIndex) {
  const matches = [...String(assistantText || "").matchAll(/Prompt\s+(\d+)\s+Completed/gi)];
  if (!matches.length) return loopIndex;
  return Math.max(...matches.map((m) => Number(m[1])));
}

function isAutomationComplete(assistantText, stopPhrase = "Automation Done") {
  const text = String(assistantText || "").trim();
  if (!text) return false;
  const stopRe = new RegExp(
    stopPhrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+"),
    "i"
  );
  if (!stopRe.test(text)) return false;
  const normalized = text.replace(/\s+/g, " ").trim();
  const stopNormalized = String(stopPhrase).replace(/\s+/g, " ").trim();
  if (
    new RegExp(`^${stopNormalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.?$`, "i").test(
      normalized
    )
  ) {
    return true;
  }
  if (text.length <= 80) return true;
  const hasNextPromptOrder =
    /Prompt\s+\d+\s+Completed/i.test(text) &&
    /(when\s+(you\s+)?(are\s+)?(completely\s+)?finished|print\s+exactly|final pass|implement|fix|verify)/i.test(
      text
    );
  if (hasNextPromptOrder) return false;
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const last = lines[lines.length - 1] || "";
  if (stopRe.test(last) && last.length <= stopPhrase.length + 10 && text.length < 300) {
    return true;
  }
  return false;
}

function countPromptCompleted(text, loopIndex) {
  const re = new RegExp(`Prompt\\s*${loopIndex}\\s*Completed`, "gi");
  return (String(text || "").match(re) || []).length;
}

console.log("Running GPT-Cursor self-check...");

assert(
  agentIdFromUrl(
    "https://cursor.com/agents/bc-a57b6d63-a511-442c-b975-872a60097e2b?branch=cursor%2Fmemory-app-mvp-7e2b"
  ) === "bc-a57b6d63-a511-442c-b975-872a60097e2b",
  "agentIdFromUrl should strip query string"
);

assert(
  resolvePromptNumber("When finished print Prompt 8 Completed", 1) === 8,
  "resolvePromptNumber should prefer GPT prompt number"
);
assert(resolvePromptNumber("no marker here", 3) === 3, "resolvePromptNumber fallback");

assert(isAutomationComplete("Automation Done") === true, "pure stop should complete");
assert(
  isAutomationComplete(
    "This is the final pass.\nWhen completely finished, print EXACTLY: Prompt 8 Completed\nAutomation Done"
  ) === false,
  "Prompt 8 + Automation Done must NOT stop early"
);
assert(
  countPromptCompleted("print Prompt 2 Completed\n...\nPrompt 2 Completed", 2) === 2,
  "marker counting"
);

function splitGptCursorUrls(text) {
  const matches = String(text || "").match(/https?:\/\/[^\s<>"']+/gi) || [];
  const urls = matches.map((u) => u.replace(/[),.;]+$/, ""));
  const gpt = urls.find((u) => /chatgpt\.com/i.test(u)) || "";
  const cursor = urls.find((u) => /cursor\.com/i.test(u)) || "";
  return { gptUrl: gpt, cursorUrl: cursor };
}

const sample = splitGptCursorUrls(
  "go https://chatgpt.com/c/abc123 and https://cursor.com/agents/bc-xyz?branch=x"
);
assert(sample.gptUrl.includes("chatgpt.com"), "telegram URL parse gpt");
assert(sample.cursorUrl.includes("cursor.com/agents/bc-xyz"), "telegram URL parse cursor");

// Slot allocator: lowest free among 1..5
function nextFreeSlot(busySet, max = 5) {
  for (let n = 1; n <= max; n += 1) {
    if (!busySet.has(String(n))) return String(n);
  }
  return null;
}
assert(nextFreeSlot(new Set()) === "1", "first run uses slot 1");
assert(nextFreeSlot(new Set(["1"])) === "2", "second run uses slot 2");
assert(nextFreeSlot(new Set(["1", "2", "3", "4"])) === "5", "fifth run uses slot 5");
assert(nextFreeSlot(new Set(["1", "2", "3", "4", "5"])) === null, "all busy");
assert(nextFreeSlot(new Set(["1", "3"])) === "2", "fills lowest gap");

const requiredFiles = [
  "src/index.js",
  "src/telegram-main.js",
  "src/telegram.js",
  "src/agent-manager.js",
  "src/agent-runner.js",
  "src/browser-session.js",
  "src/cursor-agent.js",
  "src/chatgpt.js",
  "src/browser.js",
  "src/config.js",
  "src/prompt-urls.js",
  "scripts/start-edge.sh",
  "scripts/start-edge.ps1",
  "scripts/start-chrome.sh",
  "scripts/start-chrome.ps1",
  "scripts/setup-windows.ps1",
  "scripts/setup-mac.sh",
  ".env.example",
];

for (const rel of requiredFiles) {
  await fs.access(path.join(root, rel));
}

const pkg = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"));
assert(pkg.scripts.telegram, "package.json must define telegram script");

console.log("Self-check passed.");
