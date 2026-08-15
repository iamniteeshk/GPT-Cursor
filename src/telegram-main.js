import { config } from "./config.js";
import { BrowserSession } from "./browser-session.js";
import { AgentManager } from "./agent-manager.js";
import { hasTelegramSecrets, describeSecrets, secrets } from "./secrets.js";
import {
  TelegramClient,
  parseCommand,
  splitGptCursorUrls,
} from "./telegram.js";

/**
 * Telegram control (agent slots 1–5):
 *   /status       — all 5 agents
 *   /status N     — one agent
 *   /run          — next free slot (1, then 2, … 5); paste GPT + Cursor links
 *   /run <gpt> <cursor>
 *   /stop         — stop ALL agents
 *   /stop N       — stop one agent
 *   /help
 *
 * Pings Telegram when Automation Done (or on failure).
 */

const pendingByChat = new Map(); // chatId -> { step, gptUrl? }

function helpText() {
  return [
    "GPT ↔ Cursor Telegram control",
    "",
    `Agents: slots 1–${config.maxAgents} (${config.maxAgents * 2} tabs)`,
    "/run fills lowest free slot: 1 → 2 → … → 5",
    "",
    "Commands:",
    "/status — status of all agents",
    "/status N — status of one agent (e.g. /status 2)",
    "/run — start on next free slot (then send 2 links)",
    "/run <gpt_url> <cursor_url>",
    "/stop — stop ALL agents",
    "/stop N — stop one agent (e.g. /stop 3)",
    "/help — this message",
    "",
    "You get a Telegram message when Automation Done.",
  ].join("\n");
}

async function main() {
  console.log("GPT ↔ Cursor Telegram listener");
  console.log(`Platform: ${config.platform}`);
  console.log(`Browser:  ${config.browserName}`);
  console.log("Secrets:", describeSecrets());

  if (!hasTelegramSecrets()) {
    console.error(
      [
        "Telegram secrets missing.",
        "Set TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID in .env",
        "or secrets.local.json (see .env.example / secrets.local.json.example).",
        "Then: npm run telegram",
      ].join("\n")
    );
    process.exitCode = 1;
    return;
  }

  const tg = new TelegramClient({
    token: secrets.telegramBotToken,
    chatId: secrets.telegramChatId,
    allowedChatIds: secrets.telegramAllowedChatIds || [],
  });

  const session = new BrowserSession();
  await session.ensureConnected();
  console.log("Browser CDP connected. Listening for Telegram commands…");
  await tg.sendMessage(
    `GPT-Cursor online.\nSlots 1–${config.maxAgents} (${config.maxAgents * 2} tabs).\n/help`
  );

  const manager = new AgentManager({
    session,
    maxAgents: config.maxAgents,
    onEvent: async (event, payload) => {
      if (event === "log") return;
      if (event === "agent_started") {
        await tg.sendMessage(
          `Started agent #${payload.agentId}\n` +
            `Busy ${payload.active}/${payload.max}\n` +
            `GPT: ${payload.gptUrl}\n` +
            `Cursor: ${payload.cursorUrl}`
        );
        return;
      }
      if (event === "agent_done") {
        await tg.sendMessage(
          `✅ Automation Done — agent #${payload.agentId}\n` +
            `Loops: ${payload.loops}\n` +
            `GPT: ${payload.gptUrl}\n` +
            `Cursor: ${payload.cursorUrl}\n` +
            `Slot #${payload.agentId} is free for /run`
        );
        return;
      }
      if (event === "agent_failed") {
        await tg.sendMessage(
          `❌ Agent #${payload.agentId} failed\n` +
            `${payload.error}\n` +
            `Loop: ${payload.loops ?? "?"}`
        );
        return;
      }
      if (event === "agent_stopped") {
        await tg.sendMessage(
          `⏹ Agent #${payload.agentId} stopped (loop ${payload.loops})\n` +
            `Slot #${payload.agentId} is free for /run`
        );
      }
    },
  });

  async function tryStartRun(chatId, text) {
    const { gptUrl, cursorUrl } = splitGptCursorUrls(text);
    const pending = pendingByChat.get(String(chatId));

    if (pending?.step === "gpt" && gptUrl) {
      pendingByChat.set(String(chatId), { step: "cursor", gptUrl });
      if (!cursorUrl) {
        await tg.sendMessage("Got GPT link. Now send the Cursor agent URL.", { chatId });
        return true;
      }
    }

    const gpt = gptUrl || pending?.gptUrl;
    const cursor = cursorUrl;
    if (gpt && cursor) {
      pendingByChat.delete(String(chatId));
      const slot = manager.nextFreeSlot();
      if (!slot) {
        await tg.sendMessage(
          `All ${config.maxAgents} agents busy.\n/status\n/stop N  or  /stop`,
          { chatId }
        );
        return true;
      }
      try {
        const { id } = await manager.start({
          gptUrl: gpt,
          cursorUrl: cursor,
          startedBy: `telegram:${chatId}`,
        });
        await tg.sendMessage(
          `Agent #${id} started (auto slot).\n/status ${id}\n/stop ${id}`,
          { chatId }
        );
      } catch (err) {
        await tg.sendMessage(`Could not start: ${err.message}`, { chatId });
      }
      return true;
    }

    if (gpt && !cursor) {
      pendingByChat.set(String(chatId), { step: "cursor", gptUrl: gpt });
      await tg.sendMessage("Got GPT link. Now send the Cursor agent URL.", { chatId });
      return true;
    }

    return false;
  }

  async function handleMessage(msg) {
    const chatId = msg.chat?.id;
    if (chatId == null) return;
    if (!tg.isAllowedChat(chatId)) {
      console.warn(`Ignored message from unauthorized chat ${chatId}`);
      return;
    }

    const text = msg.text || "";
    const parsed = parseCommand(text);

    if (!parsed) {
      if (pendingByChat.has(String(chatId)) || /https?:\/\//i.test(text)) {
        const handled = await tryStartRun(chatId, text);
        if (!handled) {
          await tg.sendMessage(
            "Need both links.\nSend /run then paste GPT URL and Cursor URL.",
            { chatId }
          );
        }
      }
      return;
    }

    const { cmd, rest } = parsed;
    const arg = rest.trim().split(/\s+/).filter(Boolean)[0] || "";

    if (cmd === "start" || cmd === "help") {
      await tg.sendMessage(helpText(), { chatId });
      return;
    }

    if (cmd === "status") {
      await tg.sendMessage(manager.formatStatus(arg || null), { chatId });
      return;
    }

    if (cmd === "stop" || cmd === "stopall") {
      // /stop        → all
      // /stop N      → one
      // /stopall     → all (alias)
      if (cmd === "stopall" || !arg) {
        const stopped = await manager.stopAll();
        await tg.sendMessage(
          stopped.length
            ? `Stopped agents: ${stopped.map((id) => `#${id}`).join(", ")}\n\n${manager.formatStatus()}`
            : `No busy agents.\n\n${manager.formatStatus()}`,
          { chatId }
        );
        return;
      }
      try {
        await manager.stop(arg);
        await tg.sendMessage(
          `Stopped agent #${arg}\n\n${manager.formatStatus(arg)}`,
          { chatId }
        );
      } catch (err) {
        await tg.sendMessage(err.message, { chatId });
      }
      return;
    }

    if (cmd === "run") {
      const free = manager.nextFreeSlot();
      if (!free) {
        await tg.sendMessage(
          `All ${config.maxAgents} agents busy.\n/status\n/stop N  or  /stop`,
          { chatId }
        );
        return;
      }
      if (rest.trim()) {
        const handled = await tryStartRun(chatId, rest);
        if (!handled) {
          pendingByChat.set(String(chatId), { step: "gpt" });
          await tg.sendMessage(
            `Will use agent #${free}.\nSend GPT chat URL, then Cursor agent URL.\n(Or both in one message.)`,
            { chatId }
          );
        }
        return;
      }
      pendingByChat.set(String(chatId), { step: "gpt" });
      await tg.sendMessage(
        `Will use agent #${free}.\nSend GPT chat URL, then Cursor agent URL.\n(Or both in one message.)`,
        { chatId }
      );
      return;
    }

    await tg.sendMessage(`Unknown command /${cmd}\n\n${helpText()}`, { chatId });
  }

  try {
    const backlog = await tg.getUpdates({ timeout: 0 });
    for (const u of backlog || []) tg.markUpdate(u);
  } catch (err) {
    console.warn("Could not clear Telegram backlog:", err.message);
  }

  while (!tg.stopped) {
    try {
      const updates = await tg.getUpdates({ timeout: 25 });
      for (const update of updates || []) {
        tg.markUpdate(update);
        if (update.message) {
          try {
            await handleMessage(update.message);
          } catch (err) {
            console.error("Handler error:", err.message || err);
            try {
              await tg.sendMessage(`Error: ${err.message || err}`);
            } catch {
              // ignore
            }
          }
        }
      }
    } catch (err) {
      console.warn("Telegram poll error:", err.message || err);
      await new Promise((r) => setTimeout(r, 3000));
      try {
        await session.ensureConnected();
      } catch (e) {
        console.warn("Browser reconnect while idle failed:", e.message);
      }
    }
  }
}

main().catch((error) => {
  console.error("\nTelegram listener failed:");
  console.error(error.message || error);
  process.exitCode = 1;
});
