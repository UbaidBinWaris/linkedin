const readline = require("readline");

class REPL {
  constructor(context = {}) {
    this.context = context;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: "linkedin-bot> ",
    });
  }

  start() {
    console.log("Interactive CLI started. Type 'help' for commands.");
    this.rl.prompt();

    this.rl.on("line", async (line) => {
      const input = line.trim();
      
      switch (input) {
        case "help":
          console.log(`
Available commands:
  status    - Show bot status
  exit      - Stop the bot and exit
  quit      - Alias for exit
  help      - Show this help message
          `);
          break;

        case "status":
            if (this.context.browser && this.context.browser.isConnected()) {
                console.log("Status: 🟢 Connected");
                const pages = this.context.browser.contexts()[0]?.pages().length || 0;
                console.log(`Open pages: ${pages}`);
            } else {
                console.log("Status: 🔴 Disconnected");
            }
            break;

        case "exit":
        case "quit":
          console.log("Exiting...");
          this.rl.close();
          if (this.context.cleanup) {
              await this.context.cleanup();
          }
          process.exit(0);
          break;

        case "":
          break;

        default:
          console.log(`Unknown command: '${input}'. Type 'help' for available commands.`);
          break;
      }
      this.rl.prompt();
    });

    this.rl.on("close", () => {
      console.log("\nCLI session ended.");
      process.exit(0);
    });
  }
}

module.exports = REPL;
