const fs = require("fs");
const path = require("path");
const { getRandomName } = require(`${BASE_DIR}/utils`);
const { InvalidParameterError } = require(`${BASE_DIR}/errors`);
const { PREFIX, TEMP_DIR } = require(`${BASE_DIR}/config`);
const Ffmpeg = require(`${BASE_DIR}/services/ffmpeg`);

module.exports = {
  name: "toimage",
  description: "Convierte stickers estáticos o animados a PNG o GIF",
  commands: ["toimage", "toimg"],
  usage: `${PREFIX}toimage (responde a un sticker)`,

  handle: async ({
    isSticker,
    downloadSticker,
    webMessage,
    sendWaitReact,
    sendSuccessReact,
    sendImageFromFile,
    sendErrorReply,
  }) => {
    if (!isSticker) {
      throw new InvalidParameterError("¡Necesitas enviar un sticker!");
    }

    await sendWaitReact();

    const outputBase = getRandomName();
    const outputPath = path.resolve(TEMP_DIR, outputBase);
    let inputPath = null;

    try {
      // -------------------
      // DESCARGAR STICKER
      // -------------------
      inputPath = await downloadSticker(webMessage, "input");

      if (!fs.existsSync(inputPath) || fs.statSync(inputPath).size === 0) {
        throw new Error("El sticker descargado está vacío o corrupto");
      }

      // -------------------
      // DETECTAR SI ES ANIMADO (WebP animado = VP8 + ANIM chunk)
      // -------------------
      const buffer = await fs.promises.readFile(inputPath);
      const isAnimated = buffer.includes(Buffer.from("VP8L")) || buffer.includes(Buffer.from("VP8X"));

      const finalOutput = isAnimated ? `${outputPath}.gif` : `${outputPath}.png`;

      // -------------------
      // CONVERTIR SEGÚN TIPO
      // -------------------
      if (isAnimated) {
        await Ffmpeg.convertWebpToGif(inputPath, finalOutput); // ahora maneja WebP animado correctamente
      } else {
        await Ffmpeg.convertWebpToPng(inputPath, finalOutput);
      }

      if (!fs.existsSync(finalOutput)) {
        throw new Error("FFmpeg no creó el archivo de salida");
      }

      await sendSuccessReact();
      await sendImageFromFile(finalOutput);

      // -------------------
      // LIMPIEZA
      // -------------------
      await Ffmpeg.cleanup(inputPath);
      await Ffmpeg.cleanup(finalOutput);

    } catch (err) {
      console.error("[TOIMAGE ERROR]", err);
      if (inputPath && fs.existsSync(inputPath)) await Ffmpeg.cleanup(inputPath);
      return sendErrorReply(`❌ Error al procesar el sticker: ${err.message}`);
    }
  },
};
