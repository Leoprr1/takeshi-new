const { PREFIX } = require(`${BASE_DIR}/config`);
const { isGroup } = require(`${BASE_DIR}/utils`);
const { errorLog } = require(`${BASE_DIR}/utils/logger`);

module.exports = {
  name: "promote",
  description: "Promueve a un usuario a administrador del grupo",
  commands: ["promote", "add-adm"],
  usage: `${PREFIX}promote @usuario o ${PREFIX}promote número`,

  /**
   * @param {CommandHandleProps} props
   * @returns {Promise<void>}
   */
  handle: async ({
    sock,
    remoteJid,
    m,
    args,
    sendWarningReply,
    sendSuccessReply,
    sendErrorReply,
  }) => {
    try {
      console.log("🐞 DEBUG m:", m ? JSON.stringify(m, null, 2) : "undefined");
      console.log("🐞 DEBUG args:", args);

      if (!m || typeof m !== "object") {
        return sendWarningReply("🤖 ⚠️ ¡Atención! No se recibió el mensaje correctamente.");
      }

      if (!isGroup(remoteJid)) {
        return sendWarningReply("👥 Este comando solo puede usarse en grupos.");
      }

      let userId = null;

      // Extraer menciones
      const mentions =
        m.message?.extendedTextMessage?.contextInfo?.mentionedJid ||
        m.message?.contextInfo?.mentionedJid ||
        [];

      if (mentions.length > 0) {
        userId = mentions[0];
      } else if (args && args.length > 0) {
        const cleaned = args[0].replace(/[^0-9]/g, "");
        if (cleaned.length >= 5) {
          userId = `${cleaned}@s.whatsapp.net`;
        }
      }

      if (!userId) {
        return sendWarningReply("👤 Por favor etiqueta a un usuario o pasa su número para promover.");
      }

      // Promover usuario
      await sock.groupParticipantsUpdate(remoteJid, [userId], "promote");
      return sendSuccessReply("✅ ¡Usuario promovido con éxito!");
    } catch (err) {
      errorLog(`❌ ERROR EN EL COMANDO PROMOTE: ${err.message}`);
      console.error("❌ ERROR DETALLADO:", err);
      return sendErrorReply("⚠️ Ocurrió un error al intentar promover al usuario.");
    }
  },
};