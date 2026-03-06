const { PREFIX } = require(`${BASE_DIR}/config`);
const { isGroup, toUserJid } = require(`${BASE_DIR}/utils`);
const { errorLog } = require(`${BASE_DIR}/utils/logger`);

module.exports = {
  name: "demote",
  description: "Degrada a un administrador a miembro común",
  commands: ["demote"],
  usage: `${PREFIX}demote @usuario`,
  /**
   * @param {CommandHandleProps} props
   * @returns {Promise<void>}
   */
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
      return sendWarningReply(
        "¡Este comando solo puede ser usado en un grupo!"
      );
    }

    const target =
      mentionedJid?.[0] ||
      replyJid ||
      toUserJid(args[0]);

    
    if (!target) {
      return sendWarningReply(
        "👤 Por favor etiqueta o responde al admin que deseas degradas ."
      );
    }


    try {
      await socket.groupParticipantsUpdate(remoteJid, [target], "demote");
      await sendSuccessReply("¡Usuario degradado con éxito!");
    } catch (err) {
      errorLog(`Error al degradar administrador: ${err.message}`);
      await sendErrorReply(
        "Ocurrió un error al intentar degradar al usuario. ¡Necesito ser administrador del grupo para degradar a otros administradores!"
      );
    }
  },
};
