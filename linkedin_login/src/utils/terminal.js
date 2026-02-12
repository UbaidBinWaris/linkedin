const readline = require("readline");

function waitForUserResume(message = "Press ENTER to continue...") {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(message, () => {
      rl.close();
      resolve();
    });
  });
}

module.exports = { waitForUserResume };
