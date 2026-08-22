const path = require("path");
const BASE_DIR = path.resolve(__dirname, "../../..");

const { PREFIX, BOT_NUMBER, OWNER_NUMBER } = require(`${BASE_DIR}/src/config`);
const { InvalidParameterError } = require(`${BASE_DIR}/src/errors`);
const { toUserJid, onlyNumbers } = require(`${BASE_DIR}/src/utils`);
const { isBotOwner } = require(`${BASE_DIR}/src/middlewares`);

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
    const userNumber = onlyNumbers(userJid);
    const ownerNumber = onlyNumbers(OWNER_NUMBER);
    const botNumber = onlyNumbers(BOT_NUMBER);

    // 1. Evitar auto-ban
    if (target === userJid || (memberNumber && memberNumber === userNumber)) {
      return await sendReply("❌ No puedes eliminarte a ti mismo.");
    }

    // 2. Evitar eliminar al dueño (Usando comprobación por middleware o comparación limpia de números)
    const isTargetOwner = 
      (typeof isBotOwner === "function" && isBotOwner({ userJid: target, isLid: target.includes("@lid") })) ||
      (ownerNumber && memberNumber && (memberNumber === ownerNumber || memberNumber.includes(ownerNumber) || ownerNumber.includes(memberNumber)));

    if (isTargetOwner) {
      return await sendReply("❌ No puedes eliminar al dueño del bot.");
    }

    // 3. Evitar eliminar al bot
    if (botNumber && memberNumber && (memberNumber === botNumber || botNumber.includes(memberNumber))) {
      return await sendReply("❌ No puedes eliminarme a mí.");
    }

    // 4. PROTECCIÓN PARA ADMINISTRADORES DEL GRUPO
    try {
      const groupMetadata = await socket.groupMetadata(remoteJid);
      const participants = groupMetadata?.participants || [];

      // Obtenemos los JIDs de los administradores del grupo
      const groupAdmins = participants
        .filter((p) => p.admin === "admin" || p.admin === "superadmin")
        .map((p) => p.id);

      // Si el objetivo es administrador (por JID exacto o por número), no lo banea
      const isAdmin = groupAdmins.some((adminJid) => {
        const adminNumber = onlyNumbers(adminJid);
        return (
          adminJid === target ||
          (adminNumber && memberNumber && adminNumber === memberNumber)
        );
      });

      if (isAdmin) {
        return await sendReply("❌ No se puede eliminar a un administrador del grupo.");
      }
    } catch (error) {
      console.error("[BAN METADATA ERROR]", error);
    }

    // 5. Expulsar participante
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


