const { isGroup } = require(`${BASE_DIR}/utils`);
const { errorLog } = require(`${BASE_DIR}/utils/logger`);

const { PREFIX, ASSETS_DIR } = require(`${BASE_DIR}/config`);
const { InvalidParameterError } = require(`${BASE_DIR}/errors`);
const { getProfileImageData } = require(`${BASE_DIR}/services/baileys`);

module.exports = {
  name: "profile",
  description: "Muestra información de un usuario",
  commands: ["profile"],
  usage: `${PREFIX}profile o profile @usuario`,
  /**
   * @param {CommandHandleProps} props
   * @returns {Promise<void>}
   */
  handle: async ({
    args,
    socket,
    remoteJid,
    userJid,
    sendErrorReply,
    sendWaitReply,
    sendSuccessReact,
    mentionedJid,
  }) => {
    if (!isGroup(remoteJid)) {
      throw new InvalidParameterError(
        "Este comando solo puede ser usado en un grupo."
      );
    }

    const targetJid = mentionedJid?.[0] || replyJid || toUserJid(args[0]);
    

    await sendWaitReply("Cargando perfil...");

    try {
      let profilePicUrl;
      let userName;
      let userRole = "Miembro";

      try {
        const { profileImage } = await getProfileImageData(socket, targetJid);
        profilePicUrl = profileImage || `${ASSETS_DIR}/images/default-user.png`;

        const contactInfo = await socket.onWhatsApp(targetJid);
        userName = contactInfo[0]?.name || "Usuario Desconocido";
      } catch (error) {
        errorLog(
          `Error al intentar obtener datos del usuario ${targetJid}: ${JSON.stringify(
            error,
            null,
            2
          )}`
        );
        profilePicUrl = `${ASSETS_DIR}/images/default-user.png`;
      }

      const groupMetadata = await socket.groupMetadata(remoteJid);

      const participant = groupMetadata.participants.find(
        (participant) => participant.id === targetJid
      );

      if (participant?.admin) {
        userRole = "Administrador";
      }

      const randomPercent = Math.floor(Math.random() * 100);
      const programPrice = (Math.random() * 5000 + 1000).toFixed(2);
      const beautyLevel = Math.floor(Math.random() * 100) + 1;

      const mensagem = `
👤 *Nombre:* @${targetJid.split("@")[0]}
🎖️ *Cargo:* ${userRole}

🌚 *Programa:* R$ ${programPrice}
🐮 *Ganado:* ${randomPercent + 7 || 5}%
🎱 *Pasiva:* ${randomPercent + 5 || 10}%
✨ *Belleza:* ${beautyLevel}%`;

      const mentions = [targetJid];

      await sendSuccessReact();

      await socket.sendMessage(remoteJid, {
        image: { url: profilePicUrl },
        caption: mensagem,
        mentions: mentions,
      });
    } catch (error) {
      console.error(error);
      sendErrorReply("Ocurrió un error al intentar verificar el perfil.");
    }
  },
};
