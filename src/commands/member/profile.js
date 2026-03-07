const { isGroup } = require(`${BASE_DIR}/utils`);
const { toUserJid } = require(`${BASE_DIR}/utils`);
const { errorLog } = require(`${BASE_DIR}/utils/logger`);
const { PREFIX, ASSETS_DIR } = require(`${BASE_DIR}/config`);
const { InvalidParameterError } = require(`${BASE_DIR}/errors`);
const { getProfileImageData } = require(`${BASE_DIR}/services/baileys`);

const fs = require("fs");
const path = require("path");

const USERS_FILE = path.resolve(__dirname, "../../../database/users.json");
const RPG_FILE = path.resolve(__dirname, "../../database/rpg.json");

function readJSON(file) {
  try {
    if (!fs.existsSync(file)) return {};
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return {};
  }
}

function normalizeJid(jid) {
  const number = jid.split("@")[0];
  return `${number}@`;
}

// rango aventurero (igual que tu rpg.js)
function getRangoAventurero(nivel) {
  if (nivel >= 176) return { rango: "SSS", emoji: "🟣" };
  if (nivel >= 151) return { rango: "SS", emoji: "🔴" };
  if (nivel >= 131) return { rango: "S", emoji: "🟠" };
  if (nivel >= 101) return { rango: "A", emoji: "🟡" };
  if (nivel >= 71) return { rango: "B", emoji: "🟢" };
  if (nivel >= 41) return { rango: "C", emoji: "🔵" };
  if (nivel >= 21) return { rango: "D", emoji: "🟣" };
  if (nivel >= 11) return { rango: "E", emoji: "⚪" };
  return { rango: "F", emoji: "⚫" };
}

// tiempo desde registro
function tiempoRegistro(timestamp) {
  if (!timestamp) return "Desconocido";

  const diff = Date.now() - timestamp;

  const dias = Math.floor(diff / 86400000);
  const horas = Math.floor(diff / 3600000);
  const minutos = Math.floor(diff / 60000);

  if (dias > 0) return `${dias} día(s)`;
  if (horas > 0) return `${horas} hora(s)`;
  return `${minutos} minuto(s)`;
}

module.exports = {
  name: "profile",
  description: "Muestra información de un usuario",
  commands: ["profile"],
  usage: `${PREFIX}profile o profile @usuario`,

  handle: async ({
    args,
    socket,
    remoteJid,
    userJid,
    sendErrorReply,
    sendWaitReply,
    sendSuccessReact,
    mentionedJid,
    replyJid,
    toUserJid,
  }) => {

    if (!isGroup(remoteJid)) {
      throw new InvalidParameterError(
        "Este comando solo puede ser usado en un grupo."
      );
    }

    const targetJid =
      mentionedJid?.[0] ||
      replyJid ||
      (args[0] ? toUserJid(args[0]) : userJid);

    await sendWaitReply("Cargando perfil...");

    try {

      let profilePicUrl;
      let userRole = "Miembro";

      try {
        const { profileImage } = await getProfileImageData(socket, targetJid);
        profilePicUrl = profileImage || `${ASSETS_DIR}/images/default-user.png`;
      } catch (error) {
        errorLog(`Error obteniendo foto de ${targetJid}`);
        profilePicUrl = `${ASSETS_DIR}/images/default-user.png`;
      }

      const groupMetadata = await socket.groupMetadata(remoteJid);

      const participant = groupMetadata.participants.find(
        (p) => p.id === targetJid
      );

      if (participant?.admin) userRole = "Administrador";

      // ====================
      // LEER DATABASE
      // ====================

      const users = readJSON(USERS_FILE);
      const rpg = readJSON(RPG_FILE);

      const dbUser = users[targetJid] || {};
      const rpgUser = rpg[targetJid] || {};

      const age = dbUser.age || "No registrada";
      const commandsUsed = dbUser.commandsUsed || 0;
      const name = dbUser.name || `@${targetJid.split("@")[0]}`;

      const tiempo = tiempoRegistro(dbUser.registeredAt);

      const nivel = rpgUser.nivel || 0;
      const monedas = rpgUser.monedas || 0;

      const rango = getRangoAventurero(nivel);

      // ====================
      // MENSAJE
      // ====================

      const mensagem = `
👤 *Nombre:* ${name}
🎖️ *Cargo:* ${userRole}
🎂 *Edad:* ${age}

📅 *Registrado hace:* ${tiempo}
⚡ *Comandos usados:* ${commandsUsed}

⚔️ *Nivel RPG:* ${nivel}
🏅 *Rango Aventurero:* ${rango.emoji} ${rango.rango}
💰 *Monedas:* ${monedas.toLocaleString("es-AR")}
`;

      await sendSuccessReact();

      await socket.sendMessage(remoteJid, {
        image: { url: profilePicUrl },
        caption: mensagem,
        mentions: [targetJid],
      });

    } catch (error) {
      console.error(error);
      sendErrorReply("Ocurrió un error al intentar verificar el perfil.");
    }
  },
};
