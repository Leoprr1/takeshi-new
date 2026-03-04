const { PREFIX } = require(`${BASE_DIR}/config`);
const { InvalidParameterError, WarningError } = require(`${BASE_DIR}/errors`);
const yts = require("yt-search");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawn, exec } = require("child_process");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;

const queue = require(`${BASE_DIR}/utils/queue`);

const CACHE_DIR = path.join(__dirname, "../../cache/audio");
const MAX_CACHE_MB = 100;
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

module.exports = {
  name: "pm",
  description: "Descarga y envía audio desde YouTube optimizado",
  commands: ["pm", "play", "pa"],
  usage: `${PREFIX}play duki goteo`,

  handle: async (ctx) => {
    await queue.add(async () => {
      await executePlay(ctx);
    });
  },
};

async function executePlay({
  socket,
  remoteJid,
  sendImageFromURL,
  fullArgs,
  sendWaitReact,
  sendSuccessReact,
  sendErrorReply,
}) {
  const queryRaw = Array.isArray(fullArgs) ? fullArgs.join(" ") : String(fullArgs || "");
  const query = queryRaw.trim();
  if (!query) throw new InvalidParameterError("¡Necesitas decirme qué canción buscar!");

  await sendWaitReact();

  const maxGlobalAttempts = 5;
  let globalAttempt = 0;

  while (globalAttempt < maxGlobalAttempts) {
    globalAttempt++;

    let tempFile;
    let finalFile;
    let cacheFile;

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

      if (lengthSeconds > 30 * 60)
        throw new WarningError("El audio dura más de 30 minutos.");

      /* ===============================
         🔑 CACHE
      ================================ */
      const safeTitle = title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
      cacheFile = path.join(CACHE_DIR, `${safeTitle}.opus`);

      let fileSizeBytes;
      let audioBitrate = "Desconocido";

      if (fs.existsSync(cacheFile)) {
        console.log("⚡ Usando audio cacheado");
        finalFile = cacheFile;
        const stats = fs.statSync(finalFile);
        fileSizeBytes = stats.size;

        // Detectar bitrate automáticamente
        audioBitrate = await getAudioBitrate(finalFile);
      } else {
        /* ===============================
           📁 TEMP FILE BASE
        ================================ */
        const uniqueId = Date.now() + "_" + Math.floor(Math.random() * 9999);
        tempFile = path.join(os.tmpdir(), `${uniqueId}.m4a`);
        finalFile = path.join(os.tmpdir(), `${uniqueId}.opus`);

        /* ===============================
           ⬇ DESCARGAR CON YT-DLP
        ================================ */
        const ytDlpPath = path.join(process.cwd(), "yt-dlp.exe");
        const args = [
          "-f", "bestaudio[ext=m4a]/bestaudio",
          "--no-playlist",
          "--concurrent-fragments", "4",
          "--retries", "5",
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

          child.on("error", (err) => reject(new Error("Error al ejecutar yt-dlp: " + err.message)));
          child.on("close", (code) => {
            if (code === 0 && fs.existsSync(tempFile)) resolve();
            else reject(new Error(`No se pudo descargar el audio. Código: ${code}`));
          });
        });

        /* ===============================
           🔊 CONVERTIR A OPUS
        ================================ */
        await new Promise((resolve, reject) => {
          const ff = spawn(ffmpegPath, [
            "-i", tempFile,
            "-c:a", "libopus",
            "-b:a", "128k",
            finalFile
          ], {
            windowsHide: true,
            stdio: "ignore",
            creationFlags: 0x08000000
          });

          ff.on("error", reject);
          ff.on("close", code => code === 0 ? resolve() : reject(new Error("Error convirtiendo a opus")));
        });

        const stats = fs.statSync(finalFile);
        fileSizeBytes = stats.size;

        audioBitrate = await getAudioBitrate(finalFile);

        fs.copyFileSync(finalFile, cacheFile);
        cleanCache();
        fs.unlinkSync(tempFile); // limpiar temporal m4a
      }

      /* ===============================
         🔗 ENVIAR IMAGEN Y AUDIO
      ================================ */
      const minutes = Math.floor(lengthSeconds / 60);
      const seconds = lengthSeconds % 60;
      const fileSizeMB = (fileSizeBytes / (1024 * 1024)).toFixed(2);

      if (thumb) {
        await sendImageFromURL(
          thumb,
          `*Título*: ${title}\n*Duración*: ${minutes}m ${seconds}s\n*Canal*: ${channel}\n*Bitrate*: ${audioBitrate}\n*Peso*: ${fileSizeMB}MB`
        ).catch(() => {});
      }

      await socket.sendMessage(remoteJid, {
        audio: fs.readFileSync(finalFile),
        mimetype: "audio/ogg; codecs=opus",
        ptt: true
      });

      await sendSuccessReact();
      return;

    } catch (err) {
      console.error(`Error en play (intento ${globalAttempt}):`, err);
      if (globalAttempt >= maxGlobalAttempts) {
        await sendErrorReply(`❌ Ocurrió un error: ${err?.message || err}`);
        return;
      }
      console.log("Reintentando comando completo...");
      await new Promise(r => setTimeout(r, 1500));
    } finally {
      if (finalFile && fs.existsSync(finalFile) && finalFile !== cacheFile) fs.unlinkSync(finalFile);
    }
  }
}

/* ===============================
   🧹 LIMPIEZA DE CACHE
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

  console.log("🧹 Cache limpiado automáticamente para no superar 100MB.");
}

/* ===============================
   🔍 FUNCIONES AUXILIARES
=============================== */

function getAudioBitrate(filePath) {
  return new Promise((resolve) => {
    exec(`"${ffmpegPath}" -i "${filePath}" 2>&1`, (err, stdout, stderr) => {
      const info = stderr || stdout;
      const match = info.match(/bitrate:\s*(\d+ kb\/s)/i);
      if (match) resolve(match[1]);
      else resolve("Desconocido");
    });
  });
}
