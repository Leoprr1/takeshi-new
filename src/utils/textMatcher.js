const stringSimilarity = require("string-similarity");

/**
 * Normaliza texto:
 * - Minúsculas
 * - Quita tildes
 * - Quita signos
 */
function normalizeText(text = "") {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quitar tildes
    .replace(/[.,!?¿¡;]/g, "") // quitar signos comunes
    .trim();
}

/**
 * Detecta si un mensaje coincide con una regla
 * @param {string} message
 * @param {string} ruleText
 * @param {number} threshold (0.7 recomendado)
 */
function isSimilar(message, ruleText, threshold = 0.7) {
  const normalizedMessage = normalizeText(message);
  const normalizedRule = normalizeText(ruleText);

  // Coincidencia directa parcial
  if (normalizedMessage.includes(normalizedRule)) {
    return true;
  }

  // Coincidencia por similitud
  const similarity = stringSimilarity.compareTwoStrings(
    normalizedMessage,
    normalizedRule
  );

  return similarity >= threshold;
}

module.exports = {
  normalizeText,
  isSimilar
};
