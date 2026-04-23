// 🔥 learningBot.js (OPTIMIZADO - INCREMENTAL REAL)
require("./brainbuilder");
const db = require("./database");
const stringSimilarity = require("string-similarity");

const LEARNING_FILE = "learning";
const SIMILARITY_THRESHOLD = 0.85;

/**
 * ==============================
 * 🔹 LEER MENSAJE Y APRENDER
 * ==============================
 */
function learnFromMessage(webMessage) {
  if (!webMessage?.message) return;
  if (webMessage?.key?.fromMe) return;

  const answerText = extractTextFromMessage(webMessage.message);
  if (!answerText || answerText.length < 2) return;

  let triggerText = null;
  const quoted =
    webMessage.message.extendedTextMessage?.contextInfo?.quotedMessage;

  if (quoted) {
    triggerText = extractTextFromMessage(quoted);

    const fromBotQuoted =
      webMessage.message.extendedTextMessage?.contextInfo?.participant ===
      webMessage.key?.fromMe;

    if (fromBotQuoted) return;
  }

  if (!triggerText) return;

  saveLearning(triggerText, answerText);
}

/**
 * ==============================
 * 🔹 Guardar en learning.json
 * ==============================
 */
function saveLearning(trigger, answer) {
  const learning = db.readJSON(LEARNING_FILE, []);

  learning.push({
    trigger: trigger.trim(),
    answer: answer.trim(),
    frequency: 1,
  });

  db.writeJSON(LEARNING_FILE, learning);

  checkAndExportToAutoResponder();
}

/**
 * ==============================
 * 🔥 EXPORTAR LEARNING A AUTO-RESPONDER (INCREMENTAL)
 * ==============================
 */
function checkAndExportToAutoResponder() {
  const learning = db.readJSON(LEARNING_FILE, []);
  if (!learning.length) return;

  const autoResponder = db.readJSON("auto-responder", []);

  let changed = false;

  for (const item of learning) {
    const normalizedTrigger = normalize(item.trigger);

    let existing = autoResponder.find(
      (r) => normalize(r.match) === normalizedTrigger
    );

    if (existing) {
      // asegurar formato moderno
      if (!Array.isArray(existing.answers)) {
        existing.answers = existing.answer ? [existing.answer] : [];
        delete existing.answer;
      }

      const similarIndex = existing.answers.findIndex((ans) =>
        stringSimilarity.compareTwoStrings(
          normalize(ans),
          normalize(item.answer)
        ) >= SIMILARITY_THRESHOLD
      );

      if (similarIndex !== -1) {
        existing.answers[similarIndex] = item.answer.trim();
      } else {
        existing.answers.push(item.answer.trim());
      }

      changed = true;

    } else {
      // 🔥 SOLO agrega nuevo (NO reconstruye todo)
      autoResponder.push({
        match: item.trigger.trim(),
        answers: [item.answer.trim()],
      });

      changed = true;
    }
  }

  // 🔥 SOLO guardar si hubo cambios
  if (changed) {
    db.writeJSON("auto-responder", autoResponder);
  }

  // limpiar learning
  db.writeJSON(LEARNING_FILE, []);
}

/**
 * ==============================
 * 🔹 EXTRAER TEXTO
 * ==============================
 */
function extractTextFromMessage(message) {
  if (!message) return "";

  if (message.conversation) return message.conversation;

  if (message.extendedTextMessage?.text)
    return message.extendedTextMessage.text;

  if (message.buttonsResponseMessage?.selectedDisplayText)
    return message.buttonsResponseMessage.selectedDisplayText;

  if (message.listResponseMessage?.singleSelectReply?.selectedRowId)
    return message.listResponseMessage.singleSelectReply.selectedRowId;

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

module.exports = { learnFromMessage };
