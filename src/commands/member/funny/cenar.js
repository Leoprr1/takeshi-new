const { PREFIX } = require(`${BASE_DIR}/config`);
const { InvalidParameterError } = require(`${BASE_DIR}/errors`);
const { toUserJid, onlyNumbers } = require(`${BASE_DIR}/utils`);
const path = require("node:path");
const { ASSETS_DIR } = require(`${BASE_DIR}/config`);

module.exports = {
  name: "cenar",
  description: "Invita a un usuario a cenar.",
  commands: ["cenar", "cena"],
  usage: `${PREFIX}cenar @usuario`,
  /**
   * @param {CommandHandleProps} props
   * @returns {Promise<void>}
   */
  handle: async ({
    sendGifFromFile,
    sendErrorReply,
    userJid,
    replyJid,
    args,
    isReply,
    mentionedJid,
  }) => {
    if (!args.length && !isReply) {
      throw new InvalidParameterError(
        "¡Necesitas mencionar o marcar a un miembro!"
      );
    }

     const targetJid = mentionedJid?.[0] || replyJid || toUserJid(args[0]);
    
    if (!targetJid) {
      await sendErrorReply(
        "Debes mencionar a un usuario o responder a un mensaje para cenar."
      );
      return;
    }

    const userNumber = onlyNumbers(userJid);
    const targetNumber = onlyNumbers(targetJid);

    await sendGifFromFile(
      path.resolve(ASSETS_DIR, "images", "funny", "gintama-gintoki.mp4"),
      `@${userNumber} fue a cenar con @${targetNumber}!`,
      [userJid, targetJid]
    );
  },
};
