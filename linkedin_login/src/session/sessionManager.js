const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const logger = require("../utils/logger");
const SessionLock = require("./SessionLock"); // Keeping specific import, though widely used via login

let sessionDir = path.join(process.cwd(), "data", "linkedin");

/**
 * Sets the directory where session files are stored.
 * @param {string} dirPath - Absolute path to the session directory.
 */
function setSessionDir(dirPath) {
  sessionDir = dirPath;
}

const ALGORITHM = "aes-256-cbc";
const SECRET_KEY = process.env.SESSION_SECRET || "default_insecure_secret_key_32_bytes_long!!";
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
    return null;
  }
}

/**
 * Generates a SHA-256 hash of the email to use as filename.
 * Privacy + filesystem safety.
 * @param {string} email 
 * @returns {string} hex hash
 */
function getSessionHash(email) {
  if (!email) return "default";
  return crypto.createHash("sha256").update(email).digest("hex");
}

function getSessionPath(email) {
  const filename = `${getSessionHash(email)}.json`;
  return path.join(sessionDir, filename);
}

function sessionExists(email) {
  return fs.existsSync(getSessionPath(email));
}

const { SESSION_MAX_AGE } = require("../config"); // Assuming this exists, typically 7 days?

// Validation Cache Duration (10 minutes)
const VALIDATION_CACHE_MS = 10 * 60 * 1000;

const defaultStorage = {
  async read(email) {
    const filePath = getSessionPath(email);
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath, "utf-8");
  },
  
  async write(email, data) {
    const filePath = getSessionPath(email);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, data, "utf-8");
  }
};

let currentStorage = defaultStorage;

function setSessionStorage(adapter) {
  if (adapter && typeof adapter.read === 'function' && typeof adapter.write === 'function') {
    currentStorage = adapter;
  } else {
    logger.warn("Invalid storage adapter provided. Using default file storage.");
  }
}

/**
 * Saves the browser context state.
 * @param {import('playwright').BrowserContext} context 
 * @param {string} email 
 * @param {boolean} [isValidated] - If true, updates lastValidatedAt
 */
async function saveSession(context, email, isValidated = false) {
  try {
    const state = await context.storageState();
    
    // Load existing metadata if possible to preserve creation time? 
    // For now, simpler to just overwrite, but we might lose 'createdAt' if we had it.
    // Let's just write new.
    
    const sessionData = {
      timestamp: Date.now(), // Last saved
      lastValidatedAt: isValidated ? Date.now() : undefined,
      state: state
      // Future: proxy binding here
    };

    const jsonString = JSON.stringify(sessionData);
    const encryptedData = encrypt(jsonString);
    
    await currentStorage.write(email || "default", encryptedData);

    logger.info(`Session saved for ${email} (Validated: ${isValidated}) 🔒`);
  } catch (error) {
    logger.error(`Failed to save session: ${error.message}`);
  }
}

/**
 * Loads the session.
 * @returns {Promise<{ context: import('playwright').BrowserContext, needsValidation: boolean }>}
 */
async function loadSession(browser, options = {}, email) {
  const user = email || "default";

  try {
    const fileContent = await currentStorage.read(user);
    
    if (!fileContent) {
      logger.info(`No session found for ${user}.`);
      return null;
    }

    let sessionData = null;
    let state = null;

    // Decrypt
    const decrypted = decrypt(fileContent);
    if (decrypted) {
      try {
        sessionData = JSON.parse(decrypted);
      } catch (e) {
        logger.error("Failed to parse session JSON.");
        return null;
      }
    } else {
        // Fallback for legacy plain JSON? 
        try {
            sessionData = JSON.parse(fileContent);
        } catch(e) {}
    }

    if (!sessionData || !sessionData.state) {
        logger.warn("Invalid or corrupt session data.");
        return null;
    }

    // Check Age (Total expiry)
    const age = Date.now() - sessionData.timestamp;
    if (SESSION_MAX_AGE && age > SESSION_MAX_AGE) {
         logger.warn(`Session expired (Age: ${age}ms).`);
         return null;
    }

    state = sessionData.state;

    // Check Validation Freshness
    let needsValidation = true;
    if (sessionData.lastValidatedAt) {
        const valAge = Date.now() - sessionData.lastValidatedAt;
        if (valAge < VALIDATION_CACHE_MS) {
            needsValidation = false;
            logger.info(`Session validation cached (Age: ${Math.round(valAge/1000)}s). Skipping checks.`);
        }
    }

    const context = await browser.newContext({
      storageState: state,
      ...options
    });
    
    // Attach metadata to context for caller to check? 
    // Or return object? Returning object is a breaking change for internal API but we are in v2.
    // Let's attach to context object directly as a property for convenience
    context.needsValidation = needsValidation;
    
    return context;

  } catch (error) {
    logger.error(`Error loading session: ${error.message}`);
    return null;
  }
}

module.exports = {
  setSessionDir,
  setSessionStorage,
  sessionExists,
  getSessionPath,
  saveSession,
  loadSession,
  SessionLock
};