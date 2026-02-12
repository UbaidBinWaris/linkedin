const logger = require("../utils/logger");

/**
 * Detects if a checkpoint/verification is triggered.
 * Returns true if intervention is needed.
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

    try {
      await page.waitForSelector("h1:has-text('Security Verification')", { timeout: 1000 });
      return true;
    } catch (e) {
      // Element not found
    }

    return false;
  } catch (error) {
    logger.error(`Error during checkpoint detection: ${error.message}`);
    return false;
  }
}

/**
 * Handles mobile verification/app approval prompts.
 * Polls for success (feed navigation) for a set duration.
 * @param {Page} page
 * @returns {Promise<boolean>} true if resolved, false if timed out/failed
 */
async function handleMobileVerification(page) {
    try {
        const isMobileVerif = await page.evaluate(() => {
            const text = document.body.innerText;
            // User checks: "Check your LinkedIn app", "Open your LinkedIn app", "Approve the sign-in"
            return text.includes("Check your LinkedIn app") || 
                   text.includes("Open your LinkedIn app") ||
                   text.includes("Tap Yes on the prompt") ||
                   text.includes("verification request to your device") ||
                   text.includes("Approve the sign-in");
        });

        if (!isMobileVerif) return false;

        logger.warn("ACTION REQUIRED: Check your LinkedIn app on your phone! Waiting 2 minutes...");
        
        try {
            // Poll for feed URL for 120 seconds
            // Note: If navigation happens (user approves), this might throw "Execution context was destroyed"
            // We handle that in the catch block by checking the URL.
            await page.waitForFunction(() => {
                return window.location.href.includes("/feed") || 
                       document.querySelector('.global-nav__search');
            }, { timeout: 120000 });

            logger.info("Mobile verification successful! Resuming...");
            return true; // Resolved
        } catch (err) {
            // Check if we actually succeeded via navigation
            try {
                if (page.url().includes("/feed")) {
                    logger.info("Mobile verification successful (detected via navigation)! Resuming...");
                    return true;
                }
            } catch(e) {}

            logger.warn(`Mobile verification wait ended: ${err.message}`);
            return false;
        }

    } catch (e) {
         logger.warn(`Mobile verification check failed: ${e.message}`);
         return false;
    }
}

module.exports = { detectCheckpoint, handleMobileVerification };
