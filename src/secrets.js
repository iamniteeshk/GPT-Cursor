import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const secretsPath = path.resolve(__dirname, "../secrets.local.json");

function readJsonSecrets() {
  try {
    if (!fs.existsSync(secretsPath)) return {};
    return JSON.parse(fs.readFileSync(secretsPath, "utf8"));
  } catch {
    return {};
  }
}

const fileSecrets = readJsonSecrets();

/**
 * Local secrets for autofill.
 * Priority: process.env / .env  >  secrets.local.json
 * Missing values are fine — automation proceeds normally.
 */
function splitIds(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String);
  return String(value)
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export const secrets = {
  telegramBotToken:
    process.env.TELEGRAM_BOT_TOKEN ||
    fileSecrets.telegramBotToken ||
    fileSecrets.TELEGRAM_BOT_TOKEN ||
    "",
  telegramChatId:
    process.env.TELEGRAM_CHAT_ID ||
    fileSecrets.telegramChatId ||
    fileSecrets.TELEGRAM_CHAT_ID ||
    "",
  telegramAllowedChatIds: splitIds(
    process.env.TELEGRAM_ALLOWED_CHAT_IDS ||
      fileSecrets.telegramAllowedChatIds ||
      fileSecrets.TELEGRAM_ALLOWED_CHAT_IDS ||
      ""
  ),
};

export function hasTelegramSecrets() {
  return Boolean(secrets.telegramBotToken && secrets.telegramChatId);
}

export function describeSecrets() {
  return {
    telegramBotToken: secrets.telegramBotToken ? "set" : "missing",
    telegramChatId: secrets.telegramChatId ? "set" : "missing",
    sourceFile: fs.existsSync(secretsPath) ? secretsPath : null,
  };
}
