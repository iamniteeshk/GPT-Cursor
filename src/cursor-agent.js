import fs from "node:fs/promises";
import { config } from "./config.js";
import { artifactPath, sleep, waitUntil } from "./browser.js";
import {
  detectHardBlocker,
  dismissBlockingUi,
  installDialogHandlers,
} from "./popups.js";

export async function openCursorAgent(page) {
  await installDialogHandlers(page);
  await page.goto(config.cursorUrl, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await dismissBlockingUi(page, { label: "Cursor" });
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
  await dismissBlockingUi(page, { label: "Cursor" });
  const blocker = await detectHardBlocker(page);
  if (blocker) {
    console.warn(`Hard blocker before send: ${blocker.message}`);
    console.warn("Waiting for you to clear it in Chrome...");
    await waitUntil("Cursor hard blocker cleared", config.loginWaitMs, async () => {
      await dismissBlockingUi(page, { label: "Cursor" });
      return !(await detectHardBlocker(page));
    });
  }

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

  // Prefer an explicit Send control; avoid matching generic "Run security audit" buttons.
  const send = page
    .getByRole("button", { name: /^(send|submit)$/i })
    .or(page.locator('button[data-testid*="send" i], button[aria-label*="Send" i]'))
    .first();
  if (await send.isVisible().catch(() => false)) {
    await send.click();
  } else {
    await page.keyboard.press("Enter");
  }
}

export async function waitForCursorReply(page, previousText) {
  let lastActionKind = "";
  let lastProgressLog = 0;
  let sawBusy = false;
  let previousDoneFingerprint = await getDoneFingerprint(page);
  const started = Date.now();
  const minWaitMs = 45_000;

  await waitUntil("Cursor agent reply", config.cursorReplyTimeoutMs, async () => {
    await dismissBlockingUi(page, { label: "Cursor" });
    await maybeClickMarkAsReady(page);

    const blocker = await detectHardBlocker(page);
    if (blocker) {
      if (blocker.kind !== lastActionKind) {
        lastActionKind = blocker.kind;
        console.warn(blocker.message);
        console.warn("Paused — finish that in Chrome, then the loop continues.");
      }
      return false;
    }
    lastActionKind = "";

    const busy = await isCursorBusy(page);
    if (busy) sawBusy = true;

    const text = await getLatestCursorText(page).catch(() => "");
    const doneFingerprint = await getDoneFingerprint(page);
    const newDoneSignal =
      Boolean(doneFingerprint) && doneFingerprint !== previousDoneFingerprint;
    const markReady = await hasMarkAsReady(page);

    const now = Date.now();
    if (now - lastProgressLog > 60_000) {
      lastProgressLog = now;
      const mins = Math.round((now - started) / 60000);
      console.log(
        `… still waiting on Cursor (${mins}m). busy=${busy} sawBusy=${sawBusy} newDone=${newDoneSignal} markReady=${markReady} textChars=${text.length}`
      );
    }

    if (!sawBusy && !newDoneSignal && !markReady) return false;
    if (busy) return false;
    if (Date.now() - started < minWaitMs && !newDoneSignal && !markReady) return false;

    // If the agent finished but selectors failed, still try body text once more.
    let finalText = text;
    if (!finalText || (previousText && finalText === previousText)) {
      finalText = await getLatestCursorText(page).catch(() => "");
    }
    if (!finalText) {
      // Last resort: if UI shows finished controls, dump body and accept.
      if ((newDoneSignal || markReady) && sawBusy) {
        finalText = await readBodyText(page);
      }
    }
    if (!finalText) return false;
    if (previousText && finalText === previousText && !newDoneSignal && !markReady) {
      return false;
    }

    await sleep(2000);
    const stillBusy = await isCursorBusy(page);
    if (stillBusy) return false;

    const againDone = await getDoneFingerprint(page);
    const againNewDone = Boolean(againDone) && againDone !== previousDoneFingerprint;
    const againMark = await hasMarkAsReady(page);

    if (againNewDone || againMark || (sawBusy && finalText.length > 200)) {
      // Stash on page object so caller can reuse if needed.
      page.__lastCursorText = finalText;
      return true;
    }

    return false;
  });
}

async function readBodyText(page) {
  const body = ((await page.locator("body").innerText().catch(() => "")) || "").trim();
  if (body.length > 80) return body.slice(-12000);
  return body;
}

async function hasMarkAsReady(page) {
  const btn = page.getByRole("button", { name: /mark as ready/i }).first();
  return btn.isVisible().catch(() => false);
}

async function maybeClickMarkAsReady(page) {
  const btn = page.getByRole("button", { name: /mark as ready/i }).first();
  if (!(await btn.isVisible().catch(() => false))) return false;
  try {
    await btn.click({ timeout: 3000 });
    console.log('Clicked Cursor "Mark as ready".');
    await sleep(1000);
    return true;
  } catch {
    return false;
  }
}

async function getDoneFingerprint(page) {
  const patterns = [
    /\bWorked for\b[^\n]{0,60}/gi,
    /\bAgent (completed|finished)\b[^\n]{0,60}/gi,
    /\bMark as ready\b/gi,
    /\bCreate [Pp]ull [Rr]equest\b/g,
  ];
  const body = (await readBodyText(page)) || "";
  for (const pattern of patterns) {
    const matches = body.match(pattern);
    if (matches?.length) return matches[matches.length - 1];
  }
  return "";
}

/**
 * Only treat real status-chrome / Stop as busy — not transcript words.
 */
async function isCursorBusy(page) {
  const stop = page.getByRole("button", { name: /^(stop|cancel)$/i }).first();
  if (await stop.isVisible().catch(() => false)) return true;

  // "Mark as ready" means the run finished — never busy.
  if (await hasMarkAsReady(page)) return false;

  const statusSelectors = [
    '[data-testid*="status"]',
    '[data-testid*="agent-status"]',
  ];

  const busyRe =
    /\b(thinking|generating|in progress|running start script|starting agent|agent is running)\b/i;

  for (const selector of statusSelectors) {
    const nodes = page.locator(selector);
    const count = await nodes.count().catch(() => 0);
    for (let i = 0; i < Math.min(count, 8); i += 1) {
      const text = ((await nodes.nth(i).innerText().catch(() => "")) || "").trim();
      if (busyRe.test(text)) return true;
    }
  }

  // Exact-ish header status chips only (avoid matching "Working" inside summaries).
  const headerBusy = page
    .locator("header, [data-testid*='agent'], [class*='status']")
    .getByText(/^(Thinking…|Thinking\.\.\.|Working…|Working\.\.\.|Generating|Running start script|In progress)$/i)
    .first();
  if (await headerBusy.isVisible().catch(() => false)) return true;

  return false;
}

export async function getLatestCursorText(page) {
  if (page.__lastCursorText) {
    const cached = page.__lastCursorText;
    page.__lastCursorText = "";
    if (cached?.trim()) return cached.trim();
  }

  const selectors = [
    '[data-message-author-role="assistant"]',
    '[data-testid="assistant-message"]',
    '[data-testid="agent-message"]',
    "article",
    ".prose",
    ".markdown",
  ];

  for (const selector of selectors) {
    try {
      const nodes = page.locator(selector);
      const count = await nodes.count();
      for (let i = count - 1; i >= 0 && i >= count - 5; i -= 1) {
        const text = ((await nodes.nth(i).innerText().catch(() => "")) || "").trim();
        if (text.length > 40) return text;
      }
    } catch {
      // try next selector
    }
  }

  try {
    const main = page.locator("main").first();
    if (await main.isVisible().catch(() => false)) {
      const text = ((await main.innerText().catch(() => "")) || "").trim();
      if (text.length > 40) return text;
    }
  } catch {
    // fall through
  }

  const body = await readBodyText(page);
  if (body.length > 40) return body;

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
    if (/avatar|icon|logo|favicon/i.test(src)) continue;

    const file = artifactPath(`cursor-loop-${loopIndex}-img-${i + 1}.png`);
    try {
      await img.screenshot({ path: file });
      saved.push(file);
    } catch {
      // ignore
    }
  }

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
