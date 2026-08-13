import { config } from "./config.js";
import { sleep, waitUntil } from "./browser.js";
import { dismissBlockingUi, installDialogHandlers } from "./popups.js";

export async function openChatGpt(page, { forceReload = false } = {}) {
  await installDialogHandlers(page);
  const alreadyThere =
    page.url().includes("chatgpt.com/c/") &&
    page.url().includes(config.gptUrl.split("/c/")[1]?.split("?")[0] || "___never___");

  if (!alreadyThere || forceReload) {
    await page.goto(config.gptUrl, { waitUntil: "domcontentloaded", timeout: 120_000 });
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

export async function waitForChatGptLogin(page) {
  console.log("Waiting for ChatGPT login...");
  console.log("Log in in the Chrome window, then this script will continue automatically.");
  await waitUntil("ChatGPT login", config.loginWaitMs, async () => {
    if (page.url() !== config.gptUrl && !page.url().includes("chatgpt.com/c/")) {
      await openChatGpt(page, { forceReload: true });
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
  await dismissBlockingUi(page, { label: "ChatGPT" });
  await waitForChatReady(page);
  const composer = await getComposer(page);
  if (!composer) throw new Error("ChatGPT composer not found. Are you logged in?");

  // Put text first, then attach images (more reliable with ChatGPT composer).
  await composer.click({ timeout: 10_000 });
  await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await page.keyboard.press("Backspace");

  await composer.evaluate((el, value) => {
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
      el.value = value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }
    el.focus();
    document.execCommand("selectAll", false);
    document.execCommand("insertText", false, value);
  }, text);

  await sleep(400);

  if (imagePaths.length) {
    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.count()) {
      await fileInput.setInputFiles(imagePaths);
      await sleep(2000);
    } else {
      console.warn("No file input found for ChatGPT image upload. Sending text only.");
    }
  }

  const sendButton = page
    .locator(
      'button[data-testid="send-button"], button[aria-label="Send prompt"], button[aria-label="Send message"], button[aria-label*="Send message" i]'
    )
    .filter({
      hasNot: page.locator('[aria-label*="Remove" i], [aria-label*="Open image" i]'),
    })
    .last();

  let sent = false;
  if (await sendButton.isVisible().catch(() => false)) {
    try {
      await sendButton.click({ timeout: 8_000 });
      sent = true;
    } catch (error) {
      console.warn(
        `ChatGPT send button click failed (${error.message.split("\n")[0]}). Falling back to Enter.`
      );
    }
  }

  if (!sent) {
    await composer.click({ timeout: 5_000 }).catch(() => {});
    await page.keyboard.press("Enter");
  }

  await waitForGptReplySettled(page);
}

async function waitForGptReplySettled(page) {
  const startedText = await readAssistantOnce(page);
  const startedAt = Date.now();

  await waitUntil("ChatGPT generation start", 180_000, async () => {
    await dismissBlockingUi(page, { label: "ChatGPT" });
    const stop = page.getByRole("button", { name: /stop/i }).first();
    if (await stop.isVisible().catch(() => false)) return true;
    const current = await readAssistantOnce(page);
    return current && current !== startedText && current.length > startedText.length;
  }, 1000);

  await waitUntil("ChatGPT generation finish", config.gptReplyTimeoutMs, async () => {
    await dismissBlockingUi(page, { label: "ChatGPT" });
    const stop = page.getByRole("button", { name: /stop/i }).first();
    if (await stop.isVisible().catch(() => false)) return false;

    const streaming = page.locator('[data-testid="streaming"], .result-streaming');
    if (await streaming.first().isVisible().catch(() => false)) return false;

    const a = await readAssistantOnce(page);
    await sleep(1800);
    const b = await readAssistantOnce(page);
    return Boolean(a) && a === b && a.length > 20 && Date.now() - startedAt > 2500;
  }, 1500);
}
