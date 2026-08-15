import { config } from "./config.js";
import { BrowserSession } from "./browser-session.js";
import { AgentRunner } from "./agent-runner.js";
import { denyBrowserPermissions } from "./popups.js";
import { promptForUrls } from "./prompt-urls.js";
import { describeSecrets } from "./secrets.js";
import { ensureArtifactsDir } from "./browser.js";

const checkLoginOnly = process.argv.includes("--check-login");

async function main() {
  console.log("GPT ↔ Cursor automation");
  console.log(`Platform: ${config.platform}`);
  console.log(`Browser:  ${config.browserName}`);
  console.log(`Max agents: ${config.maxAgents} (${config.maxAgents * 2} tabs)`);
  console.log("Secrets:", describeSecrets());
  console.log("Tip: for phone control + multi-agent, run: npm run telegram");

  if (!checkLoginOnly) {
    await promptForUrls();
  } else if (!config.gptUrl || !config.cursorUrl) {
    await promptForUrls();
  }

  if (config.cursorReplyTimeoutMs < 3_600_000) {
    console.warn(
      `WARNING: CURSOR_REPLY_TIMEOUT_MS is ${config.cursorReplyTimeoutMs} (${Math.round(config.cursorReplyTimeoutMs / 60000)}m). ` +
        `Recommended: 3600000 (60m). Update .env or run: cp .env.example .env`
    );
  }

  console.log(`GPT:    ${config.gptUrl}`);
  console.log(`Cursor: ${config.cursorUrl}`);
  console.log(
    `Timeouts: Cursor ${Math.round(config.cursorReplyTimeoutMs / 60000)}m | GPT ${Math.round(config.gptReplyTimeoutMs / 60000)}m | poll ${Math.round(config.pollIntervalMs / 1000)}s`
  );

  await ensureArtifactsDir();
  const session = new BrowserSession();
  const context = await session.ensureConnected();
  await denyBrowserPermissions(context);

  const runner = new AgentRunner({
    id: "1",
    gptUrl: config.gptUrl,
    cursorUrl: config.cursorUrl,
    session,
  });

  if (checkLoginOnly) {
    await runner._openPair();
    console.log("Login check passed. Exiting (--check-login).");
    return;
  }

  const result = await runner.start();
  console.log("\n===== DONE =====");
  console.log(`Loops completed: ${result.loops}`);
  console.log(`Stop phrase reached: ${Boolean(result.completed)}`);
  console.log(`Artifacts: ${config.artifactsDir}`);
}

main().catch((error) => {
  console.error("\nAutomation failed:");
  console.error(error.message || error);
  process.exitCode = 1;
});
