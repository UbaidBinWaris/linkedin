const { createLogger, format, transports } = require("winston");
const winston = require("winston");
const path = require("path");
const fs = require("fs");

const logDir = path.join(__dirname, "../../logs");

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Create default logger
const defaultLogger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.File({ filename: path.join(logDir, "error.log"), level: "error" }),
    new winston.transports.File({ filename: path.join(logDir, "combined.log") }),
  ],
});

let currentLogger = defaultLogger;

/**
 * Sets a custom logger instance.
 * @param {Object} customLogger - Logger object with info(), error(), warn(), debug() methods.
 */
function setLogger(customLogger) {
  if (customLogger && typeof customLogger.info === 'function') {
    currentLogger = customLogger;
  } else {
    console.warn("Invalid logger provided. Using default.");
  }
}

// Proxy object to forward calls to the current logger
const loggerProxy = {
  info: (msg) => currentLogger.info(msg),
  error: (msg) => currentLogger.error(msg),
  warn: (msg) => currentLogger.warn(msg),
  debug: (msg) => currentLogger.debug(msg),
  setLogger // Export configuration method
};

module.exports = loggerProxy;
