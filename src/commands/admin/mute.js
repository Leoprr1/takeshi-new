/**
 * Desenvolvido por: Mkg
 * Refatorado por: Dev Gui
 * Adaptado por: Leo
 */

const { toUserJid } = require(`${BASE_DIR}/utils`);
const {
  checkIfMemberIsMuted,
  muteMember,
} = require(`${BASE_DIR}/utils/database`);

const { PREFIX, BOT_NUMBER } = require(`${BASE_DIR}/config`);
const { DangerError } = require(`${BASE_DIR}/errors`);

module.exports = {
  name: "mute",
  description:
    "Silencia um usuário no grupo (apaga as mensagens do usuário automaticamente).",
  commands: ["mute", "mutar"],
  usage: `${PREFIX}mute @usuario o responde a un mensaje del usuario`,
  
  handle: async ({
    args,
    mentionedJid,
    replyJid,
    remoteJid,
    userJid,
    sendErrorReply,
    sendSuccessReply,
    getGroupMetadata,
    isGroup,
  }) => {

    if (!isGroup) {
      throw new DangerError("este comando solo podes usarlo en grupos");
    }

    const target =
      mentionedJid?.[0] ||
      replyJid ||
      toUserJid(args[0]);

    if (!target) {
      throw new DangerError(
        `tenes que mencionar a un usaurio para mutearlo.\n\nejemplo: ${PREFIX}mute @usuario`
      );
    }

    if (target === toUserJid(BOT_NUMBER)) {
      throw new DangerError("no podes mutear al bot");
    }

    if (target === userJid) {
      throw new DangerError("no te podes mutear a vos mismo");
    }

    const groupMetadata = await getGroupMetadata();

    const isUserInGroup = groupMetadata.participants.some(
      (participant) => participant.id === target
    );

    if (!isUserInGroup) {
      return sendErrorReply("este usuario no esta en el grupo", [target]);
    }

    const isTargetAdmin = groupMetadata.participants.some(
      (participant) => participant.id === target && participant.admin
    );

    if (isTargetAdmin) {
      throw new DangerError("no podes mutuear a un admin");
    }

    if (checkIfMemberIsMuted(remoteJid, target)) {
      return sendErrorReply("este usuario ya esta muteado!", [target]);
    }

    muteMember(remoteJid, target);

    await sendSuccessReply(
      "usuario muteado con exito!",
      [target]
    );
  },
};
