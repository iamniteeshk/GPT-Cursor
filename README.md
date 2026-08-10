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

- GPT: `https://chatgpt.com/c/6a7a07c4-635c-83ee-adf7-d03cb6bbf421`
- Cursor: `https://cursor.com/agents/bc-a815a9ed-9dda-47b4-96db-e0d48dad0c95`
- Stops when GPT replies with: `Automation Done`

Override in `.env` if needed.
