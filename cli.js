#!/usr/bin/env node
const logger = require("./src/utils/logger");
require("dotenv").config();

const loginToLinkedIn = require("./src/login/login");
const REPL = require("./src/cli/repl");

let browserInstance = null;

// Cleanup function to be called by REPL or SIGINT
async function cleanup() {
    if (browserInstance) {
        console.log("Closing browser...");
        try {
            await browserInstance.close();
            console.log("Browser closed.");
        } catch (err) {
            console.error("Error closing browser:", err.message);
        }
        browserInstance = null;
    }
}

// Handle Ctrl+C (SIGINT) for graceful shutdown fallback
process.on("SIGINT", async () => {
  console.log("\nReceived stop signal.");
  await cleanup();
  process.exit(0);
});

(async () => {
  try {
    // Check command line arguments
    const args = process.argv.slice(2);
    
    if (args.includes("--help") || args.includes("-h")) {
        console.log(`
LinkedIn Automation CLI

Usage:
  linkedin [options]

Options:
  --visible       Run in visible mode (default is headless)
  --help, -h      Show this help message
  --version, -v   Show version number
`);
        process.exit(0);
    }

    if (args.includes("--version") || args.includes("-v")) {
        const packageJson = require("./package.json");
        console.log(`v${packageJson.version}`);
        process.exit(0);
    }

    const isVisible = args.includes("--visible");
    const isHeadless = !isVisible;

    console.log(`Starting bot in ${isVisible ? "Visible" : "Headless"} Mode...`);
    
    const { browser, context, page } = await loginToLinkedIn({ headless: isHeadless });
    browserInstance = browser;
    
    console.log("Login successful.");

    // Start Interactive CLI
    const repl = new REPL({ 
        browser: browserInstance,
        cleanup: cleanup
    });
    repl.start();

  } catch (error) {
    console.error("Error occurred:", error);
    process.exit(1);
  }
})();
