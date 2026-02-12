// Main entry point
const loginToLinkedIn = require('./src/login/login');
const { setSessionDir, setSessionStorage } = require('./src/session/sessionManager');
const { setLogger } = require('./src/utils/logger');
const config = require('./src/config');

module.exports = {
    loginToLinkedIn,
    setSessionDir,
    setSessionStorage,
    setLogger,
    config
};
