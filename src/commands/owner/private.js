const { PREFIX } = require(`${BASE_DIR}/config`);
const { setPrivateMode, isPrivateModeEnabled } = require(`${BASE_DIR}/utils/privatemode`);
const { isBotOwner } = require(`${BASE_DIR}/middlewares`);

module.exports = {
  name: "private",
  description: "Activa o desactiva comandos en privado",
  commands: ["private"],
  usage: `${PREFIX}private on/off`,

  handle: async ({ args, sendReply, userJid, isLid }) => {

    // 🔒 SOLO OWNER
    if (!isBotOwner({ userJid, isLid })) {
      return sendReply("❌ Este comando solo puede usarlo el owner del bot.");
    }

    if (!args[0]) {
      const state = isPrivateModeEnabled() ? "ACTIVADOS" : "DESACTIVADOS";
      return sendReply(`Los comandos en privado están *${state}*`);
    }

    const option = args[0].toLowerCase();

    if (option === "on") {
      setPrivateMode(true);
      return sendReply("✅ Comandos en privado ACTIVADOS.");
    }

    if (option === "off") {
      setPrivateMode(false);
      return sendReply("🚫 Comandos en privado DESACTIVADOS.");
    }

    return sendReply(`Uso correcto: ${PREFIX}private on/off`);
  },
};
