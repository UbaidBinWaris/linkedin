const logger = require("../utils/logger");

/**
 * In-memory lock map to prevent simultaneous login attempts for the same user.
 * Map<email, Promise<any>>
 */
const activeLogins = new Map();

const SessionLock = {
  /**
   * Executes a function with an exclusive lock for the given email.
   * If a lock exists, it waits for it to release (or chains onto it? 
   * Actually user requested: "if activeLogins.has(email) { return activeLogins.get(email); }"
   * This means if a login is in progress, return that SAME promise. Join the existing attempt.)
   * 
   * @param {string} email 
   * @param {Function} fn - Async function to execute
   * @returns {Promise<any>}
   */
  async withLoginLock(email, fn) {
    if (activeLogins.has(email)) {
      logger.info(`[SessionLock] ${email} is already logging in. Joining existing request...`);
      return activeLogins.get(email);
    }

    logger.info(`[SessionLock] Acquiring lock for ${email}...`);
    
    // Create a promise that wraps the execution
    const promise = (async () => {
      try {
        return await fn();
      } finally {
        activeLogins.delete(email);
        logger.info(`[SessionLock] Releasing lock for ${email}.`);
      }
    })();

    activeLogins.set(email, promise);
    return promise;
  },

  /**
   * Checks if a user is currently locked.
   * @param {string} email
   * @returns {boolean}
   */
  isLocked(email) {
    return activeLogins.has(email);
  }
};

module.exports = SessionLock;
