const fs = require("fs").promises;
const fsSync = require("fs");
const path = require("path");

const databasePath = path.resolve(__dirname, "../../database");
const AUTO_FILE = path.resolve(databasePath, "auto-responder.json");
const LB2_FILE = path.resolve(databasePath, "learningbot2.json");
const GENERATED_FILE = path.resolve(databasePath, "generated-memory.json");

let brain = {
  metadata: {
    createdAt: Date.now(),
    source: "incremental-brain",
  },
  topics: {},
  global: {
    wordFrequency: {},
    totalSentences: 0,
  },
};

// 🧠 cache de lo ya procesado (CLAVE DEL FIX)
const processedSet = new Set();

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

function detectTopic(text) {
  const topicMap = {
    edad: ["edad", "años"],
    nombre: ["nombre", "llamas"],
    saludo: ["hola", "buenas", "hey"],
    estado: ["como estas", "todo bien"],
    identidad: ["quien sos", "quien eres"],
    despedida: ["chau", "adios", "nos vemos"]
  };

  for (const [topic, keywords] of Object.entries(topicMap)) {
    if (keywords.some(k => text.includes(k))) return topic;
  }

  return "general";
}

function uniqueArray(arr) {
  return [...new Set(arr)];
}

// 🔥 PROCESAMIENTO INCREMENTAL REAL
function processEntry(sentence) {
  if (!sentence) return;

  const normalized = normalize(sentence);
  if (!normalized) return;

  // 🚫 evitar reprocesar
  const hash = normalized;
  if (processedSet.has(hash)) return;
  processedSet.add(hash);

  const topic = detectTopic(normalized);

  if (!brain.topics[topic]) {
    brain.topics[topic] = {
      keywords: [],
      sentences: [],
      wordFrequency: {},
      bigrams: {},
      totalSentences: 0,
    };
  }

  const topicData = brain.topics[topic];
  const words = normalized.split(/\s+/);

  if (!topicData.sentences.includes(normalized)) {
    topicData.sentences.push(normalized);
    topicData.totalSentences++;
    brain.global.totalSentences++;
  }

  topicData.keywords.push(...words);
  topicData.keywords = uniqueArray(topicData.keywords);

  words.forEach((word, i) => {
    addFrequency(topicData.wordFrequency, word);
    addFrequency(brain.global.wordFrequency, word);

    if (i < words.length - 1) {
      const bigram = words[i] + " " + words[i + 1];
      addFrequency(topicData.bigrams, bigram);
    }
  });
}

// 🔥 carga incremental desde DB (solo nuevos)
async function syncFromDB() {
  const { getDB } = require("./jsoncache");

  const auto = getDB("auto-responder") || [];
  const lb2 = getDB("learningbot2") || [];

  for (const entry of auto) {
    if (!entry.match) continue;
    processEntry(entry.match);

    const answers = entry.answers || (entry.answer ? [entry.answer] : []);
    for (const a of answers) processEntry(a);
  }

  for (const msg of lb2) {
    processEntry(msg);
  }

  console.log("🧠 Brain actualizado incrementalmente");
}

// 🔥 guardado liviano (no bloqueante)
async function saveBrain() {
  try {
    await fs.writeFile(GENERATED_FILE, JSON.stringify(brain, null, 2));
  } catch (err) {
    console.error("❌ Error guardando brain:", err);
  }
}

// 🚀 loop estable SIN rebuild total
function initWatcher() {
  setTimeout(() => {
    syncFromDB();

    setInterval(() => {
      syncFromDB(); // solo agrega lo nuevo
      saveBrain(); // guarda snapshot liviano
    }, 60 * 1000);
  }, 5000);
}

initWatcher();

module.exports = { syncFromDB };
