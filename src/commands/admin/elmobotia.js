const { PREFIX } = require(`${BASE_DIR}/config`);
const { InvalidParameterError } = require(`${BASE_DIR}/errors`);
const {
  activateElmoBotiaGroup,
  deactivateElmoBotiaGroup,
} = require(`${BASE_DIR}/utils/elmoBotiaManager`);

module.exports = {
  name: "elmobotia",
  description: "Activa/desactiva la función de ElmoBotia en el grupo.",
  commands: ["elmobotia"],
  usage: `${PREFIX}elmobotia (1/0)`,

  handle: async ({ args, sendReply, sendSuccessReact, remoteJid }) => {
    if (!args.length) {
      throw new InvalidParameterError(
        "¡Necesitas escribir 1 o 0 (activar o desactivar)!"
      );
    }

    const elmobotiaOn = args[0] === "1";
    const elmobotiaOff = args[0] === "0";

    if (!elmobotiaOn && !elmobotiaOff) {
      throw new InvalidParameterError(
        "¡Necesitas escribir 1 o 0 (activar o desactivar)!"
      );
    }

    if (elmobotiaOn) {
      activateElmoBotiaGroup(remoteJid);
    } else {
      deactivateElmoBotiaGroup(remoteJid);
    }

    await sendSuccessReact();
    const context = elmobotiaOn ? "activado" : "desactivado";
    await sendReply(`¡ElmoBotia ${context} en este grupo con éxito!`);
  },
};
