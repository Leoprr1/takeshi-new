const fs = require("fs")
const path = require("path")

global.JSON_DB = {}
const SAVE_QUEUE = {}

// ======================
// CARGAR CARPETA JSON
// ======================

function loadJSONFolder(folderPath) {

  if (!fs.existsSync(folderPath)) return

  const files = fs.readdirSync(folderPath)
  const loaded = []

  for (const file of files) {

    if (!file.endsWith(".json")) continue

    const filePath = path.join(folderPath, file)
    const key = file.replace(".json", "")

    try {

      const data = JSON.parse(fs.readFileSync(filePath, "utf8"))

      global.JSON_DB[key] = {
        data,
        path: filePath,
        dirty: false
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

  SAVE_QUEUE[key] = setTimeout(() => {

    saveJSON(key)
    delete SAVE_QUEUE[key]

  }, delay)

}

// ======================
// GUARDAR UN JSON
// ======================

function saveJSON(key) {

  const db = global.JSON_DB[key]
  if (!db || !db.dirty) return

  const backupPath = db.path + ".bak"

  try {

    const json = JSON.stringify(db.data, null, 2)

    fs.writeFileSync(backupPath, json)
    fs.writeFileSync(db.path, json)

    db.dirty = false

  } catch (err) {

    console.log("❌ Error guardando JSON", key)
    console.log(err)

  }

}

// ======================
// GUARDAR TODOS
// ======================

function saveAllJSON() {

  let saved = 0

  for (const key in global.JSON_DB) {

    const db = global.JSON_DB[key]

    if (db.dirty) {
      saveJSON(key)
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

function watchJSON(key) {

  const db = global.JSON_DB[key]

  fs.watchFile(db.path, () => {

    try {

      const newData = JSON.parse(fs.readFileSync(db.path, "utf8"))

      db.data = newData
      db.dirty = false

      console.log(`🔄 JSON recargado → ${key}`)

    } catch {}

  })

}

// ======================
// AUTOSAVE GLOBAL
// ======================

function startAutoSave(interval = 60000) {

  setInterval(() => {

    saveAllJSON()

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
