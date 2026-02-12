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

module.exports = { detectCheckpoint };
