const fs = require("fs");
const path = require("path");

const DB_PATH = path.resolve(__dirname, "groupStats.json");

// Crear archivo si no existe
if (!fs.existsSync(DB_PATH)) {
  fs.writeFileSync(DB_PATH, JSON.stringify({}, null, 2));
}

// Leer base de datos
function readDB() {
  try {
    const data = fs.readFileSync(DB_PATH);
    return JSON.parse(data);
  } catch (err) {
    return {};
  }
}

// Escribir base de datos
function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

const groupStats = readDB();

// 🔥 AUTOGUARDADO CADA 30 SEGUNDOS
setInterval(() => {
  writeDB(groupStats);
}, 30_000);

module.exports = groupStats;
