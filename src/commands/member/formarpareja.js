module.exports = {
  name: "formar-pareja",
  commands: ["formar-pareja", "parejas"],

  handle: async ({
    socket,
    remoteJid,
    sendErrorReply
  }) => {

    if (!remoteJid.endsWith("@g.us")) {
      await sendErrorReply("Este comando solo funciona en grupos.");
      return;
    }

    // 🔹 Función para mezclar array
    const shuffleArray = (array) => array.sort(() => Math.random() - 0.5);

    // 🔹 Obtener participantes reales del grupo
    const metadata = await socket.groupMetadata(remoteJid);
    let participants = metadata.participants.map(p => p.id);

    if (participants.length < 2) {
      await sendErrorReply("Se necesitan al menos 2 personas en el grupo para formar parejas.");
      return;
    }

    // 🔹 Mezclar participantes y tomar hasta 10 personas (5 parejas)
    participants = shuffleArray(participants).slice(0, 10);

    const parejas = [];
    for (let i = 0; i < participants.length; i += 2) {
      if (participants[i + 1]) {
        parejas.push([participants[i], participants[i + 1]]);
      }
    }

    // 🔹 Crear mensaje divertido
    let text = `💖 *TOP 5 PAREJAS DEL GRUPO* 💖\n\n`;

    parejas.forEach((pair, index) => {
      const user1 = pair[0].split("@")[0];
      const user2 = pair[1].split("@")[0];
      const compatibilidad = Math.floor(Math.random() * 101);
      const emojis = "💘".repeat(Math.ceil(compatibilidad / 10));
      text += `#${index + 1} 👩‍❤️‍👨 @${user1} + @${user2}\n`;
      text += ` 💞 Compatibilidad: ${compatibilidad}% ${emojis}\n\n`;
    });

    // 🔹 Menciones
    const mentions = parejas.flat();

    await socket.sendMessage(remoteJid, {
      text,
      mentions
    });
  },
};

