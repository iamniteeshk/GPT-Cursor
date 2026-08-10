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
npm install
copy .env.example .env   # Windows
# cp .env.example .env   # macOS/Linux
```

## Test commands

### 1) Close all Chrome windows

Chrome must be fully closed before starting with remote debugging.

### 2) Start Chrome with your logged-in profile

**Windows (PowerShell):**
```powershell
.\scripts\start-chrome.ps1
```

If your profile is not `Default` (for example `Profile 1`):
```powershell
.\scripts\start-chrome.ps1 -ProfileDirectory "Profile 1"
```

**macOS / Linux:**
```bash
bash scripts/start-chrome.sh
# or
bash scripts/start-chrome.sh 9222 "Profile 1"
```

Confirm ChatGPT + Cursor are logged in in that Chrome window.

### 3) Check login only

```bash
npm run check-login
```

### 4) Run the full automation

```bash
npm start
```

The script will:
- connect to Chrome at `http://127.0.0.1:9222`
- wait if login is missing
- loop until GPT says `AUTOMATION COMPLETED`
- save prompts/replies/screenshots under `artifacts/`

## Useful .env knobs

```env
GPT_URL=https://chatgpt.com/c/6a79d41c-5274-83ee-8822-c78db9ded87f
CURSOR_URL=https://cursor.com/agents/bc-a815a9ed-9dda-47b4-96db-e0d48dad0c95
CDP_URL=http://127.0.0.1:9222
STOP_PHRASE=AUTOMATION COMPLETED
CURSOR_REPLY_TIMEOUT_MS=1800000
GPT_REPLY_TIMEOUT_MS=600000
```

## Notes

- Keep the Chrome window open while the script runs.
- Do not manually type in those two tabs during a loop.
- If Cursor is still generating, the script waits (default up to 30 minutes per turn).
- UI selectors can change; if paste/send fails, open an issue with a screenshot of the page.
