const { PREFIX } = require(`${BASE_DIR}/config`);
const { activateGroup, deactivateGroup } = require(`${BASE_DIR}/utils/database`);
const { isGroupGloballyDisabled } = require(`${BASE_DIR}/utils/globalGroups`);

module.exports = {
  name: "group-toggle",
  description: "Activa o desactiva el bot en el grupo",
  commands: ["on", "off"],
  usage: `${PREFIX}on / ${PREFIX}off`,

  /**
   * @param {CommandHandleProps} props
   * @returns {Promise<void>}
   */
  handle: async ({
    commandName,
    sendSuccessReply,
    remoteJid,
    isGroup
  }) => {

    if (!isGroup) {
      throw new WarningError("Este comando debe usarse dentro de un grupo.");
    }

    // 🚫 Bloqueo si el owner desactivó el grupo globalmente
    if (isGroupGloballyDisabled(remoteJid)) {
      throw new WarningError(
        "❌ Este grupo fue desactivado globalmente por el owner."
      );
    }

    // 🔴 DESACTIVAR
    if (commandName === "off") {

      deactivateGroup(remoteJid);

      return await sendSuccessReply("🚫 ¡Bot desactivado en el grupo!");
    }

    // 🟢 ACTIVAR
    if (commandName === "on") {

      activateGroup(remoteJid);

      return await sendSuccessReply("✅ ¡Bot activado en el grupo!");
    }

  },
};
