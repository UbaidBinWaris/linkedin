# LinkedIn Automation Bot 🤖

A robust, stealthy Node.js automation tool designed to interact with LinkedIn using [Playwright](https://playwright.dev/). This bot mimics human behavior to ensure safety, manages sessions efficiently to avoid repeated logins, and provides a powerful CLI for control.

> **⚠️ Disclaimer**: This tool is for educational purposes only. Automating interactions on LinkedIn violates their User Agreement. Use at your own risk. The authors are not responsible for any account bans or restrictions.

## 🚀 Key Features

-   **🕵️‍♂️ Stealth Automation**: Leverages `puppeteer-extra-plugin-stealth` with Playwright to minimize detection risks.
-   **💾 Smart Session Management**: Automatically saves cookies and local storage. You only need to log in once; subsequent runs reuse the session.
-   **🖥️ Dual Modes**:
    -   **Headless**: Runs in the background for efficiency.
    -   **Visible**: Watch the bot work or intervene manually when needed.
-   **⌨️ Interactive CLI**: Control the bot (check status, stop) directly from your terminal while it runs.
-   **🧠 Intelligent Validation**: Automatically detects login success and handles checkpoints/verifications by pausing for user input.
-   **🎭 Human-like Behavior**: Implements random delays, mouse movements, and dynamic User-Agents.

---

## 🛠️ Prerequisites

Before you begin, ensure you have:

1.  **Node.js**: Version 14 or higher (Run `node -v` to check).
2.  **npm**: Node Package Manager (comes with Node.js).
3.  A valid **LinkedIn Account**.

---

## 📦 Installation & Setup

Follow these steps to get the project running on your local machine.

### 1. Clone the Repository
```bash
git clone https://github.com/UbaidBinWaris/linkedin.git
cd linkedin
```

### 2. Install Dependencies
Install the required Node.js packages:
```bash
npm install
```

### 3. Install Browsers
Download the necessary browser binaries for Playwright:
```bash
npx playwright install chromium
```

### 4. Configure Environment Variables
Create a `.env` file in the root directory of the project. You can copy the structure below:

**File:** `.env`
```env
# Your LinkedIn Credentials
LINKEDIN_EMAIL=your_email@example.com
LINKEDIN_PASSWORD=your_secure_password
```

> **Note**: These credentials are used ONLY to log you in initially. Once a session is saved, the bot uses cookies.

---

## ▶️ Usage Guide

### Quick Start
To start the bot in the default **Headless Mode** (background):
```bash
npm start
```

### Run in Visible Mode
If you want to see the browser window (useful for first-time login or debugging):
```bash
npm start -- --visible
```

### CLI Command Reference
The CLI tool (`linkedin`) supports several flags:

| Flag | Short | Description |
| :--- | :--- | :--- |
| `--help` | `-h` | Show the help menu with all available options. |
| `--version` | `-v` | Display the current version of the bot. |
| `--visible` | | Run the browser in visible (headed) mode. |

**Examples:**
```bash
node cli.js --help
node cli.js --visible
```

### 🎮 Interactive Mode (REPL)
Once the bot is running, your terminal becomes an interactive control center. You can type commands directly into the console:

-   `status`: Checks if the browser is connected and shows the number of open pages.
-   `exit` (or `quit`): Gracefully closes the browser and stops the process.
-   `help`: Shows the list of available interactive commands.

Example:
```text
linkedin-bot> status
Status: 🟢 Connected
Open pages: 1
linkedin-bot> exit
Closing browser...
```

---

## 🏗️ Architecture Overview

For developers interested in the code structure:

-   **`cli.js`**: The entry point. Handles argument parsing (`--visible`, `--help`) and initializes the bot & REPL.
-   **`src/login/login.js`**: Core logic for authentication. Handles:
    -   Credential validation.
    -   Browser launching with stealth plugins.
    -   Navigation to LinkedIn.
    -   **Checkpoint Detection**: Pauses if LinkedIn asks for a code/captcha.
-   **`src/session/sessionManager.js`**: Handles saving and loading of `cookies` and `localStorage` to/from `data/session.json`.
-   **`src/cli/repl.js`**: Manages the interactive command-line interface.
-   **`src/config.js`**: Central configuration (session timeout, selectors).
-   **`src/utils/`**: Helper utilities for logging (`winston`), timing (random delays), and terminal prompts.

---

## ❓ Troubleshooting

### Login Failed / Timeout Errors
*   **Solution**: Run in **Visible Mode** (`npm start -- --visible`). This allows you to see if the page is loading slowly or if there's a popup blocking the bot.

### "Checkpoint Detected" or CAPTCHA
*   **Solution**: The bot is designed to handle this. If it detects a verification screen, it will **pause** and print a message in the terminal.
    1.  Go to the open browser window.
    2.  Manually solve the puzzle or enter the code.
    3.  Return to the terminal and press **ENTER** to resume automation.

### "Browser Closed" Unexpectedly
*   Check `logs/error.log` for detailed error messages.
*   Ensure you have stable internet functionality.

---

## 📄 License

This project is licensed under the MIT License.