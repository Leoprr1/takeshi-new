const { PREFIX } = require(`${BASE_DIR}/config`);
const { InvalidParameterError, WarningError } = require(`${BASE_DIR}/errors`);
const yts = require("yt-search");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawn, exec } = require("child_process");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;

const queue = require(`${BASE_DIR}/utils/queue`);

const CACHE_DIR = path.join(__dirname, "../../cache/video");
const MAX_CACHE_MB = 200;
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

module.exports = {
  name: "pv",
  description: "Descarga y envía video MP4 desde YouTube optimizado",
  commands: ["pv", "playv"],
  usage: `${PREFIX}play-video duki goteo`,

  handle: async (ctx) => {
    await queue.add(async () => {
      const {
        sendVideoFromURL,
        sendImageFromURL,
        fullArgs,
        sendWaitReact,
        sendSuccessReact,
        sendErrorReply,
      } = ctx;

      const query = Array.isArray(fullArgs)
        ? fullArgs.join(" ").trim()
        : String(fullArgs || "").trim();

      if (!query) throw new InvalidParameterError("¡Necesitas decirme qué video buscar!");
      await sendWaitReact();

      const maxGlobalAttempts = 5;
      let globalAttempt = 0;

      while (globalAttempt < maxGlobalAttempts) {
        globalAttempt++;
        let tempFile;
        let finalFile;
        let cacheFile;
        let fileSizeBytes;
        let resolution = "Desconocida";

        try {
          let videoUrl, title, lengthSeconds, thumb, channel;

          /* ===============================
             🔎 BUSCAR VIDEO
          ================================ */
          if (/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)/.test(query)) {
            videoUrl = query;
            const basic = await yts({ videoId: query.split("v=")[1]?.split("&")[0] });
            title = basic?.title || "Desconocido";
            lengthSeconds = basic?.seconds || 0;
            thumb = basic?.thumbnail;
            channel = basic?.author?.name || "Desconocido";
          } else {
            const res = await yts(query);
            const vid = res?.videos?.[0];
            if (!vid) {
              await sendErrorReply("❌ No encontré resultados en YouTube.");
              return;
            }
            videoUrl = vid.url;
            title = vid.title;
            lengthSeconds = vid.seconds;
            thumb = vid.thumbnail;
            channel = vid.author?.name || "Desconocido";
          }

          if (lengthSeconds > 30 * 60) throw new WarningError("El video dura más de 30 minutos.");

          /* ===============================
             🔑 CACHE
          ================================ */
          const safeTitle = title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
          cacheFile = path.join(CACHE_DIR, `${safeTitle}.mp4`);

          if (fs.existsSync(cacheFile)) {
            console.log("⚡ Usando video cacheado");
            finalFile = cacheFile;
            const stats = fs.statSync(finalFile);
            fileSizeBytes = stats.size;
            resolution = await getVideoResolution(finalFile);
          } else {
            const uniqueId = Date.now() + "_" + Math.floor(Math.random() * 9999);
            tempFile = path.join(os.tmpdir(), `${uniqueId}.mp4`);
            finalFile = tempFile;

            /* ===============================
               ⬇ DESCARGAR VIDEO DIRECTO
            ================================ */
            const ytDlpPath = path.join(process.cwd(), "yt-dlp.exe");
            const args = [
              "-f", "mp4[height<=480]/best[height<=480]",
              "--no-playlist",
              "--quiet",
              "-o", tempFile.replace(/\\/g, "/"),
              videoUrl
            ];

            await new Promise((resolve, reject) => {
              const child = spawn(ytDlpPath, args, {
                windowsHide: true,
                stdio: "ignore",
                creationFlags: 0x08000000
              });

              child.on("error", err => reject(new Error("Error al ejecutar yt-dlp: " + err.message)));
              child.on("close", code => {
                if (code === 0 && fs.existsSync(tempFile)) resolve();
                else reject(new Error("No se pudo descargar el video. Código: " + code));
              });
            });

            /* ===============================
               💾 GUARDAR EN CACHE
            ================================ */
            fs.copyFileSync(tempFile, cacheFile);
            cleanCache();

            const stats = fs.statSync(finalFile);
            fileSizeBytes = stats.size;
            resolution = await getVideoResolution(finalFile);
          }

          /* ===============================
             📤 ENVIAR IMAGEN Y VIDEO
          ================================ */
          const minutes = Math.floor(lengthSeconds / 60);
          const seconds = lengthSeconds % 60;
          const fileSizeMB = (fileSizeBytes / (1024 * 1024)).toFixed(2);

          if (thumb) {
            await sendImageFromURL(
              thumb,
              `\`*Título*:\` ${title}
\`*Duración*:\` ${minutes}m ${seconds}s
\`*Canal*:\` ${channel}
\`*Calidad*:\` ${resolution}
\`*Peso*:\` ${fileSizeMB}MB`
            ).catch(() => {});
          }

          await sendVideoFromURL(finalFile);
          await sendSuccessReact();
          return;

        } catch (err) {
          console.error(`Error en play-video (intento ${globalAttempt}):`, err);
          if (globalAttempt >= maxGlobalAttempts) {
            await sendErrorReply(`❌ Ocurrió un error: ${err.message}`);
            return;
          }
          console.log("Reintentando comando completo...");
          await new Promise(r => setTimeout(r, 1500));
        } finally {
          if (tempFile && fs.existsSync(tempFile) && tempFile !== cacheFile) fs.unlinkSync(tempFile);
        }
      }
    });
  },
};

/* ===============================
   🧹 LIMPIEZA CACHE 200MB
=============================== */
function cleanCache() {
  if (!fs.existsSync(CACHE_DIR)) return;

  const files = fs.readdirSync(CACHE_DIR).map(file => {
    const filePath = path.join(CACHE_DIR, file);
    const stats = fs.statSync(filePath);
    return { path: filePath, size: stats.size, mtime: stats.mtimeMs };
  });

  let totalSize = files.reduce((acc, f) => acc + f.size, 0);
  const maxBytes = MAX_CACHE_MB * 1024 * 1024;
  if (totalSize <= maxBytes) return;

  files.sort((a, b) => a.mtime - b.mtime);
  for (const file of files) {
    if (totalSize <= maxBytes) break;
    fs.unlinkSync(file.path);
    totalSize -= file.size;
  }

  console.log("🧹 Cache de video limpiado automáticamente (200MB máximo).");
}

/* ===============================
   🔍 FUNCIONES AUXILIARES
=============================== */
function getVideoResolution(filePath) {
  return new Promise((resolve) => {
    exec(`"${ffmpegPath}" -i "${filePath}" 2>&1`, (err, stdout, stderr) => {
      const info = stderr || stdout;
      const match = info.match(/Stream.*Video.* (\d{2,5})x(\d{2,5})/i);
      if (match) resolve(`${match[2]}p`);
      else resolve("Desconocida");
    });
  });
}
