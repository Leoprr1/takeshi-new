const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

let hasRun = false; // 🔥 evita doble ejecución

function getFileInfo(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return {
      sizeMB: (stats.size / 1024 / 1024).toFixed(2),
      modified: stats.mtime.toLocaleString(),
    };
  } catch {
    return null;
  }
}

function getYtDlpVersion(filePath) {
  return new Promise((resolve) => {
    const proc = spawn(filePath, ["--version"], {
      windowsHide: true,
    });

    let output = "";

    proc.stdout.on("data", (data) => {
      output += data.toString();
    });

    proc.on("close", () => {
      resolve(output.trim() || "desconocida");
    });

    proc.on("error", () => {
      resolve("error leyendo versión");
    });
  });
}

async function updateYtDlp(options = {}) {
  const {
    fileName = "yt-dlp.exe",
    delay = 5000,
  } = options;

  if (hasRun) return; // 🔥 solo una vez
  hasRun = true;

  const ytPath = path.join(process.cwd(), fileName);

  if (!fs.existsSync(ytPath)) {
    console.log("⚠️ yt-dlp.exe no encontrado en el proyecto");
    return;
  }

  setTimeout(async () => {

    console.log("\n🔄 ================================");
    console.log("🔄 YT-DLP UPDATER INICIADO");
    console.log("🔄 ================================\n");

    // 📌 versión antes
    const beforeVersion = await getYtDlpVersion(ytPath);
    const beforeInfo = getFileInfo(ytPath);

    console.log("📦 Versión actual:", beforeVersion);
    console.log("📅 Fecha archivo:", beforeInfo?.modified);
    console.log("💾 Tamaño:", beforeInfo?.sizeMB + " MB\n");

    const updater = spawn(ytPath, ["-U"], {
      windowsHide: true
    });

    updater.stdout.on("data", (data) => {
      console.log(`[yt-dlp] ${data.toString()}`);
    });

    updater.stderr.on("data", (data) => {
      console.log(`[yt-dlp ERROR] ${data.toString()}`);
    });

    updater.on("close", async (code) => {

      console.log("\n🔄 ================================");

      if (code === 0) {
        console.log("✅ Actualización completada");

        // 📌 versión después
        const afterVersion = await getYtDlpVersion(ytPath);
        const afterInfo = getFileInfo(ytPath);

        console.log("📦 Nueva versión:", afterVersion);
        console.log("📅 Nueva fecha:", afterInfo?.modified);
        console.log("💾 Tamaño:", afterInfo?.sizeMB + " MB");

      } else {
        console.log(`⚠️ yt-dlp terminó con código: ${code}`);
      }

      console.log("🔄 ================================\n");
    });

    updater.on("error", (err) => {
      console.error("❌ Error ejecutando yt-dlp:", err.message);
    });

  }, delay);
}

module.exports = updateYtDlp;
