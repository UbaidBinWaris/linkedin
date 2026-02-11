const { chromium } = require("playwright");
const {
  sessionExists,
  saveSession,
  loadSession,
} = require("../session/sessionManager");

async function loginToLinkedIn() {
  console.log("Launching browser...");

  const browser = await chromium.launch({
    headless: false,
    slowMo: 100,
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  // -----------------------------
  // STEP 1: Try Session Login
  // -----------------------------
  if (sessionExists()) {
    console.log("Session found. Attempting session login...");

    const cookies = loadSession();
    await context.addCookies(cookies);

    await page.goto("https://www.linkedin.com/feed");

    try {
      await page.waitForURL("**/feed**", { timeout: 5000 });
      console.log("Session login successful ✅");
      return { browser, context, page };
    } catch (err) {
      console.log("Session expired. Falling back to credential login...");
    }
  }

  // -----------------------------
  // STEP 2: Credential Login
  // -----------------------------
  console.log("Opening LinkedIn login page...");
  await page.goto("https://www.linkedin.com/login");

  const email = process.env.LINKEDIN_EMAIL;
  const password = process.env.LINKEDIN_PASSWORD;

  if (!email || !password) {
    throw new Error("Missing LINKEDIN_EMAIL or LINKEDIN_PASSWORD in .env");
  }

  console.log("Filling credentials...");

  await page.fill('input[name="session_key"]', email);
  await page.waitForTimeout(1000);

  await page.fill('input[name="session_password"]', password);
  await page.waitForTimeout(1000);

  await page.click('button[type="submit"]');

  console.log("Waiting for login redirect...");
  await page.waitForURL("**/feed**", { timeout: 0 });

  console.log("Login successful ✅");

  // -----------------------------
  // STEP 3: Save Session
  // -----------------------------
  const cookies = await context.cookies();
  saveSession(cookies);

  return { browser, context, page };
}

module.exports = loginToLinkedIn;
