const { loginToLinkedIn } = require('@ubaidbinwaris/linkedin');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

(async () => {
    console.log('Testing login functionality...');
    
    try {
        const { browser, page } = await loginToLinkedIn({ headless: true });
        console.log('Login function returned successfully.');
        
        // Wait a bit to ensure session saving is triggered/completed
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        const dataDir = path.join(__dirname, 'data');
        const sessionFile = path.join(dataDir, 'session.json');

        if (fs.existsSync(sessionFile)) {
            console.log('✅ Session file created at:', sessionFile);
        } else {
            console.error('❌ Session file NOT found at:', sessionFile);
            const files = fs.existsSync(dataDir) ? fs.readdirSync(dataDir) : 'data dir missing';
            console.log('Data dir contents:', files);
        }

        console.log('Closing browser in 5 seconds...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        await browser.close();
        
    } catch (error) {
        console.error('❌ Login failed:', error);
        process.exit(1);
    }
})();
