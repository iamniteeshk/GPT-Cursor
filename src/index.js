import fs from "node:fs/promises";
import { config } from "./config.js";
import {
  artifactPath,
  connectBrowser,
  ensureArtifactsDir,
  getOrCreatePage,
} from "./browser.js";
import {
  extractCursorPrompt,
  getLatestAssistantText,
  isChatGptLoggedIn,
  openChatGpt,
  sendToChatGpt,
  waitForChatGptLogin,
} from "./chatgpt.js";
import {
  captureCursorImages,
  getLatestCursorText,
  isCursorLoggedIn,
  openCursorAgent,
  promptCompletedMarker,
  resolveCursorPage,
  sendPromptToCursor,
  waitForCursorLogin,
  waitForCursorReply,
  writeCursorDump,
} from "./cursor-agent.js";
import { denyBrowserPermissions, dismissBlockingUi, installDialogHandlers } from "./popups.js";
import { promptForUrls } from "./prompt-urls.js";
import { describeSecrets } from "./secrets.js";

const checkLoginOnly = process.argv.includes("--check-login");

async function assertOrWaitLogin(gptPage, cursorPage) {
  let gptOk = await isChatGptLoggedIn(gptPage);
  let cursorOk = await isCursorLoggedIn(cursorPage);

  if (gptOk && cursorOk) {
    console.log("Both ChatGPT and Cursor are logged in.");
    return;
  }

  const missing = [];
  if (!gptOk) missing.push("ChatGPT");
  if (!cursorOk) missing.push("Cursor");
  console.log(`Not logged in: ${missing.join(" + ")}`);
  console.log("Please log in in the Chrome window. Script will wait...");

  if (!gptOk) await waitForChatGptLogin(gptPage);
  if (!cursorOk) await waitForCursorLogin(cursorPage);

  gptOk = await isChatGptLoggedIn(gptPage);
  cursorOk = await isCursorLoggedIn(cursorPage);
  if (!gptOk || !cursorOk) {
    throw new Error(`Still not logged in after waiting. ChatGPT=${gptOk} Cursor=${cursorOk}`);
  }
  console.log("Login complete for both services.");
}

async function readGptPrompt(gptPage, cachedText) {
  if (cachedText && cachedText.trim().length > 20) {
    console.log("Using cached GPT follow-up from previous loop.");
    return cachedText.trim();
  }
  await openChatGpt(gptPage);
  await dismissBlockingUi(gptPage, { label: "ChatGPT" });
  return getLatestAssistantText(gptPage, { retries: 10 });
}

function buildGptFollowUp({ cursorText, images, loopIndex, nextLoopIndex }) {
  const nextMarker = promptCompletedMarker(nextLoopIndex);
  return [
    `Cursor agent output for Prompt ${loopIndex}:`,
    "",
    cursorText,
    "",
    images.length
      ? `Attached ${images.length} screenshot(s)/image(s) from Cursor.`
      : "No images were captured from Cursor this round.",
    "",
    "Write the next prompt for Cursor now.",
    `In that Cursor prompt, tell Cursor that when it finishes it must print exactly: ${nextMarker}`,
    `If the website/app has reached a finishing stage, reply with ONLY these 2 words and nothing else: ${config.stopPhrase}`,
  ].join("\n");
}

async function runLoop(gptPage, cursorPage, context) {
  let loops = 0;
  let cachedGptText = "";
  let activeCursorPage = cursorPage;

  while (true) {
    loops += 1;
    console.log(`\n===== LOOP ${loops} =====`);

    await gptPage.bringToFront();
    let assistantText;
    try {
      assistantText = await readGptPrompt(gptPage, cachedGptText);
    } catch (error) {
      console.warn(`GPT read failed (${error.message}). Reloading…`);
      await openChatGpt(gptPage, { forceReload: true });
      assistantText = await getLatestAssistantText(gptPage, { retries: 12 });
    }
    cachedGptText = "";

    console.log(`GPT latest message length: ${assistantText.length} chars`);

    if (assistantText.includes(config.stopPhrase)) {
      console.log(`Found stop phrase: ${config.stopPhrase}`);
      await fs.writeFile(artifactPath("final-gpt-message.txt"), assistantText, "utf8");
      return { loops, completed: true, finalMessage: assistantText };
    }

    const prompt = extractCursorPrompt(assistantText);
    await fs.writeFile(artifactPath(`gpt-loop-${loops}-prompt.txt`), prompt, "utf8");
    console.log(
      `Extracted Cursor prompt (${prompt.length} chars). Expect marker: ${promptCompletedMarker(loops)}`
    );

    activeCursorPage = await resolveCursorPage(context, activeCursorPage);
    await openCursorAgent(activeCursorPage);
    await dismissBlockingUi(activeCursorPage, { label: "Cursor" });

    const previousCursorText = await getLatestCursorText(activeCursorPage).catch(() => "");
    await sendPromptToCursor(activeCursorPage, prompt, loops);
    console.log("Prompt sent. Waiting for Cursor to finish...");

    activeCursorPage =
      (await waitForCursorReply(activeCursorPage, previousCursorText, context, loops)) ||
      activeCursorPage;

    const cursorText = await getLatestCursorText(activeCursorPage);
    const textFile = await writeCursorDump(loops, cursorText);
    const images = await captureCursorImages(activeCursorPage, loops);

    console.log(`Cursor reply: ${cursorText.length} chars`);
    console.log(`Saved text: ${textFile}`);
    console.log(`Captured ${images.length} image artifact(s)`);

    const followUp = buildGptFollowUp({
      cursorText,
      images,
      loopIndex: loops,
      nextLoopIndex: loops + 1,
    });

    await gptPage.bringToFront();
    await openChatGpt(gptPage);
    console.log("Sending Cursor output (+ images) back to GPT...");
    await sendToChatGpt(gptPage, { text: followUp, imagePaths: images });

    let nextAssistant;
    try {
      nextAssistant = await getLatestAssistantText(gptPage, { retries: 10 });
    } catch (error) {
      console.warn(`GPT reply read failed (${error.message}). Reloading…`);
      await openChatGpt(gptPage, { forceReload: true });
      nextAssistant = await getLatestAssistantText(gptPage, { retries: 12 });
    }

    await fs.writeFile(artifactPath(`gpt-loop-${loops}-reply.txt`), nextAssistant, "utf8");

    if (nextAssistant.includes(config.stopPhrase)) {
      console.log(`GPT says: ${config.stopPhrase}`);
      await fs.writeFile(artifactPath("final-gpt-message.txt"), nextAssistant, "utf8");
      return { loops, completed: true, finalMessage: nextAssistant };
    }

    cachedGptText = nextAssistant;
    console.log("GPT produced a follow-up prompt. Continuing...");
  }
}

async function main() {
  console.log("GPT ↔ Cursor automation");
  console.log(`Platform: ${config.platform}`);
  console.log("Secrets:", describeSecrets());

  if (!checkLoginOnly) {
    await promptForUrls();
  } else if (!config.gptUrl || !config.cursorUrl) {
    await promptForUrls();
  }

  console.log(`GPT:    ${config.gptUrl}`);
  console.log(`Cursor: ${config.cursorUrl}`);

  await ensureArtifactsDir();
  const { context } = await connectBrowser();
  await denyBrowserPermissions(context);

  const gptPage = await getOrCreatePage(context, ["chatgpt.com"]);
  const cursorPage = await getOrCreatePage(context, ["cursor.com"]);
  await installDialogHandlers(gptPage);
  await installDialogHandlers(cursorPage);

  await openChatGpt(gptPage, { forceReload: true });
  await openCursorAgent(cursorPage);
  await dismissBlockingUi(gptPage, { label: "ChatGPT" });
  await dismissBlockingUi(cursorPage, { label: "Cursor" });
  await assertOrWaitLogin(gptPage, cursorPage);

  if (checkLoginOnly) {
    console.log("Login check passed. Exiting (--check-login).");
    return;
  }

  const result = await runLoop(gptPage, cursorPage, context);
  console.log("\n===== DONE =====");
  console.log(`Loops completed: ${result.loops}`);
  console.log(`Stop phrase reached: ${result.completed}`);
  console.log(`Artifacts: ${config.artifactsDir}`);
}

main().catch((error) => {
  console.error("\nAutomation failed:");
  console.error(error.message || error);
  process.exitCode = 1;
});
