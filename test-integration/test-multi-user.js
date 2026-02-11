const { loginToLinkedIn } = require('@ubaidbinwaris/linkedin');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

(async () => {
    console.log('Testing MULTI-USER login functionality...');
    
    // Test Case 1: Legacy/Env Login (no credentials passed)
    console.log('\n--- Test 1: Env Var Login ---');
    try {
        const { browser } = await loginToLinkedIn({ headless: true });
        console.log('Env login successful.');
        await browser.close();
        
        // Check for session file (should use env email)
        const email = process.env.LINKEDIN_EMAIL;
        const sanitized = email.replace(/@/g, "_at_").replace(/\./g, "_dot_").replace(/[^a-zA-Z0-9_\-]/g, "_");
        const sessionFile = path.join(process.cwd(), 'data', 'linkedin', `${sanitized}.json`);
        
        if (fs.existsSync(sessionFile)) {
            console.log(`✅ Session file exists: ${sessionFile}`);
        } else {
            console.error(`❌ Session file NOT found at: ${sessionFile}`);
        }

    } catch (e) {
        console.error('Test 1 Failed:', e.message);
    }

    // Test Case 2: Explicit Credentials
    console.log('\n--- Test 2: Explicit Credentials Login ---');
    const mockUser = { username: "test_user_multi", password: "mock_password" }; // This will likely fail login but we check path generation logic if we mock it? 
    // Actually we can't fully login with fake creds. 
    // We will just verify that the function accepts it and tries.
    // But since we want to verify session creation, we'd need real creds.
    // For now, we reuse env creds but pass them explicitly to verify the argument handling.
    
    const realUser = {
        username: process.env.LINKEDIN_EMAIL,
        password: process.env.LINKEDIN_PASSWORD
    };

    try {
        const { browser } = await loginToLinkedIn({ headless: true }, realUser);
        console.log('Explicit login successful.');
        await browser.close();
        
         // Check for session file again (same path as above since same email)
         const sanitized = realUser.username.replace(/@/g, "_at_").replace(/\./g, "_dot_").replace(/[^a-zA-Z0-9_\-]/g, "_");
         const sessionFile = path.join(process.cwd(), 'data', 'linkedin', `${sanitized}.json`);
         
         if (fs.existsSync(sessionFile)) {
             console.log(`✅ Session file exists (Explicit): ${sessionFile}`);
         } else {
             console.error(`❌ Session file NOT found at: ${sessionFile}`);
         }

    } catch (e) {
        console.error('Test 2 Failed:', e.message);
    }

})();
