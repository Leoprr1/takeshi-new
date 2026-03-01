const { PREFIX } = require(`${BASE_DIR}/config`);
const { InvalidParameterError, WarningError } = require(`${BASE_DIR}/errors`);
const ytdl = require("@distube/ytdl-core");
const yts = require("yt-search");
const fs = require("fs");
const path = require("path");
const os = require("os");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;

// 🔥 IMPORTAMOS LA COLA GLOBAL
const queue = require(`${BASE_DIR}/utils/queue`);

ffmpeg.setFfmpegPath(ffmpegPath);

module.exports = {
  name: "pm",
  description: "Descarga y envía audio desde YouTube optimizado",
  commands: ["pm", "play", "pa"],
  usage: `${PREFIX}play duki goteo`,

  handle: async (ctx) => {

    // 🔥 TODO pasa por la cola
    await queue.add(async () => {
      await executePlay(ctx);
    });

  },
};


/* ===============================
   🎵 LÓGICA REAL DEL PLAY
================================ */

async function executePlay({
  socket,
  remoteJid,
  sendImageFromURL,
  fullArgs,
  sendWaitReact,
  sendSuccessReact,
  sendErrorReply,
}) {

  const queryRaw = Array.isArray(fullArgs)
    ? fullArgs.join(" ")
    : String(fullArgs || "");

  const query = queryRaw.trim();

  if (!query) {
    throw new InvalidParameterError("¡Necesitas decirme qué canción buscar!");
  }

  await sendWaitReact();

  let tempMp3;
  let tempOgg;

  try {

    let videoUrl;
    let title;
    let lengthSeconds;
    let thumb;
    let channel;

    /* ===============================
       🔎 BUSCAR VIDEO
    ================================ */

    if (ytdl.validateURL(query)) {

      videoUrl = query;
      const basic = await yts({ videoId: ytdl.getURLVideoID(query) });

      title = basic.title;
      lengthSeconds = basic.seconds;
      thumb = basic.thumbnail;
      channel = basic.author?.name || "Desconocido";

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

    if (lengthSeconds > 30 * 60) {
      throw new WarningError("El audio dura más de 30 minutos.");
    }

    /* ===============================
       📁 TEMP FILES
    ================================ */

    const uniqueId = Date.now() + "_" + Math.floor(Math.random() * 9999);
    tempMp3 = path.join(os.tmpdir(), `${uniqueId}.mp3`);
    tempOgg = path.join(os.tmpdir(), `${uniqueId}.ogg`);

    /* ===============================
       ⬇ DESCARGA MÁS LIVIANA POSIBLE
    ================================ */

    const stream = ytdl(videoUrl, {
      quality: "lowestvideo",
      filter: "audioandvideo",
      highWaterMark: 1 << 25
    });

    await new Promise((resolve, reject) => {
      ffmpeg(stream)
        .audioCodec("libmp3lame")
        .audioBitrate(96)
        .format("mp3")
        .outputOptions([
          "-vbr on",
          "-compression_level 10"
        ])
        .on("error", reject)
        .on("end", resolve)
        .save(tempMp3);
    });

    /* ===============================
       🔥 CONVERTIR A OPUS
    ================================ */

    await new Promise((resolve, reject) => {
      ffmpeg(tempMp3)
        .audioCodec("libopus")
        .audioBitrate(96)
        .audioFrequency(48000)
        .audioChannels(2)
        .format("ogg")
        .outputOptions([
          "-vbr on",
          "-compression_level 10"
        ])
        .on("error", reject)
        .on("end", resolve)
        .save(tempOgg);
    });

    /* ===============================
       📤 ENVIAR AUDIO + IMAGEN JUNTOS
    ================================ */

    const buffer = fs.readFileSync(tempOgg);

    const sendTasks = [];
    

   // 🖼 1️⃣ Enviar imagen primero y esperar confirmación
if (thumb) {
  await sendImageFromURL(
    thumb,
    `*Título*: ${title}\n*Duración*: ${lengthSeconds}s\n*Canal*: ${channel}`
  ).catch(() => {});
}

// 🎵 2️⃣ Enviar audio inmediatamente después
await socket.sendMessage(remoteJid, {
  audio: buffer,
  mimetype: "audio/ogg; codecs=opus",
  ptt: true
});

    // 🔥 Espera a que ambos terminen antes de liberar la cola
    await Promise.all(sendTasks);

    await sendSuccessReact();

  } catch (err) {
    console.error("Error en play:", err);
    const msg = err?.message || String(err);
    await sendErrorReply(`❌ Ocurrió un error: ${msg}`);
  } finally {
    if (tempMp3 && fs.existsSync(tempMp3)) fs.unlinkSync(tempMp3);
    if (tempOgg && fs.existsSync(tempOgg)) fs.unlinkSync(tempOgg);
  }
}
