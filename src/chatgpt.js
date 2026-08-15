import { config } from "./config.js";
import { sleep, waitUntil } from "./browser.js";
import { dismissBlockingUi, installDialogHandlers } from "./popups.js";

export async function openChatGpt(page, { forceReload = false, gptUrl = config.gptUrl } = {}) {
  await installDialogHandlers(page);
  const target = gptUrl || config.gptUrl;
  if (!target) throw new Error("GPT URL is not set");
  const chatId = target.split("/c/")[1]?.split("?")[0] || "___never___";
  const alreadyThere =
    page.url().includes("chatgpt.com") && page.url().includes(chatId);

  if (!alreadyThere || forceReload) {
    await page.goto(target, { waitUntil: "domcontentloaded", timeout: 120_000 });
  } else {
    await page.bringToFront();
  }

  await sleep(1500);
  await dismissBlockingUi(page, { label: "ChatGPT" });
  await waitForChatReady(page);
  await scrollConversationToBottom(page);
}

async function waitForChatReady(page) {
  await waitUntil("ChatGPT composer ready", 120_000, async () => {
    await dismissBlockingUi(page, { label: "ChatGPT" });
    return Boolean(await getComposer(page));
  }, 1000);
}

async function scrollConversationToBottom(page) {
  await page.evaluate(() => {
    const candidates = [
      ...document.querySelectorAll('[data-testid="conversation-turn-list"], main, [role="main"]'),
      document.scrollingElement,
    ].filter(Boolean);
    for (const el of candidates) {
      try {
        el.scrollTop = el.scrollHeight;
      } catch {
        // ignore
      }
    }
    window.scrollTo(0, document.body.scrollHeight);
  }).catch(() => {});
  await sleep(400);
}

export async function isChatGptLoggedIn(page) {
  const url = page.url();
  if (url.includes("/auth") || url.includes("login")) return false;

  const loginButton = page.getByRole("button", { name: /log in/i }).first();
  if (await loginButton.isVisible().catch(() => false)) return false;

  const signup = page.getByRole("button", { name: /sign up/i }).first();
  if (await signup.isVisible().catch(() => false)) {
    const composer = await getComposer(page);
    if (!composer) return false;
  }

  const composer = await getComposer(page);
  return Boolean(composer);
}

export async function waitForChatGptLogin(page, gptUrl = config.gptUrl) {
  console.log("Waiting for ChatGPT login...");
  console.log("Log in in the browser window, then this script will continue automatically.");
  await waitUntil("ChatGPT login", config.loginWaitMs, async () => {
    if (!page.url().includes("chatgpt.com")) {
      await openChatGpt(page, { forceReload: true, gptUrl });
    }
    return isChatGptLoggedIn(page);
  });
  console.log("ChatGPT login detected.");
}

async function getComposer(page) {
  const candidates = [
    page.locator("#prompt-textarea"),
    page.locator('[contenteditable="true"][data-testid="composer"]'),
    page.locator('div[contenteditable="true"][id="prompt-textarea"]'),
    page.locator('textarea[placeholder*="Message"]'),
    page.locator('[contenteditable="true"][data-virtualkeyboard]'),
    page.locator('div[contenteditable="true"]').last(),
  ];

  for (const candidate of candidates) {
    if (await candidate.first().isVisible().catch(() => false)) {
      return candidate.first();
    }
  }
  return null;
}

async function readAssistantOnce(page) {
  await scrollConversationToBottom(page);

  const selectors = [
    '[data-message-author-role="assistant"]',
    '[data-testid="assistant-message"]',
    'article[data-turn="assistant"]',
    '[data-turn="assistant"]',
    ".agent-turn",
    'div[class*="assistant"]',
  ];

  for (const selector of selectors) {
    try {
      const nodes = page.locator(selector);
      const count = await nodes.count();
      for (let i = count - 1; i >= 0 && i >= count - 8; i -= 1) {
        const text = ((await nodes.nth(i).innerText().catch(() => "")) || "").trim();
        if (text.length > 20) return text;
      }
    } catch {
      // next
    }
  }

  // Markdown / prose blocks in main thread.
  try {
    const markdown = page.locator(
      'main .markdown, main .prose, main [class*="markdown"], [data-message-author-role] .markdown'
    );
    const count = await markdown.count();
    for (let i = count - 1; i >= 0 && i >= count - 10; i -= 1) {
      const text = ((await markdown.nth(i).innerText().catch(() => "")) || "").trim();
      if (text.length > 40) return text;
    }
  } catch {
    // fall through
  }

  // DOM evaluate: find last assistant-looking turn by attributes or structure.
  const evaluated = await page.evaluate(() => {
    const pickText = (el) => (el?.innerText || el?.textContent || "").trim();

    const roleNodes = [
      ...document.querySelectorAll('[data-message-author-role="assistant"]'),
      ...document.querySelectorAll('[data-testid="assistant-message"]'),
      ...document.querySelectorAll('article[data-turn="assistant"]'),
      ...document.querySelectorAll('[data-turn="assistant"]'),
    ];
    for (let i = roleNodes.length - 1; i >= 0; i -= 1) {
      const text = pickText(roleNodes[i]);
      if (text.length > 20) return text;
    }

    const articles = [...document.querySelectorAll("main article, main [data-testid*='conversation']")];
    for (let i = articles.length - 1; i >= 0; i -= 1) {
      const text = pickText(articles[i]);
      if (text.length > 80) return text;
    }

    const main = document.querySelector("main");
    if (!main) return "";
    const blocks = [...main.querySelectorAll("div, article, section")]
      .map((el) => pickText(el))
      .filter((t) => t.length > 120);
    return blocks.at(-1) || pickText(main).slice(-12000);
  }).catch(() => "");

  if (evaluated && evaluated.trim().length > 20) return evaluated.trim();
  return "";
}

export async function getLatestAssistantText(page, { retries = 8 } = {}) {
  let last = "";
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    await dismissBlockingUi(page, { label: "ChatGPT" });
    last = await readAssistantOnce(page);
    if (last.length > 20) return last;

    console.warn(`ChatGPT assistant message not ready (attempt ${attempt}/${retries})…`);
    if (attempt === Math.floor(retries / 2)) {
      // Midway: soft reload once in case hydration failed.
      await openChatGpt(page, { forceReload: true });
    } else {
      await sleep(1500);
      await scrollConversationToBottom(page);
    }
  }

  throw new Error(
    "Could not find latest ChatGPT assistant message after retries. " +
      "Check the ChatGPT tab is on the correct chat and fully loaded."
  );
}

export function extractCursorPrompt(assistantText) {
  const text = assistantText.trim();
  if (!text) throw new Error("ChatGPT assistant message was empty.");

  const fenceMatch = text.match(/```(?:prompt|text|markdown)?\n([\s\S]*?)```/i);
  if (fenceMatch?.[1]?.trim()) {
    return fenceMatch[1].trim();
  }

  const markerMatch = text.match(
    /(?:PROMPT FOR CURSOR|CURSOR PROMPT|PROMPT:)\s*\n+([\s\S]*)/i
  );
  if (markerMatch?.[1]?.trim()) {
    return markerMatch[1].trim();
  }

  return text;
}

/**
 * Stop only when GPT is actually ending the loop.
 * If the same message still includes a next "Prompt N Completed" work order,
 * that prompt must still be sent to Cursor (do not stop early).
 */
export function isAutomationComplete(assistantText, stopPhrase = "Automation Done") {
  const text = String(assistantText || "").trim();
  if (!text) return false;

  const stopRe = new RegExp(
    stopPhrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+"),
    "i"
  );
  if (!stopRe.test(text)) return false;

  // Exact / almost-exact stop reply.
  const normalized = text.replace(/\s+/g, " ").trim();
  const stopNormalized = String(stopPhrase).replace(/\s+/g, " ").trim();
  if (new RegExp(`^${stopNormalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.?$`, "i").test(normalized)) {
    return true;
  }
  if (text.length <= 80) return true;

  // Still has a Cursor work order → keep looping.
  const hasNextPromptOrder =
    /Prompt\s+\d+\s+Completed/i.test(text) &&
    /(when\s+(you\s+)?(are\s+)?(completely\s+)?finished|print\s+exactly|final pass|implement|fix|verify)/i.test(
      text
    );
  if (hasNextPromptOrder) {
    console.log(
      `GPT mentioned "${stopPhrase}" but also included a next Cursor prompt — continuing.`
    );
    return false;
  }

  // Long message ending with only the stop phrase as the last meaningful line.
  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const last = lines[lines.length - 1] || "";
  if (stopRe.test(last) && last.length <= stopPhrase.length + 10 && text.length < 300) {
    return true;
  }

  // Otherwise ignore embedded mentions inside larger instructions.
  console.log(
    `GPT mentioned "${stopPhrase}" inside a longer message without a clear solo stop — continuing.`
  );
  return false;
}

export async function sendToChatGpt(page, { text, imagePaths = [] }) {
  const progress = async (line) => {
    console.log(line);
    if (typeof page.__onGptProgress === "function") {
      try {
        await page.__onGptProgress(line);
      } catch {
        // ignore
      }
    }
  };

  await page.bringToFront().catch(() => {});
  await dismissBlockingUi(page, { label: "ChatGPT" });
  await waitForChatReady(page);
  let composer = await getComposer(page);
  if (!composer) throw new Error("ChatGPT composer not found. Are you logged in?");

  await progress(`GPT: pasting Cursor output (${String(text || "").length} chars)…`);

  // Clear + paste. Prefer Playwright insertText (reliable on ProseMirror); fallback clipboard.
  await fillChatGptComposer(page, composer, text);

  let filled = await readComposerText(page, composer);
  if (!filled || filled.length < Math.min(40, String(text).length / 4)) {
    await progress("GPT: paste looked empty — retrying via clipboard…");
    composer = (await getComposer(page)) || composer;
    await fillChatGptComposer(page, composer, text, { forceClipboard: true });
    filled = await readComposerText(page, composer);
  }

  if (!filled || filled.length < 10) {
    throw new Error(
      "ChatGPT composer stayed empty after paste. Click the GPT tab and check the composer."
    );
  }
  await progress(`GPT: composer has ${filled.length} chars — sending…`);

  // Images are optional; never block the text send if upload hangs.
  const usableImages = (imagePaths || []).filter(Boolean).slice(0, 3);
  if (usableImages.length) {
    try {
      await progress(`GPT: attaching ${usableImages.length} image(s)…`);
      const fileInput = page.locator('input[type="file"]').first();
      if (await fileInput.count()) {
        await Promise.race([
          fileInput.setInputFiles(usableImages),
          sleep(20_000).then(() => {
            throw new Error("image upload timed out");
          }),
        ]);
        await sleep(1500);
      } else {
        await progress("GPT: no file input — sending text only");
      }
    } catch (error) {
      await progress(`GPT: image attach skipped (${error.message}) — sending text only`);
    }
  }

  composer = (await getComposer(page)) || composer;
  const sent = await clickChatGptSend(page, composer);
  await progress(sent ? "GPT: send clicked" : "GPT: send via Enter");

  await waitForGptReplySettled(page, {
    onProgress: async (line) => {
      if (typeof page.__onGptProgress === "function") {
        await page.__onGptProgress(line);
      }
    },
  });
}

async function readComposerText(page, composer) {
  try {
    return (
      (await composer.evaluate((el) => {
        if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") return el.value || "";
        return (el.innerText || el.textContent || "").trim();
      })) || ""
    ).trim();
  } catch {
    return "";
  }
}

async function fillChatGptComposer(page, composer, text, { forceClipboard = false } = {}) {
  const value = String(text || "");
  await composer.click({ timeout: 10_000 });
  await sleep(200);
  await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await page.keyboard.press("Backspace");
  await sleep(150);

  if (!forceClipboard) {
    // Fast path — works on most ChatGPT composer builds.
    try {
      await page.keyboard.insertText(value);
      await sleep(300);
      return;
    } catch (error) {
      console.warn(`insertText failed (${error.message.split("\n")[0]}). Trying clipboard.`);
    }
  }

  // Clipboard paste fallback (Windows/Edge friendly).
  try {
    await page.evaluate(async (t) => {
      await navigator.clipboard.writeText(t);
    }, value);
  } catch {
    // grant clipboard via CDP-ish fallback: use execCommand copy from a temp
    await page.evaluate((t) => {
      const ta = document.createElement("textarea");
      ta.value = t;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }, value);
  }
  await composer.click({ timeout: 5_000 }).catch(() => {});
  await page.keyboard.press(process.platform === "darwin" ? "Meta+V" : "Control+V");
  await sleep(500);

  // Last resort: direct DOM write + input events
  const now = await readComposerText(page, composer);
  if (!now || now.length < 10) {
    await composer.evaluate((el, t) => {
      el.focus();
      if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
        el.value = t;
      } else {
        el.textContent = "";
        el.innerHTML = "";
        // ProseMirror-ish: try insertText again inside page
        document.execCommand("selectAll", false);
        document.execCommand("insertText", false, t);
        if (!(el.innerText || "").trim()) {
          el.textContent = t;
        }
      }
      el.dispatchEvent(new InputEvent("input", { bubbles: true, data: t, inputType: "insertText" }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }, value);
    await sleep(300);
  }
}

async function clickChatGptSend(page, composer) {
  const selectors = [
    'button[data-testid="send-button"]',
    'button[aria-label="Send prompt"]',
    'button[aria-label="Send message"]',
    'button[aria-label*="Send message" i]',
    'button[aria-label*="Send prompt" i]',
  ];

  for (const sel of selectors) {
    const btn = page.locator(sel).last();
    if (!(await btn.isVisible().catch(() => false))) continue;
    const disabled = await btn.isDisabled().catch(() => false);
    if (disabled) continue;
    try {
      await btn.click({ timeout: 8_000 });
      return true;
    } catch (error) {
      console.warn(`Send click failed on ${sel}: ${error.message.split("\n")[0]}`);
    }
  }

  // Composer Enter (ChatGPT usually sends on Enter)
  await composer.click({ timeout: 5_000 }).catch(() => {});
  await page.keyboard.press("Enter");
  return false;
}

async function gptStopButtonVisible(page) {
  const candidates = [
    page.locator('button[data-testid="stop-button"]'),
    page.locator('button[aria-label*="Stop generating" i]'),
    page.locator('button[aria-label*="Stop streaming" i]'),
    page.getByRole("button", { name: /^stop generating$/i }),
    page.getByRole("button", { name: /^stop$/i }),
  ];
  for (const loc of candidates) {
    if (await loc.first().isVisible().catch(() => false)) return true;
  }
  return false;
}

async function detectGptSoftError(page) {
  const body = ((await page.locator("body").innerText().catch(() => "")) || "").slice(0, 8000);
  const patterns = [
    { re: /something went wrong/i, msg: "ChatGPT: Something went wrong" },
    { re: /too many requests|rate limit|you've reached|usage limit/i, msg: "ChatGPT: rate/usage limit" },
    { re: /network error|failed to send|couldn.?t send/i, msg: "ChatGPT: send/network error" },
    { re: /verify you are human|just a moment/i, msg: "ChatGPT: Cloudflare / human check" },
    { re: /log in|sign up to chatgpt/i, msg: "ChatGPT: login wall" },
  ];
  for (const p of patterns) {
    if (p.re.test(body)) return p.msg;
  }
  // Composer still holding a huge unsent draft while no stop button → likely send failed
  return null;
}

async function waitForGptReplySettled(page, { onProgress = null } = {}) {
  const startedText = await readAssistantOnce(page);
  const startedAt = Date.now();
  let lastProgressLog = 0;
  const timeoutMin = Math.round(config.gptReplyTimeoutMs / 60000);

  console.log(
    `GPT wait start | timeout=${timeoutMin}m | baselineChars=${startedText.length}`
  );

  await waitUntil(
    "ChatGPT generation start",
    180_000,
    async () => {
      await dismissBlockingUi(page, { label: "ChatGPT" });
      const soft = await detectGptSoftError(page);
      if (soft) throw new Error(soft);

      const stop = await gptStopButtonVisible(page);
      if (stop) return true;
      const current = await readAssistantOnce(page);
      return current && current !== startedText && current.length > startedText.length;
    },
    1000
  );

  await waitUntil(
    "ChatGPT generation finish",
    config.gptReplyTimeoutMs,
    async () => {
      await dismissBlockingUi(page, { label: "ChatGPT" });
      const soft = await detectGptSoftError(page);
      if (soft) throw new Error(soft);

      const stopVisible = await gptStopButtonVisible(page);
      const streaming = page.locator('[data-testid="streaming"], .result-streaming');
      const streamingVisible = await streaming.first().isVisible().catch(() => false);

      const now = Date.now();
      if (now - lastProgressLog >= 60_000) {
        lastProgressLog = now;
        const mins = ((now - startedAt) / 60000).toFixed(1);
        const line = `… GPT ${mins}m/${timeoutMin}m | stop=${stopVisible} streaming=${streamingVisible}`;
        console.log(line);
        if (typeof onProgress === "function") {
          try {
            await onProgress(line);
          } catch {
            // ignore
          }
        }
      }

      if (stopVisible) return false;
      if (streamingVisible) return false;

      const a = await readAssistantOnce(page);
      await sleep(1800);
      const b = await readAssistantOnce(page);
      return Boolean(a) && a === b && a.length > 20 && Date.now() - startedAt > 2500;
    },
    1500
  );
}
