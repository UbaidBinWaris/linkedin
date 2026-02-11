const logger = require("../utils/logger");
const { chromium } = require("playwright");
const { sessionExists, getSessionPath } = require("../session/sessionManager");

async function loginToLinkedIn() {
  console.log("Launching browser...");

  const browser = await chromium.launch({
    headless: false,
    slowMo: 100,
  });

  let context;

  // -----------------------------
  // STEP 1: Try Using Saved Session
  // -----------------------------
  if (sessionExists()) {
    console.log("Session found. Loading storage state...");

    context = await browser.newContext({
      storageState: getSessionPath(),
    });
  } else {
    context = await browser.newContext();
  }

  const page = await context.newPage();

  // await page.goto("https://www.linkedin.com/feed");

  // // Check if already logged in
  // if (page.url().includes("feed")) {
  //   console.log("Session login successful ✅");
  //   return { browser, context, page };
  // }

  await page.goto("https://www.linkedin.com/feed", {
    waitUntil: "domcontentloaded",
  });

  // Wait a bit for LinkedIn to stabilize
  await page.waitForTimeout(3000);

  try {
    // This selector appears only when logged in
    await page.waitForSelector('input[placeholder="Search"]', {
      timeout: 5000,
    });

    logger.info("Session login successful.");
    return { browser, context, page };
  } catch (err) {
    logger.info("Session invalid. Need fresh login.");
  }

  console.log("Session invalid or missing. Proceeding to credential login...");

  // -----------------------------
  // Credential Login
  // -----------------------------
  await page.goto("https://www.linkedin.com/login");

  const email = process.env.LINKEDIN_EMAIL;
  const password = process.env.LINKEDIN_PASSWORD;

  await page.fill('input[name="session_key"]', email);
  await page.waitForTimeout(800);

  await page.fill('input[name="session_password"]', password);
  await page.waitForTimeout(800);

  await page.click('button[type="submit"]');

  await page.waitForURL("**/feed**", { timeout: 0 });

  console.log("Login successful ✅");

  // Save full browser state
  await context.storageState({ path: getSessionPath() });
  console.log("Session saved 💾");

  return { browser, context, page };
}



module.exports = loginToLinkedIn;
