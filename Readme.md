# LinkedIn Automation Bot

A robust Node.js automation tool designed to interact with LinkedIn using [Playwright](https://playwright.dev/). This bot is built with stealth features to mimic human behavior, manage sessions efficiently, and provide an interactive CLI for control.

## 🚀 Features

- **Stealth Automation**: Uses `puppeteer-extra-plugin-stealth` with Playwright to minimize detection risks.
- **Session Management**: Automatically saves and loads session states (cookies & local storage) to prevent frequent re-logins.
- **Headless & Visible Modes**: configurable execution modes for debugging or background operation.
- **Interactive CLI**: integrated REPL (Read-Eval-Print Loop) to control the bot instance after initialization.
- **Smart Validation**: robust checks to verify login status and handle checkpoints/verifications manually if needed.
- **Human-like Behavior**: Implements random delays, mouse movements, and dynamic user agents.

## 🛠️ Prerequisites

- **Node.js** (v14 or higher recommended)
- **npm** (Node Package Manager)
- A valid **LinkedIn Account**

## 📦 Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/UbaidBinWaris/linkedin.git
    cd linkedin
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Install Playwright browsers:**
    ```bash
    npx playwright install chromium
    ```

## ⚙️ Configuration

1.  Create a `.env` file in the root directory.
2.  Add your LinkedIn credentials:

    ```env
    LINKEDIN_EMAIL=your_email@example.com
    LINKEDIN_PASSWORD=your_password
    ```

##  ▶️ Usage

### Run in Headless Mode (Default)
Runs the bot in the background without a visible browser window.

```bash
npm start
```

### Run in Visible Mode
Useful for debugging or if manual intervention (CAPTCHA) is required.

```bash
npm start -- --visible
```

### CLI Commands
Once the bot is running, you can interact with it through the terminal. (See `src/cli/repl.js` for available commands).

## 📂 Project Structure

```
├── src/
│   ├── cli/            # Command Line Interface logic
│   ├── login/          # Login automation & checkpoint handling
│   ├── session/        # Session storage & management
│   ├── utils/          # Helper functions (logger, timing, etc.)
│   └── config.js       # Configuration constants
├── data/               # Stored session data (cookies, etc.)
├── logs/               # Application logs
├── index.js            # Entry point
└── package.json        # Dependencies & scripts
```

## ⚠️ Disclaimer

This tool is for educational purposes only. Automating interactions on LinkedIn violates their User Agreement. Use at your own risk. The authors are not responsible for any account bans or restrictions.