# LinkedIn Session Manager & Automation Service (v2.0.0)

A robust, deterministic backend service foundation for managing multiple LinkedIn accounts with strict concurrency control and session isolation. 

> **v2.0.0 Change**: This major version pivots from a CLI tool to a backend service architecture. It removes "stealth" plugins and "auto-resolution" magic in favor of stability, reliability, and "fail-fast" principles.

## Core Features

- **Multi-User Architecture**: Designed to handle hundreds of accounts safely.
- **Concurrency Control**: In-memory locking (`SessionLock`) prevents parallel login attempts for the same user.
- **Session Isolation**:
  - Sessions stored as `SHA-256` hashes of emails (privacy).
  - AES-256 Encryption for session data.
- **Smart Validation**:
  - Trusts sessions validated within the last 10 minutes (reduces feed navigation load).
  - Automatically refreshes older sessions.
- **Deterministic Flow**:
  - **Launch** -> **Check Session** -> **Login** -> **Fail/Success**.
  - **Fail Fast**: If a checkpoint/challenge is detected, it throws `CHECKPOINT_DETECTED` immediately, allowing the upper layer (API/Worker) to handle it (e.g., notify admin).

## Installation

```bash
npm install @ubaidbinwaris/linkedin
```

## Architecture

```mermaid
graph TD
    A[API/Worker Request] --> B{Acquire User Lock}
    B -- Busy --> C[Throw BUSY Error]
    B -- Acquired --> D[Launch Standard Playwright]
    D --> E{Load Session}
    E -- Valid & Recent --> F[Return Context (Skip Feed)]
    E -- Stale/None --> G[Navigate to Feed]
    G --> H{Is Logged In?}
    H -- Yes --> I[Update Validation Timestamp]
    I --> F
    H -- No --> J[Perform Credential Login]
    J --> K{Checkpoint?}
    K -- Yes --> L[Throw CHECKPOINT_DETECTED]
    K -- No --> M[Login Success]
    M --> I
    F --> N[Release Lock (on Task Completion)]
```

## Usage

### Basic Login

The `loginToLinkedIn` function now handles locking internally. If you try to call it twice for the same user simultaneously, the second call will fail with a `BUSY` error.

```javascript
const { loginToLinkedIn } = require('@ubaidbinwaris/linkedin');

(async () => {
    try {
        const { browser, page } = await loginToLinkedIn({
            headless: true
        }, {
            username: 'user@example.com',
            password: 'secret-password'
        });

        console.log("Logged in and active!");
        
        // Output session status
        console.log(`Needs Validation? ${page.context().needsValidation}`);

        // Do work...
        
        await browser.close();
    } catch (err) {
        if (err.message === 'CHECKPOINT_DETECTED') {
            console.error("Manual intervention required for this account.");
        } else if (err.message.startsWith('BUSY')) {
            console.error("User is currently busy with another task.");
        } else {
            console.error("Login failed:", err);
        }
    }
})();
```

### Custom Session Storage

You can link this to a database (Redis/Postgres) instead of local files.

```javascript
const { setSessionStorage } = require('@ubaidbinwaris/linkedin');

setSessionStorage({
    read: async (email) => {
        // Fetch encrypted string from DB
        return await db.sessions.findOne({ where: { email } });
    },
    write: async (email, data) => {
        // Save encrypted string to DB
        await db.sessions.upsert({ email, data });
    }
});
```

## Directory Structure

*   `src/session/`:
    *   `SessionLock.js`: In-memory concurrency control.
    *   `sessionManager.js`: Hashing, encryption, validation logic.
*   `src/login/`:
    *   `login.js`: Deterministic login flow.
*   `src/browser/`:
    *   `launcher.js`: Standard Playwright launcher (no stealth plugins).
*   `src/auth/`:
    *   `checkpoint.js`: Simple detection logic.