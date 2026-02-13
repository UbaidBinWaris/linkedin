# Session Management Architecture

This document explains **exactly** how LinkedIn sessions are stored, encrypted, and managed in this application.

## 1. Overview

The application uses a **Database Storage Adapter** pattern. Instead of saving sessions as files on the disk (which is the default behavior of the automation package), the application intercepts these save operations and stores them in your **PostgreSQL database**.

This ensures that:
- Sessions persist across server restarts.
- Sessions are backed up with your data.
- Multiple instances can theoretically share access (though `SessionLock` prevents conflicts).

## 2. Storage Location

Sessions are stored in the `linkedin_accounts` table in your PostgreSQL database.

### Database Schema
**Table:** `linkedin_accounts`
**Column:** `session_data` (Type: `JSONB`)

```sql
CREATE TABLE linkedin_accounts (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  session_data JSONB,           -- <--- Stores the encrypted session
  session_status VARCHAR(50),   -- 'active', 'idle', 'error', 'checkpoint'
  last_login TIMESTAMP,
  ...
);
```

### Data Structure
The `session_data` column contains a JSON object that wraps the encrypted string:

```json
{
  "encrypted": "d5a3...:8f2b...",  // IV:Ciphertext
  "updatedAt": "2024-02-13T10:00:00.000Z"
}
```

## 3. The Adapter Pattern

The core logic resides in `server.js`, where a custom `dbStorageAdapter` is defined and passed to the automation package.

### How it works (Step-by-Step)

1.  **Injection**:
    In `server.js`, we tell the package to use our adapter:
    ```javascript
    linkedin.setSessionStorage(dbStorageAdapter);
    ```

2.  **Writing (Save Session)**:
    When `saveSession()` is called in the package:
    - The package **encrypts** the browser state (cookies, local storage) into a string.
    - It calls `dbStorageAdapter.write(email, encryptedString)`.
    - The adapter wraps it: `{ encrypted: encryptedString, updatedAt: ... }`.
    - It executes a SQL `UPDATE` query to save it to the `linkedin_accounts` table.

3.  **Reading (Load Session)**:
    When `loadSession()` is called:
    - It calls `dbStorageAdapter.read(email)`.
    - The adapter executes `SELECT session_data ...`.
    - It extracts `row.session_data.encrypted` and returns it to the package.
    - The package **decrypts** it and restores the browser cookies.

## 4. Encryption details

The automation package handles encryption **before** handing data to the adapter.

- **Algorithm**: AES-256-CBC
- **Key**: Derived from `process.env.SESSION_SECRET` (SHA-256 hash).
- **IV (Initialization Vector)**: Random 16 bytes generated for every save.
- **Format**: `IV_HEX:ENCRYPTED_TEXT_HEX`

This means even if someone accesses your database, they cannot use the sessions without the `SESSION_SECRET` from your `.env` file.

## 5. Session Lifecycle

1.  **Login Successful**: Browser gets cookies.
2.  **Serialize**: `context.storageState()` captures cookies/origins.
3.  **Encrypt**: JSON -> String -> Encrypted String.
4.  **Persist**: Saved to DB `session_data`.
5.  **Reuse**: Next time, we decrypt and load cookies. If cookies are expired, we re-login.
