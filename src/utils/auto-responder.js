/**
 * Auto-responder separado con cache (getDB) para funcionar igual que en database.js
 */

const path = require("node:path");
const fs = require("node:fs");
const stringSimilarity = require("string-similarity");
const { normalizeText, readJSON, writeJSON } = require("./database");
const { getDB } = require("./jsoncache"); // solo para getAutoResponderResponse
const databasePath = path.resolve(__dirname, "..", "..", "database");

const AUTO_RESPONDER_GROUPS_FILE = "auto-responder-groups";
const AUTO_RESPONDER_FILE = "auto-responder"; // 🔹 archivo JSON de auto-responder

// =====================
// AUTO RESPONDER
// =====================
const getAutoResponderResponse = (match) => {
  const responses = getDB("auto-responder"); // 🔹 usa cache RAM
  if (!match || !responses.length) return null;

  const normalizedMessage = normalizeText(match);

  const sortedResponses = [...responses].sort(
    (a, b) => b.match.length - a.match.length
  );

  const getRandomAnswer = (answers) => {
    if (!Array.isArray(answers) || !answers.length) return null;
    return answers[Math.floor(Math.random() * answers.length)];
  };

  for (const response of sortedResponses) {
    if (normalizeText(response.match) === normalizedMessage)
      return getRandomAnswer(response.answers);
  }

  const messageWords = normalizedMessage.split(/\s+/);
  for (const response of sortedResponses) {
    const ruleWords = normalizeText(response.match).split(/\s+/);
    if (ruleWords.length <= 2) continue;
    if (ruleWords.every((w) => messageWords.includes(w)))
      return getRandomAnswer(response.answers);
  }

  for (const response of sortedResponses) {
    const rule = normalizeText(response.match);
    if (rule.length <= 2) continue;
    if (normalizedMessage.includes(rule))
      return getRandomAnswer(response.answers);
  }

  for (const response of sortedResponses) {
    const rule = normalizeText(response.match);
    if (rule.length <= 3) continue;
    if (stringSimilarity.compareTwoStrings(normalizedMessage, rule) >= 0.75)
      return getRandomAnswer(response.answers);
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
    }
    return true;
  }

  responses.push({
    match: match.trim(),
    answers: [answer.trim()],
  });

  writeJSON(AUTO_RESPONDER_FILE, responses, []);
  return true;
};

const removeAutoResponderItemByKey = (key) => {
  const responses = readJSON(AUTO_RESPONDER_FILE, []);
  const index = key - 1;
  if (index < 0 || index >= responses.length) return false;
  responses.splice(index, 1);
  writeJSON(AUTO_RESPONDER_FILE, responses, []);
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

