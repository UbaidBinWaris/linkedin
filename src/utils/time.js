/**
 * Returns a promise that resolves after a random delay between min and max milliseconds.
 * @param {number} min - Minimum delay in ms.
 * @param {number} max - Maximum delay in ms.
 * @returns {Promise<void>}
 */
function randomDelay(min = 1000, max = 3000) {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

module.exports = { randomDelay };
