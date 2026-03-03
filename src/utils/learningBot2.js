// 🔥 learningBot2.js
const fs = require("fs");
const path = require("path");

const GENERATED_FILE = path.resolve(__dirname, "../database/generated-memory.json");

// ===========================
// UTILIDADES
// ===========================
function readJSONSafe(file, def = { topics: {}, global: { wordFrequency: {}, totalSentences: 0 } }) {
  try {
    if (!fs.existsSync(file)) return def;
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    console.error("❌ Error leyendo JSON:", err);
    return def;
  }
}

function writeJSONSafe(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("❌ Error escribiendo JSON:", err);
  }
}

function normalize(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, "")
    .trim();
}

function addFrequency(map, key) {
  if (!map[key]) map[key] = 0;
  map[key]++;
}

// ===========================
// LEARNING BOT 2
// ===========================
function learnFromAllMessages(webMessage) {
  if (!webMessage?.message) return;
  if (webMessage?.key?.fromMe) return; // ignorar mensajes del propio bot

  const texts = extractAllTexts(webMessage.message);
  if (!texts || !texts.length) return;

  texts.forEach((messageText) => {
    if (!messageText || messageText.length < 2) return;
    updateGeneratedMemory(messageText);
  });
}

// 🔹 Extraer todos los textos posibles de un mensaje
function extractAllTexts(message) {
  const texts = [];

  if (!message) return texts;

  // Mensaje simple
  if (message.conversation) texts.push(message.conversation);

  // Mensajes extendidos (texto largo)
  if (message.extendedTextMessage?.text) texts.push(message.extendedTextMessage.text);

  // Mensajes de botones
  if (message.buttonsResponseMessage?.selectedDisplayText)
    texts.push(message.buttonsResponseMessage.selectedDisplayText);

  // Mensajes de listas
  if (message.listResponseMessage?.singleSelectReply?.selectedRowId)
    texts.push(message.listResponseMessage.singleSelectReply.selectedRowId);

  // Captions de imagen o video
  if (message.imageMessage?.caption) texts.push(message.imageMessage.caption);
  if (message.videoMessage?.caption) texts.push(message.videoMessage.caption);

  // Documento opcional
  if (message.documentMessage?.fileName) texts.push(`[document ${message.documentMessage.fileName}]`);

  return texts;
}

// 🔹 Guardar mensaje en generated-memory.json
function updateGeneratedMemory(messageText) {
  const brain = readJSONSafe(GENERATED_FILE);

  const normalizedMessage = normalize(messageText);
  const words = normalizedMessage.split(/\s+/);

  const topic = "general";
  if (!brain.topics[topic]) {
    brain.topics[topic] = {
      keywords: [],
      wordFrequency: {},
      bigrams: {},
      sentences: [],
      totalSentences: 0,
    };
  }

  const topicData = brain.topics[topic];
  topicData.totalSentences++;
  brain.global.totalSentences++;

  // Evitar duplicados exactos consecutivos
  const lastSentence = topicData.sentences[topicData.sentences.length - 1];
  if (lastSentence !== messageText.trim()) {
    topicData.sentences.push(messageText.trim());
  }

  // Actualizar keywords, wordFrequency y bigramas
  words.forEach((word, index) => {
    if (!topicData.keywords.includes(word)) topicData.keywords.push(word);
    addFrequency(topicData.wordFrequency, word);
    addFrequency(brain.global.wordFrequency, word);

    if (index < words.length - 1) {
      const bigram = `${words[index]} ${words[index + 1]}`;
      addFrequency(topicData.bigrams, bigram);
    }
  });

  writeJSONSafe(GENERATED_FILE, brain);
}

module.exports = { learnFromAllMessages };
