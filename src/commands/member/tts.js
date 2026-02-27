const fs = require("fs");
const path = require("path");
const { EdgeTTS } = require("node-edge-tts");

// 🔥 IMPORTAR TU SERVICIO REAL
const ffmpegService = require(`${BASE_DIR}/services/ffmpeg`);

module.exports = {
  name: "tts",
  description: "Convierte texto en voz con Node Edge TTS",
  commands: ["tts"],
  usage: ".tts hola mundo",

  handle: async ({
    args,
    webMessage,
    socket,
    remoteJid,
    sendReply,
  }) => {

    let text = "";

    if (args.length) {
      text = args.join(" ");
    } else if (
      webMessage?.message?.extendedTextMessage?.contextInfo?.quotedMessage
    ) {
      const quoted =
        webMessage.message.extendedTextMessage.contextInfo.quotedMessage;

      if (quoted?.conversation) {
        text = quoted.conversation;
      } else if (quoted?.extendedTextMessage?.text) {
        text = quoted.extendedTextMessage.text;
      }
    }

    if (!text.trim()) {
      return sendReply("❌ Escribí algo o responde a un mensaje con .tts");
    }

    // 🔹 Archivo MP3 temporal
    const mp3Path = path.join(ffmpegService.tempDir, `tts-${Date.now()}.mp3`);

    try {
      // -------------------------
      // 1️⃣ Crear instancia de Node Edge TTS
      // -------------------------
      const tts = new EdgeTTS({
        voice: "es-MX-JorgeNeural", // Voz española (podés probar otras)
        lang: "es-MX",
        outputFormat: "audio-24khz-48kbitrate-mono-mp3"
      });

      // -------------------------
      // 2️⃣ Generar MP3 temporal
      // -------------------------
      await tts.ttsPromise(text, mp3Path);

      // -------------------------
      // 3️⃣ Convertir a OGG/Opus para WhatsApp
      // -------------------------
      const oggPath = await ffmpegService.convertToOggOpus(mp3Path);
      const buffer = fs.readFileSync(oggPath);

      // -------------------------
      // 4️⃣ Enviar como nota de voz
      // -------------------------
      await socket.sendMessage(remoteJid, {
        audio: buffer,
        mimetype: "audio/ogg; codecs=opus",
        ptt: true
      });

      // -------------------------
      // 5️⃣ Limpiar archivos temporales
      // -------------------------
      await ffmpegService.cleanup(mp3Path);
      await ffmpegService.cleanup(oggPath);

    } catch (err) {
      console.error("TTS ERROR:", err);
      sendReply("❌ Error procesando el audio");
    }
  },
};
