import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

function num(name, fallback) {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

/** edge (default) | chrome */
export const browserName = (process.env.BROWSER || "edge").toLowerCase();

export function defaultBrowserUserDataDir(name = browserName) {
  if (name === "chrome") {
    if (process.platform === "win32") {
      return path.join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "User Data");
    }
    if (process.platform === "darwin") {
      return path.join(os.homedir(), "Library", "Application Support", "Google", "Chrome");
    }
    return path.join(os.homedir(), ".config", "google-chrome");
  }

  // Microsoft Edge
  if (process.platform === "win32") {
    return path.join(process.env.LOCALAPPDATA || "", "Microsoft", "Edge", "User Data");
  }
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "Microsoft Edge");
  }
  return path.join(os.homedir(), ".config", "microsoft-edge");
}

export function defaultDebugProfileDir(name = browserName) {
  const folder = name === "chrome" ? ".gpt-cursor-chrome" : ".gpt-cursor-edge";
  return (
    process.env.GPT_CURSOR_BROWSER_DIR ||
    process.env.GPT_CURSOR_CHROME_DIR ||
    path.join(os.homedir(), folder)
  );
}

// Back-compat alias
export function defaultChromeUserDataDir() {
  return defaultBrowserUserDataDir("chrome");
}

export const config = {
  // Filled at runtime via terminal prompts (env values are optional defaults).
  gptUrl: process.env.GPT_URL || "",
  cursorUrl: process.env.CURSOR_URL || "",
  cdpUrl: process.env.CDP_URL || "http://127.0.0.1:9222",
  stopPhrase: process.env.STOP_PHRASE || "Automation Done",
  browserName,
  // Up to 5 concurrent GPT↔Cursor pairs = 10 browser tabs
  maxAgents: Math.min(10, Math.max(1, num("MAX_AGENTS", 5))),
  // Cursor: 60 minutes, GPT: 20 minutes, poll every 60s
  cursorReplyTimeoutMs: num("CURSOR_REPLY_TIMEOUT_MS", 3_600_000),
  gptReplyTimeoutMs: num("GPT_REPLY_TIMEOUT_MS", 1_200_000),
  pollIntervalMs: num("POLL_INTERVAL_MS", 60_000),
  loginWaitMs: num("LOGIN_WAIT_MS", 1_200_000),
  chromeUserDataDir: process.env.CHROME_USER_DATA_DIR || "",
  chromeProfileDirectory:
    process.env.BROWSER_PROFILE_DIRECTORY ||
    process.env.CHROME_PROFILE_DIRECTORY ||
    "Default",
  debugChromeDir: defaultDebugProfileDir(browserName),
  artifactsDir: path.resolve(__dirname, "../artifacts"),
  platform: process.platform, // darwin | win32 | linux
};

export function setRuntimeUrls({ gptUrl, cursorUrl }) {
  config.gptUrl = gptUrl;
  config.cursorUrl = cursorUrl;
}
