const fs = require("fs");
const path = require("path");

const SESSION_PATH = path.join(__dirname, "../../data/session.json");

function sessionExists() {
  return fs.existsSync(SESSION_PATH);
}

function saveSession(cookies) {
  fs.mkdirSync(path.dirname(SESSION_PATH), { recursive: true });
  fs.writeFileSync(SESSION_PATH, JSON.stringify(cookies, null, 2));
  console.log("Session saved successfully 💾");
}

function loadSession() {
  if (!sessionExists()) return null;

  const raw = fs.readFileSync(SESSION_PATH, "utf-8");
  return JSON.parse(raw);
}

module.exports = {
  sessionExists,
  saveSession,
  loadSession,
};
