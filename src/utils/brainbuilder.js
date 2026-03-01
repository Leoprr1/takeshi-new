const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const databasePath = path.resolve(__dirname, "../../database");
const AUTO_FILE = path.resolve(databasePath, "auto-responder.json");
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
   CONSTRUCTOR DEL CEREBRO
=========================== */

function buildBrain() {

  const autoData = readJSONSafe(AUTO_FILE, []);

  const currentHash = generateHash(autoData);

  // 🚫 Evita reconstrucción innecesaria
  if (currentHash === lastHash) return;

  lastHash = currentHash;

  const brain = {
    metadata: {
      createdAt: Date.now(),
      source: "auto-responder.json",
      totalEntriesScanned: autoData.length
    },
    topics: {},
    global: {
      wordFrequency: {},
      totalSentences: 0
    }
  };

  autoData.forEach(entry => {
    if (!entry.match) return;

    const topic = detectTopic(normalize(entry.match));

    if (!brain.topics[topic]) {
      brain.topics[topic] = {
        keywords: [],
        sentences: [],
        wordFrequency: {},
        bigrams: {},
        totalSentences: 0
      };
    }

    const matchWords = normalize(entry.match).split(/\s+/);
    brain.topics[topic].keywords.push(...matchWords);

    const answers = entry.answers || (entry.answer ? [entry.answer] : []);
    if (!answers.length) return;

    answers.forEach(raw => {

      const sentence = normalize(raw);
      if (!sentence) return;

      const words = sentence.split(/\s+/);

      brain.topics[topic].sentences.push(sentence);
      brain.topics[topic].totalSentences++;
      brain.global.totalSentences++;

      words.forEach((word, index) => {

        addFrequency(brain.topics[topic].wordFrequency, word);
        addFrequency(brain.global.wordFrequency, word);

        if (index < words.length - 1) {
          const bigram = word + " " + words[index + 1];
          addFrequency(brain.topics[topic].bigrams, bigram);
        }
      });

    });

  });

  writeJSONSafe(GENERATED_FILE, brain);

  console.log("🧠 Cerebro generado / actualizado automáticamente.");
}

/* ===========================
   WATCHER AUTOMÁTICO INTERNO
=========================== */

function initWatcher() {

  if (!fs.existsSync(AUTO_FILE)) {
    console.log("⚠ auto-responder.json no existe todavía.");
    return;
  }

  console.log("👁 BrainBuilder activo observando auto-responder.json...");

  fs.watch(AUTO_FILE, { persistent: true }, (eventType) => {
    if (eventType === "change") {
      setTimeout(() => {
        buildBrain();
      }, 200);
    }
  });

  // Primera construcción al iniciar
  buildBrain();
}

/* ===========================
   AUTO-INICIO
=========================== */

initWatcher();

/* ===========================
   EXPORT OPCIONAL (por si querés usarlo manual)
=========================== */

module.exports = { buildBrain };
