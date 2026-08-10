import fs from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";
import { artifactPath, sleep, waitUntil } from "./browser.js";

export async function openCursorAgent(page) {
  await page.goto(config.cursorUrl, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
}

export async function isCursorLoggedIn(page) {
  const url = page.url();
  if (
    url.includes("authenticator.cursor.sh") ||
    url.includes("/login") ||
    url.includes("sign-in")
  ) {
    return false;
  }

  const loginButton = page.getByRole("button", { name: /log ?in|sign in/i }).first();
  if (await loginButton.isVisible().catch(() => false)) return false;

  // Cloudflare interstitial
  const human = page.getByText(/verify you are human/i).first();
  if (await human.isVisible().catch(() => false)) return false;

  const composer = await getComposer(page);
  return Boolean(composer);
}

export async function waitForCursorLogin(page) {
  console.log("Waiting for Cursor login...");
  console.log("Log in / pass Cloudflare in the Chrome window, then this script continues.");
  await waitUntil("Cursor login", config.loginWaitMs, async () => {
    if (!page.url().includes("cursor.com/agents")) {
      await openCursorAgent(page);
    }
    return isCursorLoggedIn(page);
  });
  console.log("Cursor login detected.");
}

async function getComposer(page) {
  const candidates = [
    page.locator('[data-testid="composer"], [data-testid="chat-input"]'),
    page.locator('div[contenteditable="true"][role="textbox"]'),
    page.locator('[contenteditable="true"]'),
    page.locator("textarea"),
    page.getByPlaceholder(/ask cursor|message|follow/i),
  ];

  for (const candidate of candidates) {
    const first = candidate.first();
    if (await first.isVisible().catch(() => false)) return first;
  }
  return null;
}

export async function sendPromptToCursor(page, prompt) {
  const composer = await getComposer(page);
  if (!composer) throw new Error("Cursor composer not found. Are you logged in?");

  await composer.click({ timeout: 15_000 });
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
  }, prompt);

  await sleep(400);

  // Prefer an explicit Send/Run control; otherwise Enter.
  const send = page
    .getByRole("button", { name: /send|run|submit/i })
    .first();
  if (await send.isVisible().catch(() => false)) {
    await send.click();
  } else {
    await page.keyboard.press("Enter");
  }
}

export async function waitForCursorReply(page, previousText) {
  await waitUntil("Cursor agent reply", config.cursorReplyTimeoutMs, async () => {
    const busy = await isCursorBusy(page);
    if (busy) return false;

    const text = await getLatestCursorText(page).catch(() => "");
    if (!text) return false;
    if (previousText && text === previousText) return false;

    // Stable for one poll.
    await sleep(2000);
    const again = await getLatestCursorText(page).catch(() => "");
    const stillBusy = await isCursorBusy(page);
    return again === text && !stillBusy;
  });
}

async function isCursorBusy(page) {
  const patterns = [
    /thinking/i,
    /running/i,
    /working/i,
    /generating/i,
    /in progress/i,
    /starting/i,
  ];

  for (const pattern of patterns) {
    const el = page.getByText(pattern).first();
    if (await el.isVisible().catch(() => false)) return true;
  }

  const stop = page.getByRole("button", { name: /stop|cancel/i }).first();
  if (await stop.isVisible().catch(() => false)) return true;

  return false;
}

export async function getLatestCursorText(page) {
  const selectors = [
    '[data-message-author-role="assistant"]',
    '[data-testid="assistant-message"]',
    '[data-testid="agent-message"]',
    "article",
    ".prose",
    ".markdown",
  ];

  for (const selector of selectors) {
    const nodes = page.locator(selector);
    const count = await nodes.count();
    if (count > 0) {
      const text = (await nodes.nth(count - 1).innerText()).trim();
      if (text) return text;
    }
  }

  // Fallback: grab main panel text, truncated.
  const main = page.locator("main").first();
  if (await main.isVisible().catch(() => false)) {
    return (await main.innerText()).trim();
  }

  throw new Error("Could not read Cursor agent response text.");
}

export async function captureCursorImages(page, loopIndex) {
  const saved = [];
  const images = page.locator(
    'main img, [data-testid="assistant-message"] img, article img, .prose img'
  );
  const count = await images.count();

  for (let i = 0; i < count; i += 1) {
    const img = images.nth(i);
    if (!(await img.isVisible().catch(() => false))) continue;

    const box = await img.boundingBox();
    if (!box || box.width < 40 || box.height < 40) continue;

    const src = (await img.getAttribute("src")) || "";
    // Skip tiny icons / avatars.
    if (/avatar|icon|logo|favicon/i.test(src)) continue;

    const file = artifactPath(`cursor-loop-${loopIndex}-img-${i + 1}.png`);
    try {
      await img.screenshot({ path: file });
      saved.push(file);
    } catch {
      // Ignore individual image capture failures.
    }
  }

  // Also capture a full response screenshot as a visual summary.
  const summary = artifactPath(`cursor-loop-${loopIndex}-response.png`);
  await page.screenshot({ path: summary, fullPage: false });
  saved.push(summary);

  return saved;
}

export async function writeCursorDump(loopIndex, text) {
  const file = artifactPath(`cursor-loop-${loopIndex}-text.txt`);
  await fs.writeFile(file, text, "utf8");
  return file;
}
