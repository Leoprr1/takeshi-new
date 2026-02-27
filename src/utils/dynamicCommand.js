/**
 * Direccionador
 * de comandos.
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
} = require("./database");
const { errorLog } = require("../utils/logger");
const { ONLY_GROUP_ID, PREFIX, BOT_EMOJI } = require("../config");
const { badMacHandler } = require("./badMacHandler");

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

  const activeGroup = isActiveGroup(remoteJid);

  // 🔹 Anti-link modificado para ignorar comandos sin links
  if (activeGroup && isActiveAntiLinkGroup(remoteJid)) {
    if (!userJid) return;

    const groupPrefix = getPrefix(remoteJid);

    // Si es un comando, revisar solo lo que está después del nombre del comando
    if (fullMessage.startsWith(groupPrefix)) {
      const afterCommand = fullMessage.slice(groupPrefix.length).trim();
      const parts = afterCommand.split(/\s+/);
      parts.shift(); // quitar nombre del comando
      const remainingText = parts.join(" ");

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
      // Mensajes normales con enlace
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

  const { type, command } = findCommandImport(commandName);

  if (ONLY_GROUP_ID && ONLY_GROUP_ID !== remoteJid) {
    return;
  }

  if (activeGroup) {
    if (
      !verifyPrefix(prefix, remoteJid) ||
      !hasTypeAndCommand({ type, command })
    ) {
      if (isActiveAutoResponderGroup(remoteJid)) {
        const response = getAutoResponderResponse(fullMessage);

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
      !(await isAdmin({ remoteJid, userJid, socket }))
    ) {
      await sendWarningReply(
        "¡Solo los administradores pueden ejecutar comandos!"
      );
      return;
    }
  }

  if (!isBotOwner({ userJid, isLid }) && !activeGroup) {
    
    if (
      verifyPrefix(prefix, remoteJid) &&
      hasTypeAndCommand({ type, command })
    ) {

      
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
    } else {
      return;
    }
  }

  if (!verifyPrefix(prefix, remoteJid)) {
    return;
  }

  const groupPrefix = getPrefix(remoteJid);

  if (fullMessage === groupPrefix) {
    await sendReact(BOT_EMOJI);
    await sendReply(
      `¡Este es mi prefijo! ¡Usa ${groupPrefix}menu para ver los comandos disponibles!`
    );
    return;
  }

  if (!hasTypeAndCommand({ type, command })) {
    await sendWarningReply(
      `¡Comando no encontrado! ¡Usa ${groupPrefix}menu para ver los comandos disponibles!`
    );
    return;
  }
  // 🚫 ANTI SPAM SYSTEM
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


  try {
    await command.handle({
      ...paramsHandler,
      type,
      startProcess,
      m: webMessage, // ✅ FIX agregado aquí
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
        } en el comando ${command.name}!
        
📄 *Detalles*: ${messageText}`
      );
    } else {
      errorLog("Error al ejecutar comando", error);
      await sendErrorReply(
        `Ocurrió un error al ejecutar el comando ${command.name}!
        
📄 *Detalles*: ${error.message}`
      );
    }
  }
};
