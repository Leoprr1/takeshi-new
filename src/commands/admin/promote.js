const { PREFIX } = require(`${BASE_DIR}/config`);
const { isGroup, toUserJid } = require(`${BASE_DIR}/utils`);
const { errorLog } = require(`${BASE_DIR}/utils/logger`);

module.exports = {
  name: "promote",
  description: "Promueve a un usuario a administrador del grupo",
  commands: ["promote", "add-adm"],
  usage: `${PREFIX}promote @usuario`,

  handle: async ({
    args,
    mentionedJid,
    replyJid,
    remoteJid,
    socket,
    sendWarningReply,
    sendSuccessReply,
    sendErrorReply,
  }) => {

    if (!isGroup(remoteJid)) {
      return sendWarningReply("👥 Este comando solo puede usarse en grupos.");
    }

    const target =
      mentionedJid?.[0] ||
      replyJid ||
      toUserJid(args[0]);

    if (!target) {
      return sendWarningReply(
        "👤 Por favor etiqueta o responde al usuario que deseas promover."
      );
    }

    try {

      await socket.groupParticipantsUpdate(remoteJid, [target], "promote");

      await sendSuccessReply("✅ ¡Usuario promovido con éxito!");

    } catch (err) {

      errorLog(`❌ ERROR EN EL COMANDO PROMOTE: ${err.message}`);

      await sendErrorReply(
        "⚠️ Ocurrió un error al intentar promover al usuario."
      );
    }
  },
};
