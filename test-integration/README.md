# LinkedIn Integration Test App

This is a full-stack reference implementation using the `@ubaidbinwaris/linkedin` package (v2.0+) in a backend service context.

## Features
- **PostgreSQL Database**: Stores accounts and session data (as encrypted JSONB).
- **Global Concurrency**: Uses the package's `SessionLock` to prevent parallel logins.
- **Fail-Fast**: Handles `CHECKPOINT_DETECTED` and `BUSY` errors gracefully.
- **Real-time Logs**: UI streams logs from the server via SSE.

## Setup

1.  **Database**: Ensure PostgreSQL is running.
2.  **Environment**: Create `.env` file:
    ```env
    pg_username=postgres
    pg_password=your_password
    pg_database=linkedin_test
    SESSION_SECRET=your_32_byte_secret_key_here!!!!
    ```
3.  **Install**:
    ```bash
    npm install
    ```
4.  **Run**:
    ```bash
    npm start
    ```
5.  **Use**: Open `http://localhost:3000`.

## API Endpoints
- `GET /api/accounts`: List all accounts.
- `POST /api/accounts`: Add a new account.
- `POST /api/login`: Trigger automation for an account.
