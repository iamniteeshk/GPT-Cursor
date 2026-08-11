import { sleep } from "./browser.js";

/**
 * Soft overlays we can dismiss safely.
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

/** Popups/forms that need YOU — script reports and waits. */
const USER_ACTION_PATTERNS = [
  {
    kind: "github_auth",
    re: /refresh\/?reauthorize the github integration|invalid username or token|connect github|authorize github|github.*(login|sign.?in|permission)/i,
    message:
      "ACTION NEEDED: GitHub auth/token. Fix GitHub integration in the Chrome Cursor window.",
  },
  {
    kind: "telegram_bot_token",
    re: /telegram.*bot.?token|bot.?token.*telegram|enter (your )?bot token|BOT_TOKEN/i,
    message:
      "ACTION NEEDED: Telegram Bot Token. Paste it in the Chrome popup/form, then continue.",
  },
  {
    kind: "telegram_chat_id",
    re: /telegram.*chat.?id|chat.?id.*telegram|enter (your )?chat id|CHAT_ID/i,
    message:
      "ACTION NEEDED: Telegram Chat ID. Paste it in the Chrome popup/form, then continue.",
  },
  {
    kind: "api_secret",
    re: /enter (your )?(api[_ ]?key|secret|access token)|needs? (a |your )?(api[_ ]?key|secret|token)|provide (your )?(api[_ ]?key|secret|token)/i,
    message:
      "ACTION NEEDED: API key / secret / token field is waiting. Fill it in Chrome.",
  },
  {
    kind: "env_setup",
    re: /set up cloud agents|install script|start script|environment setup|missing (required )?secret/i,
    message:
      "ACTION NEEDED: Cursor environment/setup UI needs your input in Chrome.",
  },
  {
    kind: "agent_blocked",
    re: /agent is blocked/i,
    message:
      'ACTION NEEDED: Cursor shows "Agent is blocked". Resolve the blocker in Chrome (often GitHub/env).',
  },
  {
    kind: "cloudflare",
    re: /verify you are human/i,
    message: "ACTION NEEDED: Cloudflare human check. Complete it in Chrome.",
  },
  {
    kind: "permissions",
    re: /allow.*access|grant permission|requesting permission/i,
    message:
      "ACTION NEEDED: A permission prompt needs your choice in Chrome (Allow/Deny).",
  },
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
    const origins = [
      "https://chatgpt.com",
      "https://chat.openai.com",
      "https://cursor.com",
      "https://www.cursor.com",
    ];
    for (const origin of origins) {
      await context.clearPermissions().catch(() => {});
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
    // Never auto-click Cancel while a user-action form may be open —
    // Cancel is handled only inside known soft notification dialogs.
    if (/^cancel$/i.test(String(name))) continue;

    const btn = page.getByRole("button", { name });
    if (await clickIfVisible(btn, `button ${name}`)) dismissed += 1;

    const link = page.getByRole("link", { name });
    if (await clickIfVisible(link, `link ${name}`)) dismissed += 1;
  }
  return dismissed;
}

async function dismissKnownModals(page) {
  let dismissed = 0;

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

  const dialogs = page.locator('[role="dialog"], [role="alertdialog"], [aria-modal="true"]');
  const dialogCount = await dialogs.count().catch(() => 0);
  for (let i = 0; i < dialogCount; i += 1) {
    const dialog = dialogs.nth(i);
    if (!(await dialog.isVisible().catch(() => false))) continue;

    const text = ((await dialog.innerText().catch(() => "")) || "").trim();

    // Do NOT auto-close dialogs that ask for secrets / tokens / GitHub.
    const needsUser = USER_ACTION_PATTERNS.some((p) => p.re.test(text));
    if (needsUser) continue;

    const looksBlocking = DISMISS_TEXT_SNIPPETS.some((re) => re.test(text));
    const closeCandidates = [
      dialog.getByRole("button", {
        name: /don't ask again|not now|no thanks|dismiss|close|got it|skip/i,
      }),
      dialog.locator('button[aria-label*="Close" i], button[aria-label*="Dismiss" i]'),
      dialog.locator('button:has-text("×"), button:has-text("✕")'),
    ];

    for (const candidate of closeCandidates) {
      if (
        await clickIfVisible(
          candidate,
          looksBlocking ? "blocking dialog" : "dialog close"
        )
      ) {
        dismissed += 1;
        break;
      }
    }
  }

  return dismissed;
}

async function dismissCookieBanners(page) {
  let dismissed = 0;
  const ordered = [
    page.getByRole("button", { name: /reject all/i }),
    page.getByRole("button", { name: /only necessary|essential only/i }),
    page.getByRole("button", { name: /accept all/i }),
    page.getByRole("button", { name: /accept cookies/i }),
  ];
  for (const btn of ordered) {
    if (await clickIfVisible(btn, "cookie banner")) {
      dismissed += 1;
      break;
    }
  }
  return dismissed;
}

function matchUserAction(text) {
  for (const pattern of USER_ACTION_PATTERNS) {
    if (pattern.re.test(text)) {
      return { kind: pattern.kind, message: pattern.message };
    }
  }
  return null;
}

export async function detectHardBlocker(page) {
  const bodyText = (
    (await page.locator("body").innerText().catch(() => "")) || ""
  ).slice(0, 12000);

  const fromBody = matchUserAction(bodyText);
  if (fromBody) return fromBody;

  // Dialog-only scan (more precise for token forms).
  const dialogs = page.locator('[role="dialog"], [role="alertdialog"], [aria-modal="true"]');
  const dialogCount = await dialogs.count().catch(() => 0);
  for (let i = 0; i < dialogCount; i += 1) {
    const dialog = dialogs.nth(i);
    if (!(await dialog.isVisible().catch(() => false))) continue;
    const text = ((await dialog.innerText().catch(() => "")) || "").trim();
    const hit = matchUserAction(text);
    if (hit) return hit;
  }

  // Password/token-looking inputs in a visible modal.
  const secretInput = page.locator(
    'input[type="password"], input[name*="token" i], input[placeholder*="token" i], input[placeholder*="chat id" i], input[placeholder*="bot" i]'
  );
  if (await secretInput.first().isVisible().catch(() => false)) {
    const nearby = (
      (await secretInput.first().evaluate((el) => el.closest("[role=dialog], form, body")?.innerText || "").catch(
        () => ""
      )) || ""
    ).slice(0, 2000);
    const hit = matchUserAction(nearby);
    return (
      hit || {
        kind: "secret_input",
        message:
          "ACTION NEEDED: A secret/token input is visible in Chrome. Fill it (e.g. Telegram bot token / chat ID), then continue.",
      }
    );
  }

  return null;
}

/**
 * @returns {{ dismissed: number, blocker: object|null }}
 */
export async function dismissBlockingUi(page, { label = "page" } = {}) {
  await installDialogHandlers(page);

  // Report user-action blockers BEFORE dismissing anything that might close them.
  const blockerFirst = await detectHardBlocker(page);

  let dismissed = 0;
  if (!blockerFirst) {
    dismissed += await dismissKnownModals(page);
    dismissed += await dismissByButtonNames(page);
    dismissed += await dismissCookieBanners(page);

    if (dismissed === 0) {
      const dialogVisible = await page
        .locator('[role="dialog"], [role="alertdialog"], [aria-modal="true"]')
        .first()
        .isVisible()
        .catch(() => false);
      if (dialogVisible) {
        // Only Escape soft dialogs; re-check blocker after.
        await page.keyboard.press("Escape").catch(() => {});
        await sleep(300);
        dismissed += 1;
        console.log(`Sent Escape to clear modal on ${label}`);
      }
    }
  }

  const blocker = blockerFirst || (await detectHardBlocker(page));
  if (blocker) {
    console.warn(`\n⚠️  ${blocker.message}`);
    console.warn("   Script is PAUSED on this until you finish it in Chrome.\n");
  } else if (dismissed > 0) {
    console.log(`Cleared ${dismissed} overlay action(s) on ${label}`);
  }

  return { dismissed, blocker };
}

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
