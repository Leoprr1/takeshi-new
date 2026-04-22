/**
 * Inicialización del bot con QR
 * Conexión estable usando Baileys
 */
const path = require("node:path");
const fs = require("node:fs");
const pino = require("pino");
const NodeCache = require("node-cache");
const qrcode = require("qrcode-terminal");

const { load } = require("./loader");
const {
  infoLog,
  warningLog,
  errorLog,
  successLog,
  sayLog,
} = require("./utils/logger");

const { TEMP_DIR } = require("./config");

if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

const logger = pino({ level: "silent" });

// 🔥 CACHE OPTIMIZADO (IMPORTANTE)
const msgRetryCounterCache = new NodeCache({
  stdTTL: 60,
  checkperiod: 120,
  useClones: false,
});

const groupCache = new NodeCache({ stdTTL: 60 * 60 * 24 });

async function connect() {
  const {
    default: makeWASocket,
    DisconnectReason,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    isJidBroadcast,
    isJidStatusBroadcast,
    isJidNewsletter,
  } = await import("@whiskeysockets/baileys");

  const authPath = path.resolve(__dirname, "..", "assets", "auth", "baileys");

  const { state, saveCreds } = await useMultiFileAuthState(authPath);
  const { version, isLatest } = await fetchLatestBaileysVersion();

  const socket = makeWASocket({
    version,
    logger,
    auth: state,
    printQRInTerminal: false,

    // 🔥 OPTIMIZACIONES CLAVE
    msgRetryCounterCache,
    retryRequestDelayMs: 0,
    maxMsgRetryCount: 1,
    defaultQueryTimeoutMs: undefined,
    getMessage: async () => undefined,

    shouldIgnoreJid: (jid) =>
      isJidBroadcast(jid) ||
      isJidStatusBroadcast(jid) ||
      isJidNewsletter(jid),
  });

  // =========================
  // PRESENCE CONTROLADO
  // =========================
  const lastPresence = new Map();

  socket.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      if (!msg.key || msg.key.fromMe) continue;

      const jid = msg.key.remoteJid;
      const participant = msg.key.participant ?? null;

      const text =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        "";

      try {
        await socket.sendReceipt(jid, participant, [msg.key.id], "read");

        if (!text.startsWith(".")) continue;

        const now = Date.now();

        if (lastPresence.get(jid) && now - lastPresence.get(jid) < 10000) {
          continue;
        }

        lastPresence.set(jid, now);

        await socket.sendPresenceUpdate("composing", jid);

        setTimeout(() => {
          socket.sendPresenceUpdate("paused", jid);
        }, 2000);

      } catch (err) {
        warningLog("Error enviando visto:", err.message);
      }
    }
  });

  // =========================
  // CONEXIÓN
  // =========================
  socket.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      sayLog("Escaneá este QR con WhatsApp:");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "open") {
      successLog("¡Conectado correctamente a WhatsApp!");
      infoLog("WhatsApp Web versión: " + version.join("."));
      infoLog("¿Última versión?: " + (isLatest ? "Sí" : "No"));
      load(socket);
    }

    if (connection === "close") {
      const reason = lastDisconnect?.error?.output?.statusCode;

      warningLog("Conexión cerrada. Motivo: " + reason);

      if (reason !== DisconnectReason.loggedOut) {
        connect();
      } else {
        errorLog("Sesión cerrada. Borra la carpeta auth y vuelve a escanear QR.");
      }
    }
  });

  // =========================
  // GUARDADO OPTIMIZADO
  // =========================
  let saveTimeout;

  socket.ev.on("creds.update", () => {
    clearTimeout(saveTimeout);

    saveTimeout = setTimeout(() => {
      saveCreds();
    }, 5000);
  });

  return socket;
}

exports.connect = connect;

