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
 * Long-poll Telegram bot:
 *   /run          — then paste GPT + Cursor links (same or next message)
 *   /run <gpt> <cursor>
 *   /status       — all agents
 *   /status <id>  — one agent
 *   /stop <id>
 *   /stopall
 *   /help
 *
 * Sends a message when an agent hits Automation Done (or fails).
 */

const pendingByChat = new Map(); // chatId -> { step, gptUrl? }

function helpText() {
  return [
    "GPT ↔ Cursor Telegram control",
    "",
    `Max agents: ${config.maxAgents} (= ${config.maxAgents * 2} browser tabs)`,
    "",
    "Commands:",
    "/run — start a run (send 2 links)",
    "/run <gpt_url> <cursor_url>",
    "/status — all agents",
    "/status <id> — one agent",
    "/stop <id> — stop one run",
    "/stopall — stop every run",
    "/help — this message",
    "",
    "After Automation Done you get a Telegram ping automatically.",
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
    `GPT-Cursor online.\nMax ${config.maxAgents} agents / ${config.maxAgents * 2} tabs.\nSend /help`
  );

  const manager = new AgentManager({
    session,
    maxAgents: config.maxAgents,
    onEvent: async (event, payload) => {
      if (event === "log") {
        // Keep console only for noisy loop logs; major milestones still useful.
        return;
      }
      if (event === "agent_started") {
        await tg.sendMessage(
          `Started agent #${payload.agentId}\n` +
            `Active ${payload.active}/${payload.max}\n` +
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
            `Cursor: ${payload.cursorUrl}`
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
        await tg.sendMessage(`⏹ Agent #${payload.agentId} stopped (loop ${payload.loops})`);
      }
    },
  });

  async function tryStartRun(chatId, text) {
    const { gptUrl, cursorUrl } = splitGptCursorUrls(text);
    const pending = pendingByChat.get(String(chatId));

    if (pending?.step === "gpt" && gptUrl) {
      pendingByChat.set(String(chatId), { step: "cursor", gptUrl });
      if (cursorUrl) {
        // both in same message
      } else {
        await tg.sendMessage("Got GPT link. Now send the Cursor agent URL.", { chatId });
        return true;
      }
    }

    const gpt = gptUrl || pending?.gptUrl;
    const cursor = cursorUrl;
    if (gpt && cursor) {
      pendingByChat.delete(String(chatId));
      try {
        const { id } = await manager.start({
          gptUrl: gpt,
          cursorUrl: cursor,
          startedBy: `telegram:${chatId}`,
        });
        await tg.sendMessage(`Agent #${id} queued/running.\n/status ${id}`, { chatId });
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
      // Continuation of /run flow — accept bare URLs
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

    if (cmd === "start" || cmd === "help") {
      await tg.sendMessage(helpText(), { chatId });
      return;
    }

    if (cmd === "status") {
      const id = rest.trim().split(/\s+/)[0] || null;
      await tg.sendMessage(manager.formatStatus(id), { chatId });
      return;
    }

    if (cmd === "stop") {
      const id = rest.trim().split(/\s+/)[0];
      if (!id) {
        await tg.sendMessage("Usage: /stop <id>\nOr /stopall", { chatId });
        return;
      }
      try {
        await manager.stop(id);
        await tg.sendMessage(`Stop requested for #${id}\n${manager.formatStatus(id)}`, {
          chatId,
        });
      } catch (err) {
        await tg.sendMessage(err.message, { chatId });
      }
      return;
    }

    if (cmd === "stopall") {
      await manager.stopAll();
      await tg.sendMessage("Stop requested for all agents.", { chatId });
      return;
    }

    if (cmd === "run") {
      if (rest.trim()) {
        const handled = await tryStartRun(chatId, rest);
        if (!handled) {
          pendingByChat.set(String(chatId), { step: "gpt" });
          await tg.sendMessage(
            "Send the GPT chat URL, then the Cursor agent URL.\n(Or both in one message.)",
            { chatId }
          );
        }
        return;
      }
      pendingByChat.set(String(chatId), { step: "gpt" });
      await tg.sendMessage(
        "Send the GPT chat URL, then the Cursor agent URL.\n(Or both in one message.)",
        { chatId }
      );
      return;
    }

    await tg.sendMessage(`Unknown command /${cmd}\n\n${helpText()}`, { chatId });
  }

  // Drop backlog so we only handle new messages after boot.
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
      // Browser may have died while idle — keep CDP warm.
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
