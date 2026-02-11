const logger = require("./src/utils/logger");
require("dotenv").config();

const loginToLinkedIn = require("./src/login/login");

let browserInstance = null;

// Handle Ctrl+C (SIGINT) for graceful shutdown
process.on("SIGINT", async () => {
  console.log("\nReceived stop signal. Gracefully shutting down...");
  if (browserInstance) {
    try {
      console.log("Closing browser...");
      await browserInstance.close();
      console.log("Browser closed successfully.");
    } catch (err) {
      console.error("Error closing browser:", err.message);
    }
  }
  process.exit(0);
});

(async () => {
  try {
    const { browser, context, page } = await loginToLinkedIn();
    browserInstance = browser;
    
    console.log("Login module finished successfully.");
    console.log("Bot is running. Press Ctrl+C to stop.");

    // Keep the process alive to maintain the browser session
    await new Promise(() => {}); 

  } catch (error) {
    console.error("Error occurred:", error);
    process.exit(1);
  }
})();
