// 🔥 learningBot2.js
require("./brainbuilder");
require("../commands/admin/afk");
const db = require("./database"); // Tu database.js
const path = require("path");

const NEW_FILE = path.resolve(__dirname, "../database/learningbot2.json");

/**
 * 🔹 Aprende todos los mensajes de texto entrantes
 * y los guarda en learningbot2.json de forma independiente.
 * Ignora mensajes del propio bot.
 */
function learnFromAllMessages(webMessage) {
  if (!webMessage?.message) return;

  // 🔹 Ignorar mensajes enviados por el bot
  if (webMessage.key?.fromMe) return;

  // 🔹 Obtener texto
  const messageText = extractTextFromMessage(webMessage.message);
  if (!messageText || messageText.length < 2) return;

  const normalized = normalize(messageText);
  if (!normalized.trim()) return;

  // 🔹 Leer JSON existente
  const data = db.readJSON("learningbot2", []);

  // 🔹 Evitar duplicados exactos consecutivos
  if (data.length && data[data.length - 1] === normalized) return;

  // 🔹 Guardar mensaje
  data.push(normalized);
  db.writeJSON("learningbot2", data);
}

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

function normalize(text = "") {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,!?¿¡;]/g, "")
    .trim();
}

module.exports = { learnFromAllMessages };
