import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { config, defaultChromeUserDataDir } from "./config.js";

export async function ensureArtifactsDir() {
  await fs.mkdir(config.artifactsDir, { recursive: true });
  return config.artifactsDir;
}

export async function connectBrowser() {
  console.log(`Connecting to Chrome via CDP: ${config.cdpUrl}`);
  try {
    const browser = await chromium.connectOverCDP(config.cdpUrl);
    const context = browser.contexts()[0] || (await browser.newContext());
    return { browser, context, mode: "cdp" };
  } catch (error) {
    const isWin = process.platform === "win32";
    throw new Error(
      [
        `Could not connect to Chrome at ${config.cdpUrl}.`,
        "",
        "Start debug Chrome first:",
        isWin ? "  .\\scripts\\start-chrome.ps1" : "  bash scripts/start-chrome.sh",
        "",
        "Wait until it prints: CDP is ready",
        "Then run: npm start",
        "",
        `Default Chrome profile dir: ${defaultChromeUserDataDir()}`,
        `Debug profile dir: ${config.debugChromeDir}`,
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
