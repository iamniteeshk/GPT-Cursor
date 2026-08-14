# GPT ↔ Cursor automation

Automates the ChatGPT ↔ Cursor agent copy-paste loop using **your browser profile** (no APIs).

Default browser: **Microsoft Edge** (best for Windows NUC). Chrome still optional.

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

## Preflight

```bash
npm install
npm run self-check
```

## Fresh Windows NUC (Edge)

Prereqs: **Git**, **Node.js LTS**, **Microsoft Edge** (usually preinstalled)

```powershell
git clone https://github.com/iamniteeshk/GPT-Cursor.git
cd GPT-Cursor
git checkout cursor/gpt-cursor-automation-fb11
powershell -ExecutionPolicy Bypass -File .\scripts\setup-windows.ps1
npm run self-check
.\scripts\start-edge.ps1
npm start
```

1. `start-edge.ps1` quits Edge, copies your Edge profile into `%USERPROFILE%\.gpt-cursor-edge`, opens debug Edge on port `9222`
2. Log into ChatGPT + Cursor in that Edge window if needed
3. Keep Edge open, run `npm start`, paste both links
4. Confirm: `Timeouts: Cursor 60m | GPT 20m | poll 60s`
5. Keep the NUC awake

## macOS (Edge)

```bash
git pull
npm install
cp -n .env.example .env
bash scripts/start-edge.sh
npm start
```

## Optional: Chrome instead

In `.env`:
```env
BROWSER=chrome
```

Then use `.\scripts\start-chrome.ps1` / `bash scripts/start-chrome.sh`.

## Busy / done rules

- **Stop button visible** → still busy
- **Extra `Prompt N Completed`** after send → done
- Fallback: Stop→Send + new `Worked for …`
- **Automation Done** only stops if GPT is not also giving a next Prompt N

## Optional Telegram

`.env` or `secrets.local.json` — if missing, continue without pausing.

## Notes

- Debug profile: `~/.gpt-cursor-edge` (Mac) / `%USERPROFILE%\.gpt-cursor-edge` (Windows)
- Soft popups auto-dismiss; GitHub/Cloudflare/Agent-blocked pause with a message
- Artifacts: `artifacts/`
