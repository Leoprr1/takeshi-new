const { toUserJid, onlyNumbers } = require(`${BASE_DIR}/utils`);
const {
  checkIfMemberIsMuted,
  unmuteMember,
} = require(`${BASE_DIR}/utils/database`);
const { PREFIX } = require(`${BASE_DIR}/config`);

const { DangerError, WarningError } = require(`${BASE_DIR}/errors`);

module.exports = {
  name: "unmute",
  description: "Desactiva el silencio de un miembro del grupo",
  commands: ["unmute"],
  usage: `${PREFIX}unmute @usuario o responde al mensaje`,
  handle: async ({
    remoteJid,
    sendSuccessReply,
    sendErrorReply,
    args,
    replyJid,
    userJid,
    socket,
    getGroupMetadata,
    isGroupWithLid,
    isGroup,
  }) => {
    if (!isGroup) {
      throw new DangerError("Este comando solo puede ser usado en grupos.");
    }

    if (!args.length && !replyJid) {
      throw new DangerError(
        `Necesitas mencionar a un usuario o responder su mensaje.\n\nEjemplo: ${PREFIX}unmute @usuario`
      );
    }

    // 👇 EXACTAMENTE la misma lógica que mute
    const targetUserNumber = args.length
      ? onlyNumbers(args[0])
      : isGroupWithLid
      ? replyJid
      : onlyNumbers(replyJid);

    const targetUserJid = isGroupWithLid
      ? targetUserNumber
      : toUserJid(targetUserNumber);

    // Validar que exista en WhatsApp
    const [result] =
      replyJid && isGroupWithLid
        ? [{ jid: targetUserJid, lid: targetUserJid }]
        : await socket.onWhatsApp(targetUserNumber);

    if (!result) {
      throw new DangerError("No se pudo encontrar el usuario.");
    }

    const groupMetadata = await getGroupMetadata();

    const isUserInGroup = groupMetadata.participants.some(
      (participant) => participant.id === targetUserJid
    );

    if (!isUserInGroup) {
      return sendErrorReply(
        `El usuario @${targetUserNumber} no está en este grupo.`,
        [targetUserJid]
      );
    }

    if (!checkIfMemberIsMuted(remoteJid, targetUserJid)) {
      throw new WarningError("¡Este usuario no está silenciado!");
    }

    unmuteMember(remoteJid, targetUserJid);

    await sendSuccessReply(
      `@${targetUserNumber} fue desmuteado con éxito.`,
      [targetUserJid]
    );
  },
};
