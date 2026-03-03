/**
 * Funciones útiles para trabajar con datos.
 *
 * @author Dev Gui
 */
const path = require("node:path");
const fs = require("node:fs");
const { PREFIX } = require("../config");
const stringSimilarity = require("string-similarity");

const databasePath = path.resolve(__dirname, "..", "..", "database");

// Archivos base
const ANTI_LINK_GROUPS_FILE = "anti-link-groups";
const AUTO_RESPONDER_FILE = "auto-responder";
const AUTO_RESPONDER_GROUPS_FILE = "auto-responder-groups";
const EXIT_GROUPS_FILE = "exit-groups";
const GROUP_RESTRICTIONS_FILE = "group-restrictions";
const INACTIVE_GROUPS_FILE = "inactive-groups";
const MUTE_FILE = "muted";
const ONLY_ADMINS_FILE = "only-admins";
const PREFIX_GROUPS_FILE = "prefix-groups";
const RESTRICTED_MESSAGES_FILE = "restricted-messages";
const WELCOME_GROUPS_FILE = "welcome-groups";
const USERS_FILE = "users"; // 🔹 archivo JSON para usuarios

// =====================
// FUNCIONES BASE
// =====================
function createIfNotExists(fullPath, formatIfNotExists = []) {
  if (!fs.existsSync(fullPath)) {
    fs.writeFileSync(fullPath, JSON.stringify(formatIfNotExists));
  }
}

function readJSON(jsonFile, formatIfNotExists = []) {
  const fullPath = path.resolve(databasePath, `${jsonFile}.json`);
  createIfNotExists(fullPath, formatIfNotExists);
  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
}

function writeJSON(jsonFile, data, formatIfNotExists = []) {
  const fullPath = path.resolve(databasePath, `${jsonFile}.json`);
  createIfNotExists(fullPath, formatIfNotExists);
  fs.writeFileSync(fullPath, JSON.stringify(data, null, 2), "utf8");
}

// =====================
// FUNCIONES DE USUARIOS
// =====================
function readUserProfiles() {
  return readJSON(USERS_FILE, {});
}

function saveUserProfiles(users) {
  writeJSON(USERS_FILE, users, {});
}

function incrementCommandCount(userJid) {
  const users = readUserProfiles();
  if (users[userJid]) {
    users[userJid].commandsUsed = (users[userJid].commandsUsed || 0) + 1;
    saveUserProfiles(users);
  }
}

// =====================
// FUNCIONES DE TEXTO
// =====================
const abbreviationsPath = path.resolve(databasePath, "abbreviations.json");
const abbreviations = fs.existsSync(abbreviationsPath)
  ? JSON.parse(fs.readFileSync(abbreviationsPath, "utf8"))
  : {};

function normalizeText(text) {
  if (!text) return "";
  let normalized = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quitar acentos
    .replace(/(.)\1{2,}/g, "$1") // quita letras duplicadas más de 2
    .replace(/[^\w\s]/g, ""); // quitar símbolos excepto espacios

  // aplicar abreviaturas
  for (const [key, value] of Object.entries(abbreviations)) {
    const regex = new RegExp(`\\b${key}\\b`, "gi");
    normalized = normalized.replace(regex, value);
  }

  // eliminar stopwords cortas
  const stopwords = ["de", "la", "el", "y", "a", "en", "lo", "un", "una"];
  normalized = normalized
    .split(/\s+/)
    .filter((w) => !stopwords.includes(w))
    .join(" ");

  return normalized.trim();
}

// =====================
// AUTO RESPONDER
// =====================
exports.getAutoResponderResponse = (match) => {
  const responses = readJSON(AUTO_RESPONDER_FILE, []);
  if (!match || !responses.length) return null;

  const normalizedMessage = normalizeText(match);

  const sortedResponses = [...responses].sort(
    (a, b) => b.match.length - a.match.length
  );

  // 1️⃣ Exacta
  for (const response of sortedResponses) {
    if (normalizeText(response.match) === normalizedMessage) return response.answer;
  }

  // 2️⃣ Coincidencia por palabra completa
  const messageWords = normalizedMessage.split(/\s+/);
  for (const response of sortedResponses) {
    const ruleWords = normalizeText(response.match).split(/\s+/);
    if (ruleWords.length <= 2) continue;
    if (ruleWords.every((w) => messageWords.includes(w))) return response.answer;
  }

  // 3️⃣ Includes parcial
  for (const response of sortedResponses) {
    const rule = normalizeText(response.match);
    if (rule.length <= 2) continue;
    if (normalizedMessage.includes(rule)) return response.answer;
  }

  // 4️⃣ Similitud fuzzy
  for (const response of sortedResponses) {
    const rule = normalizeText(response.match);
    if (rule.length <= 3) continue;
    if (stringSimilarity.compareTwoStrings(normalizedMessage, rule) >= 0.75)
      return response.answer;
  }

  return null;
};

// =====================
// FUNCIONES DE GRUPOS
// =====================
exports.activateExitGroup = (groupId) => {
  const exitGroups = readJSON(EXIT_GROUPS_FILE);
  if (!exitGroups.includes(groupId)) exitGroups.push(groupId);
  writeJSON(EXIT_GROUPS_FILE, exitGroups);
};

exports.deactivateExitGroup = (groupId) => {
  const exitGroups = readJSON(EXIT_GROUPS_FILE);
  const index = exitGroups.indexOf(groupId);
  if (index !== -1) exitGroups.splice(index, 1);
  writeJSON(EXIT_GROUPS_FILE, exitGroups);
};

exports.isActiveExitGroup = (groupId) => readJSON(EXIT_GROUPS_FILE).includes(groupId);

exports.activateWelcomeGroup = (groupId) => {
  const welcomeGroups = readJSON(WELCOME_GROUPS_FILE);
  if (!welcomeGroups.includes(groupId)) welcomeGroups.push(groupId);
  writeJSON(WELCOME_GROUPS_FILE, welcomeGroups);
};

exports.deactivateWelcomeGroup = (groupId) => {
  const welcomeGroups = readJSON(WELCOME_GROUPS_FILE);
  const index = welcomeGroups.indexOf(groupId);
  if (index !== -1) welcomeGroups.splice(index, 1);
  writeJSON(WELCOME_GROUPS_FILE, welcomeGroups);
};

exports.isActiveWelcomeGroup = (groupId) => readJSON(WELCOME_GROUPS_FILE).includes(groupId);

exports.activateGroup = (groupId) => {
  const inactiveGroups = readJSON(INACTIVE_GROUPS_FILE);
  const index = inactiveGroups.indexOf(groupId);
  if (index !== -1) inactiveGroups.splice(index, 1);
  writeJSON(INACTIVE_GROUPS_FILE, inactiveGroups);
};

exports.deactivateGroup = (groupId) => {
  const inactiveGroups = readJSON(INACTIVE_GROUPS_FILE);
  if (!inactiveGroups.includes(groupId)) inactiveGroups.push(groupId);
  writeJSON(INACTIVE_GROUPS_FILE, inactiveGroups);
};

exports.isActiveGroup = (groupId) => !readJSON(INACTIVE_GROUPS_FILE).includes(groupId);

// =====================
// AUTO RESPONDER Y ANTI LINK
// =====================
exports.activateAutoResponderGroup = (groupId) => {
  const groups = readJSON(AUTO_RESPONDER_GROUPS_FILE);
  if (!groups.includes(groupId)) groups.push(groupId);
  writeJSON(AUTO_RESPONDER_GROUPS_FILE, groups);
};

exports.deactivateAutoResponderGroup = (groupId) => {
  const groups = readJSON(AUTO_RESPONDER_GROUPS_FILE);
  const index = groups.indexOf(groupId);
  if (index !== -1) groups.splice(index, 1);
  writeJSON(AUTO_RESPONDER_GROUPS_FILE, groups);
};

exports.isActiveAutoResponderGroup = (groupId) => readJSON(AUTO_RESPONDER_GROUPS_FILE).includes(groupId);

exports.activateAntiLinkGroup = (groupId) => {
  const groups = readJSON(ANTI_LINK_GROUPS_FILE);
  if (!groups.includes(groupId)) groups.push(groupId);
  writeJSON(ANTI_LINK_GROUPS_FILE, groups);
};

exports.deactivateAntiLinkGroup = (groupId) => {
  const groups = readJSON(ANTI_LINK_GROUPS_FILE);
  const index = groups.indexOf(groupId);
  if (index !== -1) groups.splice(index, 1);
  writeJSON(ANTI_LINK_GROUPS_FILE, groups);
};

exports.isActiveAntiLinkGroup = (groupId) => readJSON(ANTI_LINK_GROUPS_FILE).includes(groupId);

// =====================
// MUTE Y ADMINS
// =====================
exports.muteMember = (groupId, memberId) => {
  const mutedMembers = readJSON(MUTE_FILE, {});
  if (!mutedMembers[groupId]) mutedMembers[groupId] = [];
  if (!mutedMembers[groupId].includes(memberId)) mutedMembers[groupId].push(memberId);
  writeJSON(MUTE_FILE, mutedMembers);
};

exports.unmuteMember = (groupId, memberId) => {
  const mutedMembers = readJSON(MUTE_FILE, {});
  if (!mutedMembers[groupId]) return;
  const index = mutedMembers[groupId].indexOf(memberId);
  if (index !== -1) mutedMembers[groupId].splice(index, 1);
  writeJSON(MUTE_FILE, mutedMembers);
};

exports.checkIfMemberIsMuted = (groupId, memberId) => {
  const mutedMembers = readJSON(MUTE_FILE, {});
  return mutedMembers[groupId]?.includes(memberId) || false;
};

exports.activateOnlyAdmins = (groupId) => {
  const groups = readJSON(ONLY_ADMINS_FILE, []);
  if (!groups.includes(groupId)) groups.push(groupId);
  writeJSON(ONLY_ADMINS_FILE, groups);
};

exports.deactivateOnlyAdmins = (groupId) => {
  const groups = readJSON(ONLY_ADMINS_FILE, []);
  const index = groups.indexOf(groupId);
  if (index !== -1) groups.splice(index, 1);
  writeJSON(ONLY_ADMINS_FILE, groups);
};

exports.isActiveOnlyAdmins = (groupId) => readJSON(ONLY_ADMINS_FILE, []).includes(groupId);

// =====================
// RESTRICCIONES Y PREFIX
// =====================
exports.readGroupRestrictions = () => readJSON(GROUP_RESTRICTIONS_FILE, {});
exports.saveGroupRestrictions = (restrictions) => writeJSON(GROUP_RESTRICTIONS_FILE, restrictions, {});
exports.isActiveGroupRestriction = (groupId, restriction) => {
  const restrictions = exports.readGroupRestrictions();
  return restrictions[groupId]?.[restriction] === true;
};
exports.updateIsActiveGroupRestriction = (groupId, restriction, isActive) => {
  const restrictions = exports.readGroupRestrictions();
  if (!restrictions[groupId]) restrictions[groupId] = {};
  restrictions[groupId][restriction] = isActive;
  exports.saveGroupRestrictions(restrictions);
};

exports.readRestrictedMessageTypes = () => readJSON(RESTRICTED_MESSAGES_FILE, {
  sticker: "stickerMessage",
  video: "videoMessage",
  image: "imageMessage",
  audio: "audioMessage",
  product: "productMessage",
  document: "documentMessage",
  event: "eventMessage",
});

exports.setPrefix = (groupJid, prefix) => {
  const prefixes = readJSON(PREFIX_GROUPS_FILE, {});
  prefixes[groupJid] = prefix;
  writeJSON(PREFIX_GROUPS_FILE, prefixes, {});
};

exports.getPrefix = (groupJid) => readJSON(PREFIX_GROUPS_FILE, {})[groupJid] || PREFIX;

// =====================
// AUTO RESPONDER ITEMS
// =====================
exports.listAutoResponderItems = () => {
  const responses = readJSON(AUTO_RESPONDER_FILE, []);
  return responses.map((item, index) => ({ key: index + 1, match: item.match, answer: item.answer }));
};

exports.addAutoResponderItem = (match, answer) => {
  const responses = readJSON(AUTO_RESPONDER_FILE, []);
  if (responses.find(r => r.match.toUpperCase() === match.toUpperCase())) return false;
  responses.push({ match: match.trim(), answer: answer.trim() });
  writeJSON(AUTO_RESPONDER_FILE, responses, []);
  return true;
};

exports.removeAutoResponderItemByKey = (key) => {
  const responses = readJSON(AUTO_RESPONDER_FILE, []);
  const index = key - 1;
  if (index < 0 || index >= responses.length) return false;
  responses.splice(index, 1);
  writeJSON(AUTO_RESPONDER_FILE, responses, []);
  return true;
};

// =====================
// EXPORTAR FUNCIONES DE USUARIOS
// =====================
exports.readUserProfiles = readUserProfiles;
exports.saveUserProfiles = saveUserProfiles;
exports.incrementCommandCount = incrementCommandCount;

// =====================
// EXPORTAR FUNCIONES BASE
// =====================
exports.readJSON = readJSON;
exports.writeJSON = writeJSON;
exports.normalizeText = normalizeText;
exports.addAutoResponderItem = exports.addAutoResponderItem;
