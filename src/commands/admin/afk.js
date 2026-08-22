const groupStats = require("../../database/groupStats");

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
  description: "Muestra el tiempo AFK de todos los miembros",
  commands: ["afk"],

  handle: async ({
    socket,
    remoteJid,
    sendErrorReply
  }) => {

    if (!remoteJid.endsWith("@g.us")) {
      await sendErrorReply("Este comando solo funciona en grupos.");
      return;
    }

    if (!groupStats[remoteJid]) {
      groupStats[remoteJid] = {};
    }

    const stats = groupStats[remoteJid];
    const metadata = await socket.groupMetadata(remoteJid);
    const participants = metadata.participants.map(p => p.id);
    const now = Date.now();

    // 🔹 Inicializar temporizadores para nuevos usuarios/sin mensajes
    for (const participant of metadata.participants) {
      const jid = participant.id;

      if (!stats[jid]) {
        const joinedTimestamp = participant?.joinedTimestamp 
          ? participant.joinedTimestamp * 1000 
          : now; 
        const afkTime = now - joinedTimestamp;

        stats[jid] = {
          lastMessage: joinedTimestamp,
          totalAfk: afkTime,
          messages: 0
        };
      }
    }

    // 🔹 Limpiar usuarios fuera del grupo
    for (const jid of Object.keys(stats)) {
      if (!participants.includes(jid)) {
        delete stats[jid];
      }
    }

    const users = Object.entries(stats);
    users.sort((a, b) => (now - b[1].lastMessage) - (now - a[1].lastMessage));

    let text = "💤 *AFK DEL GRUPO*\n\n";
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

    await socket.sendMessage(remoteJid, { text, mentions });
  },
};



