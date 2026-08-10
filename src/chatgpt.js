import { config } from "./config.js";
import { sleep, waitUntil } from "./browser.js";
import { dismissBlockingUi, installDialogHandlers } from "./popups.js";

export async function openChatGpt(page) {
  await installDialogHandlers(page);
  await page.goto(config.gptUrl, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  await dismissBlockingUi(page, { label: "ChatGPT" });
}

export async function isChatGptLoggedIn(page) {
  const url = page.url();
  if (url.includes("/auth") || url.includes("login")) return false;

  const loginButton = page.getByRole("button", { name: /log in/i }).first();
  if (await loginButton.isVisible().catch(() => false)) return false;

  const signup = page.getByRole("button", { name: /sign up/i }).first();
  if (await signup.isVisible().catch(() => false)) {
    // Signup can appear for guests; treat as logged out if composer is missing.
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
      await openChatGpt(page);
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
    page.locator('[contenteditable="true"]').filter({ hasText: /^$/ }).last(),
    page.locator('[contenteditable="true"]').last(),
  ];

  for (const candidate of candidates) {
    if (await candidate.first().isVisible().catch(() => false)) {
      return candidate.first();
    }
  }
  return null;
}

export async function getLatestAssistantText(page) {
  // Prefer marked assistant turns; fall back to article/message containers.
  const selectors = [
    '[data-message-author-role="assistant"]',
    '[data-testid="assistant-message"]',
    'article[data-turn="assistant"]',
    ".agent-turn",
  ];

  for (const selector of selectors) {
    const nodes = page.locator(selector);
    const count = await nodes.count();
    if (count > 0) {
      const last = nodes.nth(count - 1);
      const text = (await last.innerText()).trim();
      if (text) return text;
    }
  }

  // Broader fallback: last large markdown block in main.
  const markdown = page.locator("main .markdown, main .prose");
  const count = await markdown.count();
  if (count > 0) {
    return (await markdown.nth(count - 1).innerText()).trim();
  }

  throw new Error("Could not find latest ChatGPT assistant message.");
}

export function extractCursorPrompt(assistantText) {
  const text = assistantText.trim();
  if (!text) throw new Error("ChatGPT assistant message was empty.");

  // Prefer fenced prompt blocks if GPT wraps the Cursor prompt.
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

export async function sendToChatGpt(page, { text, imagePaths = [] }) {
  await dismissBlockingUi(page, { label: "ChatGPT" });
  const composer = await getComposer(page);
  if (!composer) throw new Error("ChatGPT composer not found. Are you logged in?");

  // Upload images first if present.
  if (imagePaths.length) {
    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.count()) {
      await fileInput.setInputFiles(imagePaths);
      await sleep(1500);
    } else {
      console.warn(
        "No file input found for ChatGPT image upload. Sending text only this round."
      );
    }
  }

  await composer.click({ timeout: 10_000 });
  await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await page.keyboard.press("Backspace");

  // Fill large text via clipboard-style insert for reliability.
  await composer.fill("");
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

  await sleep(500);

  const sendButton = page
    .locator(
      'button[data-testid="send-button"], button[aria-label*="Send"], button:has(svg)'
    )
    .filter({ hasNotText: /stop/i })
    .last();

  if (await sendButton.isVisible().catch(() => false)) {
    await sendButton.click();
  } else {
    await page.keyboard.press("Enter");
  }

  await waitForGptReplySettled(page);
}

async function waitForGptReplySettled(page) {
  const startedText = await getLatestAssistantText(page).catch(() => "");
  const startedAt = Date.now();

  // Wait for generation to start (text changes or stop button appears).
  await waitUntil("ChatGPT generation start", 120_000, async () => {
    await dismissBlockingUi(page, { label: "ChatGPT" });
    const stop = page.getByRole("button", { name: /stop/i }).first();
    if (await stop.isVisible().catch(() => false)) return true;
    const current = await getLatestAssistantText(page).catch(() => "");
    return current && current !== startedText;
  });

  // Then wait until stop button disappears / streaming ends.
  await waitUntil("ChatGPT generation finish", config.gptReplyTimeoutMs, async () => {
    await dismissBlockingUi(page, { label: "ChatGPT" });
    const stop = page.getByRole("button", { name: /stop/i }).first();
    const stopVisible = await stop.isVisible().catch(() => false);
    if (stopVisible) return false;

    const streaming = page.locator('[data-testid="streaming"], .result-streaming');
    if (await streaming.first().isVisible().catch(() => false)) return false;

    // Stable text for one poll cycle.
    const a = await getLatestAssistantText(page).catch(() => "");
    await sleep(1500);
    const b = await getLatestAssistantText(page).catch(() => "");
    return Boolean(a) && a === b && Date.now() - startedAt > 2000;
  });
}
