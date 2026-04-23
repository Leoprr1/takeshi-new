// 🔥 learningBot2.js (OPTIMIZADO)
require("./brainbuilder");
require("../commands/admin/afk");
const db = require("./database");

let buffer = [];
let lastSavedLength = 0;

/**
 * 🔹 Aprende todos los mensajes de texto entrantes
 */
function learnFromAllMessages(webMessage) {
  if (!webMessage?.message) return;
  if (webMessage.key?.fromMe) return;

  const messageText = extractTextFromMessage(webMessage.message);
  if (!messageText || messageText.length < 2) return;

  const normalized = normalize(messageText);
  if (!normalized.trim()) return;

  // evitar duplicado consecutivo en buffer
  if (buffer.length && buffer[buffer.length - 1] === normalized) return;

  buffer.push(normalized);
}

/**
 * 🔥 Guardado batch cada X tiempo
 */
setInterval(() => {
  if (!buffer.length) return;

  const data = db.readJSON("learningbot2", []);

  // evitar duplicado con el último del archivo
  if (data.length && buffer[0] === data[data.length - 1]) {
    buffer.shift();
  }

  const newData = data.concat(buffer);

  db.writeJSON("learningbot2", newData);

  console.log("🧠 learningbot2 guardado:", buffer.length);

  buffer = [];
}, 10000); // cada 10 segundos

/**
 * ==============================
 * 🔹 EXTRAER TEXTO
 * ==============================
 */
function extractTextFromMessage(message) {
  if (!message) return "";

  if (message.conversation) return message.conversation;
  if (message.extendedTextMessage?.text) return message.extendedTextMessage.text;
  if (message.buttonsResponseMessage?.selectedDisplayText)
    return message.buttonsResponseMessage.selectedDisplayText;
  if (message.listResponseMessage?.singleSelectReply?.selectedRowId)
    return message.listResponseMessage.singleSelectReply.selectedRowId;
  if (message.imageMessage?.caption) return message.imageMessage.caption;
  if (message.videoMessage?.caption) return message.videoMessage.caption;

  return "";
}

/**
 * ==============================
 * 🔹 NORMALIZAR TEXTO
 * ==============================
 */
function normalize(text = "") {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,!?¿¡;]/g, "")
    .trim();
}

module.exports = { learnFromAllMessages };
