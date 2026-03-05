const { PREFIX } = require(`${BASE_DIR}/config`);
const { InvalidParameterError, WarningError } = require(`${BASE_DIR}/errors`);
const { readJSON, writeJSON } = require(`${BASE_DIR}/utils/database`);

module.exports = {
  name: "newtyc",
  description: "Controla el sistema de noticias TyC.",
  commands: ["newtyc"],
  usage: `${PREFIX}newtyc (on/off/status/reset)`,

  /**
   * @param {CommandHandleProps} props
   */
  handle: async ({ args, sendReply, sendSuccessReact }) => {

    if (!args.length) {
      throw new InvalidParameterError(
        "Usa: on / off / status / reset"
      );
    }

    const option = args[0].toLowerCase();

    let db = readJSON("news-tyc");

    if (!db || typeof db !== "object") db = {};
    if (db.enabled === undefined) db.enabled = true;
    if (!Array.isArray(db.lastPosts)) db.lastPosts = [];
    if (!Array.isArray(db.groupsEnabled)) db.groupsEnabled = [];

    // -------------------
    // STATUS
    // -------------------
    if (option === "status") {

      const status = db.enabled ? "🟢 ACTIVADO" : "🔴 DESACTIVADO";

      return sendReply(
        `📡 Estado del sistema TyC\n\n` +
        `Estado: ${status}\n` +
        `Posts guardados: ${db.lastPosts.length}\n` +
        `Grupos habilitados: ${db.groupsEnabled.length}`
      );
    }

    // -------------------
    // ON
    // -------------------
    if (option === "on") {

      if (db.enabled) {
        throw new WarningError("¡El sistema TyC ya está activado!");
      }

      db.enabled = true;

      writeJSON("news-tyc", db);

      await sendSuccessReact();

      return sendReply("🟢 Sistema TyC activado.");
    }

    // -------------------
    // OFF
    // -------------------
    if (option === "off") {

      if (!db.enabled) {
        throw new WarningError("¡El sistema TyC ya está desactivado!");
      }

      db.enabled = false;

      writeJSON("news-tyc", db);

      await sendSuccessReact();

      return sendReply("🔴 Sistema TyC desactivado.");
    }

    // -------------------
    // RESET
    // -------------------
    if (option === "reset") {

      db.lastPosts = [];

      writeJSON("news-tyc", db);

      await sendSuccessReact();

      return sendReply("♻️ Historial de publicaciones reiniciado.");
    }

    throw new InvalidParameterError(
      "Opciones válidas: on / off / status / reset"
    );
  },
};
