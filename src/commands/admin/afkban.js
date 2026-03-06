const groupStats = require("../../database/groupStats");
const { OWNER_NUMBER, BOT_NUMBER } = require("../../config");
const { onlyNumbers, toUserJid } = require("../../utils");

const AFK_LIMIT = 7 * 24 * 60 * 60 * 1000; // 7 días

module.exports = {
  name: "afkban",
  description: "Expulsa usuarios que lleven más de 7 días AFK",
  commands: ["afkban"],

  handle: async ({
    socket,
    remoteJid,
    sendReply,
    sendSuccessReact,
    getGroupMetadata
  }) => {

    if (!remoteJid.endsWith("@g.us")) {
      return sendReply("❌ Este comando solo funciona en grupos.");
    }

    const stats = groupStats[remoteJid];

    if (!stats || Object.keys(stats).length === 0) {
      return sendReply("No hay datos AFK en este grupo.");
    }

    const metadata = await getGroupMetadata();
    const participants = metadata.participants;

    const now = Date.now();

    const toKick = [];

    for (const participant of participants) {

      const jid = participant.id;

      // ignorar admins
      if (participant.admin) continue;

      const number = onlyNumbers(jid);

      if (number === OWNER_NUMBER) continue;
      if (number === BOT_NUMBER) continue;

      const data = stats[jid];

      if (!data) continue;

      const afkTime = now - data.lastMessage;

      if (afkTime >= AFK_LIMIT) {
        toKick.push(jid);
      }

    }

    if (toKick.length === 0) {
      return sendReply("✅ No hay usuarios con más de 7 días AFK.");
    }

    try {

      await socket.groupParticipantsUpdate(remoteJid, toKick, "remove");

      // limpiar DB
      for (const jid of toKick) {
        delete stats[jid];
      }

      if (typeof sendSuccessReact === "function") await sendSuccessReact();

      return sendReply(
        `🧹 Se eliminaron ${toKick.length} usuario(s) por estar AFK más de 7 días.`
      );

    } catch (err) {

      console.error("[AFKBAN ERROR]", err);

      return sendReply(
        "❌ Ocurrió un error al intentar eliminar usuarios AFK."
      );
    }

  },
};
