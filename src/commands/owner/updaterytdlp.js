const { PREFIX } = require(`${BASE_DIR}/config`);
const { isBotOwner } = require(`${BASE_DIR}/middlewares`);
const path = require("path");

module.exports = {
  name: "updateytdlp",
  description: "Actualiza el yt-dlp.exe manualmente",
  commands: ["updateytdlp", "ytdlp-update"],
  usage: `${PREFIX}updateytdlp`,

  handle: async ({ sendReply, userJid, isLid }) => {

    // 🔒 SOLO OWNER
    if (!isBotOwner({ userJid, isLid })) {
      return sendReply("❌ Este comando solo puede usarlo el owner del bot.");
    }

    try {
      await sendReply("🔄 Iniciando actualización de yt-dlp...\n(mirá la consola)");

     require("../../../yt-dlp-update")({force: true});

    } catch (err) {
      console.error("❌ Error ejecutando updater:", err);
      return sendReply("❌ Error al ejecutar el updater.");
    }
  },
};
