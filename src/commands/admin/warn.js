const path = require("path");
const BASE_DIR = path.resolve(__dirname, "../../../");

const { toUserJid, onlyNumbers } = require(`${BASE_DIR}/src/utils`);
const { PREFIX, BOT_NUMBER, OWNER_NUMBER } = require(`${BASE_DIR}/src/config`);
const { DangerError } = require(`${BASE_DIR}/src/errors`);

const {
  muteMember,
  unmuteMember,
  checkIfMemberIsMuted,
} = require(`${BASE_DIR}/src/utils/database`);

const MAX_WARNINGS = 3;
const SUSPENSION_TIME = 30 * 60 * 1000; // 30 minutos

module.exports = {
  name: "warn",
  description:
    "Da una advertencia a un usuario y lo mutea automáticamente al llegar a 3.",
  commands: ["warn"],
  usage: `${PREFIX}warn @usuario o respondiendo al mensaje`,

  handle: async ({
    args,
    replyJid,
    mentionedJid,
    userJid,
    remoteJid,
    sendText,
    sendErrorReply,
  }) => {

    const target =
      mentionedJid?.[0] ||
      replyJid ||
      toUserJid(args[0]);

    if (!target)
      return sendErrorReply(
        `❌ Debes mencionar a un usuario o responder su mensaje.`
      );

    if (
      target === toUserJid(BOT_NUMBER) ||
      onlyNumbers(target) === OWNER_NUMBER
    )
      return sendErrorReply("❌ No podés advertir al bot ni al dueño.");

    // Inicializar DB
    global.mutedDB = global.mutedDB || {};
    if (!global.mutedDB[remoteJid]) global.mutedDB[remoteJid] = {};
    if (!global.mutedDB[remoteJid][target])
      global.mutedDB[remoteJid][target] = {
        mutedUntil: 0,
        warnings: 0,
        timeoutId: null,
      };

    const userData = global.mutedDB[remoteJid][target];
    const now = Date.now();

    if (checkIfMemberIsMuted(remoteJid, target)) {
      const remaining = Math.ceil((userData.mutedUntil - now) / 60000);

      return sendText(
        `⚠️ @${onlyNumbers(target)} aún está muteado por ${remaining} minuto(s).`,
        [target]
      );
    }

    // SUMAR WARN
    userData.warnings++;

    if (userData.warnings >= MAX_WARNINGS) {
      try {
        muteMember(remoteJid, target);
        userData.mutedUntil = now + SUSPENSION_TIME;
      } catch (err) {
        console.error("[WARN] Error al mutear:", err);
      }

      if (userData.timeoutId) {
        clearTimeout(userData.timeoutId);
        userData.timeoutId = null;
      }

      userData.timeoutId = setTimeout(async () => {
        if (checkIfMemberIsMuted(remoteJid, target)) {
          unmuteMember(remoteJid, target);
        }

        if (global.mutedDB[remoteJid]?.[target]) {
          global.mutedDB[remoteJid][target].warnings = 0;
          global.mutedDB[remoteJid][target].mutedUntil = 0;
          global.mutedDB[remoteJid][target].timeoutId = null;
        }

        await sendText(
          `✅ @${onlyNumbers(target)} ya puede volver a escribir.`,
          [target]
        );

      }, SUSPENSION_TIME);

      return sendText(
        `⚠️ @${onlyNumbers(target)} recibió su ${userData.warnings}ª advertencia y fue muteado automáticamente por ${
          SUSPENSION_TIME / 60000
        } minutos.`,
        [target]
      );
    }

    return sendText(
      `⚠️ @${onlyNumbers(target)} recibió una advertencia. Le quedan ${
        MAX_WARNINGS - userData.warnings
      } antes de ser muteado.`,
      [target]
    );
  },
};
