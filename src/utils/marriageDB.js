const fs = require("fs");
const path = require("path");

const DB_PATH = path.resolve(__dirname, "..", "database", "marriages.json");

function readDB() {
  if (!fs.existsSync(DB_PATH)) return {};
  return JSON.parse(fs.readFileSync(DB_PATH));
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function isMarried(user) {
  const db = readDB();
  return !!db[user];
}

function getMarriage(user) {
  const db = readDB();
  return db[user] || null;
}

function marry(user1, user2) {
  const db = readDB();
  const now = Date.now();

  db[user1] = {
    partner: user2,
    since: now
  };

  db[user2] = {
    partner: user1,
    since: now
  };

  writeDB(db);
}

function divorce(user) {
  const db = readDB();
  const data = db[user];

  if (data) {
    delete db[user];
    delete db[data.partner];
    writeDB(db);
  }
}

module.exports = {
  isMarried,
  getMarriage,
  marry,
  divorce
};
