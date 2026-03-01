// 🔥 learningBot.js
const db = require("./database"); // Tu database.js
const stringSimilarity = require("string-similarity");

const LEARNING_FILE = "learning"; // archivo temporal
const FREQUENCY_THRESHOLD = 1; // mínimo para pasar a auto-responder

/**
 * 🔹 Aprende un mensaje del grupo y su respuesta
 * Ignora cualquier mensaje enviado por el bot
 * @param {object} webMessage Mensaje recibido de WhatsApp
 */
function learnFromMessage(webMessage) {
  if (!webMessage?.message) return;

  // 🔹 Ignorar mensajes enviados por el bot
  if (webMessage?.key?.fromMe) return;

  // Extraer texto del mensaje actual
  const answerText = extractTextFromMessage(webMessage.message);
  if (!answerText || answerText.length < 2) return;

  // 🔹 Ver si es respuesta a otro mensaje
  let triggerText = null;
  const quoted =
    webMessage.message.extendedTextMessage?.contextInfo?.quotedMessage;

  if (quoted) {
    triggerText = extractTextFromMessage(quoted);

    // 🔹 Ignorar si el mensaje citado fue enviado por el bot
    const fromBotQuoted =
      webMessage.message.extendedTextMessage?.contextInfo?.participant ===
      webMessage.key?.fromMe;
    if (fromBotQuoted) return;
  }

  // Si no hay trigger, no aprendemos (evitamos guardar mensaje→mensaje mismo)
  if (!triggerText) return;

  saveLearning(triggerText, answerText);
}

/**
 * 🔹 Guardar el par trigger -> answer en learning.json
 */
function saveLearning(trigger, answer) {
  const learning = db.readJSON(LEARNING_FILE, []);

  const normalizedTrigger = normalize(trigger);

  // Verificar si ya existe el trigger
  const existing = learning.find(
    (item) => normalize(item.trigger) === normalizedTrigger
  );

  if (existing) {
    existing.answer = answer.trim(); // reemplaza la respuesta con la más reciente
    existing.frequency = (existing.frequency || 1) + 1;
  } else {
    learning.push({
      trigger: trigger.trim(),
      answer: answer.trim(),
      frequency: 1,
    });
  }

  db.writeJSON(LEARNING_FILE, learning);

  // Intentar pasar al auto-responder
  checkAndExportToAutoResponder();
}

/**
 * 🔹 Extraer texto de cualquier tipo de mensaje
 */
function extractTextFromMessage(message) {
  if (!message) return "";

  if (message.conversation) return message.conversation;

  if (message.extendedTextMessage?.text) return message.extendedTextMessage.text;

  if (message.buttonsResponseMessage?.selectedDisplayText)
    return message.buttonsResponseMessage.selectedDisplayText;

  if (message.listResponseMessage?.singleSelectReply?.selectedRowId)
    return message.listResponseMessage.singleSelectReply.selectedRowId;

  return "";
}

/**
 * 🔹 Normalizar texto para comparar
 */
function normalize(text = "") {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,!?¿¡;]/g, "")
    .trim();
}

/**
 * 🔹 Revisar aprendizaje frecuente y pasarlo a auto-responder
 */
function checkAndExportToAutoResponder() {
  const learning = db.readJSON(LEARNING_FILE, []);
  const remainingLearning = [];

  for (const item of learning) {
    if ((item.frequency || 0) >= FREQUENCY_THRESHOLD) {
      const added = db.addAutoResponderItem(item.trigger, item.answer);

      if (!added) {
        const allResponses = db.readJSON("auto-responder", []);
        const index = allResponses.findIndex(
          (r) => normalize(r.match) === normalize(item.trigger)
        );
        if (index !== -1) {
          allResponses[index].answer = item.answer.trim();
          db.writeJSON("auto-responder", allResponses);
        } else {
          remainingLearning.push(item);
        }
      }
    } else {
      remainingLearning.push(item);
    }
  }

  db.writeJSON(LEARNING_FILE, remainingLearning);
}

module.exports = { learnFromMessage };
