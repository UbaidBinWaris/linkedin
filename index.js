const loginToLinkedIn = require('./src/login/login');
const sessionManager = require('./src/session/sessionManager');
const config = require('./src/config');
const logger = require('./src/utils/logger');
// Exporting the main function and other utilities for library usage
module.exports = {
    loginToLinkedIn,
    sessionManager,
    config,
    logger
};
