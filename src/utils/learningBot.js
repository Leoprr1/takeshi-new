// 🔥 learningBot.js
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
 * 🔥 REORGANIZAR AUTO-RESPONDER.JSON
 * ==============================
 * - Convierte formato viejo (answer → answers[])
 * - Agrupa duplicados por match
 * - Si respuesta es similar → reemplaza
 * - Si diferente → agrega
 */
function reorganizeAutoResponder() {
  const autoResponder = db.readJSON("auto-responder", []);
  const grouped = {};

  for (const item of autoResponder) {
    if (!item.match) continue;

    const normalizedMatch = normalize(item.match);

    if (!grouped[normalizedMatch]) {
      grouped[normalizedMatch] = {
        match: item.match.trim(),
        answers: [],
      };
    }

    // 🔹 Unificar formato viejo
    let answersToProcess = [];

    if (Array.isArray(item.answers)) {
      answersToProcess = item.answers;
    } else if (item.answer) {
      answersToProcess = [item.answer];
    }

    for (const ans of answersToProcess) {
      const existingAnswers = grouped[normalizedMatch].answers;

      const similarIndex = existingAnswers.findIndex(existing =>
        stringSimilarity.compareTwoStrings(
          normalize(existing),
          normalize(ans)
        ) >= SIMILARITY_THRESHOLD
      );

      if (similarIndex !== -1) {
        // 🔥 Reemplazar similar
        existingAnswers[similarIndex] = ans.trim();
      } else {
        // 🔥 Agregar diferente
        existingAnswers.push(ans.trim());
      }
    }
  }

  // 🔥 Convertir objeto agrupado en array final
  const reorganized = Object.values(grouped);

  db.writeJSON("auto-responder", reorganized);
}

/**
 * ==============================
 * 🔹 EXPORTAR LEARNING A AUTO-RESPONDER
 * ==============================
 */
function checkAndExportToAutoResponder() {
  const learning = db.readJSON(LEARNING_FILE, []);
  const autoResponder = db.readJSON("auto-responder", []);

  for (const item of learning) {
    const index = autoResponder.findIndex(
      (r) => normalize(r.match) === normalize(item.trigger)
    );

    if (index !== -1) {

      if (!Array.isArray(autoResponder[index].answers)) {
        autoResponder[index].answers = autoResponder[index].answer
          ? [autoResponder[index].answer]
          : [];
        delete autoResponder[index].answer;
      }

      const similarIndex = autoResponder[index].answers.findIndex(ans =>
        stringSimilarity.compareTwoStrings(
          normalize(ans),
          normalize(item.answer)
        ) >= SIMILARITY_THRESHOLD
      );

      if (similarIndex !== -1) {
        autoResponder[index].answers[similarIndex] = item.answer;
      } else {
        autoResponder[index].answers.push(item.answer);
      }

    } else {
      autoResponder.push({
        match: item.trigger,
        answers: [item.answer],
      });
    }
  }

  db.writeJSON("auto-responder", autoResponder);
  db.writeJSON(LEARNING_FILE, []);

  // 🔥 REORGANIZAR TODO EL ARCHIVO DESPUÉS
  reorganizeAutoResponder();
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
