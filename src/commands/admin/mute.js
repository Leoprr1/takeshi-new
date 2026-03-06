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
  usage: `${PREFIX}mute @usuario ou responda a mensagem do usuário`,
  
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
      throw new DangerError("Este comando só pode ser usado em grupos.");
    }

    const target =
      mentionedJid?.[0] ||
      replyJid ||
      toUserJid(args[0]);

    if (!target) {
      throw new DangerError(
        `Você precisa mencionar um usuário ou responder a mensagem.\n\nExemplo: ${PREFIX}mute @usuario`
      );
    }

    if (target === toUserJid(BOT_NUMBER)) {
      throw new DangerError("Você não pode mutar o bot.");
    }

    if (target === userJid) {
      throw new DangerError("Você não pode mutar a si mesmo!");
    }

    const groupMetadata = await getGroupMetadata();

    const isUserInGroup = groupMetadata.participants.some(
      (participant) => participant.id === target
    );

    if (!isUserInGroup) {
      return sendErrorReply("O usuário não está neste grupo.", [target]);
    }

    const isTargetAdmin = groupMetadata.participants.some(
      (participant) => participant.id === target && participant.admin
    );

    if (isTargetAdmin) {
      throw new DangerError("Você não pode mutar um administrador.");
    }

    if (checkIfMemberIsMuted(remoteJid, target)) {
      return sendErrorReply("Este usuário já está mutado neste grupo.", [target]);
    }

    muteMember(remoteJid, target);

    await sendSuccessReply(
      "Usuário mutado com sucesso!",
      [target]
    );
  },
};
