import { sleep } from "./browser.js";

/**
 * Dismiss common overlays that block ChatGPT / Cursor agent UIs.
 * Prefer decline / "not now" / "don't ask again" — never enable notifications.
 */
const DISMISS_BUTTON_NAMES = [
  /^don't ask again$/i,
  /^not now$/i,
  /^no thanks$/i,
  /^dismiss$/i,
  /^close$/i,
  /^got it$/i,
  /^maybe later$/i,
  /^skip$/i,
  /^cancel$/i,
  /^reject$/i,
  /^deny$/i,
  /^decline$/i,
  /^continue without$/i,
  /^remind me later$/i,
];

const DISMISS_TEXT_SNIPPETS = [
  /enable notifications/i,
  /get notified when your agent is done/i,
  /turn on notifications/i,
  /stay signed in/i,
  /accept (all )?cookies/i,
  /we use cookies/i,
];

export async function installDialogHandlers(page) {
  if (page.__gptCursorDialogHandlersInstalled) return;
  page.__gptCursorDialogHandlersInstalled = true;

  page.on("dialog", async (dialog) => {
    try {
      console.log(`Dismissing JS dialog (${dialog.type()}): ${dialog.message()}`);
      await dialog.dismiss();
    } catch {
      // ignore
    }
  });
}

export async function denyBrowserPermissions(context) {
  try {
    // Best-effort: keep notifications/geolocation off for chatgpt + cursor origins.
    const origins = [
      "https://chatgpt.com",
      "https://chat.openai.com",
      "https://cursor.com",
      "https://www.cursor.com",
    ];
    for (const origin of origins) {
      await context.clearPermissions().catch(() => {});
      // grant nothing sensitive; clearing first means prompts may still appear as overlays in-page
      await context.grantPermissions([], { origin }).catch(() => {});
    }
  } catch {
    // CDP contexts sometimes restrict permission APIs; ignore.
  }
}

async function clickIfVisible(locator, label) {
  try {
    const target = locator.first();
    if (!(await target.isVisible({ timeout: 400 }).catch(() => false))) return false;
    await target.click({ timeout: 2000, force: true });
    console.log(`Dismissed popup via: ${label}`);
    await sleep(400);
    return true;
  } catch {
    return false;
  }
}

async function dismissByButtonNames(page) {
  let dismissed = 0;
  for (const name of DISMISS_BUTTON_NAMES) {
    const btn = page.getByRole("button", { name });
    if (await clickIfVisible(btn, `button ${name}`)) dismissed += 1;

    const link = page.getByRole("link", { name });
    if (await clickIfVisible(link, `link ${name}`)) dismissed += 1;
  }
  return dismissed;
}

async function dismissKnownModals(page) {
  let dismissed = 0;

  // Cursor notifications modal specifically.
  const notifTitle = page.getByText(/enable notifications/i).first();
  if (await notifTitle.isVisible().catch(() => false)) {
    const prefer = [
      page.getByRole("button", { name: /don't ask again/i }),
      page.getByRole("button", { name: /not now/i }),
      page.getByRole("button", { name: /no thanks/i }),
    ];
    for (const btn of prefer) {
      if (await clickIfVisible(btn, "notifications modal decline")) {
        dismissed += 1;
        break;
      }
    }
  }

  // Generic dialog/alertdialog close controls.
  const dialogs = page.locator('[role="dialog"], [role="alertdialog"], [aria-modal="true"]');
  const dialogCount = await dialogs.count().catch(() => 0);
  for (let i = 0; i < dialogCount; i += 1) {
    const dialog = dialogs.nth(i);
    if (!(await dialog.isVisible().catch(() => false))) continue;

    const text = ((await dialog.innerText().catch(() => "")) || "").trim();
    const looksBlocking = DISMISS_TEXT_SNIPPETS.some((re) => re.test(text));

    const closeCandidates = [
      dialog.getByRole("button", { name: /don't ask again|not now|no thanks|dismiss|close|got it|skip|cancel/i }),
      dialog.locator('button[aria-label*="Close" i], button[aria-label*="Dismiss" i]'),
      dialog.locator('button:has-text("×"), button:has-text("✕")'),
    ];

    for (const candidate of closeCandidates) {
      if (await clickIfVisible(candidate, looksBlocking ? "blocking dialog" : "dialog close")) {
        dismissed += 1;
        break;
      }
    }
  }

  return dismissed;
}

async function dismissCookieBanners(page) {
  let dismissed = 0;
  const candidates = [
    page.getByRole("button", { name: /accept all/i }),
    page.getByRole("button", { name: /reject all/i }),
    page.getByRole("button", { name: /accept cookies/i }),
    page.getByRole("button", { name: /only necessary|essential only/i }),
  ];
  // Prefer reject/necessary if present; otherwise accept-all so the page is usable.
  const ordered = [
    candidates[1],
    candidates[3],
    candidates[0],
    candidates[2],
  ];
  for (const btn of ordered) {
    if (await clickIfVisible(btn, "cookie banner")) {
      dismissed += 1;
      break;
    }
  }
  return dismissed;
}

export async function detectHardBlocker(page) {
  const bodyText = ((await page.locator("body").innerText().catch(() => "")) || "").slice(0, 8000);

  if (/agent is blocked/i.test(bodyText)) {
    return {
      kind: "agent_blocked",
      message:
        'Cursor shows "Agent is blocked". Usually GitHub auth / environment setup. Fix it in the Chrome window, then the script can continue.',
    };
  }

  if (/refresh\/?reauthorize the github integration|invalid username or token/i.test(bodyText)) {
    return {
      kind: "github_auth",
      message:
        "Cursor needs GitHub reauthorization. Refresh GitHub integration in Cursor, then continue.",
    };
  }

  if (/verify you are human/i.test(bodyText)) {
    return {
      kind: "cloudflare",
      message: "Cloudflare human verification is blocking Cursor. Complete it in Chrome.",
    };
  }

  return null;
}

/**
 * Run a pass of popup dismissal. Safe to call often.
 * @returns {{ dismissed: number, blocker: object|null }}
 */
export async function dismissBlockingUi(page, { label = "page" } = {}) {
  await installDialogHandlers(page);

  let dismissed = 0;
  dismissed += await dismissKnownModals(page);
  dismissed += await dismissByButtonNames(page);
  dismissed += await dismissCookieBanners(page);

  // Escape can close some modals if a close control wasn't found.
  if (dismissed === 0) {
    const dialogVisible = await page
      .locator('[role="dialog"], [role="alertdialog"], [aria-modal="true"]')
      .first()
      .isVisible()
      .catch(() => false);
    if (dialogVisible) {
      await page.keyboard.press("Escape").catch(() => {});
      await sleep(300);
      dismissed += 1;
      console.log(`Sent Escape to clear modal on ${label}`);
    }
  }

  const blocker = await detectHardBlocker(page);
  if (blocker) {
    console.warn(`Hard blocker on ${label}: ${blocker.message}`);
  } else if (dismissed > 0) {
    console.log(`Cleared ${dismissed} overlay action(s) on ${label}`);
  }

  return { dismissed, blocker };
}

/**
 * Keep clearing soft popups while waiting; throw/return on hard blockers after patience.
 */
export async function clearPopupsDuringWait(page, { label = "page", maxRounds = 3 } = {}) {
  let lastBlocker = null;
  for (let i = 0; i < maxRounds; i += 1) {
    const { blocker } = await dismissBlockingUi(page, { label });
    lastBlocker = blocker;
    if (!blocker) return null;
    await sleep(1500);
  }
  return lastBlocker;
}
