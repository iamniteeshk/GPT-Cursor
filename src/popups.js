import { sleep } from "./browser.js";
import { hasTelegramSecrets, secrets } from "./secrets.js";

/**
 * Soft overlays we can dismiss safely.
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
  /^reject all$/i,
  /^deny$/i,
  /^decline$/i,
  /^continue without$/i,
  /^remind me later$/i,
];

const DISMISS_TEXT_SNIPPETS = [
  /enable notifications/i,
  /get notified when your agent is done/i,
  /turn on notifications/i,
  /we use cookies/i,
];

/** Only true hard blockers that should pause the loop. */
const HARD_BLOCKERS = [
  {
    kind: "github_auth",
    re: /refresh\/?reauthorize the github integration|invalid username or token/i,
    message:
      "ACTION NEEDED: GitHub auth/token. Fix GitHub integration in the Chrome Cursor window.",
  },
  {
    kind: "agent_blocked",
    re: /agent is blocked/i,
    message:
      'ACTION NEEDED: Cursor shows "Agent is blocked". Resolve it in Chrome (often GitHub/env).',
  },
  {
    kind: "cloudflare",
    re: /verify you are human/i,
    message: "ACTION NEEDED: Cloudflare human check. Complete it in Chrome.",
  },
];

const warnedOnce = new Set();

function warnOnce(key, message) {
  if (warnedOnce.has(key)) return;
  warnedOnce.add(key);
  console.warn(`\n⚠️  ${message}\n`);
}

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
    // Block noisy permissions, but allow clipboard so GPT paste works on Edge/Windows.
    await context.clearPermissions().catch(() => {});
    const chatgptOrigins = ["https://chatgpt.com", "https://chat.openai.com"];
    for (const origin of chatgptOrigins) {
      await context
        .grantPermissions(["clipboard-read", "clipboard-write"], { origin })
        .catch(() => {});
    }
  } catch {
    // ignore
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

  // Prefer Deny/Block on browser-ish permission cards if visible as page UI.
  const permissionDeny = page.getByRole("button", { name: /^(deny|block|not now)$/i });
  if (await clickIfVisible(permissionDeny, "permission deny")) dismissed += 1;

  const dialogs = page.locator('[role="dialog"], [role="alertdialog"], [aria-modal="true"]');
  const dialogCount = await dialogs.count().catch(() => 0);
  for (let i = 0; i < dialogCount; i += 1) {
    const dialog = dialogs.nth(i);
    if (!(await dialog.isVisible().catch(() => false))) continue;

    const text = ((await dialog.innerText().catch(() => "")) || "").trim();
    if (HARD_BLOCKERS.some((p) => p.re.test(text))) continue;
    if (/bot.?token|chat.?id|telegram/i.test(text)) continue;

    const looksSoft = DISMISS_TEXT_SNIPPETS.some((re) => re.test(text));
    const closeCandidates = [
      dialog.getByRole("button", {
        name: /don't ask again|not now|no thanks|dismiss|close|got it|skip|deny|block/i,
      }),
      dialog.locator('button[aria-label*="Close" i], button[aria-label*="Dismiss" i]'),
    ];

    for (const candidate of closeCandidates) {
      if (await clickIfVisible(candidate, looksSoft ? "soft dialog" : "dialog close")) {
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
  ];
  for (const btn of ordered) {
    if (await clickIfVisible(btn, "cookie banner")) {
      dismissed += 1;
      break;
    }
  }
  return dismissed;
}

async function fillInput(locator, value) {
  const el = locator.first();
  if (!(await el.isVisible().catch(() => false))) return false;
  await el.click({ timeout: 2000 });
  await el.fill("");
  await el.fill(value);
  return true;
}

/**
 * If Telegram fields appear and local secrets exist, autofill.
 * If secrets are missing, log once and proceed (no pause).
 */
export async function maybeAutofillTelegram(page) {
  const bodyText = (
    (await page.locator("body").innerText().catch(() => "")) || ""
  ).slice(0, 12000);

  const asksTelegram =
    /telegram/i.test(bodyText) &&
    (/bot.?token/i.test(bodyText) || /chat.?id/i.test(bodyText));

  const tokenInput = page.locator(
    'input[placeholder*="bot token" i], input[name*="bot" i][name*="token" i], input[placeholder*="token" i]'
  );
  const chatInput = page.locator(
    'input[placeholder*="chat id" i], input[name*="chat" i], input[placeholder*="chat" i]'
  );

  const tokenVisible = await tokenInput.first().isVisible().catch(() => false);
  const chatVisible = await chatInput.first().isVisible().catch(() => false);

  if (!asksTelegram && !tokenVisible && !chatVisible) return { handled: false };

  if (!hasTelegramSecrets()) {
    warnOnce(
      "telegram-missing",
      "Telegram fields detected, but no local secrets found. Proceeding without autofill.\n" +
        "   Add them to .env (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID)\n" +
        "   or secrets.local.json — see secrets.local.json.example"
    );
    return { handled: false, missing: true };
  }

  let filled = 0;
  if (tokenVisible || asksTelegram) {
    if (await fillInput(tokenInput, secrets.telegramBotToken)) filled += 1;
  }
  if (chatVisible || asksTelegram) {
    if (await fillInput(chatInput, secrets.telegramChatId)) filled += 1;
  }

  if (filled > 0) {
    console.log(`Autofilled ${filled} Telegram field(s) from local secrets.`);
    const submit = page.getByRole("button", {
      name: /^(save|submit|continue|confirm|done|add)$/i,
    });
    await clickIfVisible(submit, "telegram submit");
    await sleep(800);
    return { handled: true, filled };
  }

  warnOnce(
    "telegram-no-inputs",
    "Telegram mentioned on page and secrets exist, but no input fields found to autofill. Proceeding."
  );
  return { handled: false };
}

export async function detectHardBlocker(page) {
  const bodyText = (
    (await page.locator("body").innerText().catch(() => "")) || ""
  ).slice(0, 12000);

  for (const pattern of HARD_BLOCKERS) {
    if (pattern.re.test(bodyText)) {
      return { kind: pattern.kind, message: pattern.message };
    }
  }

  const dialogs = page.locator('[role="dialog"], [role="alertdialog"], [aria-modal="true"]');
  const dialogCount = await dialogs.count().catch(() => 0);
  for (let i = 0; i < dialogCount; i += 1) {
    const dialog = dialogs.nth(i);
    if (!(await dialog.isVisible().catch(() => false))) continue;
    const text = ((await dialog.innerText().catch(() => "")) || "").trim();
    for (const pattern of HARD_BLOCKERS) {
      if (pattern.re.test(text)) {
        return { kind: pattern.kind, message: pattern.message };
      }
    }
  }

  return null;
}

/**
 * @returns {{ dismissed: number, blocker: object|null }}
 */
export async function dismissBlockingUi(page, { label = "page" } = {}) {
  await installDialogHandlers(page);
  await maybeAutofillTelegram(page);

  let dismissed = 0;
  dismissed += await dismissKnownModals(page);
  dismissed += await dismissByButtonNames(page);
  dismissed += await dismissCookieBanners(page);

  const blocker = await detectHardBlocker(page);
  if (blocker) {
    warnOnce(`blocker:${blocker.kind}`, `${blocker.message}\n   Script pauses only for this hard blocker.`);
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
