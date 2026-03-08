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
const {
  loadJSONFolder,
  startAutoSave
} = require("./src/utils/jsoncache")

loadJSONFolder(path.join(__dirname, "database"))
loadJSONFolder(path.join(__dirname, "src/database"))

startAutoSave(60000);

global.IDROPS = global.IDROPS || [];
global.TEMP_QUEUE = global.TEMP_QUEUE || [];
global.EVENT_QUEUE = global.EVENT_QUEUE || [];
global.LOGS = global.LOGS || [];
global.reconnecting = global.reconnecting || false;

// 🔹 Inicializar cleaner optimizado 🔹
require("./cleaner.js");

let socketGlobal;
let reconnecting = false;

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

// Eliminamos log global de promesas rechazadas
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

    successLog("✅ Reconexión exitosa");
  } catch (err) {
    errorLog("❌ Reconexión fallida, se intentará nuevamente cuando ocurra otra desconexión");
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

        // ----------------------------
        // 🔹 Optimización connection.update 🔹
        // ----------------------------
        socketGlobal.ev.removeAllListeners("connection.update"); // Limpiamos listeners antiguos

        socketGlobal.ev.on("connection.update", (update) => {
          try {
            if (update.connection) infoLog("Estado de conexión:", update.connection);
            if (update.lastDisconnect) infoLog("Última desconexión:", update.lastDisconnect.error);
          } catch (err) {
            errorLog("Error en connection.update:", err);
          }
        });

        successLog("✅ Bot conectado y listo.");
        setTimeout(() => { startTyCSystem(socketGlobal); }, 10_000);

      } catch {
        setTimeout(initSocket, 5000);
      }
    }

    await initSocket();

    // ----------------------------
    // Auto limpieza y optimización de memoria
    // ----------------------------
    const AUTO_CLEAN_INTERVAL = 10_000;
    setInterval(() => {
      try {
        if (global.IDROPS) {
          const now = Date.now();
          global.IDROPS = global.IDROPS.filter((drop) => now - drop.creado < 30_000);
        }

        if (global.gc) global.gc();
        infoLog("🧹 Auto limpieza ejecutada");

        if (reconnecting) {
          if (global.IDROPS) global.IDROPS = [];
          if (global.gc) global.gc();
          infoLog("⚡ Limpieza agresiva ejecutada durante reconexión");
        }
      } catch (err) {
        errorLog("Error durante la auto limpieza:", err.message);
      }
    }, AUTO_CLEAN_INTERVAL);

    // ----------------------------
    // Keep-alive: enviar presencia cada 25s
    // ----------------------------
    setInterval(() => {
      try {
        if (!socketGlobal?.user?.id) return;
        socketGlobal.sendPresenceUpdate("available", socketGlobal.user.id);
      } catch (err) {
        warningLog("Presence keep-alive error:", err.message);
      }
    }, 25_000);

    // ----------------------------
    // Logs BadMacHandler cada 5 minutos
    // ----------------------------
    setInterval(() => {
      const currentStats = badMacHandler.getStats();
      if (currentStats.errorCount > 0) {
        infoLog(`Estadísticas de BadMacHandler: ${currentStats.errorCount}/${currentStats.maxRetries} errores`);
      }
    }, 300_000);

    // ----------------------------
    // Log manual para PM2 cada 1 min
    // ----------------------------
    setInterval(() => infoLog("🔄 Actualizando sesión (manteniendo bot vivo)"), 60_000);

    // ----------------------------
    // 🔹 Watchdog inteligente 🔹
    // ----------------------------
    const WATCHDOG_INTERVAL = 10_000; // cada 10s chequea
    let disconnectedSince = null;

    setInterval(async () => {
      try {
        if (!socketGlobal || !socketGlobal.user || !socketGlobal.user.id) {
          if (!disconnectedSince) disconnectedSince = Date.now();
          const elapsed = Date.now() - disconnectedSince;

          if (elapsed > 120_000) { // 2 minutos desconectado
            warningLog("⚠️ Bot no se reconectó en 2 minutos. Reiniciando...");
            process.exit(1); // PM2 reinicia automáticamente
          } else {
            warningLog("⚠️ Bot desconectado, intentando reconectar...");
            await handleReconnect("Watchdog triggered reconnection");
          }
        } else {
          disconnectedSince = null; // reset si se conecta
        }
      } catch (err) {
        errorLog("Error en watchdog:", err.message);
      }
    }, WATCHDOG_INTERVAL);

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
