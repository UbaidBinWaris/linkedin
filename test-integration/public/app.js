const API_URL = 'http://localhost:3000/api';

// Fetch and display accounts
async function loadAccounts() {
    const listContainer = document.getElementById('accountList');
    listContainer.innerHTML = '<p>Loading accounts...</p>';

    try {
        const response = await fetch(`${API_URL}/accounts`);
        if (!response.ok) throw new Error('Failed to fetch accounts');
        const accounts = await response.json();
        
        listContainer.innerHTML = '';
        if (accounts.length === 0) {
            listContainer.innerHTML = '<p>No accounts found.</p>';
            return;
        }

        accounts.forEach(account => {
            const item = document.createElement('div');
            item.className = 'account-item';
            
            const statusClass = account.session_status === 'active' ? 'active' : 
                                (account.session_status === 'error' ? 'error' : '');

            item.innerHTML = `
                <div class="account-info">
                    <span class="email">${account.email}</span>
                    <span class="status ${statusClass}">Status: ${account.session_status}</span>
                    <span class="status">Last Login: ${account.last_login ? new Date(account.last_login).toLocaleString() : 'Never'}</span>
                </div>
                <div class="actions">
                    <button class="login-btn" onclick="triggerLogin(${account.id})">Login</button>
                    <!-- <button class="check-btn" onclick="checkStatus(${account.id})">Check Status</button> -->
                </div>
            `;
            listContainer.appendChild(item);
        });

    } catch (err) {
        listContainer.innerHTML = `<p style="color:red">Error: ${err.message}</p>`;
    }
}

// Add new account
document.getElementById('addAccountForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch(`${API_URL}/accounts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        if (!response.ok) throw new Error('Failed to add account');
        
        document.getElementById('addAccountForm').reset();
        loadAccounts(); // Refresh list

    } catch (err) {
        alert('Error adding account: ' + err.message);
    }
});

// Trigger Login
window.triggerLogin = async (id) => {
    try {
        const btn = document.querySelector(`button[onclick="triggerLogin(${id})"]`);
        const originalText = btn.innerText;
        btn.innerText = 'Logging in...';
        btn.disabled = true;

        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });

        const result = await response.json();
        
        if (!response.ok) throw new Error(result.error || 'Login failed');

        alert('Login Successful!');
        loadAccounts(); // Refresh status

    } catch (err) {
        alert('Login Error: ' + err.message);
    } finally {
        // Re-enable button (or the refresh will rebuild it)
        loadAccounts();
    }
};

// Initial load
loadAccounts();
