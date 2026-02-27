const groupStats = require("../../database/groupStats");

module.exports = {
  name: "afk",
  commands: ["afk"],

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

    const stats = groupStats[remoteJid];

    if (!stats || Object.keys(stats).length === 0) {
      await sendText("No hay datos todavía en este grupo.");
      return;
    }

    const now = Date.now();
    const users = Object.entries(stats);

    // Ordenar por mayor AFK acumulado
    users.sort((a, b) => b[1].totalAfk - a[1].totalAfk);

    let text = "💤 *RANKING AFK DEL GRUPO*\n\n";
    const mentions = [];

    for (const [jid, data] of users) {

      const number = jid.split("@")[0];
      mentions.push(jid);

      const totalMinutes = Math.floor(data.totalAfk / 60000);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;

      const currentAfkMinutes = Math.floor((now - data.lastMessage) / 60000);

      text += `👤 @${number}\n`;
      text += ` 💤 AFK acumulado: ${hours}h ${minutes}m\n`;
      text += ` ⏳ AFK actual: ${currentAfkMinutes} min\n`;
      text += ` 📩 Mensajes: ${data.messages}\n\n`;
    }

    await socket.sendMessage(remoteJid, {
      text,
      mentions
    });

  },
};
