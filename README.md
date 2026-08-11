# GPT ↔ Cursor automation

Automates your copy-paste loop between ChatGPT and a Cursor agent using your Chrome login cookies (**no APIs**).

## Why `~/.gpt-cursor-chrome`?

Newer Chrome errors with:

`DevTools remote debugging requires a non-default data directory`

So the start script copies your real Chrome profile into **`~/.gpt-cursor-chrome`** and launches that debug copy with port `9222`.

## Setup

```bash
git pull
npm install
cp -n .env.example .env
```

## Mac test commands

```bash
bash scripts/start-chrome.sh
```

You must see:

```text
CDP is ready at http://127.0.0.1:9222
SUCCESS.
```

Then:

```bash
curl http://127.0.0.1:9222/json/version
npm run check-login
npm start
```

If the debug Chrome window asks you to sign into ChatGPT or Cursor, sign in once there, then rerun `npm run check-login`.

## What the start script does

1. Quits normal Chrome (needed to copy cookies safely)
2. Seeds `~/.gpt-cursor-chrome` from your real profile
3. Starts that **non-default** profile with `--remote-debugging-port=9222`
4. Verifies CDP before exiting

Skip re-copying an already-seeded profile:

```bash
SYNC_PROFILE=0 bash scripts/start-chrome.sh
```

## Default URLs / stop phrase

- GPT: `https://chatgpt.com/c/6a7b03a4-1650-83ee-aa2f-7cf42012dc5d`
- Cursor: `https://cursor.com/agents/bc-bcf89552-31d7-414b-af4c-c5ba7443f517`
- Stops when GPT replies with: `Automation Done`

Override in `.env` if needed.

## Telegram secrets (optional)

Store locally in either place (never commit real tokens):

**.env**
```env
TELEGRAM_BOT_TOKEN=123456:ABC...
TELEGRAM_CHAT_ID=987654321
```

**or `secrets.local.json`** (copy from example):
```bash
cp secrets.local.json.example secrets.local.json
```

```json
{
  "telegramBotToken": "123456:ABC...",
  "telegramChatId": "987654321"
}
```

If Telegram fields appear and secrets exist → autofill.  
If secrets are missing → log once and **proceed as usual** (no pause).

## Notes

- Keep that Chrome window open while the script runs.
- Soft popups (notifications, cookies, "Not now") are auto-dismissed.
- Only hard blockers pause the loop: **Agent is blocked**, GitHub token errors, Cloudflare.
- Cursor wait default is **40 minutes**; progress logs every minute.
- Artifacts are saved under `artifacts/`.
