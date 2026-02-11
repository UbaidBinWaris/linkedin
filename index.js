require("dotenv").config();

const loginToLinkedIn = require("./src/login/login");

(async () => {
  try {
    const { browser, context, page } = await loginToLinkedIn();
    console.log("Login module finished successfully.");
  } catch (error) {
    console.error("Error occurred:", error);
  }
})();
