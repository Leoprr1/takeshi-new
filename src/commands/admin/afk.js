const groupStats = require("../../database/groupStats");
const { toUserJid } = require("../../utils");

// función para formatear tiempo correctamente
function formatTime(ms) {

  let seconds = Math.floor(ms / 1000);

  const days = Math.floor(seconds / 86400);
  seconds %= 86400;

  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;

  const minutes = Math.floor(seconds / 60);
  seconds %= 60;

  const parts = [];

  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (seconds && parts.length < 2) parts.push(`${seconds}s`);

  return parts.join(" ") || "0s";
}

module.exports = {
  name: "afk",
  commands: ["afk"],

  handle: async ({
    socket,
    remoteJid,
    sendText,
    sendErrorReply,
    mentionedJid,
    replyJid,
    args
  }) => {

    if (!remoteJid.endsWith("@g.us")) {
      await sendErrorReply("Este comando solo funciona en grupos.");
      return;
    }

    // 🔹 Crear estructura del grupo si no existe
    if (!groupStats[remoteJid]) {
      groupStats[remoteJid] = {};
    }

    const stats = groupStats[remoteJid];

    // Obtener participantes reales del grupo
    const metadata = await socket.groupMetadata(remoteJid);
    const participants = metadata.participants.map(p => p.id);

    // 🔹 AGREGAR NUEVOS MIEMBROS
    for (const jid of participants) {

      if (!stats[jid]) {
        stats[jid] = {
          lastMessage: Date.now(),
          totalAfk: 0,
          messages: 0
        };
      }

    }

    // 🔹 LIMPIAR DB (usuarios que ya no están en el grupo)
    for (const jid of Object.keys(stats)) {

      if (!participants.includes(jid)) {
        delete stats[jid];
      }

    }

    const now = Date.now();
    const users = Object.entries(stats);

    // ordenar ranking
    users.sort((a, b) => b[1].totalAfk - a[1].totalAfk);

    let text = "💤 *RANKING AFK DEL GRUPO*\n\n";
    const mentions = [];

    for (const [jid, data] of users) {

      const number = jid.split("@")[0];
      mentions.push(jid);

      const totalAfkFormatted = formatTime(data.totalAfk);
      const currentAfkFormatted = formatTime(now - data.lastMessage);

      text += `👤 @${number}\n`;
      text += ` 💤 AFK acumulado: ${totalAfkFormatted}\n`;
      text += ` ⏳ AFK actual: ${currentAfkFormatted}\n`;
      text += ` 📩 Mensajes: ${data.messages}\n\n`;
    }

    await socket.sendMessage(remoteJid, {
      text,
      mentions
    });

  },
};

