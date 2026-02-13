const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./db');
const linkedin = require('@ubaidbinwaris/linkedin-login');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// SSE Clients
let clients = [];

app.get('/api/logs', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    clients.push(res);

    req.on('close', () => {
        clients = clients.filter(client => client !== res);
    });
});

function broadcastLog(message) {
    const data = `data: ${JSON.stringify({ timestamp: new Date(), message })}\n\n`;
    clients.forEach(client => client.write(data));
}

// Initialize DB
db.initializeDatabase();

// --- Global Configuration ---

// 1. Setup Session Storage (DB Adapter)
const storageAdapter = {
    async read(username) {
        // username is the email
        broadcastLog(`[Adapter] Reading session for ${username}`);
        try {
            const res = await db.query('SELECT session_data FROM linkedin_accounts WHERE email = $1', [username]);
            return res.rows[0]?.session_data || null;
        } catch (e) {
            console.error("Storage Read Error:", e);
            return null;
        }
    },
    async write(username, data) {
        broadcastLog(`[Adapter] Writing session for ${username}`);
        try {
            // Upsert logic (or just update since we only login existing accounts)
            await db.query(
                `UPDATE linkedin_accounts 
                 SET session_data = $1::jsonb, 
                     session_status = 'active', 
                     last_login = NOW() 
                 WHERE email = $2`,
                [data, username] // data is already encrypted string? No, package passes encrypted STRING. DB expects JSONB? 
                // WAIT. Package passes encrypted STRING. 
                // DB definition says `session_data JSONB`.
                // A string is valid JSONB if quoted, but postgres might complain if it's just raw string.
                // Should we store as text? Or wrap in object?
                // Let's wrap: { data: "..." } or change DB column to TEXT or just JSON.stringify inside package?
                // package passes `data` which is result of `encrypt(JSON.stringify({...}))` -> it's a string "iv:ciphertext".
                // This is NOT valid JSON. 
                // WE FOUND A BUG/MISMATCH. 
                // DB expects JSONB. Package gives String.
                // FIX: Store as object { encrypted: data }
            );
        } catch (e) {
            console.error("Storage Write Error:", e);
        }
    }
};

// Update: The package's `write` passes a STRING (encrypted). 
// Our DB `session_data` is JSONB. 
// We must wrap it: JSON.stringify({ encrypted: data })
// BUT `read` must unwrap it. 
// We need to adjust `storageAdapter.read` too.

const dbStorageAdapter = {
    async read(username) {
        broadcastLog(`[Adapter] Reading session for ${username}`);
        try {
            const res = await db.query('SELECT session_data FROM linkedin_accounts WHERE email = $1', [username]);
            if (res.rows[0]?.session_data?.encrypted) {
                return res.rows[0].session_data.encrypted; 
            }
            return null;
        } catch (e) {
            console.error("Storage Read Error:", e);
            return null;
        }
    },
    async write(username, data) {
         broadcastLog(`[Adapter] Writing session for ${username}`);
         try {
             // data is the encrypted string
             const payload = { encrypted: data, updatedAt: new Date().toISOString() };
             await db.query(
                 `UPDATE linkedin_accounts 
                  SET session_data = $1, 
                      session_status = 'active', 
                      last_login = NOW() 
                  WHERE email = $2`,
                 [JSON.stringify(payload), username] 
             );
         } catch (e) {
             console.error("Storage Write Error:", e);
         }
    }
};

linkedin.setSessionStorage(dbStorageAdapter);

// 2. Setup Logger
const customLogger = {
    info: (msg) => { console.log(msg); broadcastLog(`[INFO] ${msg}`); },
    error: (msg) => { console.error(msg); broadcastLog(`[ERROR] ${msg}`); },
    warn: (msg) => { console.warn(msg); broadcastLog(`[WARN] ${msg}`); },
    debug: (msg) => { console.debug(msg); broadcastLog(`[DEBUG] ${msg}`); }
};
linkedin.setLogger(customLogger);


// --- API Endpoints ---

// Get all accounts
app.get('/api/accounts', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM linkedin_accounts ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add new account
app.post('/api/accounts', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await db.query(
            'INSERT INTO linkedin_accounts (email, password, session_status) VALUES ($1, $2, $3) RETURNING *',
            [email, password, 'idle']
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Trigger Login
app.post('/api/login', async (req, res) => {
    const { id } = req.body;
    console.log(`[API] Triggering login for account ID: ${id}`);
    
    try {
        // 1. Fetch credentials
        const accountResult = await db.query('SELECT * FROM linkedin_accounts WHERE id = $1', [id]);
        if (accountResult.rows.length === 0) {
            return res.status(404).json({ error: 'Account not found' });
        }
        const account = accountResult.rows[0];

        // 2. Set Status to 'logging_in'
        await db.query("UPDATE linkedin_accounts SET session_status = 'logging_in' WHERE id = $1", [id]);

        // 3. Trigger Login
        const { browser, page } = await linkedin.loginToLinkedIn({ headless: true }, {
            username: account.email,
            password: account.password
        });

        // 4. Update status to 'active'
        await db.query("UPDATE linkedin_accounts SET session_status = 'active' WHERE id = $1", [id]);

        res.json({ message: 'Login successful', status: 'active' });

        // Close after a short delay (simulating a check)
        setTimeout(async () => {
             try { await browser.close(); } catch(e){}
        }, 5000);

    } catch (err) {
         console.error('Login error:', err);
         
         let status = 'error';
         if (err.message === 'CHECKPOINT_DETECTED') {
             status = 'checkpoint';
         } else if (err.message.includes('BUSY')) {
             status = 'busy';
             return res.status(409).json({ error: err.message, status });
         }

         await db.query('UPDATE linkedin_accounts SET session_status = $1 WHERE id = $2', [status, id]);
         res.status(500).json({ error: err.message, status });
    }
});

// Get Check Status (verify session)
app.get('/api/status/:id', async (req, res) => {
    // This could verify the session validity by reusing the session data
    // For now, just return the DB status
    const { id } = req.params;
    try {
         const result = await db.query('SELECT session_status, last_login FROM linkedin_accounts WHERE id = $1', [id]);
         if (result.rows.length === 0) return res.status(404).json({error: 'Not found'});
         res.json(result.rows[0]);
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
