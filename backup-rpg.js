// backup-rpg.js
const fs = require("fs");
const path = require("path");

function createBackup() {
  const dbPath = path.join(__dirname, "src", "database", "rpg.json");
  const backupDir = path.dirname(dbPath);
  const date = new Date();
  const timestamp = date.toISOString().replace(/[:.]/g, "-");
  const backupFile = path.join(backupDir, `rpg-backup-${timestamp}.json`);

  fs.copyFile(dbPath, backupFile, (err) => {
    if (err) return console.error("❌ Error al crear backup:", err);

    console.log(`✅ Backup creado: ${backupFile}`);

    fs.readdir(backupDir, (err, files) => {
      if (err) return console.error("❌ Error leyendo carpeta:", err);

      const backups = files
        .filter(f => f.startsWith("rpg-backup-") && f.endsWith(".json"))
        .map(f => ({
          name: f,
          time: fs.statSync(path.join(backupDir, f)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time);

      if (backups.length > 40) {
        backups.slice(40).forEach(file => {
          const filePath = path.join(backupDir, file.name);
          fs.unlink(filePath, (err) => {
            if (err) console.error("⚠️ Error borrando backup viejo:", err);
            else console.log(`🗑️ Backup viejo eliminado: ${filePath}`);
          });
        });
      }
    });
  });
}

// 👉 Ejecuta el backup cada 30 minutos (1800000 ms)
setInterval(createBackup, 30 * 60 * 1000);

// Ejecuta uno al iniciar
createBackup();
