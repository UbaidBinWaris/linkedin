const logger = require("../utils/logger");
const { saveSession, SessionLock } = require("../session/sessionManager");
const { createBrowser, createContext } = require("../browser/launcher");
const { detectCheckpoint, handleMobileVerification } = require("../auth/checkpoint");
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

        logger.info(`[${email}] Session invalid. Clearing cookies and attempting credential login...`);
        
        // Clear old/corrupt cookies to ensure fresh login
        await context.clearCookies();
        
        // ----------------------------
        // STEP 3: Credential Login
        // ----------------------------
        await performCredentialLogin(page, email, password);

        // ----------------------------
        // STEP 4: Verify & Fail Fast
        // ----------------------------
        if (await detectCheckpoint(page)) {
           // Attempt to handle mobile verification (2 min wait)
           // If it returns true, it means we are now on the feed (resolved)
           if (await handleMobileVerification(page)) {
               // success, assume logged in
               // Wait a moment for page to settle
               await page.waitForTimeout(3000);
               
               // Double check if we are really on feed
               if (page.url().includes("/feed") || await isLoggedIn(page)) {
                    logger.info(`[${email}] Mobile Verification Successful ✅`);
                    await saveSession(context, email, true);
                    return { browser, context, page };
               }
           } else {
               // Failed mobile verification. 
                // User Request: "otherwise after some delay using browser opens the browser and fill the form"
                
                // If headless AND fallback is NOT disabled
                if (options.headless && !options.disableFallback) {
                    logger.info("[Fallback] Mobile verification failed. Switching to VISIBLE browser for manual intervention...");
                   await browser.close();

                   // RE-LAUNCH in Visible Mode
                   const visibleBrowser = await createBrowser({ ...options, headless: false });
                   const visibleContext = await createContext(visibleBrowser, email);
                   const visiblePage = await visibleContext.newPage();
                   visiblePage.setDefaultTimeout(60000); // More time for manual interaction

                   try {
                       logger.info("[Fallback] Filling credentials in visible browser...");
                       await performCredentialLogin(visiblePage, email, password);
                       
                       // Now wait for success (Feed)
                       logger.info("[Fallback] Waiting for user to complete login manually...");
                       
                       // Wait for URL OR Selector
                       // We loop to check both condition
                       try {
                           await visiblePage.waitForFunction(() => {
                               return window.location.href.includes("/feed") || 
                                      document.querySelector(".global-nav__search");
                           }, { timeout: 120000 });
                       } catch(e) {
                           logger.warn(`[Fallback] Wait finished with error: ${e.message}`);
                       }
                       
                       // Double check status
                       if (visiblePage.url().includes("/feed") || await isLoggedIn(visiblePage)) {
                            logger.info(`[${email}] Manual Fallback Successful ✅`);
                            await saveSession(visibleContext, email, true);
                            return { browser: visibleBrowser, context: visibleContext, page: visiblePage };
                       }
                   } catch (fallbackErr) {
                       logger.error(`[Fallback] Manual intervention failed or timed out: ${fallbackErr.message}`);
                       await visibleBrowser.close();
                       throw new Error("CHECKPOINT_DETECTED_M"); // M for manual failed
                   }
               } 
               // IF ALREADY VISIBLE (Headless = false)
               else if (!options.headless) {
                   logger.info(`[${email}] Checkpoint detected in VISIBLE mode. Waiting for user to solve...`);
                   try {
                        // Wait up to 5 minutes for manual resolution
                        await page.waitForFunction(() => {
                              return window.location.href.includes("/feed") || 
                                     document.querySelector(".global-nav__search");
                        }, { timeout: 300000 }); 
                        
                        if (page.url().includes("/feed") || await isLoggedIn(page)) {
                            logger.info(`[${email}] Manual Resolution Successful ✅`);
                            await saveSession(context, email, true);
                            return { browser, context, page };
                        }
                   } catch(e) {
                        logger.warn(`[Visible] Manual wait timeout: ${e.message}`);
                        // Fall through to error
                   }
               }

               const screenshotPath = `checkpoint_${email}_${Date.now()}.png`;
               await page.screenshot({ path: screenshotPath });
               logger.warn(`[${email}] Checkpoint detected! Screenshot saved: ${screenshotPath}`);
               throw new Error("CHECKPOINT_DETECTED");
           }
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
