const { PREFIX } = require(`${BASE_DIR}/config`);
const { InvalidParameterError, WarningError } = require(`${BASE_DIR}/errors`);
const ytdl = require("@distube/ytdl-core");
const yts = require("yt-search");
const fs = require("fs");
const path = require("path");
const os = require("os");

// 🔥 IMPORTAMOS LA COLA (IGUAL QUE PM)
const queue = require(`${BASE_DIR}/utils/queue`);

module.exports = {
  name: "pv",
  description: "Descarga y envía video desde YouTube optimizado",
  commands: ["pv", "playv"],
  usage: `${PREFIX}play-video duki goteo`,

  handle: async (ctx) => {

    // 🔥 EXACTAMENTE IGUAL QUE PM
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

      if (!query) {
        throw new InvalidParameterError("¡Necesitas decirme qué video buscar!");
      }

      await sendWaitReact();

      try {

        let videoUrl;
        let title;
        let lengthSeconds;
        let thumb;
        let channel;

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
          throw new WarningError("El video dura más de 30 minutos. Prueba con uno más corto.");
        }

        const safeTitle = title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
        const tempFile = path.join(os.tmpdir(), `${Date.now()}-${safeTitle}.mp4`);

        const stream = ytdl(videoUrl, {
          quality: "18",
          filter: "audioandvideo",
          highWaterMark: 1 << 24
        });

        const writeStream = fs.createWriteStream(tempFile);

        stream.pipe(writeStream);

        writeStream.on("finish", async () => {
  try {

    const sendTasks = [];

      // 🖼 1️⃣ Enviar imagen primero
    if (thumb) {
      await sendImageFromURL(
        thumb,
        `*Título*: ${title}\n*Duración*: ${lengthSeconds}s\n*Canal*: ${channel}`
      ).catch(() => {});
    }

    // 🎬 2️⃣ Enviar video inmediatamente después
    await sendVideoFromURL(tempFile);


    // 🔥 Espera que ambos terminen
    await Promise.all(sendTasks);

    await sendSuccessReact();

          } catch (err) {
            console.error("Error enviando video:", err);
            await sendErrorReply("❌ Error al enviar el video.");
          } finally {
            if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
          }
        });

        stream.on("error", async (err) => {
          console.error("Error en descarga:", err);
          await sendErrorReply("❌ Error al descargar el video.");
          if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
        });

      } catch (err) {
        console.error("Error en play-video:", err);
        await sendErrorReply("❌ Ocurrió un error al reproducir el video.");
      }

    });

  },
};
