const { PREFIX } = require(`${BASE_DIR}/config`);

module.exports = {
  name: "tag",
  description: "Este comando marcará todos do grupo",
  commands: ["tag", "to-tag"],
  usage: `${PREFIX}hidetag motivo`,
  /**
   * @param {CommandHandleProps} props
   * @returns {Promise<void>}
   */
  handle: async ({ fullArgs, sendText, socket, remoteJid, sendReact }) => {
    const { participants } = await socket.groupMetadata(remoteJid);

    const mentions = participants.map(({ id }) => id);

    await sendReact("📢");

    await sendText(fullArgs || `\u200B`, mentions);
  },
};
