/**
 * Servicios de procesamiento de media con solo ffmpeg.
 * Versión optimizada y estable para stickers (imagen + video).
 */

const fs = require("node:fs");
const path = require("node:path");
const ffmpeg = require("fluent-ffmpeg");
const { exec } = require("node:child_process");

// Binario centralizado
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
      `${getRandomNumber(10000, 99999)}.${extension}`
    );
  }

  // -------------------
  // EJECUTAR FFmpeg
  // -------------------
  _runFfmpeg(inputPath, outputPath, options = []) {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions(options)
        .save(outputPath)
        .on("end", () => resolve(outputPath))
        .on("error", (err) => {
          errorLog("FFmpeg error:", err);
          reject(err);
        });
    });
  }

  // -------------------
  // FILTROS DE IMAGEN
  // -------------------
  async applyBlur(inputPath, intensity = "7:5") {
    const outputPath = await this._createTempFilePath();
    return this._runFfmpeg(inputPath, outputPath, [
      `-vf boxblur=${intensity}`
    ]);
  }

  async convertToGrayscale(inputPath) {
    const outputPath = await this._createTempFilePath();
    return this._runFfmpeg(inputPath, outputPath, [
      "-vf format=gray"
    ]);
  }

  async mirrorImage(inputPath) {
    const outputPath = await this._createTempFilePath();
    return this._runFfmpeg(inputPath, outputPath, [
      "-vf hflip"
    ]);
  }

  async adjustContrast(inputPath, contrast = 1.2) {
    const outputPath = await this._createTempFilePath();
    return this._runFfmpeg(inputPath, outputPath, [
      `-vf eq=contrast=${contrast}`
    ]);
  }

  async applyPixelation(inputPath) {
    const outputPath = await this._createTempFilePath();
    return this._runFfmpeg(inputPath, outputPath, [
      "-vf scale=iw/6:ih/6,scale=iw*6:ih*6:flags=neighbor"
    ]);
  }

  // -------------------
  // CONVERTIR A STICKER (PRO ESTABLE)
  // -------------------
  async convertToSticker(inputPath, outputPath = null, isImage = false) {
    if (!outputPath) outputPath = await this._createTempFilePath("webp");

    const scaleFilter =
      "scale=512:512:force_original_aspect_ratio=decrease," +
      "pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000";

    if (isImage) {
      // 🖼 Imagen → WebP estático
      const options = [
        "-vcodec libwebp",
        `-vf ${scaleFilter}`,
        "-lossless 0",
        "-compression_level 6",
        "-qscale 90"
      ];

      return this._runFfmpeg(inputPath, outputPath, options);
    } else {
      // 🎥 Video/GIF → WebP animado compatible WhatsApp
      const options = [
        "-vcodec libwebp",
        `-vf ${scaleFilter},fps=15`,
        "-loop 0",
        "-an",
        "-t 10", // máximo 10s
        "-preset default",
        "-lossless 0",
        "-compression_level 6",
        "-qscale 80"
      ];

      return this._runFfmpeg(inputPath, outputPath, options);
    }
  }

  // -------------------
  // OBTENER DURACIÓN (FIX WINDOWS)
  // -------------------
  async getDuration(inputPath) {
    return new Promise((resolve) => {
      exec(
        `"${ffmpegPath}" -i "${inputPath}" 2>&1`,
        (err, stdout, stderr) => {
          const output = stderr || stdout;
          if (!output) return resolve(0);

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
  // LIMPIEZA
  // -------------------
  async cleanup(filePath) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}

module.exports = new FfmpegService();

