const path = require("path");
const BASE_DIR = path.resolve(__dirname, "../../..");

const { OWNER_NUMBER } = require("../../config");
const { PREFIX, BOT_NUMBER } = require(`${BASE_DIR}/src/config`);
const { InvalidParameterError } = require(`${BASE_DIR}/src/errors`);
const { toUserJid, onlyNumbers } = require(`${BASE_DIR}/src/utils`);

module.exports = {
  name: "ban",
  description: "Elimina un miembro del grupo respondiendo o mencionándolo",
  commands: ["ban", "kick"],
  usage: `${PREFIX}ban @usuario`,

  handle: async ({
    args,
    mentionedJid,
    replyJid,
    socket,
    remoteJid,
    sendReply,
    userJid,
    sendSuccessReact,
  }) => {

    const target =
      mentionedJid?.[0] ||
      replyJid ||
      toUserJid(args[0]);

    if (!target) {
      throw new InvalidParameterError("¡Necesitas mencionar o responder a un miembro!");
    }

    const memberNumber = onlyNumbers(target);
    const botJid = toUserJid(BOT_NUMBER);

    if (target === userJid) {
      return await sendReply("❌ No puedes eliminarte a ti mismo.");
    }

    if (memberNumber === OWNER_NUMBER) {
      return await sendReply("❌ No puedes eliminar al dueño del bot.");
    }

    if (target === botJid) {
      return await sendReply("❌ No puedes eliminarme a mí.");
    }

    // --- PROTECCIÓN PARA ADMINISTRADORES ---
    try {
      const groupMetadata = await socket.groupMetadata(remoteJid);
      const participants = groupMetadata?.participants || [];

      // Obtenemos los JIDs de los administradores del grupo
      const groupAdmins = participants
        .filter((p) => p.admin === "admin" || p.admin === "superadmin")
        .map((p) => p.id);

      // Si el objetivo es administrador (por JID exacto o por número), no lo banea
      const isAdmin = groupAdmins.some(
        (adminJid) => adminJid === target || onlyNumbers(adminJid) === memberNumber
      );

      if (isAdmin) {
        return await sendReply("❌ No se puede eliminar a un administrador del grupo.");
      }
    } catch (error) {
      console.error("[BAN METADATA ERROR]", error);
    }
    // ----------------------------------------

    try {
      await socket.groupParticipantsUpdate(remoteJid, [target], "remove");

      if (typeof sendSuccessReact === "function") await sendSuccessReact();

      await sendReply("✅ ¡Miembro eliminado con éxito!");
    } catch (error) {
      console.error("[BAN ERROR]", error);

      await sendReply(
        "❌ No se pudo eliminar al miembro. Puede ser administrador o WhatsApp rechazó la acción."
      );
    }
  },
};

