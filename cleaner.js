// cleaner.js - Optimizado para integrarse al bot directamente
// Uso: require('./cleaner.js')(bot, {IDROPS, TEMP_QUEUE, EVENT_QUEUE, LOGS})

const { infoLog, warningLog } = require("./src/utils/logger");

const NORMAL_INTERVAL = 10_000; // limpieza normal
const RECONNECT_INTERVAL = 5_000; // limpieza agresiva si reconecta
const DEEP_CLEAN_INTERVAL = 1 * 60 * 1000; // deep clean cada 1 min
const MEMORY_THRESHOLD_MB = 150; // aviso memoria alta
const MEMORY_CRITICAL_MB = 200; // limpieza urgente

module.exports = function(bot, queues = {}) {

  const { IDROPS, TEMP_QUEUE, EVENT_QUEUE, LOGS } = queues;

  // -----------------------------
  // Limpieza normal
  // -----------------------------
  function cleanMemory() {
    try {

      const now = Date.now();

      // limpiar IDROPS expirados (método eficiente)
      if (Array.isArray(IDROPS)) {
        for (let i = IDROPS.length - 1; i >= 0; i--) {
          if (now - IDROPS[i].creado > 5000) {
            IDROPS.splice(i, 1);
          }
        }
      }

      // limpiar colas temporales
      if (Array.isArray(TEMP_QUEUE) && TEMP_QUEUE.length > 0) {
        TEMP_QUEUE.length = 0;
      }

      if (Array.isArray(EVENT_QUEUE) && EVENT_QUEUE.length > 0) {
        EVENT_QUEUE.length = 0;
      }

      // limpiar logs inteligentemente
      if (Array.isArray(LOGS) && LOGS.length > 500) {
        LOGS.splice(0, 450);
      }

      if (global.gc) {
  const before = process.memoryUsage().heapUsed;
  global.gc();
  const after = process.memoryUsage().heapUsed;
  console.log(`[CLEANER] Memoria limpiada| ${((before - after)/1024/1024).toFixed(2)} MB liberados`);
}
      const memUsageMB = process.memoryUsage().heapUsed / 1024 / 1024;

      if (memUsageMB > MEMORY_THRESHOLD_MB) {
        warningLog(`⚠️ Consumo de memoria alto: ${memUsageMB.toFixed(2)} MB`);
      }

    } catch (err) {
      warningLog("Error durante limpieza normal:", err.message);
    }
  }

  // -----------------------------
  // Limpieza agresiva (reconexión)
  // -----------------------------
  function aggressiveClean() {
    try {

      if (Array.isArray(IDROPS)) IDROPS.length = 0;

      if (Array.isArray(TEMP_QUEUE)) TEMP_QUEUE.length = 0;

      if (Array.isArray(EVENT_QUEUE)) EVENT_QUEUE.length = 0;

      if (Array.isArray(LOGS) && LOGS.length > 50) {
        LOGS.splice(0, LOGS.length - 50);
      }

      if (global.gc) global.gc();

      warningLog("⚡ Limpieza agresiva ejecutada (reconexión)");

    } catch (err) {
      warningLog("Error durante limpieza agresiva:", err.message);
    }
  }

  // -----------------------------
  // Deep clean (desfragmentación)
  // -----------------------------
  function deepClean() {
    try {

      if (Array.isArray(IDROPS)) IDROPS.length = 0;

      if (Array.isArray(TEMP_QUEUE)) TEMP_QUEUE.length = 0;

      if (Array.isArray(EVENT_QUEUE)) EVENT_QUEUE.length = 0;

      if (Array.isArray(LOGS) && LOGS.length > 100) {
        LOGS.splice(0, LOGS.length - 100);
      }

      if (global.gc) global.gc();

      infoLog("🧠 Deep clean ejecutado (desfragmentación de memoria)");

    } catch (err) {
      warningLog("Error en deep clean:", err.message);
    }
  }

  // -----------------------------
  // Limpieza por presión de RAM
  // -----------------------------
  function memoryPressureClean() {
    try {

      const memUsageMB = process.memoryUsage().heapUsed / 1024 / 1024;

      if (memUsageMB > MEMORY_CRITICAL_MB) {

        warningLog(`🚨 Memoria crítica (${memUsageMB.toFixed(2)} MB) ejecutando limpieza urgente`);

        if (Array.isArray(IDROPS)) IDROPS.length = 0;
        if (Array.isArray(TEMP_QUEUE)) TEMP_QUEUE.length = 0;
        if (Array.isArray(EVENT_QUEUE)) EVENT_QUEUE.length = 0;

        if (Array.isArray(LOGS)) LOGS.splice(0, LOGS.length);

        if (global.gc) global.gc();
      }

    } catch (err) {
      warningLog("Error en limpieza por presión de memoria:", err.message);
    }
  }

  // -----------------------------
  // Loop principal
  // -----------------------------
  setInterval(() => {

    try {

      if (bot.reconnecting === true) {
        aggressiveClean();
      } else {
        cleanMemory();
      }

      memoryPressureClean();

    } catch (err) {
      warningLog("Error en loop principal:", err.message);
    }

  }, NORMAL_INTERVAL);

  // -----------------------------
  // Loop extra durante reconexión
  // -----------------------------
  setInterval(() => {

    try {
      if (bot.reconnecting === true) {
        aggressiveClean();
      }
    } catch (err) {
      warningLog("Error en loop reconexión:", err.message);
    }

  }, RECONNECT_INTERVAL);

  // -----------------------------
  // Deep clean periódico
  // -----------------------------
  setInterval(() => {
    deepClean();
  }, DEEP_CLEAN_INTERVAL);

  // -----------------------------
  // Logs
  // -----------------------------
  infoLog("🚀 Cleaner optimizado iniciado");

  setInterval(() => {

    const memUsageMB = process.memoryUsage().heapUsed / 1024 / 1024;

    infoLog(`🧹 Cleaner activo | RAM: ${memUsageMB.toFixed(2)} MB`);

  }, 60_000);
};
