/**
 * Direccionador de comandos con verificación de registro de usuario
 *
 * @author Dev Gui
 */
const { checkAntiSpam } = require("./antiSpam");
const {
  DangerError,
  WarningError,
  InvalidParameterError,
} = require("../errors");
const { findCommandImport } = require(".");
const {
  verifyPrefix,
  hasTypeAndCommand,
  isLink,
  isAdmin,
  checkPermission,
  isBotOwner,
} = require("../middlewares");
const {
  isActiveGroup,
  getAutoResponderResponse,
  isActiveAutoResponderGroup,
  isActiveAntiLinkGroup,
  isActiveOnlyAdmins,
  getPrefix,
  readUserProfiles,
  saveUserProfiles,
} = require("./database");
const { errorLog } = require("../utils/logger");
const { ONLY_GROUP_ID, PREFIX, BOT_EMOJI } = require("../config");
const { badMacHandler } = require("./badMacHandler");

/**
 * Verifica si el usuario está registrado
 */
async function requireRegistration(userJid, sendWarningReply) {
  const users = readUserProfiles();
  if (!users[userJid]) {
    await sendWarningReply(
      "⚠️ Necesitas registrarte primero usando:\n.reg TuNombre Edad"
    );
    return false;
  }
  return true;
}

/**
 * Registra o actualiza usuario
 */
function registerUser(userJid, name, age, profilePic = null) {
  const users = readUserProfiles();
  const now = Date.now();

  if (!users[userJid]) {
    users[userJid] = {
      name,
      age,
      profilePic,
      registeredAt: now,
      commandsUsed: 0,
    };
  } else {
    users[userJid].name = name;
    users[userJid].age = age;
    if (profilePic) users[userJid].profilePic = profilePic;
  }

  saveUserProfiles(users);
}

/**
 * Incrementa contador de comandos usados
 */
function incrementCommandCount(userJid) {
  const users = readUserProfiles();
  if (users[userJid]) {
    users[userJid].commandsUsed = (users[userJid].commandsUsed || 0) + 1;
    saveUserProfiles(users);
  }
}

/**
 * @param {CommandHandleProps} paramsHandler
 * @param {number} startProcess
 */
exports.dynamicCommand = async (paramsHandler, startProcess) => {
  const {
    commandName,
    fullMessage,
    isLid,
    prefix,
    remoteJid,
    sendErrorReply,
    sendReact,
    sendReply,
    sendWarningReply,
    socket,
    userJid,
    webMessage,
  } = paramsHandler;

  // 🔹 Verificar si es un mensaje que inicia con prefijo
  const isCommandMessage = fullMessage.trim().startsWith(prefix);

  // 🔹 Si no es comando, solo permitir auto-responder en grupos activos
  if (!isCommandMessage) {
    if (isActiveAutoResponderGroup(remoteJid)) {
      const response = getAutoResponderResponse(fullMessage);
      if (response) await sendReply(response);
    }
    return;
  }

  // 🔹 Extraer comando y argumentos solo para registro de usuarios
  const withoutPrefix = fullMessage.trim().slice(prefix.length).trim();
  const [cmd, ...args] = withoutPrefix.split(/\s+/);

  // 🔹 Registrar usuario si es reg/reg2
  if (cmd === "reg" || cmd === "reg2") {
    if (args.length < 2) {
      await sendWarningReply(
        "Uso: .reg Nombre Edad\nEjemplo: .reg Leo 23"
      );
      return;
    }

    const name = args[0];
    const age = parseInt(args[1]);
    if (isNaN(age)) {
      await sendWarningReply("⚠️ Edad inválida.");
      return;
    }

    let profilePic = null;
    try {
      profilePic = await socket.profilePictureUrl(userJid).catch(() => null);
    } catch {}

    registerUser(userJid, name, age, profilePic);
    await sendReply(`✅ Usuario registrado correctamente como ${name}, ${age} años.`);
    return;
  }

  // 🔹 Importar comando usando commandName directamente
  const { type, command } = findCommandImport(commandName);

  // 🔹 Si el comando no existe, salir sin disparar registro
  if (!hasTypeAndCommand({ type, command })) {
    if (isActiveAutoResponderGroup(remoteJid)) {
      const response = getAutoResponderResponse(fullMessage);
      if (response) await sendReply(response);
    }
    return;
  }

  // 🔹 Requiere registro solo si no es reg/reg2
  if (!(await requireRegistration(userJid, sendWarningReply))) return;

  // 🔹 Incrementar contador de comandos usados
  incrementCommandCount(userJid);

  const activeGroup = isActiveGroup(remoteJid);

  // 🔹 Anti-link
  if (activeGroup && isActiveAntiLinkGroup(remoteJid)) {
    if (!userJid) return;
    const groupPrefix = getPrefix(remoteJid);

    if (fullMessage.startsWith(groupPrefix)) {
      const afterCommand = fullMessage.slice(groupPrefix.length).trim();
      const parts2 = afterCommand.split(/\s+/);
      parts2.shift();
      const remainingText = parts2.join(" ");
      if (isLink(remainingText)) {
        if (!(await isAdmin({ remoteJid, userJid, socket }))) {
          await socket.groupParticipantsUpdate(remoteJid, [userJid], "remove");
          await sendReply(
            "¡Anti-link activado! ¡Fuiste removido por enviar un enlace en un comando!"
          );
          await socket.sendMessage(remoteJid, {
            delete: {
              remoteJid,
              fromMe: false,
              id: webMessage.key.id,
              participant: webMessage.key.participant,
            },
          });
          return;
        }
      }
    } else if (isLink(fullMessage)) {
      if (!(await isAdmin({ remoteJid, userJid, socket }))) {
        await socket.groupParticipantsUpdate(remoteJid, [userJid], "remove");
        await sendReply(
          "¡Anti-link activado! ¡Fuiste removido por enviar un enlace!"
        );
        await socket.sendMessage(remoteJid, {
          delete: {
            remoteJid,
            fromMe: false,
            id: webMessage.key.id,
            participant: webMessage.key.participant,
          },
        });
        return;
      }
    }
  }

  if (ONLY_GROUP_ID && ONLY_GROUP_ID !== remoteJid) return;

  if (activeGroup) {
    if (!verifyPrefix(prefix, remoteJid) || !hasTypeAndCommand({ type, command })) {
      if (isActiveAutoResponderGroup(remoteJid)) {
        const response = getAutoResponderResponse(fullMessage);
        if (response) await sendReply(response);
      }
      return;
    }

    if (!(await checkPermission({ type, ...paramsHandler }))) {
      await sendErrorReply("¡No tienes permiso para ejecutar este comando!");
      return;
    }

    if (isActiveOnlyAdmins(remoteJid) && !(await isAdmin({ remoteJid, userJid, socket }))) {
      await sendWarningReply("¡Solo los administradores pueden ejecutar comandos!");
      return;
    }
  }

  if (!isBotOwner({ userJid, isLid }) && !activeGroup) {
    if (verifyPrefix(prefix, remoteJid) && hasTypeAndCommand({ type, command })) {
      if (command.name !== "on") {
        await sendWarningReply(
          "¡Este grupo está desactivado! ¡Pide al dueño del grupo que active el bot!"
        );
        return;
      }
      if (!(await checkPermission({ type, ...paramsHandler }))) {
        await sendErrorReply("¡No tienes permiso para ejecutar este comando!");
        return;
      }
    } else return;
  }

  if (!verifyPrefix(prefix, remoteJid)) return;

  const groupPrefix = getPrefix(remoteJid);
  if (fullMessage === groupPrefix) {
    await sendReact(BOT_EMOJI);
    await sendReply(
      `¡Este es mi prefijo! ¡Usa ${groupPrefix}menu para ver los comandos disponibles!`
    );
    return;
  }

  // 🔹 Anti-spam
  if (!isBotOwner({ userJid, isLid })) {
    const antiSpam = checkAntiSpam(userJid);
    if (antiSpam.blocked) {
      if (antiSpam.suspended) {
        await sendErrorReply(
          `🚫 Has sido suspendido por spam.\nIntenta nuevamente en ${antiSpam.remainingMinutes} minuto(s).`
        );
      } else {
        await sendWarningReply(
          `⏳ Espera ${antiSpam.remainingSeconds}s antes de usar otro comando.\nAdvertencias restantes: ${antiSpam.remainingWarnings}`
        );
      }
      return;
    }
  }

  // 🔹 Ejecutar comando
  try {
    await command.handle({
      ...paramsHandler,
      type,
      startProcess,
      m: webMessage,
    });
  } catch (error) {
    if (badMacHandler.handleError(error, `command:${command?.name}`)) {
      await sendWarningReply(
        "Error temporal de sincronización. Inténtalo de nuevo en unos segundos."
      );
      return;
    }

    if (badMacHandler.isSessionError(error)) {
      errorLog(
        `Error de sesión durante la ejecución del comando ${command?.name}: ${error.message}`
      );
      await sendWarningReply(
        "Error de comunicación. Intenta ejecutar el comando nuevamente."
      );
      return;
    }

    if (error instanceof InvalidParameterError) {
      await sendWarningReply(`¡Parámetros inválidos! ${error.message}`);
    } else if (error instanceof WarningError) {
      await sendWarningReply(error.message);
    } else if (error instanceof DangerError) {
      await sendErrorReply(error.message);
    } else if (error.isAxiosError) {
      const messageText = error.response?.data?.message || error.message;
      const url = error.config?.url || "URL no disponible";
      const isSpiderAPIError = url.includes("api.spiderx.com.br");
      await sendErrorReply(
        `Ocurrió un error al ejecutar una llamada remota a ${
          isSpiderAPIError ? "la API de Spider X" : url
        } en el comando ${command.name}!\n📄 *Detalles*: ${messageText}`
      );
    } else {
      errorLog("Error al ejecutar comando", error);
      await sendErrorReply(
        `Ocurrió un error al ejecutar el comando ${command.name}!\n📄 *Detalles*: ${error.message}`
      );
    }
  }
};
