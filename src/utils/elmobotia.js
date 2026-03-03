/**
 * ElmoBotia - Sistema generativo inteligente con control de confianza
 * + Mejora estructural gramatical en español
 * + Adaptación básica por tipo de mensaje
 */

const path = require("node:path");
const fs = require("node:fs");

const databasePath = path.resolve(__dirname, "../../database");
const GENERATED_MEMORY_FILE = "generated-memory";

const MIN_CONFIDENCE = 0.8;

let lastGeneratedMessage = null;

/* ===========================
   UTILIDADES
=========================== */

function normalizeText(text = "") {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,!?¿¡;]/g, "")
    .trim();
}

function createIfNotExists(fullPath, formatIfNotExists = {}) {
  if (!fs.existsSync(fullPath)) {
    fs.writeFileSync(fullPath, JSON.stringify(formatIfNotExists, null, 2));
  }
}

function readJSON(jsonFile, formatIfNotExists = {}) {
  const fullPath = path.resolve(databasePath, `${jsonFile}.json`);
  createIfNotExists(fullPath, formatIfNotExists);
  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/* ===========================
   CLASIFICACIÓN GRAMATICAL EN ESPAÑOL
=========================== */

function getWordType(word) {
  const lower = word.toLowerCase();
  if (/ar$|er$|ir$/.test(lower)) return "verb";
  if (/mente$/.test(lower)) return "adverb";
  if (/o$|a$|os$|as$/.test(lower)) return "noun";
  if (/ivo$|iva$|oso$|osa$|ble$/.test(lower)) return "adjective";
  return "other";
}

/* ===========================
   DETECTAR TIPO DE MENSAJE
=========================== */

function detectMessageType(text) {
  if (text.includes("?")) return "question";
  return "statement";
}

/* ===========================
   EXTRACTOR
=========================== */

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

/* ===========================
   DETECCIÓN DE TEMA
=========================== */

function detectTopicWithScore(message, brain) {
  const normalized = normalizeText(message);
  const words = normalized.split(/\s+/);

  let bestTopic = "general";
  let bestScore = 0;

  for (const [topic, data] of Object.entries(brain.topics || {})) {
    if (!data.keywords || !data.keywords.length) continue;

    let matches = 0;
    words.forEach((word) => {
      if (data.keywords.includes(word)) matches++;
    });

    const score = words.length ? matches / words.length : 0;
    if (score > bestScore) {
      bestScore = score;
      bestTopic = topic;
    }
  }

  return { topic: bestTopic, relevance: bestScore };
}

/* ===========================
   RANDOM PESADO
=========================== */

function weightedRandom(words, frequencyMap) {
  let total = 0;
  const weighted = [];

  words.forEach((word) => {
    const weight = frequencyMap[word] || 1;
    total += weight;
    weighted.push({ word, cumulative: total });
  });

  const random = Math.random() * total;
  for (const item of weighted) {
    if (random <= item.cumulative) return item.word;
  }
  return words[0];
}

/* ===========================
   GENERADOR MEJORADO
=========================== */

function generateSentence(topicData, messageType, maxWords = 12) {
  if (!topicData.wordFrequency) return { sentence: null, bigramHits: 0 };

  const vocabulary = Object.keys(topicData.wordFrequency);
  if (!vocabulary.length) return { sentence: null, bigramHits: 0 };

  const structures = {
    statement: ["noun", "verb", "noun", "adjective"],
    question: ["pronoun", "verb", "noun"]
  };
  const structure = structures[messageType] || structures.statement;

  // Filtrar candidatos iniciales
  const startCandidates = vocabulary.filter(w => ["noun", "pronoun"].includes(getWordType(w)));
  if (!startCandidates.length) return { sentence: null, bigramHits: 0 };

  let current = weightedRandom(startCandidates, topicData.wordFrequency);
  const sentence = [current];

  let bigramHits = 0;

  for (let i = 1; i < maxWords; i++) {
    const expectedType = structure[i % structure.length];
    const possibleNext = Object.keys(topicData.bigrams || {})
      .filter(pair => pair.startsWith(current + " "))
      .map(pair => pair.split(" ")[1]);

    if (!possibleNext.length) break;

    const typedCandidates = possibleNext.filter(w => getWordType(w) === expectedType);
    const finalCandidates = typedCandidates.length ? typedCandidates : possibleNext;

    bigramHits++;
    current = weightedRandom(finalCandidates, topicData.wordFrequency);
    sentence.push(current);
  }

  let finalSentence = sentence.join(" ");
  if (finalSentence.length < 4) return { sentence: null, bigramHits: 0 };

  finalSentence = capitalize(finalSentence);
  if (messageType === "question") finalSentence += "?";
  else finalSentence += ".";

  return { sentence: finalSentence, bigramHits };
}

/* ===========================
   CONFIANZA
=========================== */

function calculateConfidence({ relevance, sentenceLength, bigramHits, topicData }) {
  const densityScore = topicData.totalSentences > 0 ? Math.min(topicData.totalSentences / 50, 1) : 0;
  const structureScore = Math.min(bigramHits / 5, 1);
  const lengthScore = Math.min(sentenceLength / 8, 1);
  return relevance * 0.4 + densityScore * 0.2 + structureScore * 0.2 + lengthScore * 0.2;
}

/* ===========================
   RESPUESTA PRINCIPAL
=========================== */

exports.getElmoBotiaResponse = (webMessage) => {
  if (!webMessage?.message) return null;
  if (webMessage?.key?.fromMe) return null;

  const messageText = extractTextFromMessage(webMessage.message);
  if (!messageText || messageText.length < 2) return null;

  if (lastGeneratedMessage && normalizeText(messageText) === normalizeText(lastGeneratedMessage)) return null;

  const brain = readJSON(GENERATED_MEMORY_FILE, { topics: {}, global: {} });
  if (!brain.topics || Object.keys(brain.topics).length === 0) return null;

  const { topic, relevance } = detectTopicWithScore(messageText, brain);
  const topicData = brain.topics[topic];
  if (!topicData) return null;

  const messageType = detectMessageType(messageText);

  const { sentence, bigramHits } = generateSentence(topicData, messageType);
  if (!sentence) return null;

  const sentenceLength = sentence.split(/\s+/).length;

  const confidence = calculateConfidence({ relevance, sentenceLength, bigramHits, topicData });
  if (confidence < MIN_CONFIDENCE) return null;

  lastGeneratedMessage = sentence;
  return sentence;
};
