const path = require("path");
const fs = require("fs");
const { connect } = require("./src/connection");
const { load } = require("./src/loader");
const { badMacHandler } = require("./src/utils/badMacHandler");
const {
  successLog,
  errorLog,
  bannerLog,
  infoLog,
  warningLog,
} = require("./src/utils/logger");
const { startTyCSystem } = require("./src/utils/newstyc");
const { loadJSONFolder, startAutoSave } = require("./src/utils/jsoncache");
const startCleaner = require("./cleaner.js");

// ----------------------------
// CACHE GLOBAL DE GRUPOS
// ----------------------------
global.GROUP_CACHE = global.GROUP_CACHE || {};
const MAX_GROUP_CACHE = 300;

// ----------------------------
// Cargar bases de datos JSON
// ----------------------------
loadJSONFolder(path.join(__dirname, "database"));
loadJSONFolder(path.join(__dirname, "src/database"));
startAutoSave(60000);

global.IDROPS = global.IDROPS || [];
global.TEMP_QUEUE = global.TEMP_QUEUE || [];
global.EVENT_QUEUE = global.EVENT_QUEUE || [];
global.LOGS = global.LOGS || [];
global.reconnecting = global.reconnecting || false;

startCleaner(global, {
  IDROPS: global.IDROPS,
  TEMP_QUEUE: global.TEMP_QUEUE,
  EVENT_QUEUE: global.EVENT_QUEUE,
  LOGS: global.LOGS,
});

let socketGlobal;
let reconnecting = false;

// ----------------------------
// FUNCION CACHEAR METADATA
// ----------------------------
async function cacheGroupMetadata(socket, jid) {
  try {
    const metadata = await socket.groupMetadata(jid);

    if (Object.keys(global.GROUP_CACHE).length > MAX_GROUP_CACHE) {
      const firstKey = Object.keys(global.GROUP_CACHE)[0];
      delete global.GROUP_CACHE[firstKey];
    }

    global.GROUP_CACHE[jid] = {
      admins: metadata.participants
        .filter(p => p.admin)
        .map(p => p.id),
      participants: metadata.participants.length,
      time: Date.now()
    };

  } catch {}
}

// ----------------------------
// Manejo global de errores
// ----------------------------
process.on("uncaughtException", (error) => {
  if (badMacHandler.handleError(error, "uncaughtException")) return;
  errorLog(`Error crítico no capturado: ${error.message}`);
  errorLog(error.stack);
  if (!error.message.includes("ENOTFOUND") && !error.message.includes("timeout"))
    process.exit(1);
});

process.on("unhandledRejection", () => {});

// ----------------------------
// Reconexión controlada sin spam
// ----------------------------
async function handleReconnect(reason) {
  if (reconnecting) return;
  reconnecting = true;
  global.reconnecting = true;

  infoLog(`⚠️ Reconexión iniciada por: ${reason}`);

  try {
    await new Promise((r) => setTimeout(r, 30_000));

    const newSocket = await connect();
    socketGlobal = newSocket;
    load(socketGlobal);

    if (socketGlobal?.ws) {
      socketGlobal.ws.on("close", () => handleReconnect("Connection closed"));
    }

    socketGlobal.ev.removeAllListeners("connection.update");
    socketGlobal.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect } = update;
      if (connection === "close" || connection === "error" || lastDisconnect?.error) {
        const code = lastDisconnect?.error?.output?.statusCode || connection;
        infoLog(`⚠️ connection.update detectó desconexión: ${code}`);
        handleReconnect(code);
      }
    });

    socketGlobal.ev.on("group-participants.update", async (update) => {
      await cacheGroupMetadata(socketGlobal, update.id);
    });

    successLog("✅ Reconexión exitosa");
  } catch (err) {
    errorLog("❌ Reconexión fallida, se intentará nuevamente al ocurrir otra desconexión");
  } finally {
    reconnecting = false;
    global.reconnecting = false;
  }
}

// ----------------------------
// Función principal de inicio
// ----------------------------
async function startBot() {
  try {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    process.setMaxListeners(1500);

    bannerLog();
    infoLog("Iniciando mis componentes internos...");

    const stats = badMacHandler.getStats();
    if (stats.errorCount > 0) {
      infoLog(`Estadísticas de BadMacHandler: ${stats.errorCount}/${stats.maxRetries} errores`);
    }

    async function initSocket() {
      try {
        const socket = await connect();
        socketGlobal = socket;
        load(socketGlobal);

        if (socketGlobal?.ws) {
          socketGlobal.ws.on("close", () => handleReconnect("Connection closed"));
        }

        socketGlobal.ev.removeAllListeners("connection.update");
        socketGlobal.ev.on("connection.update", (update) => {
          const { connection, lastDisconnect } = update;

          if (connection === "close" || connection === "error" || lastDisconnect?.error) {
            const code = lastDisconnect?.error?.output?.statusCode || connection;
            infoLog(`⚠️ connection.update detectó desconexión: ${code}`);
            handleReconnect(code);
          }
        });

        socketGlobal.ev.on("messages.upsert", async ({ messages }) => {
          const msg = messages?.[0];
          const jid = msg?.key?.remoteJid;

          if (jid && jid.endsWith("@g.us") && !global.GROUP_CACHE[jid]) {
            await cacheGroupMetadata(socketGlobal, jid);
          }
        });

        initWatchdog(socketGlobal);

        setTimeout(() => startTyCSystem(socketGlobal), 10_000);
        setTimeout(() => require("./src/commands/member/rpg.js"), 10_000);

        successLog("✅ Bot conectado y listo.");
      } catch {
        setTimeout(initSocket, 5000);
      }
    }

    await initSocket();

    let disconnectTimer = null;
    function initWatchdog(socket) {
      if (!socket) return;

      socket.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === "close" || lastDisconnect?.error) {
          if (!disconnectTimer) {
            warningLog("⚠️ Bot desconectado, iniciando watchdog...");
            disconnectTimer = setTimeout(() => {
              warningLog("⚠️ Bot no se reconectó a tiempo. Reiniciando...");
              process.exit(1);
            }, 120_000);
          }
          handleReconnect(lastDisconnect?.error?.output?.statusCode || connection);
        } else if (connection === "open" && disconnectTimer) {
          clearTimeout(disconnectTimer);
          disconnectTimer = null;
          infoLog("✅ Bot reconectado, watchdog detenido");
        }
      });
    }

    setInterval(() => {
      if (socketGlobal?.sendPresenceUpdate) {
        try {
          socketGlobal.sendPresenceUpdate("available");
        } catch {}
      }
    }, 10_000);

    setInterval(() => {
      const currentStats = badMacHandler.getStats();
      if (currentStats.errorCount > 0) {
        infoLog(`Estadísticas de BadMacHandler: ${currentStats.errorCount}/${currentStats.maxRetries} errores`);
      }
    }, 300_000);

    setInterval(() => infoLog("🔄 Actualizando sesión (manteniendo bot vivo)"), 30_000);

  } catch (error) {
    if (badMacHandler.handleError(error, "bot-startup")) {
      infoLog("Error de Bad MAC durante la inicialización, intentando nuevamente...");
      setTimeout(startBot, 5000);
      return;
    }

    errorLog(`Error al iniciar el bot: ${error.message}`);
    errorLog(error.stack);
    process.exit(1);
  }
}

startBot();
