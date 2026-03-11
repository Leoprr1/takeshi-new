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
  name: "playtest",
  description: "Play audio directo desde YouTube con streaming",
  commands: ["playtest"],
  usage: `${PREFIX}playtest duki goteo`,

  handle: async (ctx) => {
    await queue.add(async () => {
      await executePlayDirect(ctx);
    });
  },
};

async function executePlayDirect({
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

  try {
    // ===============================
    // 🔎 Buscar video
    // ===============================
    let videoUrl, title, lengthSeconds, thumb, channel;
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

    // ===============================
    // 🔗 Preparar streaming directo
    // ===============================
    const ffmpegArgs = [
      "-i", `pipe:0`,
      "-c:a", "libopus",
      "-b:a", "128k",
      "-f", "opus",
      "pipe:1"
    ];

    // Ejecutar yt-dlp y ffmpeg en pipeline
    const ytDlp = spawn("yt-dlp", [
      "-f", "bestaudio",
      "-o", "-", // salida a stdout
      videoUrl
    ], { stdio: ['ignore', 'pipe', 'ignore'] });

    const ffmpeg = spawn(ffmpegPath, ffmpegArgs, { stdio: ['pipe', 'pipe', 'ignore'] });

    ytDlp.stdout.pipe(ffmpeg.stdin);

    const chunks = [];
    ffmpeg.stdout.on("data", chunk => chunks.push(chunk));
    ffmpeg.on("close", async code => {
      if (code !== 0) {
        await sendErrorReply("❌ Error al convertir audio a opus.");
        return;
      }

      const audioBuffer = Buffer.concat(chunks);

      // ===============================
      // 📤 Enviar audio
      // ===============================
      if (thumb) {
        await sendImageFromURL(
          thumb,
          `\`*Título*:\` ${title}\n\`*Duración*:\` ${Math.floor(lengthSeconds/60)}m ${lengthSeconds%60}s\n\`*Canal*:\` ${channel}`
        ).catch(() => {});
      }

      await socket.sendMessage(remoteJid, {
        audio: audioBuffer,
        mimetype: "audio/ogg; codecs=opus",
        ptt: true
      });

      await sendSuccessReact();
    });

  } catch (err) {
    console.error("Error en playtest:", err);
    await sendErrorReply(`❌ Ocurrió un error: ${err?.message || err}`);
  }
}

