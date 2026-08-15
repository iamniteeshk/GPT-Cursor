import { chromium } from "playwright";
import {
  config,
  defaultBrowserUserDataDir,
  defaultDebugProfileDir,
} from "./config.js";
import { denyBrowserPermissions } from "./popups.js";
import { sleep } from "./browser.js";

function isClosedError(error) {
  const msg = String(error?.message || error || "");
  return /has been closed|Target closed|browser has been closed|Context closed|Connection closed|ECONNREFUSED/i.test(
    msg
  );
}

export class BrowserSession {
  constructor() {
    this.browser = null;
    this.context = null;
  }

  async connect() {
    const label = config.browserName === "chrome" ? "Chrome" : "Edge";
    console.log(`Connecting to ${label} via CDP: ${config.cdpUrl}`);
    try {
      this.browser = await chromium.connectOverCDP(config.cdpUrl);
      this.context = this.browser.contexts()[0] || (await this.browser.newContext());
      await denyBrowserPermissions(this.context);
      return this.context;
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
          `Real profile: ${defaultBrowserUserDataDir(config.browserName)}`,
          `Debug profile: ${defaultDebugProfileDir(config.browserName)}`,
          "",
          `Details: ${error.message}`,
        ].join("\n")
      );
    }
  }

  async ensureConnected() {
    try {
      if (!this.context) {
        await this.connect();
        return this.context;
      }
      // Touch the context; throws if browser crashed.
      this.context.pages();
      return this.context;
    } catch (error) {
      if (!isClosedError(error) && this.context) throw error;
      console.warn("Browser/CDP session lost. Reconnecting…");
      await sleep(2000);
      await this.connect();
      return this.context;
    }
  }

  async newPage() {
    const context = await this.ensureConnected();
    return context.newPage();
  }

  async getOrCreatePage(urlHint = []) {
    const context = await this.ensureConnected();
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
}

export { isClosedError };
