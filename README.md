# GPT ↔ Cursor automation

Automates the ChatGPT ↔ Cursor agent copy-paste loop using **your Chrome profile** (no APIs).

Supports **macOS** and **Windows** (including a fresh Intel NUC).  
Desktop only — not iOS.

## What it does

1. Asks for **GPT chat URL** + **Cursor agent URL** each run
2. Copies GPT’s prompt into Cursor
3. Waits until Cursor finishes (`Prompt N Completed` + Send↔Stop)
4. Pastes Cursor text/screenshots back to GPT
5. Repeats until GPT replies with only `Automation Done`

## Timeouts

| Setting | Default |
|--------|---------|
| Cursor wait | **60 minutes** |
| GPT wait | **20 minutes** |
| Poll | **every 60 seconds** |

## Preflight (recommended)

```bash
npm install
npm run self-check
```

## Fresh Windows NUC checklist

1. Install [Node.js LTS](https://nodejs.org/) and [Chrome](https://www.google.com/chrome/)
2. PowerShell:

```powershell
git clone https://github.com/iamniteeshk/GPT-Cursor.git
cd GPT-Cursor
git checkout cursor/gpt-cursor-automation-fb11
powershell -ExecutionPolicy Bypass -File .\scripts\setup-windows.ps1
npm run self-check
.\scripts\start-chrome.ps1
```

3. In the debug Chrome window, log into **ChatGPT** + **Cursor** once (fresh NUC has no cookies)
4. Keep that Chrome open
5. `npm start` and paste both links when asked
6. Confirm startup line shows: `Timeouts: Cursor 60m | GPT 20m | poll 60s`
7. Leave the NUC awake (no sleep) while it runs

## macOS

```bash
git pull
npm install
npm run self-check
bash scripts/start-chrome.sh
npm start
```

## Busy / done rules

- **Stop button visible** → still busy
- **Extra `Prompt N Completed`** after send (not just the instruction text) → done
- Fallback: Stop→Send + new `Worked for …`
- **Automation Done** only stops the loop if GPT is not also giving a next Prompt N

Prompt numbers are taken from GPT’s text when present (so a restart can continue at Prompt 8).

## Optional Telegram

`.env` or `secrets.local.json` — if missing, automation continues without pausing.

## Notes

- Keep debug Chrome open (`~/.gpt-cursor-chrome` on Mac, `%USERPROFILE%\.gpt-cursor-chrome` on Windows)
- Soft popups auto-dismiss; GitHub/Cloudflare/Agent-blocked pause with a message
- Artifacts: `artifacts/`
