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
  description: "Limpia todas las advertencias de un usuario y lo desmutea si estaba muteado",
  commands: ["unwarn", "clear"],
  usage: `${PREFIX}unwarn @usuario o respondiendo a su mensaje`,

  handle: async ({
    args,
    replyJid,
    remoteJid,
    sendSuccessReply,
    sendErrorReply,
  }) => {
    if (!replyJid && !args.length)
      return sendErrorReply("❌ Debes mencionar a un usuario o responder su mensaje.");

    const targetJid = replyJid ? replyJid : toUserJid(args[0]);
    if (!targetJid) return sendErrorReply("❌ No se pudo determinar al usuario.");

    // Inicializar estructura de warns dentro de la DB de mute
    global.mutedDB = global.mutedDB || {};
    if (!global.mutedDB[remoteJid]) global.mutedDB[remoteJid] = {};
    if (!global.mutedDB[remoteJid][targetJid])
      global.mutedDB[remoteJid][targetJid] = { mutedUntil: 0, warnings: 0 };

    const userData = global.mutedDB[remoteJid][targetJid];

    // Reset warnings
    userData.warnings = 0;

    // Desmutea si estaba muteado
    if (checkIfMemberIsMuted(remoteJid, targetJid)) {
      unmuteMember(remoteJid, targetJid);
      userData.mutedUntil = 0;
      return sendSuccessReply(
        `✅ @${onlyNumbers(targetJid)} ahora tiene 0 advertencias y fue desmuteado.`,
        [targetJid]
      );
    }

    return sendSuccessReply(
      `✅ @${onlyNumbers(targetJid)} ahora tiene 0 advertencias.`,
      [targetJid]
    );
  },
};
