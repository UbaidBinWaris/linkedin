const ONE_DAY_MS = 24 * 60 * 60 * 1000;

module.exports = {
  // Session expiry time: 30 days
  SESSION_MAX_AGE: 90 * ONE_DAY_MS, 

  // Selectors to verify if the session is valid (logged in)
  VALIDATION_SELECTORS: [
    '.global-nav__search',
    'input[placeholder="Search"]',
    '#global-nav-typeahead',
    '.feed-shared-update-v2' // Feed post container
  ]
};
