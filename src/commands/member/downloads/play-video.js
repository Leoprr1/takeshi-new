const { PREFIX } = require(`${BASE_DIR}/config`);
const { InvalidParameterError, WarningError } = require(`${BASE_DIR}/errors`);
const yts = require("yt-search");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawn } = require("child_process");

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

      const maxGlobalAttempts = 5;
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

          if (lengthSeconds > 30 * 60) {
            throw new WarningError("El video dura más de 30 minutos.");
          }

          /* ===============================
             📁 ARCHIVO TEMP
          ================================ */

          const uniqueId = Date.now() + "_" + Math.floor(Math.random() * 9999);
          tempFile = path.join(os.tmpdir(), `${uniqueId}.mp4`);

          /* ===============================
             ⬇ DESCARGAR CON YT-DLP
          ================================ */

          const ytDlpPath = path.join(process.cwd(), "yt-dlp.exe");

          const args = [
            "-f", "mp4[height<=480]",
            "-o", tempFile.replace(/\\/g, "/"),
            videoUrl
          ];

          await new Promise((resolve, reject) => {

            const child = spawn(ytDlpPath, args, { windowsHide: true });

            child.stdout.on("data", (data) => {
              console.log("[yt-dlp-video]", data.toString());
            });

            child.stderr.on("data", (data) => {
              console.error("[yt-dlp-video]", data.toString());
            });

            child.on("error", (err) => {
              reject(new Error("Error al ejecutar yt-dlp: " + err.message));
            });

            child.on("close", (code) => {
              if (code === 0 && fs.existsSync(tempFile)) {
                resolve();
              } else {
                reject(new Error("No se pudo descargar el video. Código: " + code));
              }
            });

          });

          /* ===============================
             📤 ENVIAR
          ================================ */

          if (thumb) {
            await sendImageFromURL(
              thumb,
              `*Título*: ${title}\n*Duración*: ${lengthSeconds}s\n*Canal*: ${channel}\n*Calidad*: 480p`
            ).catch(() => {});
          }

          await sendVideoFromURL(tempFile);

          await sendSuccessReact();

          return;

        } catch (err) {

          console.error(`Error en play-video (intento ${globalAttempt}):`, err);

          if (globalAttempt >= 5) {
            await sendErrorReply(`❌ Ocurrió un error: ${err.message}`);
            return;
          }

          console.log("Reintentando comando completo play-video...");
          await new Promise(r => setTimeout(r, 1500));

        } finally {

          if (tempFile && fs.existsSync(tempFile)) {
            fs.unlinkSync(tempFile);
          }

        }

      }

    });

  },
};
