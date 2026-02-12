const logger = require("../utils/logger");
const { saveSession, SessionLock } = require("../session/sessionManager");
const { createBrowser, createContext } = require("../browser/launcher");
const { detectCheckpoint } = require("../auth/checkpoint");
const { performCredentialLogin, isLoggedIn } = require("../auth/actions");
const { randomDelay } = require("../utils/time");

const LINKEDIN_FEED = "https://www.linkedin.com/feed/";

/**
 * Deterministic Login Flow wrapped in SessionLock
 * 1. Acquire Lock (queues if busy)
 * 2. Launch Browser
 * 3. Load Session -> Check needsValidation
 * 4. Login/Verify
 * 5. Save Session (with timestamp)
 */
async function loginToLinkedIn(options = {}, credentials = null) {
  const email = credentials?.username || process.env.LINKEDIN_EMAIL;
  const password = credentials?.password || process.env.LINKEDIN_PASSWORD;

  if (!email || !password) {
    throw new Error("Missing LinkedIn credentials.");
  }

  // Wrap entire process in lock
  return SessionLock.withLoginLock(email, async () => {
      const browser = await createBrowser(options);
      
      try {
        // ----------------------------
        // STEP 1: Load Session & Context
        // ----------------------------
        const context = await createContext(browser, email);
        const page = await context.newPage();
        page.setDefaultTimeout(30000); 

        // Check validation cache
        // needsValidation is attached to context in sectionManager
        if (context.needsValidation === false) {
             logger.info(`[${email}] Session validation cached. Skipping feed check.`);
             await page.goto(LINKEDIN_FEED, { waitUntil: "domcontentloaded" });
             return { browser, context, page };
        }

        // ----------------------------
        // STEP 2: Verify Session (if needed)
        // ----------------------------
        logger.info(`[${email}] Verifying session...`);
        await page.goto(LINKEDIN_FEED, { waitUntil: "domcontentloaded" });
        await randomDelay(1000, 2000);

        if (await isLoggedIn(page)) {
          logger.info(`[${email}] Session valid ✅`);
          // Update validation timestamp
          await saveSession(context, email, true);
          return { browser, context, page };
        }

        logger.info(`[${email}] Session invalid. Attempting credential login...`);
        
        // ----------------------------
        // STEP 3: Credential Login
        // ----------------------------
        await performCredentialLogin(page, email, password);

        // ----------------------------
        // STEP 4: Verify & Fail Fast
        // ----------------------------
        if (await detectCheckpoint(page)) {
           const screenshotPath = `checkpoint_${email}_${Date.now()}.png`;
           await page.screenshot({ path: screenshotPath });
           logger.warn(`[${email}] Checkpoint detected! Screenshot saved: ${screenshotPath}`);
           throw new Error("CHECKPOINT_DETECTED");
        }

        if (await isLoggedIn(page)) {
           logger.info(`[${email}] Login successful ✅`);
           await saveSession(context, email, true); // Save with validation = true
           return { browser, context, page };
        } else {
           throw new Error("LOGIN_FAILED: Could not verify session after login attempt.");
        }

      } catch (error) {
        logger.error(`[${email}] Login process failed: ${error.message}`);
        await browser.close();
        throw error;
      }
  });
}

module.exports = loginToLinkedIn;
