import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { config, setRuntimeUrls } from "./config.js";

function looksLikeUrl(value, hostPart) {
  try {
    const u = new URL(String(value).trim());
    return u.protocol.startsWith("http") && u.href.includes(hostPart);
  } catch {
    return false;
  }
}

async function ask(rl, label, { defaultValue = "", validate } = {}) {
  const suffix = defaultValue ? ` [${defaultValue}]` : "";
  while (true) {
    const answer = (await rl.question(`${label}${suffix}: `)).trim();
    const value = answer || defaultValue;
    if (!value) {
      console.log("  Please enter a value.");
      continue;
    }
    if (validate && !validate(value)) {
      console.log("  Invalid URL. Try again.");
      continue;
    }
    return value;
  }
}

/**
 * Each run: ask for GPT + Cursor links in the terminal.
 * Env/.env values are only used as editable defaults.
 */
export async function promptForUrls() {
  const rl = readline.createInterface({ input, output });
  try {
    console.log("");
    console.log("Enter chat links for this run:");
    const gptUrl = await ask(rl, "GPT chat URL", {
      defaultValue: config.gptUrl || process.env.GPT_URL || "",
      validate: (v) => looksLikeUrl(v, "chatgpt.com"),
    });
    const cursorUrl = await ask(rl, "Cursor agent URL", {
      defaultValue: config.cursorUrl || process.env.CURSOR_URL || "",
      validate: (v) => looksLikeUrl(v, "cursor.com"),
    });
    setRuntimeUrls({ gptUrl, cursorUrl });
    console.log("");
    console.log(`Using GPT:    ${gptUrl}`);
    console.log(`Using Cursor: ${cursorUrl}`);
    console.log(
      `Timeouts: Cursor ${Math.round(config.cursorReplyTimeoutMs / 60000)}m | GPT ${Math.round(config.gptReplyTimeoutMs / 60000)}m | poll ${Math.round(config.pollIntervalMs / 1000)}s`
    );
    console.log("");
    return { gptUrl, cursorUrl };
  } finally {
    rl.close();
  }
}
