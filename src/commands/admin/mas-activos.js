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
  name: "masactivos",
  description: "Muestra el top de miembros más activos del grupo",
  commands: ["masactivos", "mas-activos"],

  handle: async ({
    socket,
    remoteJid,
    sendText,
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

    // 🔹 Inicializar miembros si no están registrados
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

    // Ordenar de mayor a menor según cantidad de mensajes enviados
    users.sort((a, b) => b[1].messages - a[1].messages);

    let text = "🏆 *MIEMBROS MÁS ACTIVOS DEL GRUPO(no laburan)*\n\n";
    const mentions = [];

    let position = 1;
    for (const [jid, data] of users) {
      if (data.messages === 0) continue;

      const number = jid.split("@")[0];
      mentions.push(jid);

      const medal = position === 1 ? "🥇" : position === 2 ? "🥈" : position === 3 ? "🥉" : "🔹";

      text += `${medal} *#${position}* @${number}\n`;
      text += ` 📩 Mensajes enviados: *${data.messages}*\n`;
      text += ` 💤 AFK acumulado: ${formatTime(data.totalAfk)}\n\n`;

      position++;
    }

    if (mentions.length === 0) {
      return await sendText("📊 Aún no hay mensajes registrados en este grupo.");
    }

    await socket.sendMessage(remoteJid, { text, mentions });
  },
};



