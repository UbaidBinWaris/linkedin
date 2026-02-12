const logger = require("../utils/logger");
// Use playwright-extra with the stealth plugin
const { chromium } = require("playwright-extra");
const stealth = require("puppeteer-extra-plugin-stealth")();
chromium.use(stealth);

const { waitForUserResume } = require("../utils/terminal");
const { sessionExists, saveSession, loadSession } = require("../session/sessionManager");
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
/**
 * Main login function.
 * @param {Object} options - Launch options for the browser.
 * @param {boolean} [options.headless=false] - Whether to run in headless mode.
 * @param {number} [options.slowMo=50] - Slow motion delay in ms.
 * @param {string} [options.proxy] - Optional proxy server URL.
 * @param {Function} [options.onCheckpoint] - Callback when verification is needed in headless mode.
 * @param {Object} [credentials] - Optional credentials object { username, password }
 */
async function loginToLinkedIn(options = {}, credentials = null) {
  logger.info("Starting LinkedIn login process with stealth mode...");

  // Determine credentials
  const email = credentials?.username || process.env.LINKEDIN_EMAIL;
  const password = credentials?.password || process.env.LINKEDIN_PASSWORD;

  if (!email || !password) {
      const errorMsg = "Missing credentials. Provide them in arguments or set LINKEDIN_EMAIL/LINKEDIN_PASSWORD env vars.";
      logger.error(errorMsg);
      throw new Error(errorMsg);
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

  logger.info(`Launching browser for user: ${email}...`);
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
    logger.info(`Checking for saved session for ${email}...`);
    context = await loadSession(browser, contextOptions, email);

    if (context) {
      logger.info("Session stored context created.");
    } else {
      logger.info("No valid session found. Starting fresh context.");
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
      if (launchOptions.headless) {
        logger.warn("Checkpoint detected in headless mode.");
        
        // Attempt to resolve simple checkpoints (e.g. "Yes, it's me", "Skip") automatically
        try {
            logger.info("Attempting to resolve simple checkpoint headlessly...");
            const simpleResolved = await page.evaluate(async () => {
                // Find buttons, links, or elements with button role
                const candidates = Array.from(document.querySelectorAll('button, a, [role="button"], input[type="submit"], input[type="button"]'));
                const targetText = ['Yes', 'Skip', 'Not now', 'Continue', 'Sign in', 'Verify', 'Let’s do it', 'Next'];
                
                // Find a candidate with one of these texts
                const btn = candidates.find(b => {
                    const text = (b.innerText || b.value || '').trim();
                    return targetText.some(t => text.includes(t));
                });
                
                if (btn) {
                    btn.click();
                    return true;
                }
                return false;
            });
            
                if (simpleResolved) {
                    logger.info("Clicked a resolution button. Waiting to see if it clears...");
                    await randomDelay(2000, 4000);
                    if (!(await detectCheckpoint(page))) {
                         logger.info("Checkpoint resolved headlessly! Proceeding...");
                         try {
                             await page.waitForURL("**/feed**", { timeout: 10000 });
                             return { browser, context, page };
                         } catch (e) {
                             logger.warn("Resolved checkpoint but feed did not load. Continuing...");
                         }
                    }
                } else {
                    // Check for Mobile Verification ("Open your LinkedIn app")
                    const isMobileVerif = await page.evaluate(() => {
                        const text = document.body.innerText;
                        return text.includes("Open your LinkedIn app") || 
                               text.includes("Tap Yes on the prompt") ||
                               text.includes("verification request to your device");
                    });

                    if (isMobileVerif) {
                        logger.info("Mobile verification detected (Open App / Tap Yes).");
                        logger.info("Waiting 2 minutes for you to approve on your device...");
                        
                        try {
                            // Poll for feed URL for 120 seconds
                            await page.waitForFunction(() => {
                                return window.location.href.includes("/feed") || 
                                       document.querySelector('.global-nav__search');
                            }, { timeout: 120000 });

                            logger.info("Mobile verification successful! Resuming...");
                            return { browser, context, page };
                        } catch (err) {
                            logger.warn("Mobile verification timed out. Falling back to visible mode.");
                        }
                    }
                }
            } catch (err) {
                logger.warn(`Failed to auto-resolve checkpoint: ${err.message}`);
            }


        if (options.onCheckpoint && typeof options.onCheckpoint === 'function') {
           logger.info("Triggering onCheckpoint callback...");
           await options.onCheckpoint();
           logger.info("onCheckpoint resolved. Retrying login...");
           await browser.close();
           return loginToLinkedIn(options, credentials);
        }

        logger.info("Switching to visible mode for manual verification...");
        
        // await waitForUserResume("Press ENTER to open a visible browser to verify your account...");
        logger.info("Automatically launching visible browser for verification...");
        
        logger.info("Closing headless browser...");
        await browser.close();

        logger.info("Launching visible browser for verification...");
        // Call recursively in visible mode
        // We pass the same options but force headless: false
        const visibleInstance = await loginToLinkedIn({ ...options, headless: false }, { username: email, password });
        
        // Once the visible instance returns, it means login was successful and session is saved.
        logger.info("Verification successful in visible mode.");
        logger.info("Closing visible browser and resuming headless session...");
        await visibleInstance.browser.close();
        
        // Restart the original headless request. 
        // It should now find the valid session and proceed without checkpoints.
        return loginToLinkedIn(options, { username: email, password });

      } else {
        logger.warn("Checkpoint detected immediately. Manual verification required.");
         if (options.onCheckpoint && typeof options.onCheckpoint === 'function') {
             await options.onCheckpoint();
         } else {
             await waitForUserResume("Complete verification in the opened browser, then press ENTER here to continue...");
         }
      }
    }

    const { VALIDATION_SELECTORS } = require("../config");

    // Verify Session Validity
    try {
      // Check for any of the validation selectors
      const isLoggedIn = await Promise.race([
        Promise.any(VALIDATION_SELECTORS.map(selector => 
            page.waitForSelector(selector, { timeout: 15000 }).then(() => true)
        )),
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

    // CRITICAL FIX: If session was invalid, we MUST close the current context
    // and start fresh. Otherwise, retained cookies might cause redirect loops
    // (e.g. we go to /login, but LinkedIn sees cookies and redirects to /feed,
    // so we can't find the email input).
    logger.info("Closing invalid/expired session context...");
    await context.close();
    
    logger.info("Starting fresh context for credential login...");
    context = await browser.newContext(contextOptions);
    page = await context.newPage();
    page.setDefaultTimeout(30000);

    // -----------------------------
    // STEP 2: Credential Login
    // -----------------------------
    logger.info("Proceeding to credential login...");
    
    if (!page.url().includes("login") && !page.url().includes("uas/request-password-reset")) {
       await page.goto("https://www.linkedin.com/login", { waitUntil: 'domcontentloaded' });
       await randomDelay(1000, 2000);
    }

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
      if (launchOptions.headless) {
           logger.warn("Checkpoint detected in headless mode (post-login).");
           
            // Attempt to resolve simple checkpoints (e.g. "Yes, it's me", "Skip") automatically
            try {
                logger.info("Attempting to resolve simple checkpoint headlessly (post-login)...");
                const simpleResolved = await page.evaluate(async () => {
                    // Find buttons, links, or elements with button role
                    const candidates = Array.from(document.querySelectorAll('button, a, [role="button"], input[type="submit"], input[type="button"]'));
                    const targetText = ['Yes', 'Skip', 'Not now', 'Continue', 'Sign in', 'Verify', 'Let’s do it', 'Next'];
                    
                    // Find a candidate with one of these texts
                    const btn = candidates.find(b => {
                        const text = (b.innerText || b.value || '').trim();
                        return targetText.some(t => text.includes(t));
                    });
                    
                    if (btn) {
                        btn.click();
                        return true;
                    }
                    return false;
                });
                
                if (simpleResolved) {
                    logger.info("Clicked a resolution button. Waiting to see if it clears...");
                    await randomDelay(2000, 4000);
                    if (!(await detectCheckpoint(page))) {
                         logger.info("Checkpoint resolved headlessly! Proceeding...");
                         // Re-verify session
                         try {
                             await page.waitForURL("**/feed**", { timeout: 10000 });
                             return { browser, context, page };
                         } catch (e) {
                             logger.warn("Resolved checkpoint but feed did not load. Continuing...");
                         }
                    }
                }
            } catch (err) {
                logger.warn(`Failed to auto-resolve post-login checkpoint: ${err.message}`);
            }

           if (options.onCheckpoint && typeof options.onCheckpoint === 'function') {
                logger.info("Triggering onCheckpoint callback...");
                await options.onCheckpoint();
                logger.info("onCheckpoint resolved. Retrying login...");
                await browser.close();
                return loginToLinkedIn(options, credentials);
            }

           logger.info("Switching to visible mode for manual verification...");
           
           // await waitForUserResume("Press ENTER to open a visible browser to verify your account...");
           logger.info("Automatically launching visible browser for verification...");
           
           logger.info("Closing headless browser...");
           await browser.close();
   
           logger.info("Launching visible browser for verification...");
           const visibleInstance = await loginToLinkedIn({ ...options, headless: false }, { username: email, password });
           
           logger.info("Verification successful. Resuming headless session...");
           await visibleInstance.browser.close();
           
           return loginToLinkedIn(options, { username: email, password });
      } else {
          logger.warn("Checkpoint detected after login attempt. Manual verification required.");
          if (options.onCheckpoint && typeof options.onCheckpoint === 'function') {
             await options.onCheckpoint();
          } else {
             logger.info("Waiting for manual verification in the opened browser...");
             logger.info("Please solve the CAPTCHA/verification. The browser will close automatically when you are redirected to the feed.");
             
             try {
                // Wait for URL to include '/feed' OR any validation selector to appear
                await page.waitForFunction(() => {
                    return window.location.href.includes("/feed") || 
                           document.querySelector('.global-nav__search') ||
                           document.querySelector('#global-nav-typeahead');
                }, { timeout: 300000 }); // 5 minutes timeout
                
                logger.info("Verification detected! resuming...");
             } catch (err) {
                logger.error("Timeout waiting for manual verification.");
                throw new Error("Manual verification timed out.");
             }
          }
      }
    }

    // -----------------------------
    // Post-Login Verification
    // -----------------------------
    logger.info("Verifying login success...");
    try {
        await page.waitForURL("**/feed**", { timeout: 20000 });
        
        // Wait for at least one validation selector
        await Promise.any(VALIDATION_SELECTORS.map(selector => 
            page.waitForSelector(selector, { timeout: 15000 })
        ));
        
        logger.info("Login confirmed ✅");

        // Save session state
        await saveSession(context, email);
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
