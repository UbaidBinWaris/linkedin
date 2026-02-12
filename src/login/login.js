const { chromium } = require("playwright");
const logger = require("../utils/logger");
const { waitForUserResume } = require("../utils/terminal");
const { loadSession, saveSession } = require("../session/sessionManager");

const LINKEDIN_FEED = "https://www.linkedin.com/feed/";
const LINKEDIN_LOGIN = "https://www.linkedin.com/login";

/**
 * Main authentication entry point
 */
async function loginToLinkedIn(options = {}, credentials = null) {
  const email = credentials?.username || process.env.LINKEDIN_EMAIL;
  const password = credentials?.password || process.env.LINKEDIN_PASSWORD;

  if (!email || !password) {
    throw new Error("Missing LinkedIn credentials.");
  }

  const browser = await createBrowser(options);
  const context = await createContext(browser, email);
  const page = await context.newPage();

  page.setDefaultTimeout(30000);

  try {
    // Try session-based login
    await page.goto(LINKEDIN_FEED, { waitUntil: "domcontentloaded" });

    if (await isLoggedIn(page)) {
      logger.info(`Session valid for ${email}`);
      return { browser, context, page };
    }

    logger.info(`Session invalid. Performing credential login for ${email}`);
    await performCredentialLogin(page, email, password);

    await handleCheckpoint(page, options);

    if (!(await isLoggedIn(page))) {
      throw new Error("Login failed. Could not verify authenticated state.");
    }

    await saveSession(context, email);
    logger.info("Session saved successfully.");

    return { browser, context, page };

  } catch (error) {
    logger.error(`Login process failed: ${error.message}`);
    await browser.close();
    throw error;
  }
}

module.exports = loginToLinkedIn;


async function createBrowser(options) {
  return chromium.launch({
    headless: options.headless ?? false,
    slowMo: options.slowMo ?? 50,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
}

async function createContext(browser, email) {
  const storedContext = await loadSession(browser, email);

  if (storedContext) {
    logger.info("Loaded stored session.");
    return storedContext;
  }

  logger.info("Creating new browser context.");
  return browser.newContext();
}


async function isLoggedIn(page) {
  try {
    await page.waitForSelector(".global-nav__search", { timeout: 10000 });
    return true;
  } catch {
    return false;
  }
}


async function performCredentialLogin(page, email, password) {
  await page.goto(LINKEDIN_LOGIN, { waitUntil: "domcontentloaded" });

  await page.fill('input[name="session_key"]', email);
  await page.fill('input[name="session_password"]', password);

  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded" }),
    page.click('button[type="submit"]')
  ]);
}


async function handleCheckpoint(page, options) {
  // Initial check
  if (!(await detectCheckpoint(page))) return;

  logger.warn("Checkpoint detected.");

  if (options.headless) {
    logger.info("Headless mode detected. Attempting auto-resolution...");

    // ---------------------------------------------------------
    // STRATEGY 1: Click Simple Buttons (Yes, Skip, Continue)
    // ---------------------------------------------------------
    try {
      const clicked = await page.evaluate(() => {
        const candidates = Array.from(document.querySelectorAll('button, a, [role="button"], input[type="submit"], input[type="button"]'));
        const targetText = ['Yes', 'Skip', 'Not now', 'Continue', 'Sign in', 'Verify', 'Let’s do it', 'Next'];
        
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

      if (clicked) {
        logger.info("Clicked a resolution button. Waiting for navigation...");
        await page.waitForTimeout(3000);
        
        // Check if resolved
        if (!(await detectCheckpoint(page))) {
             logger.info("Checkpoint resolved via button click!");
             return;
        }
      }
    } catch (e) {
      logger.warn(`Auto-resolve button click failed: ${e.message}`);
    }

    // ---------------------------------------------------------
    // STRATEGY 2: Mobile App Verification (Wait & Poll)
    // ---------------------------------------------------------
    try {
        const isMobileVerif = await page.evaluate(() => {
            const text = document.body.innerText;
            return text.includes("Open your LinkedIn app") || 
                   text.includes("Tap Yes on the prompt") ||
                   text.includes("verification request to your device");
        });

        if (isMobileVerif) {
            logger.info("Mobile verification detected. Waiting 2 minutes for manual approval on device...");
            
            try {
                // Poll for feed URL for 120 seconds
                // We use a loop or waitForFunction
                await page.waitForFunction(() => {
                    return window.location.href.includes("/feed") || 
                           document.querySelector('.global-nav__search');
                }, { timeout: 120000 });

                logger.info("Mobile verification successful! Resuming...");
                return;
            } catch (timeoutErr) {
                logger.warn("Mobile verification timed out.");
            }
        }
    } catch (e) {
         logger.warn(`Mobile verification check failed: ${e.message}`);
    }

    // Re-check after attempts
    if (await detectCheckpoint(page)) {
        throw new Error("Checkpoint detected in headless mode and auto-resolution failed.");
    }

  } else {
    // Visible mode
    logger.warn("Verification required. Please complete manually.");
    await waitForUserResume(
      "Complete verification in browser, then press ENTER..."
    );
  }
}

async function detectCheckpoint(page) {
  const url = page.url().toLowerCase();

  return (
    url.includes("checkpoint") ||
    url.includes("challenge") ||
    url.includes("verification") ||
    url.includes("consumer-login/error")
  );
}

