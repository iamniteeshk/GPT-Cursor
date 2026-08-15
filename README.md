# GPT ↔ Cursor automation

Automates the ChatGPT ↔ Cursor agent copy-paste loop using **your browser profile** (no APIs).

Default browser: **Microsoft Edge** (best for Windows NUC). Chrome still optional.

Desktop only — not iOS.

## What it does

1. Asks for **GPT chat URL** + **Cursor agent URL** (terminal or Telegram)
2. Copies GPT’s prompt into Cursor
3. Waits until Cursor finishes (`Prompt N Completed` + Send↔Stop)
4. Pastes Cursor text/screenshots back to GPT
5. Repeats until GPT replies with only `Automation Done`
6. On browser crash/CDP drop: reconnects and reopens that agent’s tabs (up to 4 tries)

## Multi-agent (5 agents / 10 tabs)

Up to **5** concurrent GPT↔Cursor pairs share one debug browser (= **10 tabs**).

Control from your phone with Telegram (`npm run telegram`).

## Timeouts

| Setting | Default |
|--------|---------|
| Cursor wait | **60 minutes** |
| GPT wait | **20 minutes** |
| Poll | **every 60 seconds** |
| Max agents | **5** (`MAX_AGENTS`) |

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

## macOS (Edge or Chrome)

```bash
git pull
npm install
cp -n .env.example .env
bash scripts/start-edge.sh
# or: BROWSER=chrome bash scripts/start-chrome.sh
npm start
```

## Telegram listener (phone control)

Put secrets in `.env` or `secrets.local.json` **before** starting (code is ready; you fill tokens):

```env
TELEGRAM_BOT_TOKEN=123:ABC...
TELEGRAM_CHAT_ID=your_chat_id
MAX_AGENTS=5
```

```bash
# Terminal 1 — debug browser must stay open
bash scripts/start-chrome.sh   # or start-edge.sh / .ps1

# Terminal 2
npm run telegram
```

### Commands

Fixed slots **1–5**. `/run` always takes the lowest free slot (1, then 2, … then 5).

| Command | Meaning |
|---------|---------|
| `/status` | Status of **all 5** agents (idle + busy) |
| `/status N` | Status of **one** agent (e.g. `/status 2`) |
| `/run` | Start on next free slot — then paste GPT + Cursor links |
| `/run <gpt> <cursor>` | Same, both links in one message |
| `/stop` | Stop **all** agents |
| `/stop N` | Stop **one** agent (e.g. `/stop 3`) |
| `/help` | Command list |

When a run hits **Automation Done**, Telegram gets a completion message automatically (also on failure). That slot becomes free for the next `/run`.

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

## Browser crash note

If you see `Target page, context or browser has been closed`, the debug browser quit or CDP died (sleep, crash, manual close). Keep the debug window open; the runner will reconnect and reopen tabs when possible. Restart `start-*.sh/.ps1` if CDP never comes back.

## Notes

- Debug profile: `~/.gpt-cursor-edge` (Mac) / `%USERPROFILE%\.gpt-cursor-edge` (Windows)
- Soft popups auto-dismiss; GitHub/Cloudflare/Agent-blocked pause with a message
- Artifacts: `artifacts/` (per-agent under `artifacts/agent-<id>/`)
