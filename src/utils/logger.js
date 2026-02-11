const { createLogger, format, transports } = require("winston");
const path = require("path");
const fs = require("fs");

const logDir = path.join(__dirname, "../../logs");

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logger = createLogger({
  level: "info",
  format: format.combine(
    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}] ${message}`;
    })
  ),
  transports: [
    new transports.File({
      filename: path.join(logDir, "error.log"),
      level: "error",
    }),
    new transports.File({
      filename: path.join(logDir, "combined.log"),
    }),
  ],
});

module.exports = logger;
