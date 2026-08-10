import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const config = {
  gptUrl: required(
    "GPT_URL",
    "https://chatgpt.com/c/6a79d41c-5274-83ee-8822-c78db9ded87f"
  ),
  cursorUrl: required(
    "CURSOR_URL",
    "https://cursor.com/agents/bc-a815a9ed-9dda-47b4-96db-e0d48dad0c95"
  ),
  cdpUrl: process.env.CDP_URL || "http://127.0.0.1:9222",
  stopPhrase: process.env.STOP_PHRASE || "AUTOMATION COMPLETED",
  cursorReplyTimeoutMs: Number(process.env.CURSOR_REPLY_TIMEOUT_MS || 1_800_000),
  gptReplyTimeoutMs: Number(process.env.GPT_REPLY_TIMEOUT_MS || 600_000),
  loginWaitMs: Number(process.env.LOGIN_WAIT_MS || 600_000),
  chromeUserDataDir: process.env.CHROME_USER_DATA_DIR || "",
  chromeProfileDirectory: process.env.CHROME_PROFILE_DIRECTORY || "Default",
  artifactsDir: path.resolve(__dirname, "../artifacts"),
};
