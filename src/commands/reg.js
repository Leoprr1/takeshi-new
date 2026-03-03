// 🔥 reg.js - Versión global con migración automática
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

function getProfilePic(userJid, socket) {
  try {
    return socket.profilePictureUrl(userJid).catch(() => null);
  } catch {
    return null;
  }
}

// =====================
// MIGRACIÓN DE PERFILES
// =====================
function migrateProfiles(users) {
  let migrated = false;
  const newUsers = {};

  for (const key in users) {
    // Si la clave es un userJid (termina con @s.whatsapp.net) o cualquier otro
    const user = users[key];
    if (key.includes("@")) {
      if (!newUsers[key]) {
        newUsers[key] = { ...user };
        migrated = true;
      }
    }
  }

  if (migrated) {
    saveUserProfiles(newUsers);
    console.log("✅ Migración de perfiles completada. Ahora todos son globales por userJid");
  }

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

    // Migrar automáticamente si hay perfiles antiguos
    users = migrateProfiles(users);

    // =====================
    // Mostrar perfil
    // =====================
    if (args[0].toLowerCase() === ".profile") {
      const user = users[userJid];
      if (!user) return sendReply("❌ No estás registrado. Usa `.reg nombre edad` primero.");
      const profileText = `👤 Perfil de ${user.name}
🗓 Edad: ${user.age}
📅 Registrado: ${new Date(user.registeredAt).toLocaleString()}
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

    // Validar parámetros
    if (args.length < 3) return sendReply("❌ Uso: .reg nombre edad");
    const name = args[1];
    const age = parseInt(args[2]);
    if (!name || isNaN(age)) return sendReply("❌ Nombre o edad inválidos");

    // Obtener foto de perfil
    let profilePic = null;
    try {
      profilePic = await socket.profilePictureUrl(userJid).catch(() => null);
    } catch {}

    if (command === ".reg") {
      if (users[userJid]) return sendReply("❌ Ya estás registrado. Usa `.reg2 nombre edad` para actualizar.");
      users[userJid] = {
        name,
        age,
        profilePic,
        registeredAt: Date.now(),
        commandsUsed: 0
      };
      saveUserProfiles(users);
      return sendReply(`✅ Registro completo: ${name}, ${age} años`);
    }

    if (command === ".reg2") {
      if (!users[userJid]) return sendReply("❌ No estás registrado. Usa `.reg nombre edad` primero.");
      users[userJid].name = name;
      users[userJid].age = age;
      users[userJid].profilePic = profilePic;
      saveUserProfiles(users);
      return sendReply(`✅ Registro actualizado: ${name}, ${age} años`);
    }
  },
};
