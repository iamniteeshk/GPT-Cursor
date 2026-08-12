# GPT ↔ Cursor automation

Automates the ChatGPT ↔ Cursor agent copy-paste loop using **your Chrome profile** (no APIs).

Supports **macOS** and **Windows** (including a fresh Intel NUC).  
This is a desktop Node + Chrome tool — it does **not** run on iOS/iPhone.

## What it does

1. Asks you for **GPT chat URL** + **Cursor agent URL** each run
2. Copies GPT’s prompt into Cursor
3. Waits until Cursor finishes (Send↔Stop button + `Prompt N Completed`)
4. Pastes Cursor text/screenshots back to GPT
5. Repeats until GPT says `Automation Done`

## Timeouts / polling

| Setting | Default |
|--------|---------|
| Cursor wait | **60 minutes** |
| GPT wait | **20 minutes** |
| Status check | **every 60 seconds** |
| Done signal | `Prompt {n} Completed` (+ Stop→Send / Worked for fallback) |

## Fresh Windows NUC setup

1. Install [Node.js 18+](https://nodejs.org/) (LTS)
2. Install [Google Chrome](https://www.google.com/chrome/)
3. Open PowerShell:

```powershell
git clone https://github.com/iamniteeshk/GPT-Cursor.git
cd GPT-Cursor
git checkout cursor/gpt-cursor-automation-fb11
npm install
copy .env.example .env
```

4. Start debug Chrome (auto-quits normal Chrome, seeds profile):

```powershell
.\scripts\start-chrome.ps1
```

5. Wait for `CDP is ready`, keep that Chrome open, log into ChatGPT + Cursor if asked.

6. Run automation:

```powershell
npm start
```

Paste the GPT + Cursor links when prompted.

## macOS setup

```bash
git clone https://github.com/iamniteeshk/GPT-Cursor.git
cd GPT-Cursor
git checkout cursor/gpt-cursor-automation-fb11
npm install
cp -n .env.example .env
bash scripts/start-chrome.sh
npm start
```

## Each run

```text
Enter chat links for this run:
GPT chat URL: https://chatgpt.com/c/...
Cursor agent URL: https://cursor.com/agents/bc-...
```

Optional defaults can be stored in `.env`, but the terminal still asks every run.

## Busy / done detection (Cursor)

Every minute the script checks:

1. **Composer action button**
   - `Stop` visible → still busy
   - `Send` visible again after Stop → likely done
2. **Text marker** (best): `Prompt 1 Completed`, `Prompt 2 Completed`, …
3. Fallback: new `Worked for …` after a Stop→Send transition

Each Cursor prompt is appended with instructions to print `Prompt {n} Completed`.  
Follow-ups to GPT also ask it to include that requirement in the next Cursor prompt.

## Optional Telegram secrets

`.env`:
```env
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
```

or `secrets.local.json` (from `secrets.local.json.example`).

If missing → proceed without pausing.

## Notes

- Keep the debug Chrome window open while it runs
- Soft popups auto-dismiss; hard blockers (GitHub / Cloudflare / Agent blocked) pause with a message
- Artifacts land in `artifacts/`
- Why `~/.gpt-cursor-chrome`? Newer Chrome blocks remote debugging on the default profile directory
