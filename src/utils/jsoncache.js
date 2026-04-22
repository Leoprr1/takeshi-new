const fs = require("fs")
const path = require("path")
const { Worker } = require("worker_threads")

global.JSON_DB = {}
const SAVE_QUEUE = {}

// ======================
// WORKER
// ======================

const worker = new Worker(path.join(__dirname, "worker.js"))

let taskId = 0
const pending = new Map()

worker.on("message", (msg) => {
  const { id, success, data, error } = msg
  const resolve = pending.get(id)
  if (!resolve) return

  pending.delete(id)
  resolve({ success, data, error })
})

function runWorker(task) {
  return new Promise((resolve) => {
    const id = taskId++
    pending.set(id, resolve)
    worker.postMessage({ ...task, id })
  })
}

// ======================
// CARGAR CARPETA JSON
// ======================

async function loadJSONFolder(folderPath) {

  if (!fs.existsSync(folderPath)) return

  const files = fs.readdirSync(folderPath)
  const loaded = []

  for (const file of files) {

    if (!file.endsWith(".json")) continue

    const filePath = path.join(folderPath, file)
    const key = file.replace(".json", "")

    try {

      const res = await runWorker({
        type: "load",
        path: filePath
      })

      if (!res.success) throw new Error(res.error)

      global.JSON_DB[key] = {
        data: res.data,
        path: filePath,
        dirty: true
      }

      watchJSON(key)
      loaded.push(key)

    } catch (err) {

      console.log(`❌ Error cargando ${filePath}`)
      console.log(err)

    }

  }

  if (loaded.length) {
    console.log(`📦 JSON cacheados (${loaded.length})`)
  }

}

// ======================
// OBTENER DB
// ======================

function getDB(key, def = {}) {

  if (!global.JSON_DB[key]) {
    console.log(`⚠️ DB no encontrada → ${key}`)
    return def
  }

  return global.JSON_DB[key].data

}

// ======================
// MODIFICAR DB
// ======================

function setDB(key, data) {

  const db = global.JSON_DB[key]
  if (!db) return

  db.data = data
  db.dirty = true

  scheduleSave(key)

}

// ======================
// PROGRAMAR GUARDADO
// ======================

function scheduleSave(key, delay = 5000) {

  if (SAVE_QUEUE[key]) return

  SAVE_QUEUE[key] = setTimeout(async () => {

    await saveJSON(key)
    delete SAVE_QUEUE[key]

  }, delay)

}

// ======================
// GUARDAR UN JSON
// ======================

async function saveJSON(key) {

  const db = global.JSON_DB[key]
  if (!db || !db.dirty) return

  try {

    await runWorker({
      type: "save",
      path: db.path,
      data: db.data
    })

    db.dirty = false

  } catch (err) {

    console.log("❌ Error guardando JSON", key)
    console.log(err)

  }

}

// ======================
// GUARDAR TODOS
// ======================

async function saveAllJSON() {

  let saved = 0

  for (const key in global.JSON_DB) {

    const db = global.JSON_DB[key]

    if (db.dirty) {
      await saveJSON(key)
      saved++
    }

  }

  if (saved > 0) {
    console.log(`💾 Autosave JSON (${saved})`)
  }

}

// ======================
// HOT RELOAD
// ======================

let saveCount = 0;

function watchJSON(key) {

  const db = global.JSON_DB[key]

  fs.watchFile(db.path, async () => {

    try {

      const res = await runWorker({
        type: "load",
        path: db.path
      })

      if (!res.success) return

      db.data = res.data
      db.dirty = false

      saveCount++

    } catch {}

  })

  setInterval(() => {
    if (saveCount > 0) {
      console.log(`[JSON] cargado [${saveCount}]`)
      saveCount = 0
    }
  }, 10000)

}

// ======================
// AUTOSAVE GLOBAL
// ======================

function startAutoSave(interval = 60000) {

  setInterval(async () => {
    await saveAllJSON()
  }, interval)

}

module.exports = {
  loadJSONFolder,
  getDB,
  setDB,
  saveJSON,
  saveAllJSON,
  startAutoSave
}
