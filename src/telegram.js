/**
 * Minimal Telegram Bot API client (no extra deps — uses Node fetch).
 */
export class TelegramClient {
  constructor({ token, chatId, allowedChatIds = [] } = {}) {
    this.token = String(token || "").trim();
    this.defaultChatId = String(chatId || "").trim();
    this.allowedChatIds = new Set(
      [this.defaultChatId, ...allowedChatIds]
        .map((x) => String(x || "").trim())
        .filter(Boolean)
    );
    this.offset = 0;
    this._stopped = false;
  }

  get enabled() {
    return Boolean(this.token && this.defaultChatId);
  }

  isAllowedChat(chatId) {
    if (!this.allowedChatIds.size) return true;
    return this.allowedChatIds.has(String(chatId));
  }

  apiUrl(method) {
    return `https://api.telegram.org/bot${this.token}/${method}`;
  }

  async call(method, body = {}) {
    const res = await fetch(this.apiUrl(method), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      const desc = data.description || res.statusText || "Telegram API error";
      throw new Error(`Telegram ${method}: ${desc}`);
    }
    return data.result;
  }

  async sendMessage(text, { chatId = this.defaultChatId, parseMode = null } = {}) {
    if (!this.enabled) return null;
    const payload = {
      chat_id: chatId,
      text: String(text).slice(0, 4000),
      disable_web_page_preview: true,
    };
    if (parseMode) payload.parse_mode = parseMode;
    return this.call("sendMessage", payload);
  }

  async getUpdates({ timeout = 25 } = {}) {
    return this.call("getUpdates", {
      offset: this.offset,
      timeout,
      allowed_updates: ["message"],
    });
  }

  markUpdate(update) {
    if (update?.update_id != null) {
      this.offset = update.update_id + 1;
    }
  }

  stop() {
    this._stopped = true;
  }

  get stopped() {
    return this._stopped;
  }
}

export function parseCommand(text) {
  const raw = String(text || "").trim();
  if (!raw.startsWith("/")) return null;
  // /cmd@BotName args...
  const first = raw.split(/\s+/)[0];
  const cmd = first.replace(/^\/+/, "").split("@")[0].toLowerCase();
  const rest = raw.slice(first.length).trim();
  return { cmd, rest, raw };
}

export function extractUrls(text) {
  const matches = String(text || "").match(/https?:\/\/[^\s<>"']+/gi) || [];
  return matches.map((u) => u.replace(/[),.;]+$/, ""));
}

export function splitGptCursorUrls(text) {
  const urls = extractUrls(text);
  const gpt = urls.find((u) => /chatgpt\.com/i.test(u));
  const cursor = urls.find((u) => /cursor\.com/i.test(u));
  return { gptUrl: gpt || "", cursorUrl: cursor || "", urls };
}
