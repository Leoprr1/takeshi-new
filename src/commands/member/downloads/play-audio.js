const { PREFIX } = require(`${BASE_DIR}/config`);
const { InvalidParameterError, WarningError } = require(`${BASE_DIR}/errors`);
const yts = require("yt-search");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawn } = require("child_process");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;

const queue = require(`${BASE_DIR}/utils/queue`);

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

    let tempBase;
    let finalFile;

    try {
      let videoUrl;
      let title;
      let lengthSeconds;
      let thumb;
      let channel;

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
         📁 TEMP FILE BASE
      ================================ */
      const uniqueId = Date.now() + "_" + Math.floor(Math.random() * 9999);
      tempBase = path.join(os.tmpdir(), `${uniqueId}.ogg`);

      // ESTE ES EL ARCHIVO REAL FINAL
      finalFile = tempBase + ".opus";

      /* ===============================
         ⬇ DESCARGAR CON YT-DLP
      ================================ */
      const ytDlpPath = path.join(process.cwd(), "yt-dlp.exe");

      const args = [
        "-f", "bestaudio",
        "-x",
        "--audio-format", "opus",
        "--audio-quality", "0",
        "--ffmpeg-location", ffmpegPath,
        "-o", tempBase.replace(/\\/g, "/"),
        videoUrl
      ];

      await new Promise((resolve, reject) => {
        const child = spawn(ytDlpPath, args, { windowsHide: true });

        child.stdout.on("data", (data) => {
          console.log("[yt-dlp]", data.toString());
        });

        child.stderr.on("data", (data) => {
          console.error("[yt-dlp]", data.toString());
        });

        child.on("error", (err) => {
          reject(new Error("Error al ejecutar yt-dlp: " + err.message));
        });

        child.on("close", (code) => {
          if (code === 0 && fs.existsSync(finalFile)) {
            resolve();
          } else {
            reject(new Error("No se pudo descargar el audio. Código de salida: " + code));
          }
        });
      });

      const buffer = fs.readFileSync(finalFile);

      if (thumb) {
        await sendImageFromURL(
          thumb,
          `*Título*: ${title}\n*Duración*: ${lengthSeconds}s\n*Canal*: ${channel}`
        ).catch(() => {});
      }

      await socket.sendMessage(remoteJid, {
        audio: buffer,
        mimetype: "audio/ogg; codecs=opus",
        ptt: true,
      });

      await sendSuccessReact();
      return;

    } catch (err) {
      console.error(`Error en play (intento ${globalAttempt}):`, err);

      if (globalAttempt >= maxGlobalAttempts) {
        const msg = err?.message || String(err);
        await sendErrorReply(`❌ Ocurrió un error: ${msg}`);
        return;
      }

      console.log("Reintentando comando completo...");
      await new Promise(r => setTimeout(r, 1500));

    } finally {
      if (finalFile && fs.existsSync(finalFile)) fs.unlinkSync(finalFile);
    }
  }
}
