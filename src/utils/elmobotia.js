/**
 * ElmoBotia - Sistema generativo inteligente con control de confianza
 * + Protección anti-loop alineada con learningBot
 */

const path = require("node:path");
const fs = require("node:fs");

const databasePath = path.resolve(__dirname, "../../database");
const GENERATED_MEMORY_FILE = "generated-memory";

const MIN_CONFIDENCE = 0.8;

// 🔒 Memoria interna anti-loop
let lastGeneratedMessage = null;

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

// 🔹 MISMO extractor robusto que learningBot
function extractTextFromMessage(message) {
  if (!message) return "";

  if (message.conversation) return message.conversation;

  if (message.extendedTextMessage?.text)
    return message.extendedTextMessage.text;

  if (message.buttonsResponseMessage?.selectedDisplayText)
    return message.buttonsResponseMessage.selectedDisplayText;

  if (message.listResponseMessage?.singleSelectReply?.selectedRowId)
    return message.listResponseMessage.singleSelectReply.selectedRowId;

  if (message.imageMessage?.caption)
    return message.imageMessage.caption;

  if (message.videoMessage?.caption)
    return message.videoMessage.caption;

  return "";
}

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
    if (random <= item.cumulative) {
      return item.word;
    }
  }

  return words[0];
}

function generateSentence(topicData, maxWords = 18) {
  if (!topicData.wordFrequency) return { sentence: null, bigramHits: 0 };

  const vocabulary = Object.keys(topicData.wordFrequency);
  if (!vocabulary.length) return { sentence: null, bigramHits: 0 };

  let current = weightedRandom(vocabulary, topicData.wordFrequency);
  const sentence = [current];

  let bigramHits = 0;

  for (let i = 0; i < maxWords; i++) {
    const possibleNext = Object.keys(topicData.bigrams || {})
      .filter((pair) => pair.startsWith(current + " "))
      .map((pair) => pair.split(" ")[1]);

    if (!possibleNext.length) break;

    bigramHits++;
    current = weightedRandom(possibleNext, topicData.wordFrequency);
    sentence.push(current);
  }

  const finalSentence = sentence.join(" ");

  if (finalSentence.length < 4)
    return { sentence: null, bigramHits: 0 };

  return { sentence: finalSentence, bigramHits };
}

function calculateConfidence({
  relevance,
  sentenceLength,
  bigramHits,
  topicData,
}) {
  const densityScore =
    topicData.totalSentences > 0
      ? Math.min(topicData.totalSentences / 50, 1)
      : 0;

  const structureScore = Math.min(bigramHits / 5, 1);
  const lengthScore = Math.min(sentenceLength / 8, 1);

  return (
    relevance * 0.4 +
    densityScore * 0.2 +
    structureScore * 0.2 +
    lengthScore * 0.2
  );
}

exports.getElmoBotiaResponse = (webMessage) => {

  // 🔒 EXACTAMENTE igual que learningBot
  if (!webMessage?.message) return null;

  // 🔒 Ignorar mensajes enviados por el bot
  if (webMessage?.key?.fromMe) return null;

  const messageText = extractTextFromMessage(webMessage.message);
  if (!messageText || messageText.length < 2) return null;

  // 🔒 Anti-eco interno
  if (
    lastGeneratedMessage &&
    normalizeText(messageText) === normalizeText(lastGeneratedMessage)
  ) {
    return null;
  }

  const brain = readJSON(GENERATED_MEMORY_FILE, {
    topics: {},
    global: {},
  });

  if (!brain.topics || Object.keys(brain.topics).length === 0)
    return null;

  const { topic, relevance } = detectTopicWithScore(messageText, brain);
  const topicData = brain.topics[topic];
  if (!topicData) return null;

  const { sentence, bigramHits } = generateSentence(topicData);
  if (!sentence) return null;

  const sentenceLength = sentence.split(/\s+/).length;

  const confidence = calculateConfidence({
    relevance,
    sentenceLength,
    bigramHits,
    topicData,
  });

  if (confidence < MIN_CONFIDENCE) return null;

  // 🔒 Guardar última respuesta generada
  lastGeneratedMessage = sentence;

  return sentence;
};
