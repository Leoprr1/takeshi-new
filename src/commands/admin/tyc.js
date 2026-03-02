const { PREFIX } = require(`${BASE_DIR}/config`);
const { InvalidParameterError } = require(`${BASE_DIR}/errors`);
const {
  activateTyCGroup,
  deactivateTyCGroup,
} = require(`${BASE_DIR}/utils/tycmanager`);

module.exports = {
  name: "tyc",
  description: "Activa/desactiva el sistema de noticias TyC en el grupo.",
  commands: ["tyc"],
  usage: `${PREFIX}tyc (1/0)`,

  handle: async ({ args, sendReply, sendSuccessReact, remoteJid }) => {
    if (!args.length) {
      throw new InvalidParameterError(
        "¡Necesitas escribir 1 o 0 (activar o desactivar)!"
      );
    }

    const tycOn = args[0] === "1";
    const tycOff = args[0] === "0";

    if (!tycOn && !tycOff) {
      throw new InvalidParameterError(
        "¡Necesitas escribir 1 o 0 (activar o desactivar)!"
      );
    }

    if (tycOn) {
      activateTyCGroup(remoteJid);
    } else {
      deactivateTyCGroup(remoteJid);
    }

    await sendSuccessReact();
    const context = tycOn ? "activado" : "desactivado";
    await sendReply(`¡Sistema de noticias TyC ${context} en este grupo!`);
  },
};
