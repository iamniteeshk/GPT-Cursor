import fs from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";
import { ensureArtifactsDir, sleep } from "./browser.js";
import { isClosedError } from "./browser-session.js";
import {
  extractCursorPrompt,
  getLatestAssistantText,
  isAutomationComplete,
  isChatGptLoggedIn,
  openChatGpt,
  sendToChatGpt,
  waitForChatGptLogin,
} from "./chatgpt.js";
import {
  captureCursorImages,
  getLatestCursorText,
  isCursorLoggedIn,
  openCursorAgent,
  promptCompletedMarker,
  resolveCursorPage,
  resolvePromptNumber,
  sendPromptToCursor,
  waitForCursorLogin,
  waitForCursorReply,
  writeCursorDump,
} from "./cursor-agent.js";
import { dismissBlockingUi, installDialogHandlers } from "./popups.js";

function buildGptFollowUp({ cursorText, images, loopIndex, nextLoopIndex, stopPhrase }) {
  const nextMarker = promptCompletedMarker(nextLoopIndex);
  return [
    `Cursor agent output for Prompt ${loopIndex}:`,
    "",
    cursorText,
    "",
    images.length
      ? `Attached ${images.length} screenshot(s)/image(s) from Cursor.`
      : "No images were captured from Cursor this round.",
    "",
    "Write the next prompt for Cursor now.",
    `In that Cursor prompt, tell Cursor that when it finishes it must print exactly: ${nextMarker}`,
    "",
    "IMPORTANT STOP RULE:",
    `- If more Cursor work is needed, do NOT mention "${stopPhrase}" at all.`,
    `- Only when everything is fully finished, reply with EXACTLY these 2 words and nothing else:`,
    stopPhrase,
  ].join("\n");
}

export class AgentRunner {
  /**
   * @param {object} opts
   * @param {string} opts.id
   * @param {string} opts.gptUrl
   * @param {string} opts.cursorUrl
   * @param {import('./browser-session.js').BrowserSession} opts.session
   * @param {(msg: string) => Promise<void>|void} [opts.onEvent]
   */
  constructor({ id, gptUrl, cursorUrl, session, onEvent = async () => {} }) {
    this.id = id;
    this.gptUrl = gptUrl;
    this.cursorUrl = cursorUrl;
    this.session = session;
    this.onEvent = onEvent;
    this.status = "idle";
    this.loop = 0;
    this.promptNumber = 0;
    this.lastError = "";
    this.startedAt = null;
    this.finishedAt = null;
    this.stopRequested = false;
    this._task = null;
    this._pair = null;
  }

  snapshot() {
    return {
      id: this.id,
      status: this.status,
      loop: this.loop,
      promptNumber: this.promptNumber,
      gptUrl: this.gptUrl,
      cursorUrl: this.cursorUrl,
      lastError: this.lastError,
      startedAt: this.startedAt,
      finishedAt: this.finishedAt,
      stopRequested: this.stopRequested,
    };
  }

  async emit(message) {
    const line = `[${this.id}] ${message}`;
    console.log(line);
    try {
      await this.onEvent(line);
    } catch {
      // ignore notify failures
    }
  }

  requestStop() {
    this.stopRequested = true;
    this.status = "stopping";
  }

  start() {
    if (this._task) throw new Error(`Agent ${this.id} is already running`);
    this.stopRequested = false;
    this.startedAt = new Date().toISOString();
    this.finishedAt = null;
    this.lastError = "";
    this.status = "starting";
    this._task = this._run().finally(() => {
      this._task = null;
    });
    return this._task;
  }

  async _openPair() {
    const context = await this.session.ensureConnected();

    // Prefer existing tabs that already match this agent's URLs.
    const pages = context.pages().filter((p) => {
      try {
        return !p.isClosed();
      } catch {
        return false;
      }
    });

    const gptHint =
      this.gptUrl.split("/c/")[1]?.split("?")[0] ||
      this.gptUrl.slice(-24);
    let gptPage = pages.find((p) => {
      try {
        const u = p.url();
        return u.includes("chatgpt.com") && u.includes(gptHint);
      } catch {
        return false;
      }
    });

    let cursorPage = await resolveCursorPage(context, null, this.cursorUrl);

    if (!gptPage) gptPage = await this.session.newPage();
    await installDialogHandlers(gptPage);
    await installDialogHandlers(cursorPage);
    await openChatGpt(gptPage, { forceReload: true, gptUrl: this.gptUrl });
    await openCursorAgent(cursorPage, this.cursorUrl);
    await dismissBlockingUi(gptPage, { label: "ChatGPT" });
    await dismissBlockingUi(cursorPage, { label: "Cursor" });

    let gptOk = await isChatGptLoggedIn(gptPage);
    let cursorOk = await isCursorLoggedIn(cursorPage);
    if (!gptOk || !cursorOk) {
      await this.emit("Waiting for login in the browser…");
      if (!gptOk) await waitForChatGptLogin(gptPage, this.gptUrl);
      if (!cursorOk) await waitForCursorLogin(cursorPage);
    }

    this._pair = { context, gptPage, cursorPage };
    return this._pair;
  }

  async _withReconnect(fn, label) {
    let attempt = 0;
    while (attempt < 4) {
      try {
        return await fn();
      } catch (error) {
        if (!isClosedError(error) || this.stopRequested) throw error;
        attempt += 1;
        this.status = "reconnecting";
        await this.emit(
          `Browser crashed/closed during ${label}. Reconnect attempt ${attempt}/4…`
        );
        await sleep(3000);
        await this.session.ensureConnected();
        await this._openPair();
      }
    }
    throw new Error(`Browser kept crashing during ${label}`);
  }

  async _run() {
    await ensureArtifactsDir();
    const agentDir = path.join(config.artifactsDir, `agent-${this.id}`);
    await fs.mkdir(agentDir, { recursive: true });

    try {
      await this._openPair();
      this.status = "running";
      await this.emit("Started");

      let cachedGptText = "";
      let activeCursorPage = this._pair.cursorPage;

      while (!this.stopRequested) {
        this.loop += 1;
        this.status = "running";
        await this.emit(`LOOP ${this.loop}`);

        let assistantText = await this._withReconnect(async () => {
          const { gptPage } = this._pair;
          if (cachedGptText && cachedGptText.trim().length > 20) {
            return cachedGptText.trim();
          }
          await openChatGpt(gptPage, { gptUrl: this.gptUrl });
          await dismissBlockingUi(gptPage, { label: "ChatGPT" });
          return getLatestAssistantText(gptPage, { retries: 10 });
        }, "GPT read");
        cachedGptText = "";

        if (isAutomationComplete(assistantText, config.stopPhrase)) {
          this.status = "completed";
          this.finishedAt = new Date().toISOString();
          await fs.writeFile(
            path.join(agentDir, "final-gpt-message.txt"),
            assistantText,
            "utf8"
          );
          await this.emit("Automation Done");
          return { completed: true, loops: this.loop };
        }

        const prompt = extractCursorPrompt(assistantText);
        this.promptNumber = resolvePromptNumber(assistantText, this.loop);
        await fs.writeFile(
          path.join(agentDir, `gpt-loop-${this.loop}-prompt.txt`),
          prompt,
          "utf8"
        );
        await this.emit(
          `Sending Prompt #${this.promptNumber} to Cursor (${prompt.length} chars)`
        );

        await this._withReconnect(async () => {
          let { context, gptPage } = this._pair;
          activeCursorPage = await resolveCursorPage(
            context,
            activeCursorPage,
            this.cursorUrl
          );
          await openCursorAgent(activeCursorPage, this.cursorUrl);
          await dismissBlockingUi(activeCursorPage, { label: "Cursor" });
          const previousCursorText = await getLatestCursorText(
            activeCursorPage,
            this.promptNumber
          ).catch(() => "");
          await sendPromptToCursor(activeCursorPage, prompt, this.promptNumber);
          this.status = "waiting_cursor";
          await this.emit(`Waiting on Cursor for Prompt #${this.promptNumber}`);
          activeCursorPage =
            (await waitForCursorReply(
              activeCursorPage,
              previousCursorText,
              context,
              this.promptNumber,
              this.cursorUrl
            )) || activeCursorPage;

          const cursorText = await getLatestCursorText(
            activeCursorPage,
            this.promptNumber,
            previousCursorText
          );
          await this.emit(
            `Copied Cursor reply (${cursorText.length} chars). Preparing GPT paste…`
          );
          await writeCursorDump(`agent-${this.id}-loop-${this.loop}`, cursorText);
          await fs.writeFile(
            path.join(agentDir, `cursor-loop-${this.loop}-text.txt`),
            cursorText,
            "utf8"
          );
          await this.emit(`Cursor done (${cursorText.length} chars). Capturing images…`);
          let images = [];
          try {
            images = await Promise.race([
              captureCursorImages(activeCursorPage, `agent-${this.id}-loop-${this.loop}`),
              sleep(45_000).then(() => {
                throw new Error("image capture timed out");
              }),
            ]);
          } catch (error) {
            await this.emit(`Image capture skipped (${error.message}). Sending text only.`);
            images = [];
          }
          await this.emit(
            `Opening GPT to paste Cursor output (${cursorText.length} chars, ${images.length} img)…`
          );

          const followUp = buildGptFollowUp({
            cursorText,
            images,
            loopIndex: this.promptNumber,
            nextLoopIndex: this.promptNumber + 1,
            stopPhrase: config.stopPhrase,
          });

          this.status = "waiting_gpt";
          await openChatGpt(gptPage, { gptUrl: this.gptUrl });
          gptPage.__onGptProgress = async (line) => {
            await this.emit(line);
          };
          try {
            await sendToChatGpt(gptPage, { text: followUp, imagePaths: images });
          } finally {
            gptPage.__onGptProgress = null;
          }
          let nextAssistant;
          try {
            nextAssistant = await getLatestAssistantText(gptPage, { retries: 10 });
          } catch (error) {
            await this.emit(`GPT reply read failed (${error.message}). Reloading…`);
            await openChatGpt(gptPage, { forceReload: true, gptUrl: this.gptUrl });
            nextAssistant = await getLatestAssistantText(gptPage, { retries: 12 });
          }
          await fs.writeFile(
            path.join(agentDir, `gpt-loop-${this.loop}-reply.txt`),
            nextAssistant,
            "utf8"
          );

          if (isAutomationComplete(nextAssistant, config.stopPhrase)) {
            this.status = "completed";
            this.finishedAt = new Date().toISOString();
            await fs.writeFile(
              path.join(agentDir, "final-gpt-message.txt"),
              nextAssistant,
              "utf8"
            );
            await this.emit("Automation Done");
            cachedGptText = "";
            return { done: true };
          }

          cachedGptText = nextAssistant;
          await this.emit("GPT follow-up ready. Continuing…");
          return { done: false };
        }, "Cursor/GPT turn");

        if (this.status === "completed") {
          return { completed: true, loops: this.loop };
        }
      }

      this.status = "stopped";
      this.finishedAt = new Date().toISOString();
      await this.emit("Stopped by request");
      return { completed: false, loops: this.loop, stopped: true };
    } catch (error) {
      this.status = "error";
      this.lastError = error.message || String(error);
      this.finishedAt = new Date().toISOString();
      await this.emit(`ERROR: ${this.lastError}`);
      throw error;
    }
  }
}
