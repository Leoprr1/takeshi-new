const { PREFIX } = require(`${BASE_DIR}/config`);
const { InvalidParameterError, WarningError } = require(`${BASE_DIR}/errors`);
const ytdl = require("@distube/ytdl-core");
const yts = require("yt-search");
const fs = require("fs");
const path = require("path");
const os = require("os");

const queue = require(`${BASE_DIR}/utils/queue`);

module.exports = {
  name: "pv",
  description: "Descarga y envía video desde YouTube optimizado",
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

      if (!query) {
        throw new InvalidParameterError("¡Necesitas decirme qué video buscar!");
      }

      await sendWaitReact();

      const maxGlobalAttempts = 10;
      let globalAttempt = 0;

      while (globalAttempt < maxGlobalAttempts) {

        globalAttempt++;

        let tempFile;

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
          tempFile = path.join(os.tmpdir(), `${Date.now()}-${safeTitle}.mp4`);

          /* ===============================
             🔥 DESCARGA ESTABLE CON REINTENTO
          ================================ */

          let info;
          let formats;
          let attempts = 0;
          const maxAttempts = 15;

          while (attempts < maxAttempts) {
            attempts++;

            info = await ytdl.getInfo(videoUrl);
            formats = ytdl.filterFormats(info.formats, "audioandvideo");

            if (formats.length) break;

            console.log(`Reintentando formatos video (${attempts}/${maxAttempts})`);
            await new Promise(r => setTimeout(r, 700));
          }

          if (!formats || !formats.length) {
            throw new Error("No hay formatos de video disponibles");
          }

          formats = formats.filter(f => {
            if (!f.qualityLabel) return false;
            const height = parseInt(f.qualityLabel);
            return height <= 480;
          });

          if (!formats.length) {
            throw new Error("No hay formatos 360p/480p disponibles");
          }

          formats.sort((a, b) => {
            const hA = parseInt(a.qualityLabel) || 9999;
            const hB = parseInt(b.qualityLabel) || 9999;
            return hA - hB;
          });

          const selectedFormat = formats[0];

          const stream = ytdl.downloadFromInfo(info, {
            format: selectedFormat,
            highWaterMark: 1 << 24
          });

          const writeStream = fs.createWriteStream(tempFile);

          await new Promise((resolve, reject) => {

            stream.pipe(writeStream);

            writeStream.on("finish", resolve);
            writeStream.on("error", reject);
            stream.on("error", reject);

          });

          if (thumb) {
            await sendImageFromURL(
              thumb,
              `*Título*: ${title}\n*Duración*: ${lengthSeconds}s\n*Canal*: ${channel}\n*Calidad*: ${selectedFormat.qualityLabel}`
            ).catch(() => {});
          }

          await sendVideoFromURL(tempFile);

          await sendSuccessReact();

          if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);

          return; // ✅ éxito → salir del loop

        } catch (err) {

          console.error(`Error en play-video (intento ${globalAttempt}):`, err);

          if (tempFile && fs.existsSync(tempFile)) {
            fs.unlinkSync(tempFile);
          }

          if (globalAttempt >= maxGlobalAttempts) {
            await sendErrorReply(`❌ Ocurrió un error: ${err.message}`);
            return;
          }

          console.log("Reintentando comando completo play-video...");
          await new Promise(r => setTimeout(r, 1500));
        }

      }

    });

  },
};
