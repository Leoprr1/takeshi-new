module.exports = {
  name: "tops",
  commands: ["top"],

  handle: async ({
    socket,
    remoteJid,
    sendErrorReply,
    args
  }) => {

    if (!remoteJid.endsWith("@g.us")) {
      await sendErrorReply("Este comando solo funciona en grupos.");
      return;
    }

    const validTops = [
      "infieles",
      "putos",
      "geys",
      "travas",
      "regalados",
      "pijudos",
      "fieles",
      "romanticos",
      "pelotudos",
      "machos"
    ];

    const type = args[0]?.toLowerCase();
    if (!type || !validTops.includes(type)) {
      await sendErrorReply(
        `Por favor indica un tipo de TOP válido:\n${validTops.map(t => `.${t}`).join(" / ")}`
      );
      return;
    }

    // 🔹 Función para mezclar array
    const shuffleArray = (array) => array.sort(() => Math.random() - 0.5);

    // 🔹 Obtener participantes reales del grupo
    const metadata = await socket.groupMetadata(remoteJid);
    const participants = metadata.participants.map(p => p.id);

    if (participants.length === 0) {
      await sendErrorReply("No se encontraron miembros en el grupo.");
      return;
    }

    // 🔹 Seleccionar hasta 10 personas al azar
    const shuffled = shuffleArray(participants);
    const topParticipants = shuffled.slice(0, 10);

    // 🔹 Crear mensaje bonito
    let text = `🔥 *TOP 10 MÁS ${type.toUpperCase()} DEL GRUPO* 🔥\n\n`;

    topParticipants.forEach((jid, i) => {
      const number = jid.split("@")[0];
      text += `#${i + 1} 👤 @${number}\n`;
      // línea divertida según tipo
      const nivel = Math.floor(Math.random() * 100);
      switch (type) {
        case "infieles": text += ` 💔 Nivel de infiel: ${nivel}%\n`; break;
        case "putos": text += ` 🌈 Nivel de putazos: ${nivel}%\n`; break;
        case "geys": text += ` 🏳️‍🌈 Nivel de pluma: ${nivel}%\n`; break;
        case "travas": text += ` 💃 Nivel de coquetanómetro: ${nivel}%\n`; break;
        case "regalados": text += ` 🎁 Nivel de regalado: ${nivel}%\n`; break;
        case "pijudos": text += ` 🍆 Nivel de vergudos: ${nivel}%\n`; break;
        case "fieles": text += ` 💖 Nivel de lealtad: ${nivel}%\n`; break;
        case "romanticos": text += ` 💘 Nivel romántico: ${nivel}%\n`; break;
        case "pelotudos": text += ` 😇 Nivel de pelotudo: ${nivel}%\n`; break;
        case "machos": text += ` 💪 Nivel de machismo: ${nivel}%\n`; break;
      }
      text += "\n";
    });

    // 🔹 Menciones
    await socket.sendMessage(remoteJid, {
      text,
      mentions: topParticipants
    });
  },
};
