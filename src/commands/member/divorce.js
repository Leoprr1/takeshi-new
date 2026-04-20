const { onlyNumbers } = require(`${BASE_DIR}/utils`);
const { divorce, marry, isMarried } = require(`${BASE_DIR}/utils/marriageDB`);

module.exports = {
  name: "divorce",
  commands: ["divorce", "divorcio"],

  handle: async ({
    sendText,
    sendErrorReply,
    userJid,
  }) => {

    if (!isMarried(userJid)) {
      await sendErrorReply("No estás casado 💔");
      return;
    }

    const partner = marry(userJid);

    divorce(userJid);

    const userNumber = onlyNumbers(userJid);
    const partnerNumber = onlyNumbers(partner);

    await sendText(
`💔 *DIVORCIO CONFIRMADO*

@${userNumber} y @${partnerNumber} ya no están casados...

El amor terminó 🥀`,
      [userJid, partner]
    );
  },
};
