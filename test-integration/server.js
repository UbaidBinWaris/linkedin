const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./db');
const linkedin = require('@ubaidbinwaris/linkedin');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize DB
db.initializeDatabase();

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
            [email, password, 'unknown']
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

        // 2. Setup Session Storage
        const storageAdapter = {
            async read(username) {
                console.log(`[Adapter] Reading session for ${username}`);
                const res = await db.query('SELECT session_data FROM linkedin_accounts WHERE email = $1', [username]);
                return res.rows[0]?.session_data || null;
            },
            async write(username, data) {
                console.log(`[Adapter] Writing session for ${username}`);
                await db.query(
                    'UPDATE linkedin_accounts SET session_data = $1, session_status = $2, last_login = NOW() WHERE email = $3',
                    [JSON.stringify(data), 'active', username]
                );
            }
        };
        linkedin.setSessionStorage(storageAdapter);

        // 3. Trigger Login
        // Note: For now we are running headless: false to see the browser as per request
        const { browser, page } = await linkedin.loginToLinkedIn({ headless: false }, {
            username: account.email,
            password: account.password
        });

        // 4. Update status
        await db.query('UPDATE linkedin_accounts SET session_status = $1 WHERE id = $2', ['active', id]);

        res.json({ message: 'Login successful', status: 'active' });

        // Keep browser open for a bit or manage it? 
        // For this test integration, we might want to keep it open or close it based on user action.
        // For now, we'll close it after a short delay to simulate a check, or leave it if it's a persistent bot.
        // Let's just close it for now to save resources after successful login validation.
        // Or better, return success and let the user play with it.
        // But the request said "open the browser optio to add new linkedin user... and allows to save the user".
        
        // Use a timeout to close to allow some interaction if needed, or simply return.
        // Since we await loginToLinkedIn, the function returns AFTER login is done.
        
        await browser.close(); 

    } catch (err) {
         console.error('Login error:', err);
         await db.query('UPDATE linkedin_accounts SET session_status = $1 WHERE id = $2', ['error', id]);
         res.status(500).json({ error: err.message });
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
