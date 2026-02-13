# Login & Authentication Workflow

This document explains the **step-by-step** logic used to authenticate with LinkedIn. The system is designed to be **deterministic**, **robust**, and safe.

## Logic Flowchart

```mermaid
graph TD
    A[Start Login] --> B{Session Cached?}
    B -- Yes (Valid) --> C[Return Existing Browser]
    B -- No --> D[Load Session from DB]
    D --> E{Session Exists?}
    E -- Yes --> F[Validate Session on Feed]
    F -- Success --> G[Update Cache & Return]
    F -- Invalid/Expired --> H[Credential Login]
    E -- No --> H
    H --> I{Login Success?}
    I -- Yes --> G
    I -- No (Checkpoint) --> J{Can Auto-Solve?}
    J -- Yes (Mobile Verify) --> K[Wait for Feed]
    K --> G
    J -- No --> L{Headless Mode?}
    L -- Yes --> M[Close & Relaunch Visible]
    M --> N[Manual User Intervention]
    N --> O{User Reached Feed?}
    O -- Yes --> G
    O -- No --> P[Throw Error: CHECKPOINT]
    L -- No --> P
```

## Detailed Steps

### 1. Initialization
The `loginToLinkedIn(options, credentials)` function is the entry point.
- It acquires a **SectionLock** to prevent multiple browsers from trying to login to the same account simultaneously.
- It launches a Playwright browser instance.

### 2. Session Loading
Before typing a password, we try to restore a previous session.
- **Source**: `server.js` adapter reads from Postgres.
- **Decryption**: `sessionManager.js` decrypts the data.
- **Result**: Browser context is restored with cookies.
- **Optimization**: If `context.needsValidation` is false (recently validated), we skip the feed check and return immediately.

### 3. Validation (The "Feed Check")
If the session is not fresh:
1.  Navigate to `https://www.linkedin.com/feed/`.
2.  Check for elements that exist only when logged in (e.g., global nav, identity module).
3.  **If I am on the feed**, the session is valid. Update timestamp and return.
4.  **If I am redirected to login**, the session is dead. Proceed to credential login.

### 4. Credential Login
If valid session is missing:
1.  Navigate to Login Page.
2.  Type Email (simulating human typing speed).
3.  Type Password.
4.  Click "Sign In".

### 5. Checkpoint & Challenge Handling
This is the most critical part. LinkedIn often asks for verification.

#### A. Mobile Verification (`handleMobileVerification`)
If the page asks for a phone number verification code (and we have logic to handle it, or if it's just a "verify it's you" prompt that we can click through):
- The system attempts to resolve it automatically.
- It waits for navigation to the Feed.

#### B. Manual Fallback
If an unknown challenge appears (CAPTCHA, new logic) and we are in **Headless Mode** (hidden browser):
1.  **Close Headless Browser**: We cannot solve it blindly.
2.  **Relaunch Visible Browser**: A new browser window opens on the server/desktop.
3.  **Fill Credentials**: The bot types the password again.
4.  **Wait for Human**: The bot pauses and waits (up to 2 minutes) for **YOU** to solve the puzzle or enter the SMS code.
5.  **Resume**: Once you reach the Feed, the bot takes control back, saves the new session, and continues.

### 6. Saving
Upon any successful access to the feed:
- `saveSession()` is triggered.
- The new cookies/state are encrypted and updated in the database.
- `session_status` in DB is updated to `'active'`.

## Session Lifecycle & Validation Strategy

The system uses a **"Trust but Verify"** model.

### 1. The Authority: Live Validation
`SESSION_MAX_AGE` (30 days) is just a safety cap. The **real authority** is the live LinkedIn session.
- **Every time** the bot runs (unless cached for <10m), it visits the feed.
- It checks for **live DOM elements** (e.g., search bar, user identity).
- **If these are missing**, the session is INVALID, regardless of its age.

### 2. Immediate Re-login
If validation fails (e.g., cookies revoked, manual logout):
1.  The system immediately discards the session.
2.  It triggers a **fresh credential login** (email + password).
3.  It saves the new session to the DB.

### 3. Rolling Refresh
- **Successful Validation** update the `lastValidatedAt` timestamp in the database.
- This confirms the session is still good, extending its trust period.

### Summary
| Condition | Action |
| :--- | :--- |
| **< 10 mins since last check** | **SKIP CHECK** (Assume valid) |
| **> 10 mins since last check** | **VALIDATE** (Visit Feed) |
| **Validation Fails** | **RE-LOGIN** (Type Password) |
| **> 30 Days Old** | **FORCE RE-LOGIN** (Security Cap) |
