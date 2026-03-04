// 🔥 reg.js - Versión global con soporte privado y grupos
const fs = require("fs");
const path = require("path");
const databasePath = path.resolve(__dirname, "../../database");
const USERS_FILE = path.resolve(databasePath, "users.json");

// =====================
// UTILIDADES
// =====================
function readUserProfiles() {
  try {
    if (!fs.existsSync(USERS_FILE)) return {};
    return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
  } catch (err) {
    console.error("❌ Error leyendo users.json:", err);
    return {};
  }
}

function saveUserProfiles(profiles) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(profiles, null, 2));
  } catch (err) {
    console.error("❌ Error escribiendo users.json:", err);
  }
}

async function getProfilePic(jid, socket) {
  try {
    // ⚡ usar JID real completo para WhatsApp
    if (!jid) return null;
    return await socket.profilePictureUrl(jid).catch(() => null);
  } catch {
    return null;
  }
}

// =====================
// Función para normalizar userJid para DB
// =====================
const normalizeJid = (jid) => {
  if (!jid) return "";
  const number = jid.split("@")[0];
  return `${number}@`;
};

// =====================
// MIGRACIÓN DE PERFILES
// =====================
function migrateProfiles(users) {
  let migrated = false;
  const newUsers = {};

  for (const key in users) {
    const user = users[key];
    const normalizedJid = normalizeJid(key);
    if (!newUsers[normalizedJid]) {
      newUsers[normalizedJid] = { ...user };
      migrated = true;
    }
  }

  if (migrated) saveUserProfiles(newUsers);

  return newUsers;
}

// =====================
// COMANDO
// =====================
module.exports = {
  name: "reg",
  description: "Registrate o actualiza tu registro, también muestra perfil con .profile",
  usage: ".reg nombre edad | .reg2 nombre edad | .profile",
  async handle({ fullMessage, userJid, socket, sendReply }) {
    const args = fullMessage.trim().split(/\s+/);
    let users = readUserProfiles();
    users = migrateProfiles(users);

    const saveJid = normalizeJid(userJid); // clave en la DB

    // =====================
    // Mostrar perfil
    // =====================
    if (args[0].toLowerCase() === ".profile") {
      const user = users[saveJid];
      if (!user) return sendReply("❌ No estás registrado. Usa `.reg nombre edad` primero.");

      // ⚡ Si no tiene profilePic guardada, intenta obtenerla con JID real
      if (!user.profilePic) {
        user.profilePic = await getProfilePic(userJid, socket); // ⚠️ usar JID real
        users[saveJid] = user;
        saveUserProfiles(users);
      }

      // Mostrar nombre real, no numero@
      const profileText = `👤 *Nombre:* ${user.name}
🎖️ *Cargo:* Miembro

🌚 *Programa:* ${user.program || "No registrado"}
🐮 *Ganado:* ${user.ganado || "0%"}
🎱 *Pasiva:* ${user.pasiva || "0%"}
✨ *Belleza:* ${user.belleza || "0%"}
🖼 Foto: ${user.profilePic || "No disponible"}
⚡ Comandos usados: ${user.commandsUsed || 0}`;

      return sendReply(profileText);
    }

    // =====================
    // Registro o actualización
    // =====================
    const command = args[0].toLowerCase();
    if (command !== ".reg" && command !== ".reg2") {
      return sendReply("❌ Comando inválido. Usa `.reg` o `.reg2` o `.profile`");
    }

    if (args.length < 3) return sendReply("❌ Uso: .reg nombre edad");
    const name = args[1];
    const age = parseInt(args[2]);
    if (!name || isNaN(age)) return sendReply("❌ Nombre o edad inválidos");

    // Foto de perfil usando JID real
    const profilePic = await getProfilePic(userJid, socket);

    if (command === ".reg") {
      if (users[saveJid]) return sendReply("❌ Ya estás registrado. Usa `.reg2 nombre edad` para actualizar.");

      users[saveJid] = {
        name,
        age,
        profilePic,
        registeredAt: Date.now(),
        commandsUsed: 0,
        groups: userJid.includes("@g.us") ? [userJid] : []
      };
      saveUserProfiles(users);
      return sendReply(`✅ Registro completo: ${name}, ${age} años`);
    }

    if (command === ".reg2") {
      if (!users[saveJid]) return sendReply("❌ No estás registrado. Usa `.reg nombre edad` primero.");

      users[saveJid].name = name;
      users[saveJid].age = age;
      users[saveJid].profilePic = profilePic || users[saveJid].profilePic;
      if (userJid.includes("@g.us") && !users[saveJid].groups.includes(userJid)) {
        users[saveJid].groups.push(userJid);
      }
      saveUserProfiles(users);
      return sendReply(`✅ Registro actualizado: ${name}, ${age} años`);
    }
  },
};
