const { PREFIX } = require(`${BASE_DIR}/config`);
const { InvalidParameterError } = require(`${BASE_DIR}/errors`);
const { toUserJid, onlyNumbers } = require(`${BASE_DIR}/utils`);
const { isMarried } = require(`${BASE_DIR}/utils/marriageDB`);

global.marriageProposals = global.marriageProposals || {};

module.exports = {
  name: "casarse",
  commands: ["casarse"],

  handle: async ({
    sendText,
    sendErrorReply,
    userJid,
    replyJid,
    args,
    isReply,
    mentionedJid,
  }) => {

    if (!args.length && !isReply) {
      throw new InvalidParameterError("Debes mencionar a alguien 💍");
    }

     const targetJid = mentionedJid?.[0] || replyJid || toUserJid(args[0]);
    
    if (!targetJid || targetJid === userJid) {
      await sendErrorReply("No puedes casarte contigo mismo 😭");
      return;
    }

    if (isMarried(userJid)) {
      await sendErrorReply("Ya estás casado 💔");
      return;
    }

    if (isMarried(targetJid)) {
      await sendErrorReply("Esa persona ya está casada 💔");
      return;
    }

    global.marriageProposals[targetJid] = userJid;

    const userNumber = onlyNumbers(userJid);
    const targetNumber = onlyNumbers(targetJid);

    await sendText(
`💍 *PROPUESTA DE MATRIMONIO* 💍

@${userNumber} quiere casarse contigo @${targetNumber} 😳✨

Responde con:
👉 *.accept*

para aceptar esta unión 💒`,
      [userJid, targetJid]
    );
  },
};
