import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { config } from "./config.js";

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
    if (!config.chromeUserDataDir) {
      throw new Error(
        [
          `Could not connect to Chrome at ${config.cdpUrl}.`,
          "Start Chrome with remote debugging first:",
          "  Windows: .\\scripts\\start-chrome.ps1",
          "  macOS/Linux: bash scripts/start-chrome.sh",
          "Or set CHROME_USER_DATA_DIR in .env to launch with your profile.",
          `Details: ${error.message}`,
        ].join("\n")
      );
    }

    console.log(
      `CDP unavailable. Launching persistent Chrome profile: ${config.chromeUserDataDir}`
    );
    const context = await chromium.launchPersistentContext(config.chromeUserDataDir, {
      channel: "chrome",
      headless: false,
      args: [`--profile-directory=${config.chromeProfileDirectory}`],
      viewport: null,
    });
    return { browser: context, context, mode: "persistent" };
  }
}

export async function getOrCreatePage(context, urlHint) {
  const pages = context.pages();
  const existing = pages.find((page) => {
    const url = page.url();
    return urlHint.some((hint) => url.includes(hint));
  });
  if (existing) {
    await existing.bringToFront();
    return existing;
  }
  const page = await context.newPage();
  return page;
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
