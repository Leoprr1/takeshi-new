const { onlyNumbers } = require(`${BASE_DIR}/utils`);
const { getMarriage, isMarried } = require(`${BASE_DIR}/utils/marriageDB`);

module.exports = {
  name: "infomatrimonio",
  commands: ["infomatrimonio", "mimatrimonio"],

  handle: async ({
    sendText,
    sendErrorReply,
    userJid,
  }) => {

    // 🔎 Verifica si está casado
    if (!isMarried(userJid)) {
      await sendErrorReply("No estás casado 💔");
      return;
    }

    const marriage = getMarriage(userJid);

    // 🔐 Seguridad extra
    if (!marriage || !marriage.partner || !marriage.since) {
      await sendErrorReply("Datos de matrimonio corruptos 💔");
      return;
    }

    const partnerJid = marriage.partner;
    const since = marriage.since;

    const now = Date.now();
    const diff = now - since;

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);

    const partnerNumber = onlyNumbers(partnerJid);
    const userNumber = onlyNumbers(userJid);

    const date = new Date(since).toLocaleDateString();

    await sendText(
`💍 *INFORMACIÓN DE MATRIMONIO* 💍

🤵 @${userNumber}
👰 @${partnerNumber}

📅 Fecha de boda: ${date}

⏳ Tiempo juntos:
❤️ ${days} días
🕒 ${hours} horas
⏱ ${minutes} minutos

Que viva el amor ✨`,
      [partnerJid, userJid] // ← ESTO hace que los etiquete
    );
  },
};
