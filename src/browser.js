import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import {
  config,
  defaultBrowserUserDataDir,
  defaultDebugProfileDir,
} from "./config.js";

export async function ensureArtifactsDir() {
  await fs.mkdir(config.artifactsDir, { recursive: true });
  return config.artifactsDir;
}

export async function connectBrowser() {
  const label = config.browserName === "chrome" ? "Chrome" : "Edge";
  console.log(`Connecting to ${label} via CDP: ${config.cdpUrl}`);
  try {
    const browser = await chromium.connectOverCDP(config.cdpUrl);
    const context = browser.contexts()[0] || (await browser.newContext());
    return { browser, context, mode: "cdp" };
  } catch (error) {
    const isWin = process.platform === "win32";
    const startCmd = isWin
      ? config.browserName === "chrome"
        ? "  .\\scripts\\start-chrome.ps1"
        : "  npm run edge:win   (or: powershell -ExecutionPolicy Bypass -File .\\scripts\\start-edge.ps1)"
      : config.browserName === "chrome"
        ? "  bash scripts/start-chrome.sh"
        : "  bash scripts/start-edge.sh";

    throw new Error(
      [
        `Could not connect to ${label} at ${config.cdpUrl}.`,
        "",
        "Start debug browser first:",
        startCmd,
        "",
        "Wait until it prints: CDP is ready",
        "Then run: npm start",
        "",
        `Real profile dir: ${defaultBrowserUserDataDir(config.browserName)}`,
        `Debug profile dir: ${defaultDebugProfileDir(config.browserName)}`,
        "",
        `Details: ${error.message}`,
      ].join("\n")
    );
  }
}

export async function getOrCreatePage(context, urlHint) {
  const pages = context.pages().filter((page) => {
    try {
      return !page.isClosed();
    } catch {
      return false;
    }
  });
  const existing = pages.find((page) => {
    const url = page.url();
    return urlHint.some((hint) => url.includes(hint));
  });
  if (existing) {
    await existing.bringToFront().catch(() => {});
    return existing;
  }
  return context.newPage();
}

export async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitUntil(label, timeoutMs, checkFn, intervalMs = 2000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const result = await checkFn();
    if (result) return result;
    await sleep(intervalMs);
  }
  throw new Error(`Timed out waiting for: ${label} (${timeoutMs}ms)`);
}

export function artifactPath(filename) {
  return path.join(config.artifactsDir, filename);
}
