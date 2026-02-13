const logger = require("../utils/logger");
const { randomDelay } = require("../utils/time");

const LINKEDIN_LOGIN = "https://www.linkedin.com/login";

/**
 * Performs credential-based login.
 */
async function performCredentialLogin(page, email, password) {
  logger.info("Proceeding to credential login...");

  if (!page.url().includes("login") && !page.url().includes("uas/request-password-reset")) {
     await page.goto(LINKEDIN_LOGIN, { waitUntil: 'domcontentloaded' });
     await randomDelay(1000, 2000);
  }

  logger.info("Entering credentials...");
  
  await page.click('input[name="session_key"]');
  await randomDelay(500, 1000);
  await page.type('input[name="session_key"]', email, { delay: 100 });
  
  await randomDelay(1000, 2000);
  
  await page.click('input[name="session_password"]');
  await page.type('input[name="session_password"]', password, { delay: 100 });
  
  await randomDelay(1000, 2000);

  logger.info("Submitting login form...");
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
    page.click('button[type="submit"]')
  ]);
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
