const { ASSETS_DIR } = require(`${BASE_DIR}/config`);
const { onlyNumbers } = require(`${BASE_DIR}/utils`);
const { marry, isMarried } = require(`${BASE_DIR}/utils/marriageDB`);
const path = require("node:path");

module.exports = {
  name: "accept",
  commands: ["accept"],

  handle: async ({
    sendGifFromFile,
    sendAudioFromFile,
    sendErrorReply,
    userJid,
  }) => {

    if (!global.marriageProposals || !global.marriageProposals[userJid]) {
      await sendErrorReply("No tienes propuesta pendiente 💔");
      return;
    }

    const proposerJid = global.marriageProposals[userJid];

    if (isMarried(userJid) || isMarried(proposerJid)) {
      await sendErrorReply("Uno de los dos ya está casado 💔");
      return;
    }

    delete global.marriageProposals[userJid];

    marry(userJid, proposerJid);

    const proposerNumber = onlyNumbers(proposerJid);
    const accepterNumber = onlyNumbers(userJid);

    await sendGifFromFile(
      path.resolve(ASSETS_DIR, "images", "wedding", "marry.mp4"),
`💒✨ ¡BODA CONFIRMADA! ✨💒

@${proposerNumber} y @${accepterNumber}

Ahora están oficialmente casados 💍❤️`,
      [proposerJid, userJid]
    );

    await sendAudioFromFile(
      path.resolve(ASSETS_DIR, "audio", "wedding.mp3")
    );
  },
};
