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

const msgRetryCounterCache = new NodeCache();
const groupCache = new NodeCache({ stdTTL: 60 * 60 * 24 });

async function connect() {
  // 🔥 IMPORT ESM CORRECTO DE BAILEYS
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
    printQRInTerminal: false, // 🔥 QR EN CONSOLA
    msgRetryCounterCache,
    defaultQueryTimeoutMs: undefined,
    shouldIgnoreJid: (jid) =>
      isJidBroadcast(jid) ||
      isJidStatusBroadcast(jid) ||
      isJidNewsletter(jid),
  });

  socket.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      sayLog("Escaneá este QR con WhatsApp:");
      qrcode.generate(qr, { small: true }); // 🔥 QR REAL
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

  socket.ev.on("creds.update", saveCreds);

  return socket;
}

exports.connect = connect;
