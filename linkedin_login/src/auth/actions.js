const logger = require("../utils/logger");
const { randomDelay } = require("../utils/time");

const LINKEDIN_LOGIN = "https://www.linkedin.com/login";

/**
 * Performs credential-based login.
 */
async function performCredentialLogin(page, email, password) {
  logger.info("Proceeding to credential login...");

  // Check for Signup Page redirect
  if (page.url().includes("signup")) {
      logger.info("Redirected to Sign Up page. Navigating back to Login...");
      const signInLink = await page.$('a[href*="login"]');
      if (signInLink) {
          await signInLink.click();
      } else {
          await page.goto(LINKEDIN_LOGIN, { waitUntil: 'domcontentloaded' });
      }
      await randomDelay(1000, 2000);
  }

  logger.info("Entering credentials...");
  
  try {
      // Use fill instead of type for reliability (clears input first)
      await page.waitForSelector('input[name="session_key"]', { timeout: 5000 });
      await page.fill('input[name="session_key"]', email);
      
      await randomDelay(500, 1000);
      
      await page.waitForSelector('input[name="session_password"]', { timeout: 5000 });
      await page.fill('input[name="session_password"]', password);
      
      await randomDelay(1000, 2000);

      logger.info("Submitting login form...");
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
        page.click('button[type="submit"]')
      ]);
  } catch(e) {
      logger.error(`Error filling credentials: ${e.message}`);
      throw e;
  }
}

const { VALIDATION_SELECTORS } = require("../config");

/**
 * Checks if the user is currently logged in (on feed).
 */
async function isLoggedIn(page) {
  try {
    const selector = VALIDATION_SELECTORS.join(", ");
    await page.waitForSelector(selector, { timeout: 10000 });
    return true;
  } catch {
    return false;
  }
}

module.exports = { performCredentialLogin, isLoggedIn };
