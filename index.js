const loginToLinkedIn = require('./src/login/login');
const sessionManager = require('./src/session/sessionManager');
const config = require('./src/config');
const logger = require('./src/utils/logger'); // This is now the proxy object
// Exporting the main function and other utilities for library usage
module.exports = {
    loginToLinkedIn,
    sessionManager,
    setSessionDir: sessionManager.setSessionDir,
    setSessionStorage: sessionManager.setSessionStorage,
    setLogger: logger.setLogger,
    config,
    logger
};
