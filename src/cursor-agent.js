import fs from "node:fs/promises";
import { config } from "./config.js";
import { artifactPath, sleep, waitUntil } from "./browser.js";
import {
  detectHardBlocker,
  dismissBlockingUi,
  installDialogHandlers,
} from "./popups.js";

function agentIdFromUrl(url = config.cursorUrl) {
  try {
    const u = new URL(String(url));
    const parts = u.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] || "";
  } catch {
    const noQuery = String(url).split("?")[0].split("#")[0];
    const parts = noQuery.split("/").filter(Boolean);
    return parts[parts.length - 1] || "";
  }
}

export function promptCompletedMarker(loopIndex) {
  return `Prompt ${loopIndex} Completed`;
}

/** Prefer Prompt N from GPT text when present; else use loop index. */
export function resolvePromptNumber(assistantText, loopIndex) {
  const matches = [...String(assistantText || "").matchAll(/Prompt\s+(\d+)\s+Completed/gi)];
  if (!matches.length) return loopIndex;
  const nums = matches.map((m) => Number(m[1])).filter((n) => Number.isFinite(n) && n > 0);
  if (!nums.length) return loopIndex;
  return Math.max(...nums);
}

export async function resolveCursorPage(context, preferredPage = null, cursorUrl = config.cursorUrl) {
  const target = cursorUrl || config.cursorUrl;
  const agentId = agentIdFromUrl(target);
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
      await agents.goto(target, { waitUntil: "domcontentloaded" }).catch(() => {});
      await sleep(2000);
    }
    return agents;
  }

  if (preferredPage && !preferredPage.isClosed()) {
    await preferredPage.bringToFront().catch(() => {});
    await preferredPage.goto(target, { waitUntil: "domcontentloaded" }).catch(() => {});
    await sleep(2000);
    return preferredPage;
  }

  const page = await context.newPage();
  await page.goto(target, { waitUntil: "domcontentloaded" });
  await sleep(2000);
  return page;
}

export async function openCursorAgent(page, cursorUrl = config.cursorUrl) {
  const target = cursorUrl || config.cursorUrl;
  await installDialogHandlers(page);
  if (!page.url().includes(agentIdFromUrl(target))) {
    await page.goto(target, { waitUntil: "domcontentloaded" });
    await sleep(2500);
  } else {
    await page.bringToFront().catch(() => {});
    await sleep(400);
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
  return Boolean(await getComposer(page));
}

export async function waitForCursorLogin(page) {
  console.log("Waiting for Cursor login...");
  await waitUntil("Cursor login", config.loginWaitMs, async () => {
    if (!page.url().includes("cursor.com/agents")) await openCursorAgent(page);
    return isCursorLoggedIn(page);
  });
  console.log("Cursor login detected.");
}

async function getComposer(page) {
  for (const scope of [page, ...page.frames()]) {
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

export async function collectPageText(page) {
  const chunks = [];
  for (const frame of page.frames()) {
    try {
      const text = await frame
        .locator("body")
        .innerText({ timeout: 2500 })
        .catch(async () =>
          frame.evaluate(() => document.body?.innerText || "").catch(() => "")
        );
      const trimmed = String(text || "").trim();
      if (trimmed) chunks.push(trimmed);
    } catch {
      // ignore
    }
  }
  return chunks.join("\n\n").trim();
}

/**
 * Prefer real assistant/message DOM nodes over raw body scrape.
 * Cursor cloud UI changes often — keep selectors loose.
 */
async function collectAssistantDomText(page) {
  try {
    return await page.evaluate(() => {
      const selectors = [
        '[data-message-author-role="assistant"]',
        '[data-role="assistant"]',
        '[data-testid*="assistant" i]',
        '[class*="assistant" i]',
        'article',
        '[class*="prose" i]',
        '[class*="markdown" i]',
      ];
      const blocks = [];
      for (const sel of selectors) {
        for (const el of document.querySelectorAll(sel)) {
          const t = (el.innerText || "").trim();
          if (t.length > 80) blocks.push(t);
        }
      }
      // Dedupe while preserving order
      const seen = new Set();
      const unique = [];
      for (const b of blocks) {
        const key = b.slice(0, 120);
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(b);
      }
      if (!unique.length) return "";
      // Latest few assistant-ish blocks
      return unique.slice(-4).join("\n\n---\n\n");
    });
  } catch {
    return "";
  }
}

async function scrollCursorToBottom(page) {
  await page
    .evaluate(() => {
      const nodes = [
        ...document.querySelectorAll('[data-testid*="scroll" i], main, [role="main"], [class*="scroll" i]'),
        document.scrollingElement,
      ].filter(Boolean);
      for (const el of nodes) {
        try {
          el.scrollTop = el.scrollHeight;
        } catch {
          // ignore
        }
      }
      window.scrollTo(0, document.body.scrollHeight);
    })
    .catch(() => {});
  await sleep(400);
}

/**
 * Composer action button state:
 * - stop  => agent is working (Send morphs into Stop)
 * - send  => idle / ready for follow-up (work finished or not started)
 * - unknown => cannot determine
 */
export async function getComposerActionState(page) {
  for (const frame of page.frames()) {
    const stop = frame
      .getByRole("button", { name: /\bstop\b/i })
      .or(frame.locator('button[aria-label*="Stop" i], button[title*="Stop" i]'))
      .first();
    if (await stop.isVisible().catch(() => false)) return "stop";
  }

  for (const frame of page.frames()) {
    const send = frame
      .getByRole("button", { name: /^(send|submit)$/i })
      .or(
        frame.locator(
          'button[data-testid*="send" i], button[aria-label*="Send" i]:not([aria-label*="Stop" i])'
        )
      )
      .first();
    if (await send.isVisible().catch(() => false)) return "send";
  }

  // Follow-up composer visible usually means idle/done.
  if (await getComposer(page)) return "send";
  return "unknown";
}

function extractWorkedFor(text) {
  const matches = String(text).match(/\bWorked for\b[^\n]{0,80}/gi);
  return matches?.length ? matches[matches.length - 1] : "";
}

function countPromptCompleted(text, loopIndex) {
  const re = new RegExp(`Prompt\\s*${loopIndex}\\s*Completed`, "gi");
  return (String(text || "").match(re) || []).length;
}

function hasPromptCompleted(text, loopIndex, baselineCount = 0) {
  // Our outgoing prompt already contains the marker once. Done = marker count increased
  // (assistant printed it), not merely that the instruction text is on the page.
  return countPromptCompleted(text, loopIndex) > baselineCount;
}

export async function sendPromptToCursor(page, prompt, loopIndex) {
  await dismissBlockingUi(page, { label: "Cursor" });
  const blocker = await detectHardBlocker(page);
  if (blocker) {
    console.warn(`Hard blocker before send: ${blocker.message}`);
    await waitUntil("Cursor hard blocker cleared", config.loginWaitMs, async () => {
      await dismissBlockingUi(page, { label: "Cursor" });
      return !(await detectHardBlocker(page));
    });
  }

  const marker = promptCompletedMarker(loopIndex);
  const finalPrompt = [
    prompt,
    "",
    "-----",
    `When you fully finish this task, print exactly this line on its own:`,
    marker,
    "Then stop. Do not wait for more instructions.",
  ].join("\n");

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
  }, finalPrompt);

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
 * Wait for Cursor to finish.
 * Primary done signal: assistant prints an EXTRA "Prompt {n} Completed"
 * (our sent instruction already contains one copy — that alone is not done).
 * Also watches Send↔Stop button transitions every pollIntervalMs (default 60s).
 */
export async function waitForCursorReply(
  page,
  previousText,
  context,
  loopIndex,
  cursorUrl = config.cursorUrl
) {
  let active = page;
  // Let the UI flip to Stop after send before taking baseline.
  await sleep(5000);
  if (context) active = await resolveCursorPage(context, active, cursorUrl);

  const baselineText = await collectPageText(active);
  const baselineWorkedFor = extractWorkedFor(baselineText);
  const baselineMarkerCount = countPromptCompleted(baselineText, loopIndex);
  let sawStop = false;
  let lastActionKind = "";
  let lastProgressLog = 0;
  const started = Date.now();
  const marker = promptCompletedMarker(loopIndex);
  const timeoutMin = Math.round(config.cursorReplyTimeoutMs / 60000);

  console.log(
    `Cursor wait start | expect extra "${marker}" | baselineMarkers=${baselineMarkerCount} | baseline workedFor="${baselineWorkedFor || "none"}" | timeout=${timeoutMin}m | textChars=${baselineText.length}`
  );

  await waitUntil(
    "Cursor agent reply",
    config.cursorReplyTimeoutMs,
    async () => {
      if (context) active = await resolveCursorPage(context, active, cursorUrl);
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
      const action = await getComposerActionState(active);
      const workedFor = extractWorkedFor(fullText);
      const markerCount = countPromptCompleted(fullText, loopIndex);
      const completed = markerCount > baselineMarkerCount;
      const newWorkedFor = Boolean(workedFor) && workedFor !== baselineWorkedFor;

      if (action === "stop") sawStop = true;

      const now = Date.now();
      if (now - lastProgressLog >= config.pollIntervalMs - 1000) {
        lastProgressLog = now;
        const mins = ((now - started) / 60000).toFixed(1);
        console.log(
          `… Cursor ${mins}m/${timeoutMin}m | action=${action} sawStop=${sawStop} markers=${markerCount}/${baselineMarkerCount}+ completed=${completed} workedFor="${workedFor || "none"}" textChars=${fullText.length}`
        );
      }

      // Still working: Stop button is showing.
      if (action === "stop") return false;

      // Best signal: assistant printed an additional completion marker and Stop is gone.
      if (completed && (sawStop || newWorkedFor || Date.now() - started > 90_000)) {
        active.__lastCursorText = pickAssistantPayload(fullText, previousText, loopIndex);
        console.log(`Detected assistant ${marker} (markers ${markerCount} > baseline ${baselineMarkerCount})`);
        return true;
      }

      // Strong secondary: saw Stop, now Send again, and Worked for changed.
      if (sawStop && action === "send" && newWorkedFor) {
        await sleep(2000);
        const again = await collectPageText(active);
        const againAction = await getComposerActionState(active);
        if (
          againAction !== "stop" &&
          extractWorkedFor(again) &&
          extractWorkedFor(again) !== baselineWorkedFor
        ) {
          active.__lastCursorText = pickAssistantPayload(again, previousText, loopIndex);
          console.log("Detected Stop→Send transition with new Worked for.");
          return true;
        }
      }

      // Late fallback after long runs: Send restored + Worked for changed + substantial text.
      if (
        action === "send" &&
        newWorkedFor &&
        fullText.length > 500 &&
        Date.now() - started > 120_000
      ) {
        active.__lastCursorText = pickAssistantPayload(fullText, previousText, loopIndex);
        console.log("Fallback done: Send idle + new Worked for.");
        return true;
      }

      return false;
    },
    config.pollIntervalMs
  );

  return active;
}

function pickAssistantPayload(fullText, previousText = "", loopIndex = 1) {
  const text = String(fullText || "").trim();
  if (!text) return "";

  const marker = promptCompletedMarker(loopIndex);
  const lower = text.toLowerCase();
  const markerLower = marker.toLowerCase();

  // Find every "Prompt N Completed" — outgoing instruction has one, assistant adds another.
  const positions = [];
  for (let i = 0; i < lower.length; ) {
    const found = lower.indexOf(markerLower, i);
    if (found < 0) break;
    positions.push(found);
    i = found + markerLower.length;
  }

  const MAX = 100_000;

  if (positions.length >= 2) {
    const last = positions[positions.length - 1];
    const prev = positions[positions.length - 2];
    // Between instruction marker and completion marker ≈ assistant turn (+ tiny user footer).
    let chunk = text.slice(prev + marker.length, last + marker.length + 40).trim();
    chunk = chunk
      .replace(/^then stop\.[^\n]*\n*/i, "")
      .replace(/^do not wait for more instructions\.?\n*/i, "")
      .trim();
    if (chunk.length > 40) return chunk.slice(0, MAX);
  }

  if (positions.length === 1) {
    const last = positions[0];
    const before = text.slice(0, last);
    // Start after our send footer when possible.
    const footerKeys = [
      "when you fully finish this task",
      "print exactly this line on its own",
      "-----",
    ];
    let start = Math.max(0, last - MAX);
    for (const key of footerKeys) {
      const at = before.toLowerCase().lastIndexOf(key);
      if (at > start) start = at;
    }
    let chunk = text.slice(start, last + marker.length + 40).trim();
    if (chunk.length > 40) return chunk.slice(0, MAX);
  }

  const workedIdx = lower.lastIndexOf("worked for");
  if (workedIdx >= 0) {
    return text.slice(Math.max(0, workedIdx - 2000), workedIdx + MAX).trim().slice(0, MAX);
  }

  const changesIdx = lower.lastIndexOf("changes made");
  if (changesIdx >= 0) return text.slice(changesIdx, changesIdx + MAX).trim().slice(0, MAX);

  // Prefer delta vs previous snapshot when we have one.
  const prev = String(previousText || "").trim();
  if (prev && text.length > prev.length + 40) {
    // Find where previous ends inside current; take the tail.
    const overlapAt = text.indexOf(prev.slice(-200));
    if (overlapAt >= 0) {
      const delta = text.slice(overlapAt + 200).trim();
      if (delta.length > 40) return delta.slice(0, MAX);
    }
    return text.slice(prev.length).trim().slice(0, MAX) || text.slice(-MAX).trim();
  }

  return text.slice(-MAX).trim();
}

/**
 * Read Cursor's latest reply for handoff to GPT.
 * Always refreshes from the page (cache alone was losing real responses).
 */
export async function getLatestCursorText(page, loopIndex = 1, previousText = "") {
  await page.bringToFront().catch(() => {});
  await scrollCursorToBottom(page);
  await sleep(800);

  const cached = String(page.__lastCursorText || "").trim();
  page.__lastCursorText = "";

  const domText = String((await collectAssistantDomText(page)) || "").trim();
  const full = await collectPageText(page);
  const fromFull = pickAssistantPayload(full, previousText, loopIndex);
  const fromDom = domText
    ? pickAssistantPayload(domText, previousText, loopIndex) || domText
    : "";

  // Prefer the longest plausible reply that mentions the completion marker when expected.
  const marker = promptCompletedMarker(loopIndex);
  const candidates = [fromDom, fromFull, cached, domText].filter((t) => t && t.trim().length > 40);
  candidates.sort((a, b) => {
    const aMark = a.toLowerCase().includes(marker.toLowerCase()) ? 1 : 0;
    const bMark = b.toLowerCase().includes(marker.toLowerCase()) ? 1 : 0;
    if (aMark !== bMark) return bMark - aMark;
    return b.length - a.length;
  });

  const best = candidates[0] || "";
  if (best.length > 40) {
    console.log(
      `Cursor reply extracted: ${best.length} chars` +
        (best.toLowerCase().includes(marker.toLowerCase()) ? ` (has ${marker})` : " (no marker in slice)")
    );
    return best.trim();
  }

  throw new Error(
    "Could not read Cursor agent response text. " +
      "Open the Cursor tab and check the latest assistant message is visible."
  );
}

export async function captureCursorImages(page, loopIndex) {
  const saved = [];
  // Keep this fast — GPT handoff must not stall on screenshot scraping.
  const images = page.locator("img");
  const count = await images.count().catch(() => 0);
  for (let i = 0; i < Math.min(count, 8); i += 1) {
    const img = images.nth(i);
    if (!(await img.isVisible().catch(() => false))) continue;
    const box = await img.boundingBox().catch(() => null);
    if (!box || box.width < 120 || box.height < 120) continue;
    const src = (await img.getAttribute("src").catch(() => "")) || "";
    if (/avatar|icon|logo|favicon|emoji|data:image\/svg/i.test(src)) continue;
    const file = artifactPath(`cursor-loop-${loopIndex}-img-${saved.length + 1}.png`);
    try {
      await img.screenshot({ path: file, timeout: 5000 });
      saved.push(file);
    } catch {
      // ignore
    }
    if (saved.length >= 2) break;
  }
  const summary = artifactPath(`cursor-loop-${loopIndex}-response.png`);
  try {
    await page.screenshot({ path: summary, fullPage: false, timeout: 8000 });
    saved.push(summary);
  } catch {
    // ignore
  }
  return saved;
}

export async function writeCursorDump(loopIndex, text) {
  const file = artifactPath(`cursor-loop-${loopIndex}-text.txt`);
  await fs.writeFile(file, text, "utf8");
  return file;
}
