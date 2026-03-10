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
  isAdmin,
  checkPermission,
  isBotOwner,
} = require("../middlewares");

const {
  isActiveGroup,
  isActiveAntiLinkGroup,
  isActiveOnlyAdmins,
  getPrefix,
  readUserProfiles,
  saveUserProfiles,
} = require("./database");

const {
  getAutoResponderResponse,
  isActiveAutoResponderGroup,
} = require("./auto-responder");

const { errorLog } = require("../utils/logger");

const { ONLY_GROUP_ID, BOT_EMOJI } = require("../config");

const { badMacHandler } = require("./badMacHandler");
const { isPrivateModeEnabled } = require("./privatemode");



/* =====================================================
   🔹 CACHE SYSTEM (MEJORA DE PERFORMANCE)
===================================================== */

const commandCache = new Map();
const adminCache = new Map();
let usersCache = readUserProfiles();

/* cache admins 60s */
async function isAdminCached({ remoteJid, userJid, socket }) {

  const globalCache = global.GROUP_CACHE?.[remoteJid];

  if (globalCache && Date.now() - globalCache.time < 600000) {
    return globalCache.admins.includes(userJid);
  }

  const metadata = await socket.groupMetadata(remoteJid);

  const admins = metadata.participants
    .filter(p => p.admin)
    .map(p => p.id);

  global.GROUP_CACHE[remoteJid] = {
    admins,
    participants: metadata.participants.length,
    time: Date.now()
  };

  return admins.includes(userJid);
}


/* cache comandos */
function getCommandCached(name) {

  if (commandCache.has(name)) {
    return commandCache.get(name);
  }

  const cmd = findCommandImport(name);

  commandCache.set(name, cmd);

  return cmd;
}

/* autosave usuarios cada 30s */
setInterval(() => {
  try {
    saveUserProfiles(usersCache);
  } catch {}
}, 30000);


/**
 * Verifica si el usuario está registrado
 */
async function requireRegistration(userJid, sendWarningReply) {

  if (!usersCache[userJid]) {
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

  const now = Date.now();

  if (!usersCache[userJid]) {
    usersCache[userJid] = {
      name,
      age,
      profilePic,
      registeredAt: now,
      commandsUsed: 0,
    };
  } else {
    usersCache[userJid].name = name;
    usersCache[userJid].age = age;

    if (profilePic) {
      usersCache[userJid].profilePic = profilePic;
    }
  }

  saveUserProfiles(usersCache);
}

/**
 * Incrementa contador de comandos usados
 */
function incrementCommandCount(userJid) {

  if (usersCache[userJid]) {
    usersCache[userJid].commandsUsed =
      (usersCache[userJid].commandsUsed || 0) + 1;
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

  const message = (fullMessage || "").trim();

  const activeGroup = isActiveGroup(remoteJid);


  /* =========================================
     🔹 ANTILINK GLOBAL
  ========================================= */

  if (activeGroup && isActiveAntiLinkGroup(remoteJid)) {

    if (!userJid) return;

    if (webMessage.key.fromMe) return;

    if (
      message.includes("http") ||
      message.includes("www.") ||
      message.includes("chat.whatsapp.com")
    ) {

      const linkRegex =
        /(https?:\/\/[^\s]+|www\.[^\s]+|chat\.whatsapp\.com\/[^\s]+)/i;

      if (linkRegex.test(message)) {

        const userIsAdmin = await isAdminCached({
          remoteJid,
          userJid,
          socket,
        });

        if (!userIsAdmin) {

          await sendReply(
            "🚫 Anti-link activado. Usuario removido por enviar enlaces."
          );

          await socket.groupParticipantsUpdate(remoteJid, [userJid], "remove");

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
  }


  /* =========================================
     🔹 DETECTAR COMANDO
  ========================================= */

  const isCommandMessage = message.startsWith(prefix);

  /* =========================================
   🔹 BLOQUEAR COMANDOS EN PRIVADO
========================================= */
if (!remoteJid.endsWith("@g.us") && !isPrivateModeEnabled() && !isBotOwner({ userJid, isLid })) {
  return;
}

  if (!isCommandMessage) {

    if (isActiveAutoResponderGroup(remoteJid)) {

      const response = getAutoResponderResponse(message);

      if (response) {
        await sendReply(response);
      }
    }

    return;
  }


  /* =========================================
     🔹 EXTRAER COMANDO
  ========================================= */

  const withoutPrefix = message.slice(prefix.length).trim();

  const [cmd, ...args] = withoutPrefix.split(/\s+/);


  /* =========================================
     🔹 REGISTRO
  ========================================= */

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

    await sendReply(
      `✅ Usuario registrado correctamente como ${name}, ${age} años.`
    );

    return;
  }


  /* =========================================
     🔹 BUSCAR COMANDO
  ========================================= */

  const { type, command } = getCommandCached(commandName);


  if (!hasTypeAndCommand({ type, command })) {

    if (isActiveAutoResponderGroup(remoteJid)) {

      const response = getAutoResponderResponse(message);

      if (response) {
        await sendReply(response);
      }
    }

    return;
  }


  /* =========================================
     🔹 VERIFICAR REGISTRO
  ========================================= */

  if (!(await requireRegistration(userJid, sendWarningReply))) {
    return;
  }

  incrementCommandCount(userJid);


  if (ONLY_GROUP_ID && ONLY_GROUP_ID !== remoteJid) {
    return;
  }


  /* =========================================
     🔹 PERMISOS EN GRUPO
  ========================================= */

  if (activeGroup) {

    if (
      !verifyPrefix(prefix, remoteJid) ||
      !hasTypeAndCommand({ type, command })
    ) {

      if (isActiveAutoResponderGroup(remoteJid)) {

        const response = getAutoResponderResponse(message);

        if (response) {
          await sendReply(response);
        }
      }

      return;
    }

    if (!(await checkPermission({ type, ...paramsHandler }))) {
      await sendErrorReply("¡No tienes permiso para ejecutar este comando!");
      return;
    }

    if (
      isActiveOnlyAdmins(remoteJid) &&
      !(await isAdminCached({ remoteJid, userJid, socket }))
    ) {
      await sendWarningReply(
        "¡Solo los administradores pueden ejecutar comandos!"
      );
      return;
    }
  }


  /* =========================================
     🔹 GRUPOS DESACTIVADOS
  ========================================= */

  if (!isBotOwner({ userJid, isLid }) && !activeGroup) {

    if (verifyPrefix(prefix, remoteJid) && hasTypeAndCommand({ type, command })) {

      if (command.name !== "on") {

        await sendWarningReply(
          "¡Este grupo está desactivado! ¡Pide al dueño del grupo que active el bot!"
        );

        return;
      }

      if (!(await checkPermission({ type, ...paramsHandler }))) {

        await sendErrorReply(
          "¡No tienes permiso para ejecutar este comando!"
        );

        return;
      }

    } else {
      return;
    }
  }


  if (!verifyPrefix(prefix, remoteJid)) {
    return;
  }


  const groupPrefix = getPrefix(remoteJid);


  if (message === groupPrefix) {

    await sendReact(BOT_EMOJI);

    await sendReply(
      `¡Este es mi prefijo! ¡Usa ${groupPrefix}menu para ver los comandos disponibles!`
    );

    return;
  }


  /* =========================================
     🔹 ANTI-SPAM
  ========================================= */

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


  const mentionedJid =
    webMessage?.message?.extendedTextMessage?.contextInfo?.mentionedJid ||
    webMessage?.message?.imageMessage?.contextInfo?.mentionedJid ||
    webMessage?.message?.videoMessage?.contextInfo?.mentionedJid ||
    webMessage?.message?.conversation?.contextInfo?.mentionedJid ||
    [];


  /* =========================================
     🔹 EJECUTAR COMANDO
  ========================================= */

  try {

    await command.handle({
      ...paramsHandler,
      type,
      startProcess,
      m: webMessage,
      mentionedJid,
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
