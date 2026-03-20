/*
 * Este archivo index.js es el mismo que existe en "src/index.js", solo está aquí
 * para facilitar la ejecución del bot en algunas hosts.
 *
 * Si hiciste clic aquí, es porque probablemente ya usaste un bot de "case" y con un "index.js" de 20 mil líneas...
 * ¡Lo sé, te entiendo!
 * ¿Qué es mejor? ¿Que te dé un error en tu "play", vayas al archivo "play.js" y lo corrijas
 * o que vayas a la línea 71023 de "index.js" y lo corrijas?
 *
 * Imagina si pegas tu "case" mal y olvidas cerrar
 * o abrir un paréntesis, una llave...
 * Pones el bot a funcionar, te da varios errores y no sabes cómo resolverlos...
 * ¿Adivina qué haces?
 * Vuelves a la "index.js" que tenías antes, ¿verdad?
 *
 * ¡Eso es lo que no queremos! ¡Queremos un código limpio, legible y de fácil mantenimiento!
 * Creamos código para humanos, no para máquinas, así que, ¡cuanto más simple, mejor!
 *
 * A partir de ahora, vamos a cambiar la palabra "case" por "comando", ¿ok? ¡Vamos allá!
 *
 * ---------------- 🤖 ¿DÓNDE ESTÁN LOS COMANDOS? 🤖 ----------------
 *
 * Encontrarás los comandos dentro de la carpeta "src/commands"
 * ¿No lo entiendes? ¡Vamos a ver!
 *
 * Abre la carpeta "src"
 * Luego, abre la carpeta "commands"
 *
 * Observa que dentro de ella hay 3 carpetas:
 *
 * - 📁 admin
 * - 📁 member
 * - 📁 owner
 *
 * Dentro de la carpeta "admin" hay comandos administrativos.
 * Dentro de la carpeta "member" hay comandos para miembros.
 * Dentro de la carpeta "owner" hay comandos a los que solo puede acceder el dueño del bot/grupo.
 *
 * Sencillo, ¿verdad? Ah, un detalle: no necesitas poner un "if" para saber si el comando es de admin o de dueño.
 * ¡El bot ya lo hace por ti! ¡Solo necesitas colocar el comando en la carpeta correspondiente!
 *
 * ---------------- 🤖 ¿DÓNDE MODIFICO EL MENÚ? 🤖 ----------------
 *
 * Abre la carpeta "src"
 * Ve al archivo "menu.js" y ¡edita el menú!
 * Solo recuerda, haz todo dentro de las comillas (`), ya que es un template string.
 *
 * ¿No lo entiendes?
 * Mira:
 *
 * `¡Hola, qué tal!` - Esto es CORRECTO ✅
 *
 * Hola `¿qué tal?` - Esto es INCORRECTO (observa que "Hola" está fuera de las comillas) ❌
 *
 * ---------------- 🤖 ¿CÓMO CAMBIO LA FOTO DEL BOT? 🤖 ----------------
 *
 * Abre la carpeta "assets"
 * Luego, abre la carpeta "images"
 * ¡Sustituye la imagen "takeshi-bot.png" por otra de tu preferencia!
 * Solo no olvides mantener el nombre "takeshi-bot.png"
 *
 * ---------------- 🚀 IMPORTANTE 🚀 ----------------
 *
 * Lee el tutorial completo en: https://github.com/guiireal/takeshi-bot-espanol
 *
 * ¡No saltes pasos! Léelo completo, ¡ya que es muy importante para que entiendas cómo funciona el bot!
 *
 * Por: Dev Gui
 *
 * ¡No modifiques nada a continuación, a menos que sepas lo que estás haciendo!
 */
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

// 🔥 CONTROL DE PRECARGA
let groupsPreloaded = false;
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

    // 🔥 limite simple (FIFO)
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
// NUEVO: PRECARGAR TODOS LOS GRUPOS
// ----------------------------
async function preloadAllGroups(socket) {
  try {

    // 🔥 evitar sobrecarga
    if (global.reconnecting) return;
    if (Object.keys(global.GROUP_CACHE).length > 200) return;

    infoLog("⚡ Precargando metadata de todos los grupos...");

    const groups = await socket.groupFetchAllParticipating();

    for (const jid in groups) {

      const metadata = groups[jid];

      global.GROUP_CACHE[jid] = {
        admins: metadata.participants
          .filter(p => p.admin)
          .map(p => p.id),

        participants: metadata.participants.length,

        time: Date.now()
      };

    }

    successLog(`✅ ${Object.keys(global.GROUP_CACHE).length} grupos cargados en cache`);

  } catch (err) {
    warningLog("⚠️ No se pudieron precargar todos los grupos");
  }
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
// Precarga de TODOS los comandos
// ----------------------------
function preloadCommands(dir) {
  global.loadedCommands = [];
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);

    if (fs.statSync(fullPath).isDirectory()) {
      preloadCommands(fullPath);
    } else if (file.endsWith(".js")) {
      try {
        const cmdModule = require(fullPath);
        global.loadedCommands.push(cmdModule);
        if (cmdModule.preload) cmdModule.preload();
      } catch (err) {
        errorLog(`❌ Error cargando comando ${fullPath}: ${err.message}`);
      }
    }
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

          if (connection === "open" && !groupsPreloaded) {

            groupsPreloaded = true;

            preloadAllGroups(socketGlobal);

            setInterval(() => {
              preloadAllGroups(socketGlobal);
            }, 600000);
          }

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

        setTimeout(() => {
          infoLog("⚡ Precargando todos los comandos...");
          preloadCommands(path.join(__dirname, "src/commands"));
          infoLog("✅ Todos los comandos precargados en memoria.");
        }, 10_000);

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
