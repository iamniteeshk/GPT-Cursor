import fs from "node:fs/promises";
import { config } from "./config.js";
import { artifactPath, sleep, waitUntil } from "./browser.js";
import {
  detectHardBlocker,
  dismissBlockingUi,
  installDialogHandlers,
} from "./popups.js";

function agentIdFromUrl(url = config.cursorUrl) {
  const parts = String(url).split("/").filter(Boolean);
  return parts[parts.length - 1] || "";
}

/** Prefer the exact agent tab; fall back to any Cursor agents tab. */
export async function resolveCursorPage(context, preferredPage = null) {
  const agentId = agentIdFromUrl();
  const pages = context.pages().filter((p) => {
    try {
      return !p.isClosed();
    } catch {
      return false;
    }
  });

  const exact = pages.find((p) => p.url().includes(agentId));
  if (exact) {
    await exact.bringToFront().catch(() => {});
    return exact;
  }

  const agents = pages.find((p) => p.url().includes("cursor.com/agents"));
  if (agents) {
    await agents.bringToFront().catch(() => {});
    if (!agents.url().includes(agentId)) {
      await agents.goto(config.cursorUrl, { waitUntil: "domcontentloaded" }).catch(() => {});
      await sleep(2000);
    }
    return agents;
  }

  if (preferredPage && !preferredPage.isClosed()) {
    await preferredPage.bringToFront().catch(() => {});
    await preferredPage.goto(config.cursorUrl, { waitUntil: "domcontentloaded" }).catch(() => {});
    await sleep(2000);
    return preferredPage;
  }

  const page = await context.newPage();
  await page.goto(config.cursorUrl, { waitUntil: "domcontentloaded" });
  await sleep(2000);
  return page;
}

export async function openCursorAgent(page) {
  await installDialogHandlers(page);
  if (!page.url().includes(agentIdFromUrl())) {
    await page.goto(config.cursorUrl, { waitUntil: "domcontentloaded" });
    await sleep(2500);
  } else {
    await page.bringToFront().catch(() => {});
    await sleep(500);
  }
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
  await waitUntil("Cursor login", config.loginWaitMs, async () => {
    if (!page.url().includes("cursor.com/agents")) {
      await openCursorAgent(page);
    }
    return isCursorLoggedIn(page);
  });
  console.log("Cursor login detected.");
}

async function getComposer(page) {
  const scopes = [page, ...page.frames()];
  for (const scope of scopes) {
    const candidates = [
      scope.locator('[data-testid="composer"], [data-testid="chat-input"]'),
      scope.locator('div[contenteditable="true"][role="textbox"]'),
      scope.locator('[contenteditable="true"]'),
      scope.locator("textarea"),
      scope.getByPlaceholder(/ask cursor|message|follow/i),
    ];
    for (const candidate of candidates) {
      const first = candidate.first();
      if (await first.isVisible().catch(() => false)) return first;
    }
  }
  return null;
}

/** Read visible text from the page and every iframe. */
export async function collectPageText(page) {
  const chunks = [];

  for (const frame of page.frames()) {
    try {
      const text = await frame
        .locator("body")
        .innerText({ timeout: 2500 })
        .catch(async () => frame.evaluate(() => document.body?.innerText || "").catch(() => ""));
      const trimmed = String(text || "").trim();
      if (trimmed) chunks.push(trimmed);
    } catch {
      // ignore frame read failures
    }
  }

  if (!chunks.length) {
    try {
      const html = await page.content();
      const rough = html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (rough) chunks.push(rough.slice(-20000));
    } catch {
      // ignore
    }
  }

  return chunks.join("\n\n").trim();
}

function extractWorkedFor(text) {
  const matches = String(text).match(/\bWorked for\b[^\n]{0,80}/gi);
  return matches?.length ? matches[matches.length - 1] : "";
}

async function stopButtonVisible(page) {
  for (const frame of page.frames()) {
    const candidates = [
      frame.getByRole("button", { name: /\bstop\b/i }),
      frame.locator('button[aria-label*="Stop" i]'),
      frame.locator('button[title*="Stop" i]'),
    ];
    for (const loc of candidates) {
      if (await loc.first().isVisible().catch(() => false)) return true;
    }
  }
  return false;
}

async function isCursorBusy(page, fullText = "") {
  if (await stopButtonVisible(page)) return true;

  // Active-run phrases commonly shown while cloud agents work.
  const busyRe =
    /\b(Thinking|Planning|Working|Generating|Running start script|Running command|Editing files|Exploring|Searching|Applying|In progress|Agent is running|Starting agent)\b/i;

  // Prefer checking short status-ish lines near the top of collected text.
  const head = String(fullText).slice(0, 2500);
  if (/\bWorked for\b/i.test(head) && !busyRe.test(head)) {
    // Finished banner is present and no active verb nearby.
  }

  if (busyRe.test(head)) {
    // If "Worked for" exists and there is no Stop button, treat as not busy
    // (transcript may contain older "Working" words).
    if (/\bWorked for\b/i.test(fullText) && !(await stopButtonVisible(page))) {
      return false;
    }
    // Without a finished marker, assume busy if those verbs appear in the live head area.
    if (!/\bWorked for\b/i.test(fullText)) return true;
  }

  return false;
}

export async function sendPromptToCursor(page, prompt) {
  await dismissBlockingUi(page, { label: "Cursor" });
  const blocker = await detectHardBlocker(page);
  if (blocker) {
    console.warn(`Hard blocker before send: ${blocker.message}`);
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

/**
 * Wait until the agent finishes.
 * Done = "Worked for …" fingerprint changed since send, and Stop is gone.
 */
export async function waitForCursorReply(page, previousText, context = null) {
  let active = page;
  const baselineText = await collectPageText(active);
  const baselineWorkedFor = extractWorkedFor(baselineText);
  let sawBusy = false;
  let lastActionKind = "";
  let lastProgressLog = 0;
  const started = Date.now();

  console.log(
    `Cursor wait baseline workedFor="${baselineWorkedFor || "none"}" textChars=${baselineText.length}`
  );

  await waitUntil(
    "Cursor agent reply",
    config.cursorReplyTimeoutMs,
    async () => {
      if (context) {
        active = await resolveCursorPage(context, active);
      }

      await dismissBlockingUi(active, { label: "Cursor" }).catch(() => {});

      const blocker = await detectHardBlocker(active);
      if (blocker) {
        if (blocker.kind !== lastActionKind) {
          lastActionKind = blocker.kind;
          console.warn(blocker.message);
        }
        return false;
      }
      lastActionKind = "";

      const fullText = await collectPageText(active);
      const workedFor = extractWorkedFor(fullText);
      const stopVisible = await stopButtonVisible(active);
      const busy = stopVisible || (await isCursorBusy(active, fullText));
      if (busy) sawBusy = true;

      const newDone = Boolean(workedFor) && workedFor !== baselineWorkedFor;
      const markReady = /mark as ready/i.test(fullText);

      const now = Date.now();
      if (now - lastProgressLog > 30_000) {
        lastProgressLog = now;
        const mins = ((now - started) / 60000).toFixed(1);
        console.log(
          `… Cursor wait ${mins}m | url=${active.url().slice(0, 80)} | frames=${active.frames().length} | busy=${busy} stop=${stopVisible} sawBusy=${sawBusy} workedFor="${workedFor || "none"}" newDone=${newDone} textChars=${fullText.length}`
        );
      }

      // Still running.
      if (stopVisible) return false;
      if (busy && !newDone) return false;

      // Finished: new Worked-for marker (best signal on Cursor cloud agents).
      if (newDone) {
        await sleep(2000);
        const again = await collectPageText(active);
        const againWorked = extractWorkedFor(again);
        if (againWorked && againWorked !== baselineWorkedFor && !(await stopButtonVisible(active))) {
          active.__lastCursorText = pickAssistantPayload(again, previousText);
          return true;
        }
      }

      // Fallback: Mark as ready + substantial new text, after we saw activity.
      if ((markReady || sawBusy) && fullText.length > 400) {
        const payload = pickAssistantPayload(fullText, previousText);
        if (payload && payload !== previousText && payload.length > 120) {
          // Require either newDone-ish content or at least 90s elapsed to avoid early steal.
          if (newDone || markReady || Date.now() - started > 90_000) {
            active.__lastCursorText = payload;
            return true;
          }
        }
      }

      return false;
    },
    3000
  );

  return active;
}

function pickAssistantPayload(fullText, previousText = "") {
  const text = String(fullText || "").trim();
  if (!text) return "";

  // Prefer the section around the latest "Worked for" / Changes made summary.
  const workedIdx = text.toLowerCase().lastIndexOf("worked for");
  if (workedIdx >= 0) {
    const slice = text.slice(Math.max(0, workedIdx - 500), workedIdx + 8000).trim();
    if (slice.length > 80) return slice;
  }

  const changesIdx = text.toLowerCase().lastIndexOf("changes made");
  if (changesIdx >= 0) {
    const slice = text.slice(changesIdx, changesIdx + 8000).trim();
    if (slice.length > 80) return slice;
  }

  const tail = text.slice(-10000).trim();
  if (previousText && tail === previousText) return tail;
  return tail;
}

export async function getLatestCursorText(page) {
  if (page.__lastCursorText?.trim()) {
    const cached = page.__lastCursorText.trim();
    page.__lastCursorText = "";
    return cached;
  }

  const full = await collectPageText(page);
  const payload = pickAssistantPayload(full);
  if (payload.length > 40) return payload;
  throw new Error("Could not read Cursor agent response text.");
}

export async function captureCursorImages(page, loopIndex) {
  const saved = [];
  const images = page.locator("img");
  const count = await images.count().catch(() => 0);

  for (let i = 0; i < Math.min(count, 30); i += 1) {
    const img = images.nth(i);
    if (!(await img.isVisible().catch(() => false))) continue;
    const box = await img.boundingBox();
    if (!box || box.width < 80 || box.height < 80) continue;
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
