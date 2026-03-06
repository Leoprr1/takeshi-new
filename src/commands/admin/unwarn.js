const path = require("path");
const BASE_DIR = path.resolve(__dirname, "../../../");

const { toUserJid, onlyNumbers } = require(`${BASE_DIR}/src/utils`);
const { PREFIX } = require(`${BASE_DIR}/src/config`);

const {
  unmuteMember,
  checkIfMemberIsMuted,
} = require(`${BASE_DIR}/src/utils/database`);

module.exports = {
  name: "unwarn",
  description: "Limpia todas las advertencias de un usuario",
  commands: ["unwarn", "clear"],
  usage: `${PREFIX}unwarn @usuario o respondiendo`,

  handle: async ({
    args,
    replyJid,
    mentionedJid,
    remoteJid,
    sendSuccessReply,
    sendErrorReply,
  }) => {

    const target =
      mentionedJid?.[0] ||
      replyJid ||
      toUserJid(args[0]);

    if (!target)
      return sendErrorReply(
        "❌ Debes mencionar a un usuario o responder su mensaje."
      );

    global.mutedDB = global.mutedDB || {};
    if (!global.mutedDB[remoteJid]) global.mutedDB[remoteJid] = {};
    if (!global.mutedDB[remoteJid][target])
      global.mutedDB[remoteJid][target] = {
        mutedUntil: 0,
        warnings: 0,
        timeoutId: null,
      };

    const userData = global.mutedDB[remoteJid][target];

    if (userData.timeoutId) {
      clearTimeout(userData.timeoutId);
      userData.timeoutId = null;
    }

    userData.warnings = 0;

    if (checkIfMemberIsMuted(remoteJid, target)) {
      unmuteMember(remoteJid, target);
      userData.mutedUntil = 0;

      return sendSuccessReply(
        `✅ @${onlyNumbers(target)} ahora tiene 0 advertencias y fue desmuteado.`,
        [target]
      );
    }

    return sendSuccessReply(
      `✅ @${onlyNumbers(target)} ahora tiene 0 advertencias.`,
      [target]
    );
  },
};

