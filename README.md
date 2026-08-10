# GPT ↔ Cursor automation

Automates your copy-paste loop between ChatGPT and a Cursor agent using **your Chrome profile** (no OpenAI/Cursor APIs).

Flow:
1. Read the latest prompt from the GPT chat
2. Paste it into the Cursor agent
3. Wait for Cursor to finish
4. Paste Cursor text + screenshots back into GPT
5. Repeat until GPT replies with `AUTOMATION COMPLETED`

Default chats:
- GPT: `https://chatgpt.com/c/6a79d41c-5274-83ee-8822-c78db9ded87f`
- Cursor: `https://cursor.com/agents/bc-a815a9ed-9dda-47b4-96db-e0d48dad0c95`

## Prerequisites

- Node.js 18+
- Google Chrome
- Already logged into ChatGPT and Cursor in that Chrome profile

## Setup

```bash
git clone https://github.com/iamniteeshk/GPT-Cursor.git
cd GPT-Cursor
git checkout cursor/gpt-cursor-automation-fb11
npm install
cp .env.example .env
```

## Test commands (Mac)

Chrome must be started **with** remote debugging. If Chrome was already open, macOS prints `Opening in existing browser session` and port `9222` never opens.

```bash
# 1) This quits Chrome, relaunches with debugging, and verifies port 9222
bash scripts/start-chrome.sh

# 2) You must see: "CDP is ready at http://127.0.0.1:9222"
#    Optional manual check:
curl http://127.0.0.1:9222/json/version

# 3) Confirm login, then run
npm run check-login
npm start
```

If step 1 still fails:
1. Press **Cmd+Q** in Chrome (fully quit)
2. Open **Activity Monitor** → quit any remaining **Google Chrome**
3. Run `bash scripts/start-chrome.sh` again

## Windows

```powershell
.\scripts\start-chrome.ps1
npm run check-login
npm start
```

## What success looks like

`start-chrome.sh` should end with:

```text
CDP is ready at http://127.0.0.1:9222
SUCCESS. Next:
  npm run check-login
  npm start
```

If you instead see only `Opening in existing browser session.` and the command returns immediately, debugging did **not** start — quit Chrome fully and rerun the script.

## Useful .env knobs

```env
GPT_URL=https://chatgpt.com/c/6a79d41c-5274-83ee-8822-c78db9ded87f
CURSOR_URL=https://cursor.com/agents/bc-a815a9ed-9dda-47b4-96db-e0d48dad0c95
CDP_URL=http://127.0.0.1:9222
STOP_PHRASE=AUTOMATION COMPLETED
```

## Notes

- Keep that Chrome window open while the script runs.
- Do not manually type in those two tabs during a loop.
- Artifacts are saved under `artifacts/`.
