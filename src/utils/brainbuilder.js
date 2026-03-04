// 🔥 brainbuilder.js
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const databasePath = path.resolve(__dirname, "../../database");
const AUTO_FILE = path.resolve(databasePath, "auto-responder.json");
const LB2_FILE = path.resolve(databasePath, "learningbot2.json");
const GENERATED_FILE = path.resolve(databasePath, "generated-memory.json");

let lastHash = null;

/* ===========================
   UTILIDADES
=========================== */
function readJSONSafe(file, def = []) {
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

function generateHash(data) {
  return crypto
    .createHash("md5")
    .update(JSON.stringify(data))
    .digest("hex");
}

/* ===========================
   DETECCIÓN DE TOPICS
=========================== */
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
    if (keywords.some(k => text.includes(k))) {
      return topic;
    }
  }

  return "general";
}

/* ===========================
   ELIMINAR DUPLICADOS EN ARRAYS
=========================== */
function uniqueArray(arr) {
  return [...new Set(arr)];
}

/* ===========================
   CONSTRUCTOR DEL CEREBRO
=========================== */
function buildBrain() {
  const autoData = readJSONSafe(AUTO_FILE, []);
  const lb2Data = readJSONSafe(LB2_FILE, []);

  // Combinar ambos datos para calcular hash
  const combinedData = { autoData, lb2Data };
  const currentHash = generateHash(combinedData);

  // 🚫 Evita reconstrucción innecesaria
  if (currentHash === lastHash) return;
  lastHash = currentHash;

  const brain = {
    metadata: {
      createdAt: Date.now(),
      source: "auto-responder + learningbot2",
      totalEntriesScanned: autoData.length + lb2Data.length
    },
    topics: {},
    global: {
      wordFrequency: {},
      totalSentences: 0
    }
  };

  /* ===== Función para procesar mensajes ===== */
  function processEntry(sentence) {
    const normalizedSentence = normalize(sentence);
    if (!normalizedSentence) return;

    const topic = detectTopic(normalizedSentence);
    if (!brain.topics[topic]) {
      brain.topics[topic] = {
        keywords: [],
        sentences: [],
        wordFrequency: {},
        bigrams: {},
        totalSentences: 0
      };
    }

    const words = normalizedSentence.split(/\s+/);
    const topicData = brain.topics[topic];

    // Evitar duplicados exactos de sentences
    if (!topicData.sentences.includes(normalizedSentence)) {
      topicData.sentences.push(normalizedSentence);
      topicData.totalSentences++;
      brain.global.totalSentences++;
    }

    // Actualizar keywords sin duplicados
    topicData.keywords.push(...words);
    topicData.keywords = uniqueArray(topicData.keywords);

    // Actualizar wordFrequency y bigrams
    words.forEach((word, index) => {
      addFrequency(topicData.wordFrequency, word);
      addFrequency(brain.global.wordFrequency, word);

      if (index < words.length - 1) {
        const bigram = words[index] + " " + words[index + 1];
        addFrequency(topicData.bigrams, bigram);
      }
    });
  }

  /* ===== Procesar auto-responder.json (match + answers) ===== */
  autoData.forEach(entry => {
    if (!entry.match) return;

    processEntry(entry.match);

    const answers = entry.answers || (entry.answer ? [entry.answer] : []);
    answers.forEach(ans => processEntry(ans));
  });

  /* ===== Procesar learningbot2.json exactamente como antes ===== */
  lb2Data.forEach(msg => processEntry(msg));

  /* ===== Combinar con generate-memory.json existente ===== */
  const existingBrain = readJSONSafe(GENERATED_FILE, null);
  if (existingBrain) {
    Object.entries(existingBrain.topics).forEach(([topic, data]) => {
      if (!brain.topics[topic]) {
        brain.topics[topic] = data;
      } else {
        brain.topics[topic].sentences = uniqueArray([
          ...brain.topics[topic].sentences,
          ...data.sentences
        ]);
        brain.topics[topic].keywords = uniqueArray([
          ...brain.topics[topic].keywords,
          ...data.keywords
        ]);
        for (const [w, count] of Object.entries(data.wordFrequency)) {
          brain.topics[topic].wordFrequency[w] =
            (brain.topics[topic].wordFrequency[w] || 0) + count;
        }
        for (const [b, count] of Object.entries(data.bigrams)) {
          brain.topics[topic].bigrams[b] =
            (brain.topics[topic].bigrams[b] || 0) + count;
        }
        brain.topics[topic].totalSentences =
          brain.topics[topic].sentences.length;
      }
    });
  }

  writeJSONSafe(GENERATED_FILE, brain);
  console.log("🧠 Cerebro generado / actualizado automáticamente (duplicados eliminados).");
}

/* ===========================
   WATCHER AUTOMÁTICO INTERNO
=========================== */
function initWatcher() {
  console.log("👁 BrainBuilder activo observando archivos...");

  // Vigilar auto-responder.json
  if (fs.existsSync(AUTO_FILE)) {
    fs.watch(AUTO_FILE, { persistent: true }, (eventType) => {
      if (eventType === "change") setTimeout(buildBrain, 200);
    });
  } else {
    console.log("⚠ auto-responder.json no existe todavía.");
  }

  // Vigilar learningbot2.json
  if (fs.existsSync(LB2_FILE)) {
    fs.watch(LB2_FILE, { persistent: true }, (eventType) => {
      if (eventType === "change") setTimeout(buildBrain, 200);
    });
  }

  // Primera construcción
  buildBrain();
}

/* ===========================
   AUTO-INICIO
=========================== */
initWatcher();

/* ===========================
   EXPORT OPCIONAL
=========================== */
module.exports = { buildBrain };
