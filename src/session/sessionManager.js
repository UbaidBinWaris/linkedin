const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const logger = require("../utils/logger");

const DATA_DIR = path.join(process.cwd(), "data", "linkedin");
const ALGORITHM = "aes-256-cbc";
// Use a fixed key if not provided in env (for development convenience, but ideally should be in env)
// Ensure the key is 32 bytes.
const SECRET_KEY = process.env.SESSION_SECRET || "default_insecure_secret_key_32_bytes_long!!";

// Ensure key is exactly 32 bytes for aes-256-cbc
const key = crypto.createHash("sha256").update(String(SECRET_KEY)).digest();

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text) {
  try {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = textParts.join(':');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    // If decryption fails, it might be a plain JSON file or invalid key
    return null;
  }
}

/**
 * Sanitizes a username to be safe for filenames.
 * Replaces special characters with underscores or descriptive text.
 * @param {string} username 
 * @returns {string}
 */
function sanitizeUsername(username) {
  if (!username) return "default_session";
  return username
    .replace(/@/g, "_at_")
    .replace(/\./g, "_dot_")
    .replace(/[^a-zA-Z0-9_\-]/g, "_");
}

function getSessionPath(username) {
  const filename = `${sanitizeUsername(username)}.json`;
  return path.join(DATA_DIR, filename);
}

function sessionExists(username) {
  return fs.existsSync(getSessionPath(username));
}

const { SESSION_MAX_AGE } = require("../config");

/**
 * Saves the browser context storage state to an encrypted file with a timestamp.
 * @param {import('playwright').BrowserContext} context 
 * @param {string} [username] - The username to associate with this session
 */
async function saveSession(context, username) {
  try {
    const state = await context.storageState();
    
    // Wrap state with metadata
    const sessionData = {
      timestamp: Date.now(),
      state: state
    };

    const jsonString = JSON.stringify(sessionData);
    const encryptedData = encrypt(jsonString);
    
    const filePath = getSessionPath(username);
    
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, encryptedData, "utf-8");
    logger.info(`Session saved successfully for ${username || "default"} (Encrypted & Timestamped) 🔒`);
  } catch (error) {
    logger.error(`Failed to save session: ${error.message}`);
  }
}

/**
 * Loads the session from the encrypted file and creates a new context.
 * Checks for session expiry.
 * @param {import('playwright').Browser} browser 
 * @param {Object} options - Context options
 * @param {string} [username] - The username to load session for
 * @returns {Promise<import('playwright').BrowserContext>}
 */
async function loadSession(browser, options = {}, username) {
  const filePath = getSessionPath(username);

  if (!fs.existsSync(filePath)) {
    logger.info(`No session file found for ${username || "default"}.`);
    return null;
  }

  try {
    const fileContent = fs.readFileSync(filePath, "utf-8");
    let sessionData;
    let state;

    // Try verifying if it is already JSON (legacy/plain)
    try {
      const parsed = JSON.parse(fileContent);
      
      // Check if it matches the new structure { timestamp, state }
      if (parsed.timestamp && parsed.state) {
        sessionData = parsed; // It was plain JSON but with new structure (unlikely but possible)
      } else {
        // It's the old structure (just storageState)
        state = parsed;
        logger.info("Loaded plain JSON session (Legacy).");
      }
    } catch (e) {
      // Not JSON, try decrypting
      const decrypted = decrypt(fileContent);
      if (decrypted) {
        try {
          const parsedDecrypted = JSON.parse(decrypted);
           // Check if it matches the new structure { timestamp, state }
          if (parsedDecrypted.timestamp && parsedDecrypted.state) {
            sessionData = parsedDecrypted;
          } else {
             // It's the old encrypted structure (just storageState)
             state = parsedDecrypted;
             logger.info("Loaded encrypted session (Legacy structure).");
          }
        } catch (parseError) {
           logger.error("Failed to parse decrypted session.");
           return null;
        }
      } else {
         logger.error("Failed to decrypt session file. It might be corrupt or key mismatch.");
         return null;
      }
    }

    // Process new structure if found
    if (sessionData) {
      const age = Date.now() - sessionData.timestamp;
      if (age > SESSION_MAX_AGE) {
        logger.warn(`Session expired. Age: ${age}ms > Max: ${SESSION_MAX_AGE}ms. Rejecting session.`);
        return null;
      }
      state = sessionData.state;
      logger.info(`Loaded active session for ${username || "default"} (Age: ${Math.round(age / 1000 / 60)} mins) 🔓.`);
    }

    const context = await browser.newContext({
      storageState: state,
      ...options
    });
    
    return context;
  } catch (error) {
    logger.error(`Error loading session: ${error.message}`);
    return null;
  }
}

module.exports = {
  sessionExists,
  getSessionPath,
  saveSession,
  loadSession
};