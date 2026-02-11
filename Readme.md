# LinkedIn Automation Bot & Module 🤖

A robust, stealthy Node.js automation tool designed to interact with LinkedIn using [Playwright](https://playwright.dev/). This package can be used as a standalone **CLI tool** or integrated as a **Module** into larger applications (supporting database storage, custom logging, and headless controls).

> **⚠️ Disclaimer**: This tool is for educational purposes only. Automating interactions on LinkedIn violates their User Agreement. Use at your own risk. The authors are not responsible for any account bans or restrictions.

---

## 🚀 Key Features

-   **🕵️‍♂️ Stealth Automation**: Leverages `puppeteer-extra-plugin-stealth` to minimize detection risks.
-   **👥 Multi-User Support**: Manage multiple LinkedIn accounts with isolated sessions.
-   **💾 Flexible Session Storage**: Store sessions in local files (default) or **inject your own database adapter** (MongoDB, Postgres, Redis, etc.).
-   **🖥️ Dual Modes**:
    -   **Headless**: Runs efficiently in the background.
    -   **Visible**: Watch the bot work for debugging.
-   **⌨️ CLI & Interactive REPL**: Control the bot directly from the terminal.
-   **🔌 Module Integration**: Easily integrate into existing Express/Node.js servers with custom logging and webhook-style checkpoint handling.
-   **🧠 Smart Validation**: Automatically detects checkpoints (CAPTCHA/Pin) and allows manual resolution via terminal or callback.

---

## 📦 Installation

### 1. Install via NPM
```bash
npm install @ubaidbinwaris/linkedin
```

### 2. (Optional) Clone for Source Usage
```bash
git clone https://github.com/UbaidBinWaris/linkedin.git
cd linkedin
npm install
npx playwright install chromium
```

---

## ▶️ Usage: CLI Mode

You can run the bot directly from the command line.

### 1. Quick Start (Single User)
Create a `.env` file with your credentials:
```env
LINKEDIN_EMAIL=your_email@example.com
LINKEDIN_PASSWORD=your_password
```
Then run:
```bash
npm start
```

### 2. Multi-User Mode
To manage multiple accounts, create a `users.js` file in the root directory:

**File:** `users.js`
```javascript
module.exports = [
    { username: "alice@example.com", password: "password123" },
    { username: "bob@company.com", password: "securePass!" }
];
```

Run the bot:
```bash
npm start
```
The CLI will prompt you to select which user to log in as:
```text
Select a user to login:
1. alice@example.com
2. bob@company.com
3. Use Environment Variables (.env)
```

---

## 🔌 Usage: Module Integration

This package is designed to be embedded in larger systems (e.g., a SaaS backend managing hundreds of accounts).

### Import
```javascript
const linkedin = require('@ubaidbinwaris/linkedin');
```

### 1. Custom Session Storage (Database Integration)
By default, sessions are saved as JSON files in `data/linkedin/`. You can override this to save sessions directly in your database.

```javascript
// Example: Using a generic database
linkedin.setSessionStorage({
    async read(username) {
        // Fetch encrypted session string from your DB
        const user = await db.users.findOne({ email: username });
        return user ? user.linkedinSession : null;
    },
    async write(username, data) {
        // Save encrypted session string to your DB
        await db.users.updateOne(
            { email: username }, 
            { $set: { linkedinSession: data } },
            { upsert: true }
        );
    }
});
```

### 2. Custom Logger
Redirect bot logs to your application's logging system (e.g., Winston, Pino, Bunyan).

```javascript
linkedin.setLogger({
    info: (msg) => console.log(`[BOT INFO] ${msg}`),
    error: (msg) => console.error(`[BOT ERROR] ${msg}`),
    warn: (msg) => console.warn(`[BOT WARN] ${msg}`),
    debug: (msg) => console.debug(`[BOT DEBUG] ${msg}`)
});
```

### 3. Login & Headless Control
When running on a server, you can't use the terminal to solve CAPTCHAs. Use the `onCheckpoint` callback to handle verification requests (e.g., trigger an alert).

```javascript
const credentials = { 
    username: "alice@example.com", 
    password: "password123" 
};

try {
    const { browser, page } = await linkedin.loginToLinkedIn({
        headless: true,
        // Callback when LinkedIn asks for verification
        onCheckpoint: async () => {
            console.log("⚠️ Checkpoint detected! Pausing for manual intervention...");
            
            // Example: Send an email/Slack alert to admin
            await sendAdminAlert(`User ${credentials.username} needs verification!`);
            
            // Wait for admin to signal resolution (e.g. via DB flag or API call)
            await waitForAdminResolution();
            
            console.log("Resuming login...");
        }
    }, credentials);

    console.log("Login successful!");
    
    // Do automation tasks...
    await browser.close();

} catch (err) {
    console.error("Login failed:", err);
}
```

---

## 🛠️ Configuration Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `headless` | `boolean` | `false` | Run browser in background. |
| `slowMo` | `number` | `50` | Delay between actions (ms). |
| `proxy` | `string` | `undefined` | Proxy URL (e.g., `http://user:pass@host:port`). |
| `onCheckpoint` | `function` | `null` | Async callback triggered when verification is needed. |

---

## ❓ Troubleshooting

### "Checkpoint Detected"
-   **CLI Mode**: The bot will pause and ask you to open a visible browser. Press ENTER to open it, solve the CAPTCHA, and the bot will confirm success and resume.
-   **Module Mode**: Ensure you provide an `onCheckpoint` callback to handle this event, otherwise the promise will reject or hang depending on implementation.

### Session Files
-   Sessions are encrypted and contain timestamps.
-   If `setSessionStorage` is NOT used, files are stored in `data/linkedin/<sanitized_username>.json`.

---

## 📄 License
MIT License.