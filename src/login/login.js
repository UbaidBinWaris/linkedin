const logger = require("../utils/logger");
// Use playwright-extra with the stealth plugin
const { chromium } = require("playwright-extra");
const stealth = require("puppeteer-extra-plugin-stealth")();
chromium.use(stealth);

const { waitForUserResume } = require("../utils/terminal");
const { sessionExists, getSessionPath } = require("../session/sessionManager");
const { randomDelay } = require("../utils/time");

/**
 * Validates that necessary environment variables are set.
 * @throws {Error} If credentials are missing.
 */
function validateCredentials() {
  if (!process.env.LINKEDIN_EMAIL || !process.env.LINKEDIN_PASSWORD) {
    throw new Error("Missing LINKEDIN_EMAIL or LINKEDIN_PASSWORD in environment variables.");
  }
}

/**
 * Detects if a checkpoint/verification is triggered.
 * @param {import('playwright').Page} page
 * @returns {Promise<boolean>}
 */
async function detectCheckpoint(page) {
  try {
    const url = page.url();
    if (
      url.includes("checkpoint") ||
      url.includes("challenge") ||
      url.includes("verification") ||
      url.includes("consumer-login/error")
    ) {
      return true;
    }

    // Also check for specific checkpoint elements if URL check isn't enough
    // This is a non-blocking check with a short timeout
    try {
      await page.waitForSelector("h1:has-text('Security Verification')", { timeout: 1000 });
      return true;
    } catch (e) {
      // Element not found, likely no checkpoint
    }

    return false;
  } catch (error) {
    logger.error(`Error during checkpoint detection: ${error.message}`);
    return false;
  }
}

/**
 * Generates random viewport dimensions.
 */
function getRandomViewport() {
  const width = 1280 + Math.floor(Math.random() * 640); // 1280 - 1920
  const height = 720 + Math.floor(Math.random() * 360); // 720 - 1080
  return { width, height };
}

/**
 * Generates a random User-Agent string (simplified for now, ideally use a library).
 */
function getRandomUserAgent() {
  const versions = ["120.0.0.0", "121.0.0.0", "122.0.0.0"];
  const version = versions[Math.floor(Math.random() * versions.length)];
  return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Safari/537.36`;
}

/**
 * Main login function.
 * @param {Object} options - Launch options for the browser.
 * @param {boolean} [options.headless=false] - Whether to run in headless mode.
 * @param {number} [options.slowMo=50] - Slow motion delay in ms.
 * @param {string} [options.proxy] - Optional proxy server URL.
 */
async function loginToLinkedIn(options = {}) {
  logger.info("Starting LinkedIn login process with stealth mode...");

  try {
    validateCredentials();
  } catch (error) {
    logger.error(error.message);
    throw error;
  }

  const launchOptions = {
    headless: options.headless !== undefined ? options.headless : false,
    slowMo: options.slowMo || 50,
    args: [
      "--no-sandbox", 
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled" // Extra stealth
    ],
    ...options,
  };

  logger.info(`Launching browser...`);
  const browser = await chromium.launch(launchOptions);

  let context;
  let page;

  const contextOptions = {
    userAgent: getRandomUserAgent(),
    viewport: getRandomViewport(),
    locale: 'en-US',
    timezoneId: 'America/New_York', // Align with proxy if used, otherwise standard
    permissions: ['geolocation'],
    ignoreHTTPSErrors: true,
  };

  try {
    // -----------------------------
    // STEP 1: Try Using Saved Session
    // -----------------------------
    if (sessionExists()) {
      logger.info("Saved session found. Attempting to restore...");
      try {
        context = await browser.newContext({
          storageState: getSessionPath(),
          ...contextOptions
        });
        logger.info("Context created with storage state.");
      } catch (err) {
        logger.warn(`Failed to create context with storage state: ${err.message}. specific session might be corrupt.`);
        context = await browser.newContext(contextOptions);
      }
    } else {
      logger.info("No session found. Starting fresh context.");
      context = await browser.newContext(contextOptions);
    }

    page = await context.newPage();

    // Set a default timeout for all actions
    page.setDefaultTimeout(30000);

    logger.info("Navigating to LinkedIn feed...");
    await page.goto("https://www.linkedin.com/feed/", {
      waitUntil: "domcontentloaded",
    });

    // Human-like pause
    await randomDelay(2000, 4000);

    // Check for checkpoint immediately after navigation
    if (await detectCheckpoint(page)) {
      logger.warn("Checkpoint detected immediately. Manual verification required.");
      await waitForUserResume("Complete verification in the opened browser, then press ENTER here to continue...");
    }

    // Verify Session Validity
    try {
      // Check for a known element on the feed page
      const isLoggedIn = await Promise.race([
        page.waitForSelector('.global-nav__search, input[placeholder="Search"]', { timeout: 10000 }).then(() => true),
        page.waitForSelector('.login-form, #username, input[name="session_key"]', { timeout: 5000 }).then(() => false)
      ]).catch(() => false);

      if (isLoggedIn) {
        logger.info("Session is valid. Login successful.");
        return { browser, context, page };
      } else {
        logger.info("Session invalid or redirected to login page.");
      }
    } catch (err) {
      logger.info("Could not verify session state. Proceeding to credential login.");
    }

    // -----------------------------
    // STEP 2: Credential Login
    // -----------------------------
    logger.info("Proceeding to credential login...");
    
    if (!page.url().includes("login") && !page.url().includes("uas/request-password-reset")) {
       await page.goto("https://www.linkedin.com/login", { waitUntil: 'domcontentloaded' });
       await randomDelay(1000, 2000);
    }

    const email = process.env.LINKEDIN_EMAIL;
    const password = process.env.LINKEDIN_PASSWORD;

    logger.info("Entering credentials...");
    
    // Simulate human typing
    await page.click('input[name="session_key"]');
    await randomDelay(500, 1000);
    await page.type('input[name="session_key"]', email, { delay: 100 }); // Type with delay
    
    await randomDelay(1000, 2000);
    
    await page.click('input[name="session_password"]');
    await page.type('input[name="session_password"]', password, { delay: 100 });
    
    await randomDelay(1000, 2000);

    logger.info("Submitting login form...");
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
      page.click('button[type="submit"]')
    ]);

    // Check for checkpoint again
    if (await detectCheckpoint(page)) {
      logger.warn("Checkpoint detected after login attempt. Manual verification required.");
      await waitForUserResume("Complete verification in the opened browser, then press ENTER here to continue...");
    }

    // -----------------------------
    // Post-Login Verification
    // -----------------------------
    logger.info("Verifying login success...");
    try {
        await page.waitForURL("**/feed**", { timeout: 20000 });
        await page.waitForSelector('.global-nav__search, input[placeholder="Search"]', { timeout: 15000 });
        
        logger.info("Login confirmed ✅");

        // Save session state
        await context.storageState({ path: getSessionPath() });
        logger.info("Session state saved 💾");

        return { browser, context, page };

    } catch (err) {
        logger.error("Login failed or timed out waiting for feed.");
        const screenshotPath = `error_login_${Date.now()}.png`;
        try {
            await page.screenshot({ path: screenshotPath });
            logger.info(`Screenshot saved to ${screenshotPath}`);
        } catch (opts) {
             console.error("Failed to take error screenshot");
        }
        
        throw new Error("Login failed: Could not reach feed page.");
    }

  } catch (error) {
    logger.error(`Critical error in loginToLinkedIn: ${error.message}`);
    if (browser) await browser.close();
    throw error;
  }
}

module.exports = loginToLinkedIn;
