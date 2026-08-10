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
  sendPromptToCursor,
  waitForCursorLogin,
  waitForCursorReply,
  writeCursorDump,
} from "./cursor-agent.js";

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
    throw new Error(
      `Still not logged in after waiting. ChatGPT=${gptOk} Cursor=${cursorOk}`
    );
  }
  console.log("Login complete for both services.");
}

async function runLoop(gptPage, cursorPage) {
  let loops = 0;

  while (true) {
    loops += 1;
    console.log(`\n===== LOOP ${loops} =====`);

    await gptPage.bringToFront();
    await openChatGpt(gptPage);

    const assistantText = await getLatestAssistantText(gptPage);
    console.log(`GPT latest message length: ${assistantText.length} chars`);

    if (assistantText.includes(config.stopPhrase)) {
      console.log(`Found stop phrase: ${config.stopPhrase}`);
      await fs.writeFile(
        artifactPath("final-gpt-message.txt"),
        assistantText,
        "utf8"
      );
      return { loops, completed: true, finalMessage: assistantText };
    }

    const prompt = extractCursorPrompt(assistantText);
    await fs.writeFile(artifactPath(`gpt-loop-${loops}-prompt.txt`), prompt, "utf8");
    console.log(`Extracted Cursor prompt (${prompt.length} chars). Sending to Cursor...`);

    await cursorPage.bringToFront();
    await openCursorAgent(cursorPage);

    const previousCursorText = await getLatestCursorText(cursorPage).catch(() => "");
    await sendPromptToCursor(cursorPage, prompt);
    console.log("Prompt sent. Waiting for Cursor to finish...");

    await waitForCursorReply(cursorPage, previousCursorText);
    const cursorText = await getLatestCursorText(cursorPage);
    const textFile = await writeCursorDump(loops, cursorText);
    const images = await captureCursorImages(cursorPage, loops);

    console.log(`Cursor reply: ${cursorText.length} chars`);
    console.log(`Saved text: ${textFile}`);
    console.log(`Captured ${images.length} image artifact(s)`);

    const followUp = [
      "Cursor agent output for this step:",
      "",
      cursorText,
      "",
      images.length
        ? `Attached ${images.length} screenshot(s)/image(s) from Cursor.`
        : "No images were captured from Cursor this round.",
      "",
      "Write the next prompt for Cursor now.",
      `If the website/app has reached a finishing stage, reply with ONLY these 2 words and nothing else: ${config.stopPhrase}`,
    ].join("\n");

    await gptPage.bringToFront();
    await openChatGpt(gptPage);
    console.log("Sending Cursor output (+ images) back to GPT...");
    await sendToChatGpt(gptPage, { text: followUp, imagePaths: images });

    const nextAssistant = await getLatestAssistantText(gptPage);
    await fs.writeFile(
      artifactPath(`gpt-loop-${loops}-reply.txt`),
      nextAssistant,
      "utf8"
    );

    if (nextAssistant.includes(config.stopPhrase)) {
      console.log(`GPT says: ${config.stopPhrase}`);
      await fs.writeFile(
        artifactPath("final-gpt-message.txt"),
        nextAssistant,
        "utf8"
      );
      return { loops, completed: true, finalMessage: nextAssistant };
    }

    console.log("GPT produced a follow-up prompt. Continuing...");
  }
}

async function main() {
  console.log("GPT ↔ Cursor automation");
  console.log(`GPT:    ${config.gptUrl}`);
  console.log(`Cursor: ${config.cursorUrl}`);

  await ensureArtifactsDir();
  const { context } = await connectBrowser();

  const gptPage = await getOrCreatePage(context, ["chatgpt.com"]);
  const cursorPage = await getOrCreatePage(context, ["cursor.com"]);

  await openChatGpt(gptPage);
  await openCursorAgent(cursorPage);
  await assertOrWaitLogin(gptPage, cursorPage);

  if (checkLoginOnly) {
    console.log("Login check passed. Exiting (--check-login).");
    return;
  }

  const result = await runLoop(gptPage, cursorPage);
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
