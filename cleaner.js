// cleaner.js - Ultra optimizado y seguro para bots pesados
// Uso: pm2 start cleaner.js --name "cleaner" --node-args="--expose-gc"

const { infoLog, warningLog } = require("./src/utils/logger");

const NORMAL_INTERVAL = 10_000; // 1 min limpieza normal
const RECONNECT_INTERVAL = 5_000; // 15s limpieza agresiva si reconecta
const MEMORY_THRESHOLD_MB = 150; // aviso si supera 500MB

// ✅ Limpieza normal (solo basura temporal, segura)
function cleanMemory() {
  try {
    const now = Date.now();

    // Drops expirados (solo los viejos)
    if (Array.isArray(global.IDROPS)) {
      global.IDROPS = global.IDROPS.filter(drop => now - drop.creado < 30_000);
    }

    // Colas temporales
    if (Array.isArray(global.TEMP_QUEUE)) global.TEMP_QUEUE.length = 0;
    if (Array.isArray(global.EVENT_QUEUE)) global.EVENT_QUEUE.length = 0;

    // Logs: limpiar solo si superan 1000 entradas
    if (Array.isArray(global.LOGS) && global.LOGS.length > 20) {
      global.LOGS.length = 0;
    }

    // Forzar GC si está disponible
    if (global.gc) global.gc();

    // Monitoreo memoria
    const memUsageMB = process.memoryUsage().heapUsed / 1024 / 1024;
    if (memUsageMB > MEMORY_THRESHOLD_MB) {
      warningLog(`⚠️ Consumo de memoria alto: ${memUsageMB.toFixed(2)} MB`);
    }

    infoLog("🧹 Limpieza normal ejecutada correctamente");
  } catch (err) {
    warningLog("Error durante limpieza normal:", err.message);
  }
}

// ✅ Limpieza agresiva segura (solo basura, no toca sesión ni buffers)
function aggressiveClean() {
  try {
    if (Array.isArray(global.IDROPS)) global.IDROPS.length = 0;
    if (Array.isArray(global.TEMP_QUEUE)) global.TEMP_QUEUE.length = 0;
    if (Array.isArray(global.EVENT_QUEUE)) global.EVENT_QUEUE.length = 0;

    // Logs solo si son muy grandes
    if (Array.isArray(global.LOGS) && global.LOGS.length > 20) global.LOGS.length = 0;

    if (global.gc) global.gc();

    warningLog("⚡ Limpieza agresiva ejecutada (reconexión activa)");

  } catch (err) {
    warningLog("Error durante limpieza agresiva:", err.message);
  }
}

// ----------------------
// Loop principal seguro
// ----------------------
setInterval(() => {
  try {
    if (global.reconnecting === true) {
      aggressiveClean();
    } else {
      cleanMemory();
    }
  } catch (err) {
    warningLog("Error en loop principal:", err.message);
  }
}, NORMAL_INTERVAL);

// Loop extra solo para reconexión (más frecuente)
setInterval(() => {
  try {
    if (global.reconnecting === true) aggressiveClean();
  } catch (err) {
    warningLog("Error en loop reconexión:", err.message);
  }
}, RECONNECT_INTERVAL);

// Log de inicio visible en PM2
infoLog("🚀 Cleaner optimizado iniciado sin afectar la sesión ni buffers del bot");

// Log periódico visible en PM2 para confirmar que sigue funcionando
setInterval(() => {
  infoLog("🧹 Cleaner activo y monitoreando memoria...");
}, 30_000);
