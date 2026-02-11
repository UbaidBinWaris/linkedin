const fs = require('fs');
const path = require('path');
const readline = require('readline');
const logger = require('../utils/logger');

const USERS_FILE = path.join(process.cwd(), 'users.js');

/**
 * Loads users from users.js and prompts for selection if multiple exist.
 * @returns {Promise<Object|null>} Selected credentials { username, password } or null if using env.
 */
async function selectUser() {
    if (!fs.existsSync(USERS_FILE)) {
        logger.info("No users.js file found. Using environment variables.");
        return null;
    }

    let users = [];
    try {
        users = require(USERS_FILE);
        if (!Array.isArray(users) || users.length === 0) {
            logger.warn("users.js exists but exports an empty array or invalid format.");
            return null;
        }
    } catch (error) {
        logger.error(`Error loading users.js: ${error.message}`);
        return null;
    }

    if (users.length === 1) {
        logger.info(`Single user found in users.js: ${users[0].username}`);
        return users[0];
    }

    // Multiple users - Prompt for selection
    console.log('\nSelect a user to login:');
    users.forEach((u, index) => {
        console.log(`${index + 1}. ${u.username}`);
    });
    console.log(`${users.length + 1}. Use Environment Variables (.env)`);

    const selectedIndex = await new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const ask = () => {
            rl.question('\nEnter number: ', (answer) => {
                const num = parseInt(answer);
                if (!isNaN(num) && num >= 1 && num <= users.length + 1) {
                    rl.close();
                    resolve(num - 1);
                } else {
                    console.log('Invalid selection. Try again.');
                    ask();
                }
            });
        };
        ask();
    });

    if (selectedIndex === users.length) {
        logger.info("Selected: Environment Variables");
        return null; // Fallback to env
    }

    const selectedUser = users[selectedIndex];
    logger.info(`Selected user: ${selectedUser.username}`);
    return selectedUser;
}

module.exports = { selectUser };
