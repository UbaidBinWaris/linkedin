const { chromium } = require("playwright");
const logger = require("../utils/logger");
const { loadSession } = require("../session/sessionManager");

/**
 * Creates and launches a browser instance.
 * @param {Object} options - Launch options
 */
async function createBrowser(options = {}) {
  const launchOptions = {
    headless: options.headless !== undefined ? options.headless : true,
    args: [
      "--no-sandbox", 
      "--disable-setuid-sandbox",
    ],
    ...options
  };

  logger.info("Launching browser (Standard Playwright)...");
  return await chromium.launch(launchOptions);
}

/**
 * Creates or loads a browser context.
 * @param {import('playwright').Browser} browser
 * @param {string} email - for session loading
 */
async function createContext(browser, email) {
  const contextOptions = {
    userAgent: getRandomUserAgent(),
    viewport: getRandomViewport(),
    locale: 'en-US',
    timezoneId: 'America/New_York',
    permissions: ['geolocation'],
    ignoreHTTPSErrors: true,
  };

  logger.info(`Checking for saved session for ${email}...`);
  const storedContext = await loadSession(browser, contextOptions, email);

  if (storedContext) {
    logger.info("Session stored context loaded.");
    return storedContext;
  }

  logger.info("No valid session found. Creating new context.");
  return await browser.newContext(contextOptions);
}

function getRandomViewport() {
  const width = 1280 + Math.floor(Math.random() * 640);
  const height = 720 + Math.floor(Math.random() * 360);
  return { width, height };
}

function getRandomUserAgent() {
  const versions = ["120.0.0.0", "121.0.0.0", "122.0.0.0"];
  const version = versions[Math.floor(Math.random() * versions.length)];
  return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Safari/537.36`;
}

module.exports = { createBrowser, createContext };
