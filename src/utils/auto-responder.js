/**
 * Auto-responder optimizado con cache en RAM (sin recalcular por mensaje)
 */

const path = require("node:path");
const fs = require("node:fs");
const stringSimilarity = require("string-similarity");
const { normalizeText, readJSON, writeJSON } = require("./database");
const { getDB } = require("./jsoncache");

const databasePath = path.resolve(__dirname, "..", "..", "database");

const AUTO_RESPONDER_GROUPS_FILE = "auto-responder-groups";
const AUTO_RESPONDER_FILE = "auto-responder";

// =====================
// 🔥 CACHE EN RAM
// =====================

let cachedResponses = [];
let lastHash = null;

const crypto = require("crypto");

// preparar cache
function prepareAutoResponder() {
  try {
    const responses = getDB("auto-responder") || [];

    // 🔥 validar que sea array
    if (!Array.isArray(responses)) return;

    // 🔥 generar hash del contenido
    const currentHash = crypto
      .createHash("md5")
      .update(JSON.stringify(responses))
      .digest("hex");

    // 🔥 si no cambió, NO recalcular
    if (currentHash === lastHash) return;

    lastHash = currentHash;

    // 🔥 reconstruir cache
    cachedResponses = responses
      .map((r) => {
        const normalized = normalizeText(r.match);

        return {
          raw: r,
          normalized,
          words: normalized.split(/\s+/),
        };
      })
      .sort((a, b) => b.normalized.length - a.normalized.length);

    console.log("⚡ Auto-responder cache actualizado:", cachedResponses.length);

  } catch (err) {
    console.log("❌ Error preparando cache auto-responder:", err);
  }
}


// 🔥 delay inicial (espera a que JSONCache cargue)
setTimeout(() => {
  prepareAutoResponder();

  // 🔁 luego sí, interval normal
  setInterval(() => {
    prepareAutoResponder();
  }, 600000);

}, 10000); // 10 segundos

// =====================
// AUTO RESPONDER
// =====================

const getAutoResponderResponse = (match) => {
  if (!match || !cachedResponses.length) return null;

  const normalizedMessage = normalizeText(match);
  const messageWords = normalizedMessage.split(/\s+/);

  const getRandomAnswer = (answers) => {
    if (!Array.isArray(answers) || !answers.length) return null;
    return answers[Math.floor(Math.random() * answers.length)];
  };

  // 1. match exacto
  for (const r of cachedResponses) {
    if (r.normalized === normalizedMessage) {
      return getRandomAnswer(r.raw.answers);
    }
  }

  // 2. palabras completas
  for (const r of cachedResponses) {
    if (r.words.length <= 2) continue;
    if (r.words.every((w) => messageWords.includes(w))) {
      return getRandomAnswer(r.raw.answers);
    }
  }

  // 3. includes
  for (const r of cachedResponses) {
    if (r.normalized.length <= 2) continue;
    if (normalizedMessage.includes(r.normalized)) {
      return getRandomAnswer(r.raw.answers);
    }
  }

  // 4. similaridad
  for (const r of cachedResponses) {
    if (r.normalized.length <= 3) continue;
    if (
      stringSimilarity.compareTwoStrings(normalizedMessage, r.normalized) >= 0.75
    ) {
      return getRandomAnswer(r.raw.answers);
    }
  }

  return null;
};

// =====================
// AUTO RESPONDER Y ANTI LINK
// =====================

const activateAutoResponderGroup = (groupId) => {
  const groups = readJSON(AUTO_RESPONDER_GROUPS_FILE);
  if (!groups.includes(groupId)) groups.push(groupId);
  writeJSON(AUTO_RESPONDER_GROUPS_FILE, groups);
};

const deactivateAutoResponderGroup = (groupId) => {
  const groups = readJSON(AUTO_RESPONDER_GROUPS_FILE);
  const index = groups.indexOf(groupId);
  if (index !== -1) groups.splice(index, 1);
  writeJSON(AUTO_RESPONDER_GROUPS_FILE, groups);
};

const isActiveAutoResponderGroup = (groupId) =>
  readJSON(AUTO_RESPONDER_GROUPS_FILE).includes(groupId);

// =====================
// AUTO RESPONDER ITEMS
// =====================

const listAutoResponderItems = () => {
  const responses = readJSON(AUTO_RESPONDER_FILE, []);
  return responses.map((item, index) => ({
    key: index + 1,
    match: item.match,
    answers: item.answers || [],
  }));
};

const addAutoResponderItem = (match, answer) => {
  const responses = readJSON(AUTO_RESPONDER_FILE, []);

  const existing = responses.find(
    (r) => r.match.toUpperCase() === match.toUpperCase()
  );

  if (existing) {
    if (!existing.answers.includes(answer.trim())) {
      existing.answers.push(answer.trim());
      writeJSON(AUTO_RESPONDER_FILE, responses, []);
      prepareAutoResponder(); // 🔥 refrescar cache
    }
    return true;
  }

  responses.push({
    match: match.trim(),
    answers: [answer.trim()],
  });

  writeJSON(AUTO_RESPONDER_FILE, responses, []);
  prepareAutoResponder(); // 🔥 refrescar cache

  return true;
};

const removeAutoResponderItemByKey = (key) => {
  const responses = readJSON(AUTO_RESPONDER_FILE, []);
  const index = key - 1;
  if (index < 0 || index >= responses.length) return false;

  responses.splice(index, 1);
  writeJSON(AUTO_RESPONDER_FILE, responses, []);
  prepareAutoResponder(); // 🔥 refrescar cache

  return true;
};

// =====================
// EXPORTS
// =====================

module.exports = {
  getAutoResponderResponse,
  activateAutoResponderGroup,
  deactivateAutoResponderGroup,
  isActiveAutoResponderGroup,
  listAutoResponderItems,
  addAutoResponderItem,
  removeAutoResponderItemByKey,
};
