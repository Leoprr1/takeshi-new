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
  commands: ["warn"], // solo warn
  usage: `${PREFIX}warn (respondiendo al mensaje)`,

  handle: async ({
    args,
    replyJid,
    userJid,
    remoteJid,
    socket,
    sendText,
    sendErrorReply,
  }) => {
    if (!replyJid && !args.length)
      return sendErrorReply(`❌ Responde al mensaje del usuario para darle una advertencia.`);

    const targetJid = replyJid ? replyJid : toUserJid(args[0]);
    if (!targetJid) return sendErrorReply("❌ No se pudo determinar al usuario.");

    if (targetJid === toUserJid(BOT_NUMBER) || onlyNumbers(targetJid) === OWNER_NUMBER)
      return sendErrorReply("❌ No podés advertir al bot ni al dueño.");

    // Inicializar estructura en muted.json
    global.mutedDB = global.mutedDB || {};
    if (!global.mutedDB[remoteJid]) global.mutedDB[remoteJid] = {};
    if (!global.mutedDB[remoteJid][targetJid])
      global.mutedDB[remoteJid][targetJid] = {
        mutedUntil: 0,
        warnings: 0,
        timeoutId: null,
      };

    const userData = global.mutedDB[remoteJid][targetJid];
    const now = Date.now();

    // Si ya está muteado, no sumamos más warns
    if (checkIfMemberIsMuted(remoteJid, targetJid)) {
      const remaining = Math.ceil((userData.mutedUntil - now) / 60000);
      return sendText(
        `⚠️ @${onlyNumbers(targetJid)} aún está muteado por ${remaining} minuto(s).`,
        [targetJid]
      );
    }

    // DAR WARN
    userData.warnings++;

    if (userData.warnings >= MAX_WARNINGS) {
      try {
        muteMember(remoteJid, targetJid); // también borra mensajes
        userData.mutedUntil = now + SUSPENSION_TIME;
      } catch (err) {
        console.error("[WARN] Error al mutear al usuario:", err);
      }

      // Cancelar timeout anterior si existía
      if (userData.timeoutId) {
        clearTimeout(userData.timeoutId);
        userData.timeoutId = null;
      }

      // Desmuteo automático con notificación
      userData.timeoutId = setTimeout(async () => {
        if (checkIfMemberIsMuted(remoteJid, targetJid)) {
          unmuteMember(remoteJid, targetJid);
        }
        if (global.mutedDB[remoteJid] && global.mutedDB[remoteJid][targetJid]) {
          global.mutedDB[remoteJid][targetJid].warnings = 0;
          global.mutedDB[remoteJid][targetJid].mutedUntil = 0;
          global.mutedDB[remoteJid][targetJid].timeoutId = null;
        }

        // Notificación en el grupo
        await sendText(
          `✅ @${onlyNumbers(targetJid)} ya terminó su tiempo de castigo y puede volver a escribir.`,
          [targetJid]
        );
      }, SUSPENSION_TIME);

      return sendText(
        `⚠️ @${onlyNumbers(targetJid)} recibió su ${userData.warnings}ª advertencia y fue muteado automáticamente por ${
          SUSPENSION_TIME / 60000
        } minutos.`,
        [targetJid]
      );
    }

    return sendText(
      `⚠️ @${onlyNumbers(targetJid)} recibió una advertencia. Le quedan ${
        MAX_WARNINGS - userData.warnings
      } antes de ser muteado automáticamente.`,
      [targetJid]
    );
  },
};
