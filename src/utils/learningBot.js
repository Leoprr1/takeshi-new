// learningBot.js
const { readJSON, writeJSON, getAutoResponderResponse } = require("./database");
const stringSimilarity = require("string-similarity");

const LEARNING_FILE = "learning.json";
const AUTO_RESPONDER_FILE = "auto-responder";

// Umbral de frecuencia para pasar de learning.json a auto-responder.json
const FREQUENCY_THRESHOLD = 3; 

// Normalización usando abbreviations y database.js
function normalizeText(text) {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// 🔥 Aprender un nuevo par trigger → answer
function learnResponse(trigger, answer) {
  if (!trigger || !answer) return;

  const normalizedTrigger = normalizeText(trigger);
  const normalizedAnswer = normalizeText(answer);

  // Ignorar triggers/respuestas muy cortas
  if (normalizedTrigger.length <= 2 || normalizedAnswer.length <= 2) return;

  const learning = readJSON(LEARNING_FILE, []);
  const existing = learning.find(
    (item) =>
      normalizeText(item.trigger) === normalizedTrigger &&
      normalizeText(item.answer) === normalizedAnswer
  );

  if (existing) {
    existing.frequency = (existing.frequency || 1) + 1;
  } else {
    learning.push({
      trigger: trigger.trim(),
      answer: answer.trim(),
      frequency: 1,
    });
  }

  // Revisar si supera el umbral para pasar a auto-responder
  const toPromote = learning.filter((item) => item.frequency >= FREQUENCY_THRESHOLD);

  if (toPromote.length > 0) {
    const autoResponses = readJSON(AUTO_RESPONDER_FILE, []);

    toPromote.forEach((item) => {
      // Evitar duplicados en auto-responder
      const existsInAuto = autoResponses.find(
        (r) =>
          normalizeText(r.match) === normalizeText(item.trigger) &&
          normalizeText(r.answer) === normalizeText(item.answer)
      );
      if (!existsInAuto) {
        autoResponses.push({ match: item.trigger, answer: item.answer });
      }

      // Eliminar del learning temporal
      const index = learning.indexOf(item);
      if (index !== -1) learning.splice(index, 1);
    });

    writeJSON(AUTO_RESPONDER_FILE, autoResponses);
  }

  // Guardar cambios en learning.json
  writeJSON(LEARNING_FILE, learning);
}

// 🔥 Obtener respuesta aprendida de learning.json
function getLearnedResponse(message) {
  const normalizedMessage = normalizeText(message);
  const learning = readJSON(LEARNING_FILE, []);

  // Ordenar por longitud de trigger y frecuencia para que sea “humano”
  const sorted = learning.sort(
    (a, b) =>
      b.trigger.length - a.trigger.length || (b.frequency || 1) - (a.frequency || 1)
  );

  for (const item of sorted) {
    const normalizedTrigger = normalizeText(item.trigger);

    // 1️⃣ Coincidencia exacta
    if (normalizedMessage === normalizedTrigger) return item.answer;

    // 2️⃣ Includes (solo triggers > 1 caracter)
    if (normalizedTrigger.length > 1 && normalizedMessage.includes(normalizedTrigger))
      return item.answer;

    // 3️⃣ Similitud (solo triggers > 2 caracteres)
    if (normalizedTrigger.length > 2) {
      const similarity = stringSimilarity.compareTwoStrings(
        normalizedMessage,
        normalizedTrigger
      );
      if (similarity >= 0.75) return item.answer;
    }
  }

  return null;
}

module.exports = { learnResponse, getLearnedResponse };
