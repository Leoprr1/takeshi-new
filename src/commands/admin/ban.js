const path = require("path");
const BASE_DIR = path.resolve(__dirname, "../../..");

const { OWNER_NUMBER } = require("../../config");
const { PREFIX, BOT_NUMBER } = require(`${BASE_DIR}/src/config`);
const { InvalidParameterError } = require(`${BASE_DIR}/src/errors`);
const { toUserJid, onlyNumbers } = require(`${BASE_DIR}/src/utils`);

// Función para convertir cualquier formato de número o mención a JID válido
function parseToJid(input) {
  if (!input) return null;

  // Si ya es un JID válido con @, lo retorna directamente
  if (input.includes("@")) return input;

  // Si es mención @123456789, quitar la @
  if (input.startsWith("@")) input = input.slice(1);

  // Limpiar caracteres que no sean números ni +
  let cleaned = input.replace(/[^0-9+]/g, "");

  // Si empieza con +, quitar +
  if (cleaned.startsWith("+")) cleaned = cleaned.slice(1);

  // Si no empieza con código de país (ejemplo 54 Argentina), agregarlo (modificar según tu país)
  if (!cleaned.startsWith("54")) cleaned = "54" + cleaned;

  return cleaned + "@s.whatsapp.net";
}

module.exports = {
  name: "ban",
  description: "Elimina un miembro del grupo respondiendo a su mensaje o mencionándolo",
  commands: ["ban", "kick"],
  usage: `${PREFIX}ban @mencionar_miembro\nO\n${PREFIX}ban (respondiendo a un mensaje)`,

  handle: async ({
    args,
    isReply,
    replyJid,
    socket,
    remoteJid,
    sendReply,
    userJid,
    sendSuccessReact,
  }) => {
    console.log("[BAN] Comando iniciado por:", userJid);

    let memberToRemoveJid;

    if (isReply && replyJid) {
      memberToRemoveJid = replyJid;
      console.log("[BAN] Usando replyJid:", memberToRemoveJid);
    } else if (args.length) {
      memberToRemoveJid = parseToJid(args[0]);
      console.log("[BAN] Usando args parseados a JID:", memberToRemoveJid);
    } else {
      throw new InvalidParameterError("¡Necesitas mencionar o responder a un miembro!");
    }

    const memberNumber = onlyNumbers(memberToRemoveJid);
    const botJid = toUserJid(BOT_NUMBER);

    // Prevenir eliminar a: usuario mismo, dueño del bot y al bot
    if (memberToRemoveJid === userJid) {
      return await sendReply("❌ No puedes eliminarte a ti mismo.");
    }
    if (memberNumber === OWNER_NUMBER) {
      return await sendReply("❌ No puedes eliminar al dueño del bot.");
    }
    if (memberToRemoveJid === botJid) {
      return await sendReply("❌ No puedes eliminarme a mí.");
    }

    try {
      console.log(`[BAN] Intentando eliminar a ${memberToRemoveJid} del grupo ${remoteJid}`);
      await socket.groupParticipantsUpdate(remoteJid, [memberToRemoveJid], "remove");
      if (typeof sendSuccessReact === "function") await sendSuccessReact();
      await sendReply("✅ ¡Miembro eliminado con éxito!");
    } catch (error) {
      console.error("[BAN] Error al eliminar al miembro:", error);
      await sendReply("❌ No se pudo eliminar al miembro. Puede ser administrador o WhatsApp rechazó la acción.");
    }
  },
};