// cleaner.js - Optimizado posta (sin romper CPU)

const { infoLog, warningLog } = require("./src/utils/logger");

const NORMAL_INTERVAL = 60_000;
const RECONNECT_INTERVAL = 15_000;
const DEEP_CLEAN_INTERVAL = 5 * 60 * 1000;

// 🔥 SUBIDO A 200MB COMO PEDISTE
const MEMORY_THRESHOLD_MB = 200;
const MEMORY_CRITICAL_MB = 400;

let lastGC = 0;

module.exports = function (bot, queues = {}) {

  const { IDROPS, TEMP_QUEUE, EVENT_QUEUE, LOGS } = queues;

  // -----------------------------
  // GC CONTROLADO (SOLO SI > 200MB)
  // -----------------------------
  function runGC() {
    if (!global.gc) return;

    const memUsageMB = process.memoryUsage().heapUsed / 1024 / 1024;

    // 🔥 SOLO SI SUPERA 200MB
    if (memUsageMB < MEMORY_THRESHOLD_MB) return;

    const now = Date.now();

    // evitar spam de GC
    if (now - lastGC < 30_000) return;

    const before = process.memoryUsage().heapUsed;
    global.gc();
    const after = process.memoryUsage().heapUsed;

    lastGC = now;

    console.log(`[CLEANER] GC | ${((before - after)/1024/1024).toFixed(2)} MB liberados | RAM: ${(after/1024/1024).toFixed(2)} MB`);
  }

  // -----------------------------
  // Limpieza normal
  // -----------------------------
  function cleanMemory() {
    try {
      const now = Date.now();

      if (Array.isArray(IDROPS) && IDROPS.length > 0) {
        for (let i = IDROPS.length - 1; i >= 0; i--) {
          if (now - IDROPS[i].creado > 5000) {
            IDROPS.splice(i, 1);
          }
        }
      }

      if (Array.isArray(TEMP_QUEUE) && TEMP_QUEUE.length > 50) {
        TEMP_QUEUE.length = 0;
      }

      if (Array.isArray(EVENT_QUEUE) && EVENT_QUEUE.length > 50) {
        EVENT_QUEUE.length = 0;
      }

      if (Array.isArray(LOGS) && LOGS.length > 500) {
        LOGS.splice(0, 400);
      }

      runGC();

      const memUsageMB = process.memoryUsage().heapUsed / 1024 / 1024;

      if (memUsageMB > MEMORY_THRESHOLD_MB) {
        warningLog(`⚠️ RAM alta: ${memUsageMB.toFixed(2)} MB`);
      }

    } catch (err) {
      warningLog("Error limpieza normal:", err.message);
    }
  }

  // -----------------------------
  // Limpieza agresiva
  // -----------------------------
  function aggressiveClean() {
    try {

      if (Array.isArray(IDROPS)) IDROPS.length = 0;
      if (Array.isArray(TEMP_QUEUE)) TEMP_QUEUE.length = 0;
      if (Array.isArray(EVENT_QUEUE)) EVENT_QUEUE.length = 0;

      if (Array.isArray(LOGS) && LOGS.length > 50) {
        LOGS.splice(0, LOGS.length - 50);
      }

      runGC();

      warningLog("⚡ Limpieza agresiva (reconexión)");

    } catch (err) {
      warningLog("Error limpieza agresiva:", err.message);
    }
  }

  // -----------------------------
  // Deep clean
  // -----------------------------
  function deepClean() {
    try {

      if (Array.isArray(IDROPS)) IDROPS.length = 0;

      if (Array.isArray(TEMP_QUEUE) && TEMP_QUEUE.length > 20) {
        TEMP_QUEUE.length = 0;
      }

      if (Array.isArray(EVENT_QUEUE) && EVENT_QUEUE.length > 20) {
        EVENT_QUEUE.length = 0;
      }

      if (Array.isArray(LOGS) && LOGS.length > 100) {
        LOGS.splice(0, LOGS.length - 100);
      }

      runGC();

      infoLog("🧠 Deep clean");

    } catch (err) {
      warningLog("Error deep clean:", err.message);
    }
  }

  // -----------------------------
  // Memoria crítica
  // -----------------------------
  function memoryPressureClean() {
    try {

      const memUsageMB = process.memoryUsage().heapUsed / 1024 / 1024;

      if (memUsageMB > MEMORY_CRITICAL_MB) {

        warningLog(`🚨 RAM crítica (${memUsageMB.toFixed(2)} MB)`);

        if (Array.isArray(IDROPS)) IDROPS.length = 0;
        if (Array.isArray(TEMP_QUEUE)) TEMP_QUEUE.length = 0;
        if (Array.isArray(EVENT_QUEUE)) EVENT_QUEUE.length = 0;

        if (Array.isArray(LOGS)) LOGS.length = 0;

        runGC();
      }

    } catch (err) {
      warningLog("Error memoria crítica:", err.message);
    }
  }

  // -----------------------------
  // LOOP PRINCIPAL
  // -----------------------------
  setInterval(() => {
    try {
      if (bot.reconnecting) {
        aggressiveClean();
      } else {
        cleanMemory();
      }

      memoryPressureClean();

    } catch (err) {
      warningLog("Error loop principal:", err.message);
    }
  }, NORMAL_INTERVAL);

  // -----------------------------
  // LOOP RECONEXIÓN
  // -----------------------------
  setInterval(() => {
    if (bot.reconnecting) {
      aggressiveClean();
    }
  }, RECONNECT_INTERVAL);

  // -----------------------------
  // DEEP CLEAN
  // -----------------------------
  setInterval(deepClean, DEEP_CLEAN_INTERVAL);

  // -----------------------------
  // LOG CONTROLADO
  // -----------------------------
  setInterval(() => {
    const memUsageMB = process.memoryUsage().heapUsed / 1024 / 1024;
    infoLog(`🧹 RAM: ${memUsageMB.toFixed(2)} MB`);
  }, 60_000);

  infoLog("🚀 Cleaner optimizado iniciado");
};
