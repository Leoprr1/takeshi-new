// cleaner.js - Optimizado para integrarse al bot directamente
// Uso: require('./cleaner.js')(bot, {IDROPS, TEMP_QUEUE, EVENT_QUEUE, LOGS})

const { infoLog, warningLog } = require("./src/utils/logger");

const NORMAL_INTERVAL = 10_000; // 10s limpieza normal
const RECONNECT_INTERVAL = 5_000; // 5s limpieza agresiva si reconecta
const MEMORY_THRESHOLD_MB = 150; // aviso si supera 150MB

module.exports = function(bot, queues = {}) {
  const { IDROPS, TEMP_QUEUE, EVENT_QUEUE, LOGS } = queues;

  function cleanMemory() {
    try {
      const now = Date.now();

      // Drops expirados
      if (Array.isArray(IDROPS)) {
        IDROPS.splice(0, IDROPS.length, ...IDROPS.filter(drop => now - drop.creado < 30_000));
      }

      // Colas temporales
      if (Array.isArray(TEMP_QUEUE)) TEMP_QUEUE.length = 0;
      if (Array.isArray(EVENT_QUEUE)) EVENT_QUEUE.length = 0;

      // Logs: limpiar solo si superan 1000 entradas
      if (Array.isArray(LOGS) && LOGS.length > 20) LOGS.length = 0;

      if (global.gc) global.gc();

      const memUsageMB = process.memoryUsage().heapUsed / 1024 / 1024;
      if (memUsageMB > MEMORY_THRESHOLD_MB) {
        warningLog(`⚠️ Consumo de memoria alto: ${memUsageMB.toFixed(2)} MB`);
      }

      infoLog("🧹 Limpieza normal ejecutada correctamente");
    } catch (err) {
      warningLog("Error durante limpieza normal:", err.message);
    }
  }

  function aggressiveClean() {
    try {
      if (Array.isArray(IDROPS)) IDROPS.length = 0;
      if (Array.isArray(TEMP_QUEUE)) TEMP_QUEUE.length = 0;
      if (Array.isArray(EVENT_QUEUE)) EVENT_QUEUE.length = 0;
      if (Array.isArray(LOGS) && LOGS.length > 20) LOGS.length = 0;

      if (global.gc) global.gc();

      warningLog("⚡ Limpieza agresiva ejecutada (reconexión activa)");
    } catch (err) {
      warningLog("Error durante limpieza agresiva:", err.message);
    }
  }

  // Loop principal
  setInterval(() => {
    try {
      if (bot.reconnecting === true) {
        aggressiveClean();
      } else {
        cleanMemory();
      }
    } catch (err) {
      warningLog("Error en loop principal:", err.message);
    }
  }, NORMAL_INTERVAL);

  // Loop extra solo para reconexión
  setInterval(() => {
    try {
      if (bot.reconnecting === true) aggressiveClean();
    } catch (err) {
      warningLog("Error en loop reconexión:", err.message);
    }
  }, RECONNECT_INTERVAL);

  // Log de inicio
  infoLog("🚀 Cleaner optimizado iniciado y vinculado al bot");

  // Log periódico para confirmar que sigue activo
  setInterval(() => {
    infoLog("🧹 Cleaner activo y monitoreando memoria...");
  }, 30_000);
};
