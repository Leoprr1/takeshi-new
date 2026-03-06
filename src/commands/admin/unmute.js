const { toUserJid } = require(`${BASE_DIR}/utils`);
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
    mentionedJid,
    getGroupMetadata,
    isGroup,
  }) => {

    if (!isGroup) {
      throw new DangerError("Este comando solo puede ser usado en grupos.");
    }

    const target =
      mentionedJid?.[0] ||
      replyJid ||
      toUserJid(args[0]);

    if (!target) {
      throw new DangerError(
        `Necesitas mencionar a un usuario o responder su mensaje.\n\nEjemplo: ${PREFIX}unmute @usuario`
      );
    }

    const groupMetadata = await getGroupMetadata();

    const isUserInGroup = groupMetadata.participants.some(
      (participant) => participant.id === target
    );

    if (!isUserInGroup) {
      return sendErrorReply(
        "El usuario no está en este grupo.",
        [target]
      );
    }

    if (!checkIfMemberIsMuted(remoteJid, target)) {
      throw new WarningError("¡Este usuario no está silenciado!");
    }

    unmuteMember(remoteJid, target);

    await sendSuccessReply(
      "Usuario desmuteado con éxito.",
      [target]
    );
  },
};
