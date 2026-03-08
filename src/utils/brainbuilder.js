const fs = require("fs").promises; // usar la versión de promesas
const path = require("path");
const crypto = require("crypto");

const databasePath = path.resolve(__dirname, "../../database");
const AUTO_FILE = path.resolve(databasePath, "auto-responder.json");
const LB2_FILE = path.resolve(databasePath, "learningbot2.json");
const GENERATED_FILE = path.resolve(databasePath, "generated-memory.json");

let lastHash = null;

// ✅ Lectura segura de JSON (síncrona sigue estando bien)
function readJSONSafe(file, def = []) {
  try {
    if (!fs.existsSync(file)) return def;
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    console.error("❌ Error leyendo JSON:", err);
    return def;
  }
}

// 🔹 Escritura asíncrona con timeout
function writeJSONSafeAsync(file, data) {
  setTimeout(async () => {
    try {
      await fs.writeFile(file, JSON.stringify(data, null, 2), "utf8");
    } catch (err) {
      console.error("❌ Error escribiendo JSON:", err);
    }
  }, 50);
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

async function buildBrain() {
  const { getDB } = require("./jsoncache"); 

  const autoDataRaw = getDB("auto-responder");
  const lb2DataRaw = getDB("learningbot2");

  const autoData = Array.isArray(autoDataRaw) ? autoDataRaw : [];
  const lb2Data = Array.isArray(lb2DataRaw) ? lb2DataRaw.map(String) : [];

  const combinedData = { autoData, lb2Data };
  const currentHash = generateHash(combinedData);
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

  function processEntry(sentence) {
    const normalizedSentence = normalize(sentence);
    if (!normalizedSentence) return;

    const topic = detectTopic(normalizedSentence);
    if (!brain.topics[topic]) {
      brain.topics[topic] = { keywords: [], sentences: [], wordFrequency: {}, bigrams: {}, totalSentences: 0 };
    }

    const topicData = brain.topics[topic];
    const words = normalizedSentence.split(/\s+/);

    if (!topicData.sentences.includes(normalizedSentence)) {
      topicData.sentences.push(normalizedSentence);
      topicData.totalSentences++;
      brain.global.totalSentences++;
    }

    topicData.keywords.push(...words);
    topicData.keywords = uniqueArray(topicData.keywords);

    words.forEach((word, index) => {
      addFrequency(topicData.wordFrequency, word);
      addFrequency(brain.global.wordFrequency, word);

      if (index < words.length - 1) {
        const bigram = words[index] + " " + words[index + 1];
        addFrequency(topicData.bigrams, bigram);
      }
    });
  }

  // 🔹 Función para procesar arrays en chunks sin bloquear
  function processArrayInChunks(arr, processFn, chunkSize = 20, delay = 1, callback) {
    let index = 0;
    function nextChunk() {
      const end = Math.min(index + chunkSize, arr.length);
      for (; index < end; index++) {
        processFn(arr[index]);
      }
      if (index < arr.length) {
        setTimeout(nextChunk, delay);
      } else if (callback) callback();
    }
    nextChunk();
  }

  // 🔹 Procesar autoData suavemente
  processArrayInChunks(autoData, entry => {
    if (!entry.match) return;
    processEntry(entry.match);
    const answers = entry.answers || (entry.answer ? [entry.answer] : []);
    answers.forEach(ans => processEntry(ans));
  });

  // 🔹 Procesar lb2Data suavemente
  processArrayInChunks(lb2Data, msg => processEntry(msg));

  // 🔹 Combinar con generated-memory existente y escribir con timeout
  setTimeout(() => {
    const fsSync = require("fs");
    let existingBrain = null;
    if (fsSync.existsSync(GENERATED_FILE)) {
      try {
        existingBrain = JSON.parse(fsSync.readFileSync(GENERATED_FILE, "utf8"));
      } catch (err) {
        console.warn("⚠️ generated-memory.json vacío o corrupto, se creará uno nuevo");
      }
    }

    if (existingBrain) {
      Object.entries(existingBrain.topics).forEach(([topic, data]) => {
        if (!brain.topics[topic]) brain.topics[topic] = data;
        else {
          brain.topics[topic].sentences = uniqueArray([...brain.topics[topic].sentences, ...data.sentences]);
          brain.topics[topic].keywords = uniqueArray([...brain.topics[topic].keywords, ...data.keywords]);
          for (const [w, count] of Object.entries(data.wordFrequency)) {
            brain.topics[topic].wordFrequency[w] = (brain.topics[topic].wordFrequency[w] || 0) + count;
          }
          for (const [b, count] of Object.entries(data.bigrams)) {
            brain.topics[topic].bigrams[b] = (brain.topics[topic].bigrams[b] || 0) + count;
          }
          brain.topics[topic].totalSentences = brain.topics[topic].sentences.length;
        }
      });
    }

    writeJSONSafeAsync(GENERATED_FILE, brain);
    console.log("🧠 Cerebro generado / actualizado sin bloquear el bot.");
  }, 50);
}

// 🔹 Watcher simple, arranca 5 segundos después
function initWatcher() {
  setTimeout(() => {
    buildBrain();
    setInterval(() => buildBrain(), 60 * 1000); // cada 30 minutos
  }, 5000);
}

initWatcher();

module.exports = { buildBrain };
