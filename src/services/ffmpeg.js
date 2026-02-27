/**
 * Servicios de procesamiento de media con solo ffmpeg.
 *
 * Todas las funciones dependen únicamente del binario de ffmpeg.
 */
const fs = require("node:fs");
const path = require("node:path");
const ffmpeg = require("fluent-ffmpeg");
const { exec } = require("node:child_process");

// Binario de ffmpeg centralizado
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
ffmpeg.setFfmpegPath(ffmpegPath);

const { getRandomNumber } = require("../utils");
const { errorLog } = require("../utils/logger");
const { TEMP_DIR } = require(`${BASE_DIR}/config`);

class FfmpegService {
  constructor() {
    this.tempDir = TEMP_DIR;
  }

  // -------------------
  // CREAR RUTA TEMPORAL
  // -------------------
  async _createTempFilePath(extension = "png") {
    return path.join(
      this.tempDir,
      `${getRandomNumber(10_000, 99_999)}.${extension}`
    );
  }

  // -------------------
  // EJECUTAR FFmpeg GENÉRICO
  // -------------------
  _runFfmpeg(inputPath, outputPath, options = [], complexFilters = null) {
    return new Promise((resolve, reject) => {
      let command = ffmpeg(inputPath).output(outputPath);

      if (complexFilters) {
        command = command.complexFilter(complexFilters);
      } else if (Array.isArray(options) && options.length) {
        command = command.outputOptions(options);
      }

      command
        .on("error", (err) => {
          errorLog("FFmpeg error:", err);
          reject(err);
        })
        .on("end", () => resolve(outputPath))
        .run();
    });
  }

  // -------------------
  // FILTROS DE IMAGEN
  // -------------------
  async applyBlur(inputPath, intensity = "7:5") {
    const outputPath = await this._createTempFilePath();
    return this._runFfmpeg(inputPath, outputPath, [`-vf boxblur=${intensity}`]);
  }

  async convertToGrayscale(inputPath) {
    const outputPath = await this._createTempFilePath();
    return this._runFfmpeg(inputPath, outputPath, ["-vf format=gray"]);
  }

  async mirrorImage(inputPath) {
    const outputPath = await this._createTempFilePath();
    return this._runFfmpeg(inputPath, outputPath, ["-vf hflip"]);
  }

  async adjustContrast(inputPath, contrast = 1.2) {
    const outputPath = await this._createTempFilePath();
    return this._runFfmpeg(inputPath, outputPath, [`-vf eq=contrast=${contrast}`]);
  }

  async applyPixelation(inputPath) {
    const outputPath = await this._createTempFilePath();
    const filter = "-vf scale=iw/6:ih/6,scale=iw*10:ih*10:flags=neighbor";
    return this._runFfmpeg(inputPath, outputPath, [filter]);
  }

  // -------------------
  // CONVERTIR A STICKER (IMAGEN O VIDEO AUTOMÁTICO)
  // -------------------
  async convertToSticker(inputPath, outputPath = null) {
    if (!outputPath) outputPath = await this._createTempFilePath("webp");

    const videoExtensions = ["mp4", "mov", "mkv", "webm", "avi", "gif"];
    const ext = path.extname(inputPath).replace(".", "").toLowerCase();
    const isVideo = videoExtensions.includes(ext);

    if (!isVideo) {
      // Imagen -> webp
      const options = [
        "-vf scale=512:512:force_original_aspect_ratio=decrease",
        "-qscale 90"
      ];
      return this._runFfmpeg(inputPath, outputPath, options);
    } else {
      // Video/GIF -> WebP animado seguro para Windows
      const options = [
        "-vcodec libwebp",
        "-vf scale=512:512:force_original_aspect_ratio=decrease,fps=15",
        "-loop 0", // loop infinito
        "-an", // mute audio
        "-vsync 0", // sincronización de frames
        "-preset default",
        "-lossless 0",
        "-compression_level 6",
        "-qscale 80"
      ];
      return this._runFfmpeg(inputPath, outputPath, options);
    }
  }

  // -------------------
  // OBTENER DURACIÓN SOLO CON FFMPEG
  // -------------------
  async getDuration(inputPath) {
    return new Promise((resolve, reject) => {
      exec(
        `"${ffmpegPath}" -i "${inputPath}" 2>&1`,
        (err, stdout, stderr) => {
          if (err && !stderr) return reject(err);
          const output = stderr || stdout;
          const match = output.match(/Duration: (\d+):(\d+):([\d.]+)/);
          if (!match) return resolve(0);
          const hours = parseInt(match[1], 10);
          const minutes = parseInt(match[2], 10);
          const seconds = parseFloat(match[3]);
          resolve(hours * 3600 + minutes * 60 + seconds);
        }
      );
    });
  }
// -------------------
// CONVERTIR AUDIO A OGG OPUS (WhatsApp)
// -------------------
async convertToOggOpus(inputPath, outputPath = null) {
  if (!outputPath) outputPath = await this._createTempFilePath("ogg");

  const options = [
    "-vn",
    "-c:a libopus",
    "-ar 48000",
    "-ac 1",
    "-b:a 64k"
  ];

  return this._runFfmpeg(inputPath, outputPath, options);
}

  // -------------------
  // LIMPIEZA DE ARCHIVOS TEMPORALES
  // -------------------
  async cleanup(filePath) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
}

module.exports = new FfmpegService();
