const fs = require("fs");
const { connect } = require("http2");
const path = require("path");
const { PREFIX } = require(`${BASE_DIR}/config`);

const DB_FILE = path.join(BASE_DIR,"database", "rpg.json");

let DB = {};

// -----------------------------
// Carga de DB
// -----------------------------
function loadDB() {
  try {
    if (!fs.existsSync(path.dirname(DB_FILE))) {
      fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify({}, null, 2));
    }
    const raw = fs.readFileSync(DB_FILE, "utf8") || "{}";
    DB = JSON.parse(raw);
    if (typeof DB !== "object" || Array.isArray(DB)) DB = {};
  } catch (e) {
    console.error("[RPG] Error leyendo DB, re-creando:", e);
    DB = {};
    fs.writeFileSync(DB_FILE, JSON.stringify(DB, null, 2));
  }
}
loadDB();

// -----------------------------
// Guardado con cola para evitar pisadas
// -----------------------------
const saveQueue = [];
let saving = false;

async function saveDB(data) {
  saveQueue.push(data || DB);

  if (saving) return;
  saving = true;

  while (saveQueue.length > 0) {
    const dbToSave = saveQueue.shift();
    try {
      await fs.promises.writeFile(DB_FILE, JSON.stringify(dbToSave, null, 2));
      console.log("[RPG] Guardado DB exitoso");
    } catch (err) {
      console.error("[RPG] Error guardando DB:", err);
    }
  }

  saving = false;
}

// -----------------------------
// Guardado automático periódico
// -----------------------------
setInterval(() => {
  saveDB();
}, 10 * 1000); // cada 30 segundos

module.exports = { DB, loadDB, saveDB };


// -----------------------------
// Datos base actualizados
// -----------------------------
const START = {
  nivel: 1,
  xp: 0,
  hp: 100,
  hpMax: 100,
  mana: 100,
  manamax: 100,
  monedas: 100,
  arma: null,      // { code, nombre, dano }
  armadura: null,  // { code, nombre, defensa }
  inventario: [],  // [{ code, nombre, tipo, ... }]
  
  // Academia
  academia: {
    especialidades: {
      fuerza: 0,
      agilidad: 0,
      defensa: 0,
      magia: 0,
      curacion: 0,
      controlEspada: 0,
      manaMax: 0
    },
    entrenosHoy: {} // se llenará al entrenar
  },

  // Mascotas y Gólem
  mascotas: [],         // lista de mascotas
  mascotaEquipada: null,// mascota actualmente equipada
  golem: null,          // golem asignado

  // Casa
  hasHouse: false,
  enCasa: false,
  homeChest: [],        // cofre de casa

  // Buffs por Academia / Equipamiento / Golem / Mascotas
  fuerzaBonus: 0,
  agilidadBonus: 0,
  defensaBonus: 0,
  magiaBonus: 0,
  curacionBonus: 0,
  precisionBonus: 0,

  // Cooldowns
  lastDaily: 0,
  lastWork: 0,
  lastHunt: 0,
  lastMine: 0,
  lastFish: 0,
  lastDungeon: 0,
  lastGuildMission: 0, // cooldown misiones gremio

  // Info RPG
  nick: "",
  gremio: null,
  misionesActivas: [],
  misionesCompletadas: [],
  profecion: null // opcional: herrero, minero, alquimista, cazador...
};

// -----------------------------
// Mascotas
// -----------------------------
const MASCOTAS = [
      { code: "T01", nombre: "Draco", emoji: "🐉", atkBuff: 30, defBuff: 15, hpBuff: 50,precio: 100000 },
      { code: "T02", nombre: "Fénix", emoji: "🔥", atkBuff: 27, defBuff: 25, hpBuff: 40, precio: 120000 },
      { code: "T03", nombre: "Golem de Piedra", emoji: "🪨", atkBuff: 25, defBuff: 40, hpBuff: 80, precio: 150000 },
      { code: "T04", nombre: "Lobo Espiritual", emoji: "🐺", atkBuff: 35, defBuff: 20, hpBuff: 40, precio: 130000  },
      { code: "T05", nombre: "Ser de Luz", emoji: "✨", atkBuff: 40, defBuff: 15, hpBuff: 55, precio: 200000 },
    ];

const ARMAS = [
  { code: "A1", nombre: "Daga Oxidada", dano: 6, precio: 600 },
  { code: "A2", nombre: "Espada de Madera", dano: 10, precio: 1000 },
  { code: "A3", nombre: "Espada de Hierro", dano: 18, precio: 2200 },
  { code: "A4", nombre: "Lanza del Viento", dano: 28, precio: 4500 },
  { code: "A5", nombre: "Sable del Alba", dano: 40, precio: 8000 },
  { code: "A6", nombre: "espada de diamante", dano: 50, precio: 10000 },
  { code: "A7", nombre: "La chancla de mamá", dano: 55, precio: 10000 },
  { code: "A8", nombre: "Pelo de turra", dano: 65, precio: 11000 },
  { code: "A9", nombre: "Zenith", dano: 80, precio: 13000 },
  { code: "A10", nombre: "espada de Trunks", dano: 100, precio: 15000 },
  { code: "A11", nombre: "Frostmore", dano: 110, precio: 16000 },
  { code: "A12", nombre: "espada Dragon Slayer", dano: 120, precio: 17000 },
  // 10 armas comunes
  { code: "C01", nombre: "Espada de Madera", dano: 10, precio: 1000 },
  { code: "C02", nombre: "Hacha de Madera", dano: 12, precio: 1100 },
  { code: "C03", nombre: "Lanza de Madera", dano: 11, precio: 1050 },
  { code: "C04", nombre: "Arco Básico", dano: 9, precio: 900 },
  { code: "C05", nombre: "Ballesta de Madera", dano: 10, precio: 1000 },
  { code: "C06", nombre: "Espada Corta Básica", dano: 8, precio: 800 },
  { code: "C07", nombre: "Daga de Madera", dano: 7, precio: 700 },
  { code: "C08", nombre: "Maza de Madera", dano: 13, precio: 1200 },
  { code: "C09", nombre: "Espadón de Madera", dano: 14, precio: 1300 },
  { code: "C10", nombre: "Hacha de Mano", dano: 11, precio: 1050 },

// 10 armas raras
  { code: "Z01", nombre: "Espada de Hierro", dano: 25, precio: 4000 },
  { code: "Z02", nombre: "Hacha de Acero", dano: 28, precio: 4500 },
  { code: "Z03", nombre: "Lanza de Acero", dano: 26, precio: 4300 },
  { code: "Z04", nombre: "Arco de Precisión", dano: 23, precio: 3800 },
  { code: "Z05", nombre: "Ballesta de Acero", dano: 25, precio: 4000 },
  { code: "Z06", nombre: "Espada Corta de Acero", dano: 22, precio: 3700 },
  { code: "Z07", nombre: "Daga de Acero", dano: 20, precio: 3500 },
  { code: "Z08", nombre: "Maza de Acero", dano: 30, precio: 4800 },
  { code: "Z09", nombre: "Espadón de Acero", dano: 32, precio: 5000 },
  { code: "Z10", nombre: "Hacha de Mano de Acero", dano: 28, precio: 4500 },

// 10 armas legendarias
  { code: "L01", nombre: "Espada del Infinito", dano: 912, precio: 100000 },
  { code: "L02", nombre: "Hacha del Apocalipsis", dano: 850, precio: 100000 },
  { code: "L03", nombre: "Lanza Celestial", dano: 870, precio: 100000 },
  { code: "L04", nombre: "Arco del Fénix", dano: 800, precio: 100000 },
  { code: "L05", nombre: "Ballesta Legendaria", dano: 820, precio: 100000 },
  { code: "L06", nombre: "Espada Corta de los Dioses", dano: 830, precio: 100000 },
  { code: "L07", nombre: "Daga de la Eternidad", dano: 810, precio: 100000 },
  { code: "L08", nombre: "Maza de los Titanes", dano: 900, precio: 100000 },
  { code: "L09", nombre: "Espadón del Olimpo", dano: 950, precio: 100000 },
  { code: "L10", nombre: "Hacha de Mano Divina", dano: 880, precio: 100000 },

    // 5 armas fantasticas
  { code: "F01", nombre: "⚔️ Espada del Alba Eterna 🌅✨", dano: 1500, precio: 500000 },
  { code: "F02", nombre: "☄️ Guadaña del Vacío Infinito 🌌💀", dano: 1500, precio: 500000 },
  { code: "F03", nombre: "🐉 Lanza del Dragón Carmesí 🔥🔥", dano: 1500, precio: 500000 },
  { code: "F04", nombre: "🌪️ Arco de las Tormentas Eternas ⚡🏹", dano: 1500, precio: 500000 },
  { code: "F05", nombre: "🌑 Mandoble del Eclipse Oscuro 🌙⚔️", dano: 1500, precio: 500000 },


  // 5 armas miticas
  { code: "H01", nombre: "⚔️ Espada del Infinito 🌌💀", dano: 2000, precio: 1000000 },
  { code: "H02", nombre: "☄️ Guadaña de Fragmento Solar 🌅✨", dano: 2000, precio: 1000000 },
  { code: "H03", nombre: "🐉 Lanza de Agujero Negro 🔥🔥", dano: 2000, precio: 1000000 },
  { code: "H04", nombre: "🌪️ Arco Absorvedor de Materia ⚡🏹", dano: 2000, precio: 1000000 },
  { code: "H05", nombre: "🌑 Guante de zeno Sama 🌙⚔️", dano: 2000, precio: 1000000 },




];

const ARMADURAS = [
  { code: "R1", nombre: "Chaleco Ligero", defensa: 4, precio: 600 },
  { code: "R2", nombre: "Cota de Cuero", defensa: 8, precio: 1200 },
  { code: "R3", nombre: "Malla de Hierro", defensa: 14, precio: 2600 },
  { code: "R4", nombre: "Placas Reforzadas", defensa: 22, precio: 5200 },
  { code: "R5", nombre: "Aegis Real", defensa: 35, precio: 9000 },
  { code: "R6", nombre: "Armadura de Netherite", defensa: 45, precio: 10000 },
  { code: "R7", nombre: "Capa de la Inmortalidad", defensa: 55, precio: 12000 },
  { code: "R8", nombre: "Armadura Berserker", defensa: 65, precio: 13000 },
  { code: "R9", nombre: "Armadura caballero del zodiaco", defensa: 80, precio: 15000 },
  { code: "R10", nombre: "Traje de Goku", defensa: 100, precio: 18000 },

  // 10 armaduras comunes
  { code: "C11", nombre: "Escudo de Madera", defensa: 8, precio: 1000 },
  { code: "C12", nombre: "Casco Básico", defensa: 5, precio: 600 },
  { code: "C13", nombre: "Armadura de Cuero", defensa: 10, precio: 1200 },
  { code: "C14", nombre: "Guantes Básicos", defensa: 3, precio: 500 },
  { code: "C15", nombre: "Botas de Cuero", defensa: 4, precio: 600 },
  { code: "C16", nombre: "Hombreras de Cuero", defensa: 6, precio: 800 },
  { code: "C17", nombre: "Pantalones de Cuero", defensa: 7, precio: 900 },
  { code: "C18", nombre: "Escudo Pequeño", defensa: 5, precio: 600 },
  { code: "C19", nombre: "Casco de Hierro Ligero", defensa: 8, precio: 1000 },
  { code: "C20", nombre: "Armadura de Tela", defensa: 6, precio: 800 },


// 10 armaduras raras
  { code: "Z11", nombre: "Escudo de Acero", defensa: 25, precio: 4500 },
  { code: "Z12", nombre: "Casco de Acero", defensa: 20, precio: 4000 },
  { code: "Z13", nombre: "Armadura de Hierro", defensa: 30, precio: 5000 },
  { code: "Z14", nombre: "Guantes de Acero", defensa: 15, precio: 3500 },
  { code: "Z15", nombre: "Botas de Hierro", defensa: 18, precio: 3800 },
  { code: "Z16", nombre: "Hombreras de Acero", defensa: 22, precio: 4200 },
  { code: "Z17", nombre: "Pantalones de Acero", defensa: 20, precio: 4000 },
  { code: "Z18", nombre: "Escudo Grande de Hierro", defensa: 28, precio: 4800 },
  { code: "Z19", nombre: "Casco de los Guardianes", defensa: 25, precio: 4500 },
  { code: "Z20", nombre: "Armadura Reforzada", defensa: 35, precio: 5500 },


 // 10 armaduras legendarias
  { code: "L11", nombre: "Escudo de los Dioses", defensa: 500, precio: 100000 },
  { code: "L12", nombre: "Casco de los Titanes", defensa: 480, precio: 100000 },
  { code: "L13", nombre: "Armadura de los Dioses", defensa: 500, precio: 100000 },
  { code: "L14", nombre: "Guantes Legendarios", defensa: 450, precio: 100000 },
  { code: "L15", nombre: "Botas del Olimpo", defensa: 470, precio: 100000 },
  { code: "L16", nombre: "Hombreras Legendarias", defensa: 490, precio: 100000 },
  { code: "L17", nombre: "Pantalones Legendarios", defensa: 480, precio: 100000 },
  { code: "L18", nombre: "Escudo Celestial", defensa: 500, precio: 100000 },
  { code: "L19", nombre: "Casco del Olimpo", defensa: 495, precio: 100000 },
  { code: "L20", nombre: "Armadura Celestial", defensa: 500, precio: 100000 },

  // 5 armaduras fantasticas
  { code: "F06", nombre: "🛡️ Armadura del Guardián Celestial 🌌✨", defensa: 1500, precio: 500000 },
  { code: "F07", nombre: "🔥 Coraza del Fénix Renacido 🕊️♨️", defensa: 1500, precio: 500000 },
  { code: "F08", nombre: "❄️ Placas del Trono Gélido 👑🧊", defensa: 1500, precio: 500000 },
  { code: "F09", nombre: "🌑 Armadura del Eclipse Abismal 🌙⚔️", defensa: 1500, precio: 500000 },
  { code: "F10", nombre: "⚡ Manto del Señor de las Tormentas 🌪️🌩️", defensa: 1500, precio: 500000 },

  // 5 armaduras miticas
  { code: "H06", nombre: "🛡️ Armadura del Infinito 🌌✨", defensa: 2000, precio: 1000000 },
  { code: "H07", nombre: "🔥 Coraza de Fragmento Solar 🕊️♨️", defensa: 2000, precio: 1000000 },
  { code: "H08", nombre: "❄️ Placas de Agujero Negro 👑🧊", defensa: 2000, precio: 1000000 },
  { code: "H09", nombre: "🌑 Armadura Absorvedora de Materia 🌙⚔️", defensa: 2000, precio: 1000000 },
  { code: "H10", nombre: "⚡ Manto de Zeno Sama 🌪️🌩️", defensa: 2000, precio: 1000000 },


];

const POCIONES = [
  { code: "MP1", nombre: "Poción de Mana (100)", tipo: "mana", mana: 100, precio: 1500 },
  { code: "MP2", nombre: "Poción de Mana (200)", tipo: "mana", mana: 200, precio: 2500 },
  { code: "MP3", nombre: "Poción de Mana (300)", tipo: "mana", mana: 300, precio: 3500 },
  { code: "MP4", nombre: "Poción de Mana (400)", tipo: "mana", mana: 400, precio: 4500 },
  { code: "MP5", nombre: "Poción de Mana (500)", tipo: "mana", mana: 500, precio: 5500 },
  { code: "MP6", nombre: "Poción de Mana (600)", tipo: "mana", mana: 600, precio: 6500 },
  { code: "P1", nombre: "Poción de Vida (100)", tipo: "pocion", curacion: 100, precio: 1000},
  { code: "P2", nombre: "Poción de Vida (200)", tipo: "pocion", curacion: 200, precio: 2000 },
  { code: "P3", nombre: "Poción de Vida (300)", tipo: "pocion", curacion: 300, precio: 3000 },
  { code: "P4", nombre: "Poción de Vida (400)", tipo: "pocion", curacion: 400, precio: 4000 },
  { code: "P5", nombre: "Poción de Vida (500)", tipo: "pocion", curacion: 500, precio: 5000 },
  { code: "P6", nombre: "Poción de Vida (600)", tipo: "pocion", curacion: 600, precio: 6000 },
];



// Cooldowns (ms)
const CD = {
  daily: 24 * 60 * 60 * 1000, // 24h
  work: 60 * 60 * 1000, // 1h
  hunt: 2 * 60 * 1000, // 2m
  mine: 2 * 60 * 1000, // 2m
  fish: 2 * 60 * 1000, // 2m
};

// -----------------------------
// Helpers
// -----------------------------
function normalizeId(id) {
  if (!id || typeof id !== "string") return null;
  id = id.trim();
  // si viene con @s.whatsapp.net convertir a @lid
  if (/@s\.whatsapp\.net$/.test(id)) {
    return id.replace(/@s\.whatsapp\.net$/, "@lid");
  }
  // ya en formato @lid
  if (id.includes("@lid")) return id;
  // si llegó solo el número (sin sufijo), agregar @lid
  if (/^\d+$/.test(id)) return `${id}@lid`;
  // caso por si viene con otros sufijos (por seguridad)
  if (/@/.test(id)) {
    // probar convertir dominios conocidos a @lid
    return id.replace(/@.*$/, "@lid");
  }
  return null;
}

function getUser(id) {
  const nid = normalizeId(id);
  if (!nid) return null;

  // Crear usuario si no existe
  if (!DB[nid]) {
    const newUser = JSON.parse(JSON.stringify(START));
    newUser.lid = nid; // Guardar el @lid correctamente
    // inicializaciones seguras
    if (newUser.mana === undefined) newUser.mana = 100;
    if (newUser.manamax === undefined) newUser.manamax = 100;
    if (newUser.lastRegen === undefined) newUser.lastRegen = 0;
    // --- Academia / Especialidades ---
    if (!newUser.academia) {
      newUser.academia = {
        fuerza: 1,
        agilidad: 1,
        magia: 1,
        curacion: 1,
        espada: 1,
        defensa: 1,
        manaBonus: 0,
        especialidades: {} // para futuros hechizos/skills
      };
    }
    DB[nid] = newUser;
    saveDB();
  }

  // Tomamos el usuario existente o recién creado
  const user = DB[nid];

  // Forzar inicialización de maná según nivel (si falta)
  const manaBase = 100;
  const manaPorNivel = 10;
  if (typeof user.mana !== "number") user.mana = manaBase;
  const nivel = typeof user.nivel === "number" ? user.nivel : 1;
  user.manamax = manaBase + (nivel - 1) * manaPorNivel;
  if (user.mana > user.manamax) user.mana = user.manamax;

  // Asegurar hp inicial si falta (por si hay entradas antiguas en DB)
  if (typeof user.hp !== "number") user.hp = user.hpMax || 100;
  if (typeof user.hpMax !== "number") user.hpMax = 100;

// ----------------------------
// Regeneración automática de maná y vida (cada X ms)
// ----------------------------
if (typeof user.lastRegen !== "number" || isNaN(user.lastRegen)) {
  user.lastRegen = Date.now();
}

const regenTime = 5 * 60 * 1000; // 5 minutos
const nowTime = Date.now();
const elapsed = nowTime - user.lastRegen;

if (elapsed >= regenTime) {
  const homeMultiplier = user.enCasa ? 4 : 1; // x4 dentro de casa
  const BASE_HP_PERCENT = 0.05; // 5% por tick (HP)
  const BASE_MANA_PERCENT = 0.10; // 10% por tick (Mana)

  let ticks = Math.floor(elapsed / regenTime);
  const MAX_TICKS = 12;
  if (ticks > MAX_TICKS) ticks = MAX_TICKS;

  // Vida y maná total incluyendo buffs
  const totalHP = (user.hpMax || 0)
                  + (user.curacionBonus|| 0)
                  + (user.golem?.hpBuff || 0)
                  + (user.mascotaEquipada?.hpBuff || 0);

  const totalMana = (user.manamax || 0)
                    + (user.academia?.manaMax || 0);

  if (Number.isNaN(totalHP) || Number.isNaN(totalMana)) {
    user.lastRegen += regenTime * ticks;
    saveDB();
  } else {
    const curHP = Number(user.hp || 0);
    const curMana = Number(user.mana || 0);

    const rawRegenHP = Math.floor(totalHP * BASE_HP_PERCENT * homeMultiplier) * ticks;
    const rawRegenMana = Math.floor(totalMana * BASE_MANA_PERCENT * homeMultiplier) * ticks;

    const addHP = Math.min(rawRegenHP, Math.max(0, totalHP - curHP));
    const addMana = Math.min(rawRegenMana, Math.max(0, totalMana - curMana));

    user.hp = Math.min(totalHP, curHP + addHP);
    user.mana = Math.min(totalMana, curMana + addMana);

    user.lastRegen += regenTime * ticks;
    saveDB();

    if (process.env.DEBUG_REGEN === "1") {
      console.log(
        `[REGEN] enCasa=${!!user.enCasa} ticks=${ticks} +HP=${addHP} (+${rawRegenHP} raw) +Mana=${addMana} (+${rawRegenMana} raw) newLast=${new Date(user.lastRegen).toISOString()}`
      );
    }
  }
}

return user;
}


function now() {
  return Date.now();
}

function fmt(n) {
  return Intl.NumberFormat("es-AR").format(n);
}

function timeLeft(ms) {
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m < 60) return `${m}m ${r}s`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}h ${rm}m`;
}
function xpForNextLevel(nivel) {
  // escalado suave
  return 100 + (nivel - 1) * 80;
}
function addXP(user, amount) {
  user.xp += amount;
  // subir nivel si corresponde
  let needed = xpForNextLevel(user.nivel);
  let subidas = 0;
  while (user.xp >= needed) {
    user.xp -= needed;
    user.nivel++;
    subidas++;
    // subir vida max y curar un poco
    user.hpMax += 20;
    user.hp = Math.min(user.hpMax, user.hp + 30);
    needed = xpForNextLevel(user.nivel);
    // subir mana max y curar un poco
    user.manaMax += 10;
    user.mana = Math.min(user.manaMax, user.mana + 30);
    needed = xpForNextLevel(user.nivel);
  }
  return subidas;
}
// -----------------------------
// FUNCIONES DE INVENTARIO
// -----------------------------

// Buscar item por código o UID
function findItemByCode(code, user) {
  code = String(code || "").toUpperCase();

  if (user) {
    // Primero busca en inventario del usuario
    const item = user.inventario?.find(i => {
      if (i.tipo === "mascota") return i.uid === code || i.code === code; // Mascotas: code o uid
      return i.code === code; // Otros items: solo code
    });
    if (item) return item;
  }

  // Luego busca en listas globales
  return (
    ARMAS.find(x => x.code.toUpperCase() === code) ||
    ARMADURAS.find(x => x.code.toUpperCase() === code) ||
    POCIONES.find(x => x.code.toUpperCase() === code) ||
    MASCOTAS.find(x => x.code.toUpperCase() === code)
  );
}

// Migrar items antiguos (sin UID ni precio) al cargar inventario
function migrateItems(user) {
  if (!user.inventario) user.inventario = [];
  user.inventario.forEach(item => {
    if (!item.uid) item.uid = Date.now().toString(36) + Math.floor(Math.random() * 1000);
    if (item.tipo === "mascota" && !item.precio) {
      item.precio = (item.atkBuff + item.defBuff + item.hpBuff) * 1000;
    }
  });
}

// Agregar item al inventario
function pushInv(user, item, sendReply) {
  if (!item || !item.code) {
    if (sendReply) sendReply("❌ Error: objeto inválido, no se puede agregar al inventario.");
    return false;
  }

  migrateItems(user);

  // Limpiar inventario
  user.inventario = user.inventario.filter(i => i && i.code);

  if (user.inventario.length >= 10) {
    if (sendReply) sendReply("👜 Tu inventario está lleno (10/10). Debes usar o vender algún ítem antes de agregar más.");
    return false;
  }

  // Asignar UID y precio para mascotas si no existen
  if (!item.uid) item.uid = Date.now().toString(36) + Math.floor(Math.random() * 1000);
  if (item.tipo === "mascota" && !item.precio) {
    item.precio = (item.atkBuff + item.defBuff + item.hpBuff) * 1000;
  }

  // Agregar item al inventario
  user.inventario.push({ ...item });
  return true;
}

// Sacar item del inventario (⚠️ NO lo elimina)
function takeFromInv(user, identifier) {
  identifier = String(identifier || "").toUpperCase();

  // Buscar item
  const it = user.inventario.find(i => {
    if (i.tipo === "mascota") return i.uid === identifier || i.code === identifier; // Mascotas: code o uid
    return i.code === identifier; // Otros: solo code
  });

  return it || null;
}


function getAttack(user,u = {}) {
  const base = 5 + (user.nivel || 0) * 1.5;
  const arma = user.arma?.dano || 0;
  const aca = u.academia?.especialidades || {};
  return Math.round(
   
    (u?.fuerza || 0) +
    (aca.fuerza || 0) +
    (aca.controlEspada || 0) +
    (u.golem?.atkBuff || 0) +
    (u.mascotaEquipada?.atkBuff || 0)+
    base + arma );

}

function getDefense(user,u = {}) {
  const base = 2 + (user.nivel || 0) * 1.2;
  const arm = user.armadura?.defensa || 0;
  const aca = user.academia?.especialidades || {};
  return Math.round(
    
    (u?.defensa || 0) +
    (aca.defensa || 0) +
    Math.floor((aca.agilidad || 0) / 2) +
    (u.golem?.defBuff || 0) +
    (u.mascotaEquipada?.defBuff || 0)+
    base + arm );
}


// -----------------------------
// Texto de ayuda
// -----------------------------
function helpText() {
  const p = PREFIX;
  return (
`🎮 *RPG – Comandos*
• ${p}rpg setname
• ${p}rpg stats
• ${p}rpg inventory
• ${p}rpg daily
• ${p}rpg work
• ${p}rpg gremio
• ${p}rpg academia
• ${p}rpg casino
• ${p}rpg dungeon D1/D2/D3
• ${p}rpg mazmorra legendaria L1/L2/L3
• ${p}rpg isla corrupta I1/I2/I3
• ${p}rpg evento-mascota
• ${p}rpg hunt | mine | fish
• ${p}rpg home
• ${p}rpg shop
• ${p}rpg buy <código>
• ${p}rpg equip <código>
• ${p}rpg unequip arma/armadura/mascota
• ${p}rpg use <código> (solo pociones)
• ${p}rpg magia curar
• ${p}rpg magia curar @otrouser
• ${p}rpg duel @usuario
• ${p}rpg asesinar @usuario
• ${p}rpg ranking

  ventas a otros players:
• ${p}rpg list <código> <precio>
• ${p}rpg dar dinero/item <cantidad/codigo> @usuario
• ${p}rpg market
• ${p}rpg buyplayer <código> <vendedor>

💬 Ejemplos:
• ${p}rpg buy A2
• ${p}rpg equip R3
• ${p}rpg use P1`
  );
}

// -----------------------------
// Handler principal
// -----------------------------
module.exports = {
  name: "rpg",
  description: "Sistema RPG con stats, tienda, equipo, pociones, farmeo y duelos.",
  commands: ["rpg", "aventura"],
  usage: `${PREFIX}rpg <subcomando>`,
  /**
   * @param {CommandHandleProps} props
   * Esperado: { args, userJid, sendReply, sendSuccessReact, sendErrorReply, mentions }
   */
  handle: async ({
  args,
  userJid,
  sendReply,
  sendSuccessReact,
  sendErrorReply,
  mentions,
}) => {
  try {
    // Unimos los args y limpiamos espacios extras
    const text = args.join(" ").trim();
    // Dividimos en subcomando y resto de argumentos
    const [sub, ...rest] = text.split(/\s+/);
    const cmd = (sub || "").toLowerCase();

    // Normalizamos el userJid antes de usarlo
    const normalizedUserId = normalizeId(userJid);
    if (!normalizedUserId) {
      return sendErrorReply("❌ Error: no se pudo identificar tu usuario (userJid inválido).");
    }
    const you = getUser(normalizedUserId);
    if (!you) {
      return sendErrorReply("❌ Error: no se pudo cargar tu perfil RPG.");
    }

    // -------- SETNAME --------
    if (cmd === "setname") {
      const nuevoNombre = rest.join(" ").trim();
      if (!nuevoNombre)
        return sendErrorReply(`❌ ¡Error! Uso: *.rpg setname <tu_nombre>*`);
      you.nick = nuevoNombre;
      saveDB();
      await sendSuccessReact();
      return sendReply(`✅ Tu nombre RPG se cambió a *${nuevoNombre}*`);
    }

    // -------- HELP --------
    if (!cmd || cmd === "help" || cmd === "ayuda") {
      return sendReply(helpText());
    }


// -------- STATS SIN BOTONES --------
if (cmd === "stats") {

  // --- Función para obtener rango según nivel ---
  function getRangoAventurero(nivel) {
    if (nivel >= 176) return { rango: "SSS", emoji: "🟣", medalla: "🏆" };
    if (nivel >= 151) return { rango: "SS", emoji: "🔴", medalla: "🎖️" };
    if (nivel >= 131) return { rango: "S", emoji: "🟠", medalla: "🎖️" };
    if (nivel >= 101) return { rango: "A", emoji: "🟡", medalla: "🏅" };
    if (nivel >= 71) return { rango: "B", emoji: "🟢", medalla: "🏅" };
    if (nivel >= 41) return { rango: "C", emoji: "🔵", medalla: "🥈" };
    if (nivel >= 21) return { rango: "D", emoji: "🟣", medalla: "🥉" };
    if (nivel >= 11) return { rango: "E", emoji: "⚪", medalla: "⚪" };
    return { rango: "F", emoji: "⚫", medalla: "⚫" };
  }

  // --- Barra de XP ---
  function getXpBar(xp, nextLevelXp) {
    const totalBlocks = 10;
    const filledBlocks = Math.min(Math.floor((xp / nextLevelXp) * totalBlocks), totalBlocks);
    const emptyBlocks = totalBlocks - filledBlocks;
    return "▓".repeat(filledBlocks) + "░".repeat(emptyBlocks);
  }

  // --- Insignia según misiones completadas ---
  function getInsignia(u) {
    const total = Array.isArray(u.misionesCompletadas) ? u.misionesCompletadas.length :
                  typeof u.misionesCompletadas === "number" ? u.misionesCompletadas : 0;
    let emoji = "🌱";
    if (total >= 1600) emoji = "🐲";
    else if (total >= 800) emoji = "👑";
    else if (total >= 400) emoji = "💎";
    else if (total >= 200) emoji = "💥";
    else if (total >= 100) emoji = "🔥";
    else if (total >= 50) emoji = "🌳";
    else if (total >= 25) emoji = "🌿";
    return total > 0 ? `${emoji} x${total}` : "Ninguna";
  }

  // --- Ranking ---
  const rankingArr = Object.entries(DB).map(([id, u]) => ({
    id,
    nivel: u.nivel || 0,
    xp: u.xp || 0,
    monedas: u.monedas || 0,
  }));
  rankingArr.sort((a, b) => (b.nivel - a.nivel) || (b.xp - a.xp) || (b.monedas - a.monedas));
  const posicion = rankingArr.findIndex(p => p.id === normalizedUserId) + 1;
  const rankingText = posicion === 1 ? "🥇👑 *Top 1 en el ranking*"
                    : posicion === 2 ? "🥈 *Top 2 en el ranking*"
                    : posicion === 3 ? "🥉 *Top 3 en el ranking*"
                    : posicion > 0 ? `🎖 Top ${posicion} en el ranking`
                    : "⭐ Sin posición (no encontrado)";

  const rangoInfo = getRangoAventurero(you.nivel || 0);
  const insigniaText = getInsignia(you);

  // --- Equipados ---
  const armaTxt = you.arma ? `🗡️ ${you.arma.nombre} (+${you.arma.dano || 0} ATQ) | 💰 ${you.arma.precio?.toLocaleString("es-AR") || 0} | Usar: ${PREFIX}rpg equip ${you.arma.code}` : "Ninguna";
  const armTxt = you.armadura ? `🛡️ ${you.armadura.nombre} (+${you.armadura.defensa || 0} DEF) | 💰 ${you.armadura.precio?.toLocaleString("es-AR") || 0} | Usar: ${PREFIX}rpg equip ${you.armadura.code}` : "Ninguna";

  const invTxt = (you.inventario && you.inventario.length)
    ? you.inventario.filter(i => i && i.nombre).map(i => `📦 ${i.code || "Desconocido"}`).join(", ")
    : "Vacío";

// --- Mascota equipada ---
let mascotaTxt = "Ninguna";
if (you.mascotaEquipada) {
  const m = you.mascotaEquipada;
  const precio = m.precio ? ` | 💰 ${m.precio.toLocaleString("es-AR")}` : "";
  const equipCode = m.uid || m.code || "Desconocido";
  mascotaTxt = `${m.emoji || "🐾"} ${m.nombre || "Desconocida"} ` +
               `(+${m.atkBuff || 0} ATK, +${m.defBuff || 0} DEF, +${m.hpBuff || 0} HP)` +
               `${precio} | Usar: ${PREFIX}rpg equip ${equipCode}`;
}



  // --- Otros datos ---
  const casaText = you.hasHouse ? `🏠 Sí` : `❌ No`;
  const enCasaText = you.enCasa ? `✅ Sí (bonus aplicado)` : `❌ No`;
  const cofreText = (you.homeChest && you.homeChest.length > 0)
    ? you.homeChest.map((i, idx) => `${idx + 1}. ${i.code || "Desconocido"}`).join(", ")
    : "Vacío";

  const bonusHP = you.hpMax ? (you.enCasa ? Math.floor(you.hpMax * 0.2) : Math.floor(you.hpMax * 0.05)) : 0;
  const bonusMana = you.manamax ? (you.enCasa ? Math.floor(you.manamax * 0.4) : Math.floor(you.manamax * 0.1)) : 0;

  let golemText = "❌ No";
  if (you.golem) {
    const golemRango = getRangoAventurero(you.golem.nivel || 0);
    golemText = `🛡️ Sí - Nivel ${you.golem.nivel || 0} (${golemRango.rango})`;
  }

  if (!you.academia) you.academia = { especialidades: {} };
  const aca = you.academia.especialidades || {};
  const espIcons = { fuerza: "💪", agilidad: "🏃", defensa: "🛡️", magia: "✨", curacion: "💖", controlEspada: "⚔️", manaMax: "🔮" };
  let acaText = "\n📚 *Especialidades de Academia* 📚\n";
  Object.entries(espIcons).forEach(([key, emoji]) => {
    const nivel = aca[key] || 0;
    const barra = "⭐".repeat(Math.min(nivel, 10)) + "✩".repeat(Math.max(0, 10 - nivel));
    acaText += `${emoji} ${key}: Nivel ${nivel}\n[${barra}]\n`;
  });

  const totalHP = (you.hpMax || 0) + ((aca.curacion || 0) * 5) + (you.golem?.hpBuff || 0) + (you.mascotaEquipada?.hpBuff || 0);
  const totalMana = (you.manamax || 0) + ((aca.manaMax || 0) * 10);
  const totalAtk = getAttack(you);
  const totalDef = getDefense(you);
  const xpBar = getXpBar(you.xp || 0, xpForNextLevel(you.nivel || 0));

  const txt =
    `✨🏹 *Tus Stats* 🏹✨\n\n` +
    `${rankingText}\n` +
    `💠 Rango Aventurero: ${rangoInfo.emoji} *${rangoInfo.rango}* ${rangoInfo.medalla}\n` +
    `🏅 Misiones de Gremio: ${insigniaText}\n` +
    `🔹 Nivel: ${you.nivel || 0}\n` +
    `🔹 XP: ${you.xp || 0}/${xpForNextLevel(you.nivel || 0)} [${xpBar}]\n` +
    `❤️ Vida: ${you.hp || 0}/${totalHP} (+${bonusHP} regen)\n` +
    `💙 Maná: ${you.mana || 0}/${totalMana} (+${bonusMana} regen)\n` +
    `💰 Monedas: ${fmt(you.monedas || 0)}\n` +
    `⚔️ Fuerza total: ${totalAtk}\n` +
    `🛡️ Defensa total: ${totalDef}\n` +
    `⚔️ Arma: ${armaTxt}\n` +
    `🛡️ Armadura: ${armTxt}\n` +
    `🎒 Inventario: ${invTxt}\n` +
    `🐾 Mascotas:\n${mascotaTxt}\n` +
    `🏠 Casa: ${casaText}\n` +
    `🏡 Dentro de casa: ${enCasaText}\n` +
    `🪙 Cofre: ${cofreText}\n` +
    `🛡️ Gólem: ${golemText}\n` +
    acaText;

  return sendReply(txt);
}





// -------- INVENTORY --------
if (cmd === "inventory" || cmd === "inv") {
  // Limpiar inventario de items inválidos
  you.inventario = you.inventario.filter(item => item && item.code);
  you.homeChest = you.homeChest?.filter(item => item && item.code) || [];

  // --- Inventario ---
  let invTxt = `👜 *Inventario* (${you.inventario.length}/10)\n\n`;
  let invTotal = 0;

  if (!you.inventario.length) invTxt += "Vacío\n";
  else {
    you.inventario.forEach(item => {
      let precio = (item.precio || 0).toLocaleString("es-AR");

      if (ARMAS.some(a => a.code === item.code)) {
        invTxt += `🗡️ ${item.code} - ${item.nombre} (ATQ +${item.dano}) | 💰 ${precio} | Usar: ${PREFIX}rpg equip ${item.code}\n`;
      } else if (ARMADURAS.some(a => a.code === item.code)) {
        invTxt += `🛡️ ${item.code} - ${item.nombre} (DEF +${item.defensa}) | 💰 ${precio} | Usar: ${PREFIX}rpg equip ${item.code}\n`;
      } else if (POCIONES.some(p => p.code === item.code)) {
        invTxt += `🧪 ${item.code} - ${item.nombre} (Poción) | 💰 ${precio} | Usar: ${PREFIX}rpg use ${item.code}\n`;
      } else if (item.tipo === "mascota") {
        const isEquipped = you.mascotaEquipada?.uid === item.uid ? " (Equipada)" : "";
        invTxt += `🐾 ${item.code} - ${item.nombre}${isEquipped} | ATQ +${item.atkBuff || 0} | DEF +${item.defBuff || 0} | HP +${item.hpBuff || 0} | 💰 ${precio} | Usar: ${PREFIX}rpg equip ${item.code} / ${PREFIX}rpg equip ${item.uid}\n`;
      } else {
        invTxt += `📦 ${item.code} - ${item.nombre} | 💰 ${precio}\n`;
      }

      invTotal += item.precio || 0;
    });
  }

  invTxt += `\n──────────────\n💎 *Valor total del inventario:* ${invTotal.toLocaleString("es-AR")}\n\n`;

  // --- Cofre ---
  let cofreTxt = `🪙 *Cofre de tu casa* (Total de ítems: ${you.homeChest.length})\n\n`;
  let cofreTotal = 0;

  if (!you.homeChest.length) cofreTxt += "Vacío\n";
  else {
    you.homeChest.forEach(item => {
      let precio = (item.precio || 0).toLocaleString("es-AR");
      const isEquipped = item.tipo === "mascota" && you.mascotaEquipada?.uid === item.uid ? " (Equipada)" : "";

      if (ARMAS.some(a => a.code === item.code)) {
        cofreTxt += `🗡️ ${item.code} - ${item.nombre} (ATQ +${item.dano}) | 💰 ${precio}\n`;
      } else if (ARMADURAS.some(a => a.code === item.code)) {
        cofreTxt += `🛡️ ${item.code} - ${item.nombre} (DEF +${item.defensa}) | 💰 ${precio}\n`;
      } else if (POCIONES.some(p => p.code === item.code)) {
        cofreTxt += `🧪 ${item.code} - ${item.nombre} (Poción) | 💰 ${precio}\n`;
      } else if (item.tipo === "mascota") {
        cofreTxt += `🐾 ${item.code} - ${item.nombre}${isEquipped} | ATQ +${item.atkBuff || 0} | DEF +${item.defBuff || 0} | HP +${item.hpBuff || 0} | 💰 ${precio}\n`;
      } else {
        cofreTxt += `📦 ${item.code} - ${item.nombre} | 💰 ${precio}\n`;
      }

      cofreTotal += item.precio || 0;
    });
  }

  cofreTxt += `\n──────────────\n💎 *Valor total del cofre:* ${cofreTotal.toLocaleString("es-AR")}`;

  return sendReply(invTxt + cofreTxt);
}





    // -------- DAILY --------
    if (cmd === "daily") {
      const cd = you.lastDaily + CD.daily - now();
      if (cd > 0) {
        return sendErrorReply(`⏳ Tu *daily* estará listo en ${timeLeft(cd)}.`);
      }
      const reward = 2000 + Math.floor(Math.random() * 150);
      you.monedas += reward;
      you.lastDaily = now();
      addXP(you, 800);
      saveDB();
      await sendSuccessReact();
      return sendReply(`🎁 Reclamaste tu *daily*: +$${fmt(reward)} y +800 XP`);
    }

    // -------- WORK --------
    if (cmd === "work") {
      const cd = you.lastWork + CD.work - now();
      if (cd > 0) {
        return sendErrorReply(`⏳ Podés *work* de nuevo en ${timeLeft(cd)}.`);
      }
      const pay = 1000 + Math.floor(Math.random() * 70);
      you.monedas += pay;
      you.lastWork = now();
      const up = addXP(you, 500);
      saveDB();
      await sendSuccessReact();
      return sendReply(`🧰 Trabajaste y ganaste $${fmt(pay)}. ${up ? `⬆️ *Subiste ${up} nivel(es)*` : `+500 XP`}`);
    }

       // -----------------------------
// SISTEMA DE MANÁ
// -----------------------------
if (cmd === "magia") {
  // Asegurarse que el jugador tiene maná
  if (you.mana === undefined) you.mana = 100;
  if (you.manamax === undefined) you.manamax = 100;
  if (you.lastManaRegen === undefined) you.lastManaRegen = 0;

  // Asegurar que academia existe
  if (!you.academia) you.academia = { especialidades: {} };
  const aca = you.academia.especialidades || {};

  const hechizo = rest[0]?.toLowerCase();
  if (!hechizo) {
    return sendReply(
      `✨ Comando Magia:\n` +
      `.rpg magia curar (-25% maná máx)\n` +
      `.rpg magia curar @usuario (-25% maná máx, cura a otro)\n` +
      `.rpg use <código> (-recupera maná)`
    );
  }

  if (hechizo === "curar") {
  // ---- Calcular coste de maná total incluyendo buffs de academia ----
  const totalMana = (you.manamax || 0) + ((aca.manaMax || 0));

  const manaCostBase = Math.floor(totalMana * 0.25);
  const manaReduction = Math.floor(manaCostBase * ((aca.magia || 0) * 0.05));
  const cost = Math.max(manaCostBase - manaReduction);

  if (you.mana < cost)
    return sendErrorReply(`⚠️ No tienes suficiente maná (${cost} requerido).`);

  // --- OBTENER USUARIO MENCIONADO COMO EN DUEL ---
  const rawMention = rest[1]?.replace(/\D/g, "");
  let objetivo = you;
  let objetivoNombre = "ti mismo";
  let mentions = [];

  if (rawMention) {
    const targetJidRaw = rawMention + "@s.whatsapp.net";
    const normalizedTargetId = normalizeId(targetJidRaw);
    if (normalizedTargetId && normalizedTargetId !== normalizedUserId) {
      const targetUser = getUser(normalizedTargetId);
      if (targetUser) {
        objetivo = targetUser;
        objetivoNombre = `@${normalizedTargetId.split("@")[0]}`;
        mentions.push(normalizedTargetId);
      } else {
        return sendErrorReply("❌ El usuario mencionado no tiene perfil RPG.");
      }
    } else if (normalizedTargetId === normalizedUserId) {
      objetivo = you;
      objetivoNombre = "ti mismo";
    }
  }

  // ---- Aplicar coste de maná ----
  you.mana -= cost;

  // ---- Calcular curación según vida total + bonus de academia/golem/mascota ----
  const totalHP = (objetivo.hpMax || 0)
                  + ((objetivo.academia?.curacion || 0) * 5)
                  + (objetivo.golem?.hpBuff || 0)
                  + (objetivo.mascotaEquipada?.hpBuff || 0);

  const healMultiplier = 1 + ((aca.curacion || 0) * 0.05);
  const healAmount = Math.floor(totalHP * 0.5 * healMultiplier);

  objetivo.hp = Math.min(totalHP, (objetivo.hp || 0) + healAmount);

  saveDB();
  await sendSuccessReact();

  return sendReply(
    `💖 Usaste curar sobre ${objetivoNombre} (+${healAmount} HP, -${cost} maná)\n` +
    `HP de ${objetivoNombre}: ${objetivo.hp}/${totalHP}\n` +
    `Tu maná: ${you.mana}/${totalMana}`,
    null,
    { mentions }
  );
}
}



    // -------- FARMEO: HUNT/MINE/FISH --------
    if (["hunt", "mine", "fish"].includes(cmd)) {
      const map = { hunt: "lastHunt", mine: "lastMine", fish: "lastFish" };
      const cdKey = map[cmd];
      const cd = you[cdKey] + CD[cmd] - now();
      if (cd > 0) {
        return sendErrorReply(`⏳ Esperá ${timeLeft(cd)} para volver a *${cmd}*.`);
      }

      // resolvemos según actividad
      let gainMoney = 0;
      let gainXP = 0;
      let flavor = "";
      switch (cmd) {
        case "hunt": {
          const atk = getAttack(you);
          const roll = Math.random();
          if (roll < 0.2) {
            flavor = "Fallaste la cacería…";
            gainXP = 15 + Math.floor(Math.random() * (atk + 50));
          } else {
            gainMoney = 150 + Math.floor(Math.random() * (atk + 50));
            gainXP = 50 + Math.floor(Math.random() * (atk + 50));
            flavor = "🐗 Cazaste presas valiosas.";
          }
          break;
        }
        case "mine": {
          const def = getDefense(you);
          const roll = Math.random();
          if (roll < 0.2) {
            flavor = "La veta estaba vacía…";
            gainXP = 15 + Math.floor(Math.random() * (def + 50));
          } else {
            gainMoney = 150 + Math.floor(Math.random() * (def + 50));
            gainXP = 50 + Math.floor(Math.random() * (def + 50));
            flavor = "⛏️ Encontraste minerales.";
          }
          break;
        }
        case "fish": {
          const roll = Math.random();
          if (roll < 0.25) {
            flavor = "Se te escaparon…";
            gainXP = 15 + Math.floor(Math.random() * 55);
          } else {
            gainMoney = 150 + Math.floor(Math.random() * 55);
            gainXP = 50 + Math.floor(Math.random() * 55);
            flavor = "🎣 Pescaste algo decente.";
          }
          break;
        }
      }

      you[cdKey] = now();
      you.monedas += gainMoney;
      const up = addXP(you, gainXP);
      saveDB();
      await sendSuccessReact();
      return sendReply(
        `${flavor}\n` +
        (gainMoney ? `+$${fmt(gainMoney)}\n` : "") +
        `${up ? `⬆️ *Subiste ${up} nivel(es)*` : `+${gainXP} XP`}`
      );
    }

// -------- SHOP --------
if (cmd === "shop") {
  let txt = "🏪 *Tienda RPG*\n\n";

  // Sección Comprar
  txt += "🛒 *Comprar*\n";

  // Armas (excluyendo códigos C, Z y L)
  txt += "*Armas*\n";
  ARMAS.filter(a => !["C","Z","L","H","F"].includes(a.code[0]))
       .forEach(a => txt += `• ${a.code} - ${a.nombre} | ATQ +${a.dano} | $${fmt(a.precio)}\n`);

  // Armaduras (excluyendo códigos C, Z y L)
  txt += "\n*Armaduras*\n";
  ARMADURAS.filter(a => !["C","Z","L","H","F"].includes(a.code[0]))
            .forEach(a => txt += `• ${a.code} - ${a.nombre} | DEF +${a.defensa} | $${fmt(a.precio)}\n`);

  // Pociones
  txt += "\n*Pociones*\n";
  POCIONES.forEach(p => txt += `• ${p.code} - ${p.nombre} | $${fmt(p.precio)}\n`);

  txt += `\nCompra con: *${PREFIX}rpg buy <código>* (ej: ${PREFIX}rpg buy A2)\n\n`;


  return sendReply(txt);
}

// -------- PLAYER MARKET --------

// Poner un ítem propio a la venta
if (cmd === "list") {
  if (!you.inventario) you.inventario = []; // inicializamos inventario si no existe
  if (!rest || rest.length < 2) return sendErrorReply(`Uso: *${PREFIX}rpg list <código> <precio>*`);

  const codeOrUid = rest[0].toUpperCase();
  const precioStr = rest.slice(1).join(""); // une todo lo que quede después del código
  const precio = parseInt(precioStr.replace(/[^0-9]/g, "")); // eliminamos $ u otros caracteres
  if (isNaN(precio) || precio <= 0) return sendErrorReply("Precio inválido.");

  // Buscar item en inventario
  const itemIndex = you.inventario.findIndex(i => {
    // Mascotas: se puede listar por UID o code
    if (i.tipo === "mascota" && i.uid) return i.uid.toUpperCase() === codeOrUid || i.code.toUpperCase() === codeOrUid;
    // Otros items: solo por code
    return i.code.toUpperCase() === codeOrUid;
  });

  if (itemIndex === -1) return sendErrorReply("No tenés ese ítem en tu inventario.");

  const item = you.inventario[itemIndex];

  // Validar precio máximo solo para items base (armas, armaduras, pociones)
  const baseItem =
    ARMAS.find(x => x.code.toUpperCase() === (item.code || "").toUpperCase()) ||
    ARMADURAS.find(x => x.code.toUpperCase() === (item.code || "").toUpperCase()) ||
    POCIONES.find(x => x.code.toUpperCase() === (item.code || "").toUpperCase()) ||
    MASCOTAS.find(x => x.code.toUpperCase() === (item.code || "").toUpperCase());

  // multiplicadores por rareza
  const rarezaMult = {
    comun: 1,
    raro: 1.5,
    legendario: 2,
    fantastico: 5,
    mitico: 7.5
  };

  if (baseItem) {
    const multiplicador = rarezaMult[item.rareza?.toLowerCase()] || 1;
    const precioMax = Math.floor(baseItem.precio * multiplicador);

    if (precio > precioMax) {
      return sendErrorReply(`El precio máximo para ${item.nombre} (${item.rareza || "común"}) es $${fmt(precioMax)}.`);
    }
  }

  // quitar del inventario
  you.inventario.splice(itemIndex, 1);
  if (!global.MARKET) global.MARKET = [];
  global.MARKET.push({ idVendedor: normalizedUserId, item, precio });

  // monedas inmediatas
  you.monedas += precio;

  saveDB();
  await sendSuccessReact();
  return sendReply(`✅ Pusiste a la venta *${item.nombre}* (${item.rareza || "común"}) por $${fmt(precio)} en el mercado y recibiste las monedas.`);
}

// Ver el mercado
if (cmd === "market") {
  if (!global.MARKET || global.MARKET.length === 0) return sendReply("🛒 No hay items a la venta actualmente.");
  let txt = "🛒 *Mercado de jugadores*\n\n";
  global.MARKET.forEach((m, idx) => {
    const vendedor = m.idVendedor === normalizedUserId ? "Tú" : (m.idVendedor?.split("@")[0] || "Desconocido");

    // Determinar stats y emoji del item
    let stats = "";
    let emoji = "✨"; // default para ítems raros o desconocidos
    let codeDisplay = m.item.code;

    if (m.item.dano) {
      stats = `(+${m.item.dano} ATQ)`;
      emoji = "🗡️";
    } else if (m.item.defensa) {
      stats = `(+${m.item.defensa} DEF)`;
      emoji = "🛡️";
    } else if (m.item.tipo === "comida") {
      emoji = "🍎";
    } else if (m.item.tipo === "pocion") {
      emoji = "💊";
    } else if (m.item.tipo === "mascota") {
      stats = `(ATQ +${m.item.atkBuff || 0} | DEF +${m.item.defBuff || 0} | HP +${m.item.hpBuff || 0})`;
      emoji = "🐾";
      codeDisplay = m.item.uid || m.item.code; // mostrar UID si existe
    }

    txt += `${idx + 1}. ${emoji} ${m.item.nombre} ${stats} | $${fmt(m.precio)} | Vendedor: ${vendedor} | Código/UID: ${codeDisplay}\n`;
  });
  txt += `\nCompra con: *${PREFIX}rpg buyplayer <código/UID> <vendedor>* (ej: ${PREFIX}rpg buyplayer A1 223256997032099)`;
  return sendReply(txt);
}

// Comprar de otro jugador
if (cmd === "buyplayer") {
  if (!rest || rest.length < 2) return sendErrorReply(`Uso: *${PREFIX}rpg buyplayer <código/UID> <vendedor>*`);

  const codeOrUid = rest[0].toUpperCase();
  const vendedorId = rest[1].toLowerCase();

  if (!global.MARKET || global.MARKET.length === 0) return sendErrorReply("No hay items a la venta.");

  const saleIndex = global.MARKET.findIndex(m => {
    if (m.item.tipo === "mascota" && m.item.uid) {
      // Mascotas: buscar por UID o code
      return (m.item.uid.toUpperCase() === codeOrUid || m.item.code.toUpperCase() === codeOrUid) &&
             m.idVendedor.split("@")[0].toLowerCase() === vendedorId;
    }
    // Otros items: buscar solo por code
    return m.item.code.toUpperCase() === codeOrUid && m.idVendedor.split("@")[0].toLowerCase() === vendedorId;
  });

  if (saleIndex === -1) return sendErrorReply("Item no encontrado en el mercado con ese vendedor.");

  const sale = global.MARKET[saleIndex];
  if (sale.idVendedor === normalizedUserId) return sendErrorReply("No podés comprarte a vos mismo.");
  if (you.monedas < sale.precio) return sendErrorReply(`No tenés suficientes monedas. Te faltan $${fmt(sale.precio - you.monedas)}.`);

  you.monedas -= sale.precio;
  if (!you.inventario) you.inventario = [];
  pushInv(you, sale.item);

  // Le damos las monedas al vendedor si existe
  let seller = getUserById(sale.idVendedor);
  if (!seller) {
    seller = { id: sale.idVendedor, monedas: 0, inventario: [] };
    if (!DB.users) DB.users = [];
    DB.users.push(seller);
  }
  seller.monedas += sale.precio;

  // Eliminamos del mercado
  global.MARKET.splice(saleIndex, 1);

  saveDB();
  await sendSuccessReact();
  return sendReply(`✅ Compraste *${sale.item.nombre}* por $${fmt(sale.precio)} de ${sale.idVendedor.split("@")[0] || "Desconocido"}.`);
}

// Función auxiliar para encontrar usuario por ID
function getUserById(id) {
  if (!DB.users) return null;
  return DB.users.find(u => u.id === id);
}

  // COMANDO DAR
if (cmd === "dar") {
  if (!you.inventario) you.inventario = [];
  if (rest.length < 3) return sendErrorReply(`Uso: *${PREFIX}rpg dar <dinero|item> <cantidad|código/UID> @usuario*`);

  const tipo = rest[0].toLowerCase(); // "dinero" o "item"
  const esDinero = tipo === "dinero";
  const targetRaw = rest[rest.length - 1]; // siempre el último argumento es el @usuario
  if (!targetRaw) return sendErrorReply("Debes mencionar a un usuario válido.");

  const rawMention = targetRaw.replace(/\D/g, "");
  if (!rawMention) return sendErrorReply("Debes mencionar a un usuario válido.");

  const targetJidRaw = rawMention + "@s.whatsapp.net";
  const targetUser = getUser(targetJidRaw);
  if (!targetUser) return sendErrorReply("❌ El usuario mencionado no tiene perfil RPG.");

  if (esDinero) {
    const cantidad = parseInt(rest[1]);
    if (isNaN(cantidad) || cantidad <= 0) return sendErrorReply("Debes indicar una cantidad válida de monedas.");
    if ((you.monedas || 0) < cantidad) return sendErrorReply("No tenés suficientes monedas.");

    you.monedas -= cantidad;
    targetUser.monedas = (targetUser.monedas || 0) + cantidad;

    saveDB();
    await sendSuccessReact();
    return sendReply(`💰 Le diste ${cantidad} monedas a @${rawMention}`, null, { mentions: [targetJidRaw] });

  } else {
    const codeOrUid = rest[1].toUpperCase(); // código o UID

  
    // Buscar item en inventario según tipo
    const itemIndex = you.inventario.findIndex(i => {
      if (i.tipo === "mascota") {
        // Mascotas: buscar por UID o code
        return (i.uid && i.uid.toUpperCase() === codeOrUid) || i.code.toUpperCase() === codeOrUid;
      } else {
        // Armas, armaduras, pociones: solo por code
        return i.code.toUpperCase() === codeOrUid;
      }
    });

    if (itemIndex === -1) return sendErrorReply("No tenés ese ítem en tu inventario.");

    const item = you.inventario.splice(itemIndex, 1)[0];
    if (!targetUser.inventario) targetUser.inventario = [];
    pushInv(targetUser, item); // función para agregar al inventario del receptor

    saveDB();
    await sendSuccessReact();
    return sendReply(`✅ Le diste *${item.nombre}* a @${rawMention} (${item.tipo === "mascota" ? "UID: " + item.uid : "Código: " + item.code})`, null, { mentions: [targetJidRaw] });
  }
}





   // -------- BUY <code> --------
if (cmd === "buy") {
  const code = rest.join(" ").toUpperCase().trim();
  if (!code) return sendErrorReply(`Uso: *${PREFIX}rpg buy <código>*`);

  // Buscar el item en todas las listas
  const item =
    ARMAS.find((x) => x.code === code) ||
    ARMADURAS.find((x) => x.code === code) ||
    POCIONES.find((x) => x.code === code);

  if (!item) return sendErrorReply("Código inválido.");

  // Bloquear solo los items exclusivos de dungeon
  if (["C", "Z", "L", "H","F"].includes(item.code[0])) {
    return sendErrorReply("❌ No podés comprar este item, es exclusivo de mazmorra.");
  }

  // Verificar que tenga monedas
  if (you.monedas < item.precio) {
    return sendErrorReply(`No tenés monedas suficientes. Te faltan $${fmt(item.precio - you.monedas)}.`);
  }

  // Compra exitosa
  you.monedas -= item.precio;
  pushInv(you, item);
  const up = addXP(you, 10);
  saveDB();
  await sendSuccessReact();
  return sendReply(`✅ Compraste *${item.nombre}* por $${fmt(item.precio)}. ${up ? `⬆️ +Nivel` : `+10 XP`}`);
}


// -------- UNEQUIP <tipo> --------
if (cmd === "unequip" || cmd === "desequipar") {
  const type = rest[0]?.toLowerCase();
  if (!type) return sendErrorReply(`Uso: *${PREFIX}rpg unequip <arma|armadura|mascota>*`);

  // -----------------------------
  // DESQUIPEAR ARMA
  // -----------------------------
  if (type === "arma") {
    if (!you.arma) return sendErrorReply("No tenés ningún arma equipada.");
    pushInv(you, you.arma);
    const removed = you.arma;
    you.arma = null;
    saveDB();
    await sendSuccessReact();
    return sendReply(`🗡️ Quitaste *${removed.nombre}* y volvió a tu inventario.`);
  }

  // -----------------------------
  // DESQUIPEAR ARMADURA
  // -----------------------------
  if (type === "armadura") {
    if (!you.armadura) return sendErrorReply("No tenés ninguna armadura equipada.");
    pushInv(you, you.armadura);
    const removed = you.armadura;
    you.armadura = null;
    saveDB();
    await sendSuccessReact();
    return sendReply(`🛡️ Quitaste *${removed.nombre}* y volvió a tu inventario.`);
  }

  // -----------------------------
  // DESQUIPEAR MASCOTA
  // -----------------------------
  if (type === "mascota") {
    if (!you.mascotaEquipada) return sendErrorReply("No tenés ninguna mascota equipada.");
    
    // Clonamos el objeto completo para mantener stats, rareza y UID
    const removed = { ...you.mascotaEquipada };
    pushInv(you, removed);

    you.mascotaEquipada = null;
    saveDB();
    await sendSuccessReact();
    return sendReply(
      `🐾 Quitaste a *${removed.nombre}* | Buffs: +${removed.atkBuff} ATK, +${removed.defBuff} DEF, +${removed.hpBuff} HP | 💰 ${removed.precio.toLocaleString("es-AR")} y volvió a tu inventario.`
    );
  }

  // -----------------------------
  // TIPO INVÁLIDO
  // -----------------------------
  return sendErrorReply("Solo se puede quitar arma, armadura o mascota.");
}



// EQUIP <code>
if (cmd === "equip" || cmd === "equipar") {
  const code = rest.join(" ").toUpperCase().trim();
  if (!code) return sendErrorReply(`Uso: *${PREFIX}rpg equip <código>*`);

  // Armas
  if (ARMAS.some(a => a.code === code)) {
    const idx = you.inventario.findIndex(i => i.code.toUpperCase() === code);
    if (idx === -1) return sendErrorReply("No tenés esa arma en tu inventario.");
    const it = you.inventario.splice(idx, 1)[0]; // eliminar del inventario
    if (you.arma) pushInv(you, you.arma); // devolver anterior
    you.arma = it;
    saveDB();
    await sendSuccessReact();
    return sendReply(`🗡️ Equipaste *${it.nombre}* (ATQ +${it.dano}).`);
  }

  // Armaduras
  if (ARMADURAS.some(r => r.code === code)) {
    const idx = you.inventario.findIndex(i => i.code.toUpperCase() === code);
    if (idx === -1) return sendErrorReply("No tenés esa armadura en tu inventario.");
    const it = you.inventario.splice(idx, 1)[0]; // eliminar del inventario
    if (you.armadura) pushInv(you, you.armadura); // devolver anterior
    you.armadura = it;
    saveDB();
    await sendSuccessReact();
    return sendReply(`🛡️ Equipaste *${it.nombre}* (DEF +${it.defensa}).`);
  }


  // -----------------------------
  // EQUIPAR MASCOTAS (por code o UID)
  // -----------------------------
  const mascota = you.inventario?.find(m => m.tipo === "mascota" && (m.code === code || m.uid === code));
  if (mascota) {
    // Devolver la mascota equipada anterior
    if (you.mascotaEquipada) pushInv(you, you.mascotaEquipada);
    // Quitar del inventario
    you.inventario = you.inventario.filter(m => m !== mascota);
    you.mascotaEquipada = mascota;

    saveDB();
    await sendSuccessReact();
    return sendReply(
      `🐾 Equipaste a *${mascota.nombre || "Desconocida"}* (${mascota.rareza || "Común"}). Buffs: +${mascota.atkBuff || 0} ATK, +${mascota.defBuff || 0} DEF, +${mascota.hpBuff || 0} HP`
    );
  }

  return sendErrorReply("Solo se puede equipar armas, armaduras o mascotas.");
}




   if (cmd === "use" || cmd === "usar") {
  const code = rest.join(" ").toUpperCase().trim();
  if (!code) return sendErrorReply(`Uso: *${PREFIX}rpg use <código>* (ej: P1 o MP1)`);

  const it = takeFromInv(you, code);
  if (!it) return sendErrorReply("No tenés esa poción en tu inventario.");

  // ---- Calcular vida y maná totales ----
  const totalHP = (you.hpMax || 0)
                  + (you.curacionBonus || 0)
                  + (you.golem?.hpBuff || 0)
                  + (you.mascotaEquipada?.hpBuff || 0);

  const totalMana = (you.manamax || 0)
                    + (you.manaMax || 0);

  // Poción de vida
  if (it.curacion) {
    const beforeHP = you.hp;
    you.hp = Math.min(totalHP, (you.hp || 0) + it.curacion);
    saveDB();
    await sendSuccessReact();
    return sendReply(`🧪 Usaste *${it.nombre}*: ${beforeHP} ➜ ${you.hp} HP.`);
  }

  // Poción de maná
  if (it.mana) {
    const beforeMana = you.mana;
    you.mana = Math.min(totalMana, (you.mana || 0) + it.mana);
    saveDB();
    await sendSuccessReact();
    return sendReply(`🔮 Usaste *${it.nombre}*: ${beforeMana} ➜ ${you.mana} MP.`);
  }

  return sendErrorReply("Ese código no es una poción válida.");
}


// -------- HOME SYSTEM --------
if (cmd === "home") {
  const sub = rest[0]?.toLowerCase();

  if (!you.hasHouse) you.hasHouse = false;
  if (!you.enCasa) you.enCasa = false;
  if (!you.homeChest) you.homeChest = [];
  if (!you.golem) you.golem = null; // inicializamos gólem

  switch (sub) {
    case "comprar":
      if (you.hasHouse) return sendErrorReply("🏠 Ya tenés tu casa.");
      const precioCasa = 50000;
      if (you.monedas < precioCasa)
        return sendErrorReply(`💰 Necesitás $${precioCasa} para comprarla.`);
      you.monedas -= precioCasa;
      you.hasHouse = true;
      saveDB();
      await sendSuccessReact();
      return sendReply(`🎉 Compraste tu casa por $${precioCasa}. Ahora podés entrar y descansar.`);
    
    case "entrar":
      if (!you.hasHouse) return sendErrorReply("❌ No tenés casa. Comprala primero con .rpg home comprar");
      if (you.enCasa) return sendErrorReply("Ya estás dentro de tu casa.");
      you.enCasa = true;
      saveDB();
      await sendSuccessReact();
      return sendReply("🏠 Entraste a tu casa. La regeneración de HP y MP es más rápida.");

    case "salir":
      if (!you.enCasa) return sendErrorReply("❌ No estás dentro de tu casa.");
      you.enCasa = false;
      saveDB();
      await sendSuccessReact();
      return sendReply("🚪 Saliste de tu casa. La regeneración vuelve a la normalidad.");

    case "cofre":
  if (!you.enCasa) return sendErrorReply("❌ Debes estar dentro de tu casa para usar el cofre.");
  if (!you.homeChest || you.homeChest.length === 0) return sendReply("🪙 Tu cofre está vacío.");

  // Mostrar items con nombre, código/UID y tipo
  const itemsText = you.homeChest.map((i, idx) => {
    const identifier = i.uid || i.code || "Desconocido";
    const tipo = i.tipo ? `(${i.tipo})` : "";
    return `${idx + 1}. ${i.nombre || "Desconocido"} ${tipo} | Código/UID: ${identifier}`;
  }).join("\n");

  return sendReply(`🪙 *Cofre de tu casa*\n\n${itemsText}`);

case "mover":
  if (!you.enCasa) return sendErrorReply("❌ Debes estar dentro de tu casa para mover items.");
  const itemId = rest[1]?.toUpperCase();
  const destino = rest[2]?.toLowerCase(); // inventario o cofre
  if (!itemId || !destino) return sendErrorReply("Uso: .rpg home mover <código/UID> <inventario|cofre>");

  if (destino === "cofre") {
    const index = you.inventario.findIndex(i =>
      (i.uid && i.uid.toUpperCase() === itemId) || (i.code && i.code.toUpperCase() === itemId)
    );
    if (index === -1) return sendErrorReply("❌ No tenés ese item en tu inventario.");

    const item = you.inventario.splice(index, 1)[0];
    you.homeChest.push(item);
    saveDB();
    return sendReply(`📦 ${item.nombre || item.code} movido al cofre.`);
  }

  if (destino === "inventario") {
    const index = you.homeChest.findIndex(i =>
      (i.uid && i.uid.toUpperCase() === itemId) || (i.code && i.code.toUpperCase() === itemId)
    );
    if (index === -1) return sendErrorReply("❌ No tenés ese item en el cofre.");

    const item = you.homeChest.splice(index, 1)[0];
    you.inventario.push(item);
    saveDB();
    return sendReply(`📦 ${item.nombre || item.code} movido al inventario.`);
  }

  return sendErrorReply("❌ Destino inválido, usá inventario o cofre.");


    case "golem":
      if (!you.hasHouse) return sendErrorReply("❌ Debes tener casa para tener un gólem.");
      if (!you.golem) {
        const precioGolem = 20000;
        if (you.monedas < precioGolem)
          return sendErrorReply(`💰 Necesitás $${precioGolem} para conseguir un gólem protector.`);
        you.monedas -= precioGolem;
        you.golem = { nivel: 1, atk: 50, hp: 200, lastKO: 0 }; // valores iniciales
        saveDB();
        await sendSuccessReact();
        return sendReply(`🛡️ Compraste un gólem nivel 1. Ataque: 50, Vida: 200.`);
      } else {
        // Subir nivel del gólem
        const precioSubir = 20000 + (you.golem.nivel - 1) * 5000; // aumenta 5000 por cada nivel adicional
        if (you.monedas < precioSubir) return sendErrorReply(`💰 Necesitás $${precioSubir} para subir el nivel del gólem.`);
        you.monedas -= precioSubir;
        you.golem.nivel++;
        you.golem.atk += 20;
        you.golem.hp += 100;
        saveDB();
        await sendSuccessReact();
        return sendReply(`🛡️ Gólem subió a nivel ${you.golem.nivel}. Ataque: ${you.golem.atk}, Vida: ${you.golem.hp}. Precio siguiente mejora: $${20000 + (you.golem.nivel - 1) * 5000}`);
      }

    default:
      return sendReply(
        `🏠 Comando Home:\n` +
        `.rpg home comprar (Comprar casa) $50.000\n` +
        `.rpg home entrar (Entrar a tu casa)\n` +
        `.rpg home salir - (Salir de tu casa)\n` +
        `.rpg home mover <código> <inventario | cofre> (Mover items)\n` +
        `.rpg home golem (Comprar o mejorar tu gólem)precio de compra= $20.000\n` +
        ` si compraste el golem= precio de la mejora= $25.000(aumenta 5k por nivel)`
      );
  }
}

// -----------------------------
// Comando Academia Ultra-Épica (sin botones)
// -----------------------------
// -----------------------------
// Mostrar Academia
// -----------------------------
if (cmd === "academia" && !rest[0]) {
  const user = you;
  if (!user.academia) user.academia = { especialidades: {}, entrenosHoy: {} };
  if (!user.academia.especialidades) user.academia.especialidades = {};
  if (!user.academia.entrenosHoy) user.academia.entrenosHoy = {};

  const especialidades = [
    { key: "fuerza", nombre: "💪 Fuerza", desc: "Aumenta el daño físico", costo: 5000 },
    { key: "agilidad", nombre: "🏃 Agilidad", desc: "Aumenta velocidad y esquive", costo: 4000 },
    { key: "defensa", nombre: "🛡️ Defensa", desc: "Reduce daño recibido", costo: 4500 },
    { key: "magia", nombre: "✨ Magia", desc: "Aumenta daño mágico", costo: 6000 },
    { key: "curacion", nombre: "💖 Curación", desc: "Mejora regeneración de HP", costo: 5000 },
    { key: "controlEspada", nombre: "⚔️ ControlEspada", desc: "Aumenta precisión y crítico", costo: 5500 },
    { key: "manaMax", nombre: "🔮 Mana máximo", desc: "Incrementa maná máximo", costo: 5000 }
  ];

  const MAX_ENTRENOS = 3;
  const COOLDOWN = 60 * 60 * 1000; // 1 hora
  const ahora = Date.now();

  let texto = `🏫 *Academia Ultra-Épica*\n\n`;

  especialidades.forEach(esp => {
    if (!user.academia.especialidades[esp.key]) user.academia.especialidades[esp.key] = 0;
    if (!user.academia.entrenosHoy[esp.key]) user.academia.entrenosHoy[esp.key] = { count: 0, last: 0 };

    const nivel = user.academia.especialidades[esp.key];
    const entrenosData = user.academia.entrenosHoy[esp.key];
    let entrenos = entrenosData.count;

    let cdText = "";
    let bloqueCompleto = false;
    if (entrenos >= MAX_ENTRENOS) {
      const tiempoPasado = ahora - entrenosData.last;
      if (tiempoPasado < COOLDOWN) {
        const restanteMs = COOLDOWN - tiempoPasado;
        const min = Math.floor(restanteMs / 60000);
        const sec = Math.floor((restanteMs % 60000) / 1000);
        cdText = `⏳ Bloque completo: ${min}m ${sec}s restantes`;
        bloqueCompleto = true;
      } else {
        entrenosData.count = 0; // Resetear bloque
        entrenos = 0;
      }
    }

    const barra = "⭐".repeat(Math.min(nivel, 10)) + "✩".repeat(10 - Math.min(nivel, 10));

    texto += `${esp.nombre}: Nivel ${nivel}\n[${barra}]\n${esp.desc}\nEntrenos actuales: ${entrenos}/${MAX_ENTRENOS} ${bloqueCompleto ? "⏳" : ""}\n${cdText}\nCosto: ${esp.costo}💰\n\n`;
  });

  texto += `Para entrenar una especialidad escribí:\n.rpg academia entrenar <especialidad>\nEjemplo: .rpg academia entrenar fuerza`;

  return sendReply(texto);
}

// -----------------------------
// Entrenamiento de Academia
// -----------------------------
if (cmd === "academia" && rest[0] === "entrenar") {
  const user = you;
  if (!user.academia) user.academia = { especialidades: {}, entrenosHoy: {} };

  const inputKey = rest[1];
  const costos = {
    fuerza: 5000,
    agilidad: 4000,
    defensa: 4500,
    magia: 6000,
    curacion: 5000,
    controlEspada: 5500,
    manaMax: 5000
  };

  // Buscar la clave real del objeto, ignorando mayúsculas/minúsculas
  const key = Object.keys(costos).find(k => k.toLowerCase() === (inputKey || "").toLowerCase());
  if (!key) return sendReply("❌ Especialidad inválida. Ej: .rpg academia entrenar fuerza");

  if (!user.academia.especialidades[key]) user.academia.especialidades[key] = 0;
  if (!user.academia.entrenosHoy[key]) user.academia.entrenosHoy[key] = { count: 0, last: 0 };

  const MAX_ENTRENOS = 3;
  const COOLDOWN = 60 * 60 * 1000; // 1 hora
  const ahora = Date.now();
  const entrenosData = user.academia.entrenosHoy[key];

  // Revisar bloque de 3 entrenamientos
  if (entrenosData.count >= MAX_ENTRENOS) {
    const tiempoPasado = ahora - entrenosData.last;
    if (tiempoPasado < COOLDOWN) {
      const restanteMs = COOLDOWN - tiempoPasado;
      const min = Math.floor(restanteMs / 60000);
      const sec = Math.floor((restanteMs % 60000) / 1000);
      return sendReply(`❌ Ya completaste los 3 entrenamientos. Espera ${min}m ${sec}s para el siguiente bloque.`);
    } else {
      entrenosData.count = 0; // Resetear bloque pasado el cooldown
    }
  }

  if ((user.monedas || 0) < costos[key]) return sendReply(`❌ No tienes suficientes monedas. Necesitas ${costos[key]}💰`);

  // Entrenamiento
  user.monedas -= costos[key];
  user.academia.especialidades[key] += 1;
  entrenosData.count += 1;
  entrenosData.last = ahora;

  if (!user.fuerzaBonus) user.fuerzaBonus = 0;
  if (!user.agilidadBonus) user.agilidadBonus = 0;
  if (!user.defensaBonus) user.defensaBonus = 0;
  if (!user.magiaBonus) user.magiaBonus = 0;
  if (!user.curacionBonus) user.curacionBonus = 0;
  if (!user.precisionBonus) user.precisionBonus = 0;
  if (!user.manamax) user.manamax = 100;

  switch(key) {
    case "fuerza": user.fuerzaBonus += 2; break;
    case "agilidad": user.agilidadBonus += 1.5; break;
    case "defensa": user.defensaBonus += 1.8; break;
    case "magia": user.magiaBonus += 2.2; break;
    case "curacion": user.curacionBonus += 2; break;
    case "controlEspada": user.precisionBonus += 1.5; break;
    case "manaMax": user.manamax += 5; break;
  }

  const xpGana = 500 + Math.floor(Math.random() * 15);
  addXP(user, xpGana);
  saveDB();

  let recompensa = "";
  if (user.academia.especialidades[key] % 10 === 0) {
    recompensa = `🎉 ¡Hito alcanzado! Bonus especial aplicado en ${key} 🎉\n`;
  }

  return sendReply(
    `✅ Entrenaste *${key}*\n💰 Coste: ${costos[key]} monedas\n🎖️ Ganaste ${xpGana} XP\nNivel actual: ${user.academia.especialidades[key]}\nEntrenos en bloque: ${entrenosData.count}/${MAX_ENTRENOS}\n${recompensa}`
  );
}




// -----------------------------
// SISTEMA DE GREMIO INTERACTIVO CON COMBATE MANUAL POR COMANDOS
// -----------------------------
if (cmd === "gremio") {
  if (you.gremio === undefined) you.gremio = null;
  if (you.nivel === undefined) you.nivel = 1;
  if (!you.misionesActivas) you.misionesActivas = [];
  if (!you.misionesCooldown) you.misionesCooldown = {};
  if (!you.misionesCompletadas) you.misionesCompletadas = [];
  if (you.hp === undefined) you.hp = 100;
  if (you.mana === undefined) you.mana = 100;
  if (you.manamax === undefined) you.manamax = 100;

  const accion = rest[0]?.toLowerCase();

  const MISIONES = [
    { comando: "flores", rango: "F", nivelMin: 1, descripcion: "Recolectar flores", recompensa: { monedas: 250, xp: 100 } },
    { comando: "lobos", rango: "E", nivelMin: 11, descripcion: "Cazar lobos salvajes", recompensa: { monedas: 600, xp: 200 } },
    { comando: "ruinas", rango: "D", nivelMin: 21, descripcion: "Explorar Ruinas Antiguas", recompensa: { monedas: 1000, xp: 300 } },
    { comando: "ogro", rango: "C", nivelMin: 41, descripcion: "Derrotar al Ogro de la Montaña", recompensa: { monedas: 1500, xp: 1000 }, boss: { nombre: "Ogro de la Montaña", hp: 5000, atk: 200, skills: [
        { name: "Golpe aplastante", dmg: 250, type: "físico" },
        { name: "Rugido", effect: { type: "stun", dur: 1 } }
    ] } },
    { comando: "principe", rango: "B", nivelMin: 71, descripcion: "Rescatar al príncipe secuestrado", recompensa: { monedas: 4000, xp: 3000 } },
    { comando: "mago", rango: "A", nivelMin: 101, descripcion: "Derrotar al Mago Negro", recompensa: { monedas: 10000, xp: 5000 }, boss: { nombre: "Mago Negro", hp: 8000, atk: 350, skills: [
        { name: "Bola de fuego", dmg: 300, type: "fuego", mana: 10 },
        { name: "Curación", heal: 200, mana: 15 }
    ] } },
    { comando: "dragón", rango: "S", nivelMin: 131, descripcion: "Invadir la Fortaleza del Dragón", recompensa: { monedas: 20000, xp: 10000 }, boss: { nombre: "Dragón", hp: 12000, atk: 500, skills: [
        { name: "Llamarada", dmg: 400, type: "fuego" },
        { name: "Aliento de hielo", dmg: 250, type: "hielo", effect: { type: "slow", dur: 2 } }
    ] } },
    { comando: "rey-demonio", rango: "SS", nivelMin: 151, descripcion: "Derrotar al Rey Demonio", recompensa: { monedas: 50000, xp: 20000 }, boss: { nombre: "Rey Demonio", hp: 20000, atk: 700, skills: [
        { name: "Puño demoníaco", dmg: 600, type: "físico" },
        { name: "Maldición", effect: { type: "debuff", stat: "atk", value: -50, dur: 2 } }
    ] } },
    { comando: "salvar-mundo", rango: "SSS", nivelMin: 176, descripcion: "Salvar el mundo de la catástrofe", recompensa: { monedas: 100000, xp: 50000 } }
  ];

  const ahora = Date.now();
  const COOLDOWN_MISION = 30 * 60 * 1000;

  // ------------------ UNIRSE ------------------
  if (accion === "unirse") {
    if (you.gremio) return sendErrorReply(`Ya pertenecés al gremio ${you.gremio}.`);
    you.gremio = "Aventureros";
    saveDB();
    await sendSuccessReact();
    return sendReply(`🎉 Te uniste al gremio *Aventureros*! Ahora podés realizar misiones según tu nivel.`);
  }

  // ------------------ LISTAR ------------------
  if (accion === "misiones") {
    if (!you.gremio) return sendErrorReply("❌ No pertenecés a ningún gremio. Usá: .rpg gremio unirse");
    const disponibles = MISIONES.filter(m => you.nivel >= m.nivelMin);
    if (!disponibles.length) return sendReply("No hay misiones disponibles para tu nivel.");
    const texto = disponibles.map(m => `• ${m.comando} (Rango ${m.rango}) - Nivel mínimo: ${m.nivelMin}\n ${m.descripcion}`).join("\n\n");
    return sendReply(`🗡️ *Misiones disponibles*\n\n${texto}`);
  }

  // ------------------ TOMAR ------------------
  if (accion === "tomar") {
    if (!you.gremio) return sendErrorReply("❌ No pertenecés a ningún gremio.");
    const comandoMision = rest[1]?.toLowerCase();
    if (!comandoMision) return sendErrorReply("❌ Especificá la misión. Ej: .rpg gremio tomar flores");
    const mision = MISIONES.find(m => m.comando === comandoMision);
    if (!mision) return sendErrorReply("❌ Misión inexistente.");
    if (you.nivel < mision.nivelMin) return sendErrorReply(`❌ Nivel insuficiente: ${mision.nivelMin}`);
    if (you.misionesActivas.includes(mision.comando)) return sendErrorReply("❌ Ya estás realizando esta misión.");
    you.misionesActivas.push(mision.comando);
    saveDB();
    await sendSuccessReact();
    return sendReply(`✅ Tomaste la misión *${mision.comando}* - ${mision.descripcion}`);
  }

  // ------------------ COMPLETAR ------------------
  if (accion === "completar") {
    if (!you.gremio) return sendErrorReply("❌ No pertenecés a ningún gremio.");
    const completarComando = rest[1]?.toLowerCase();
    if (!completarComando) return sendErrorReply("❌ Especificá la misión. Ej: .rpg gremio completar flores");
    const misionCompletar = MISIONES.find(m => m.comando === completarComando);
    if (!misionCompletar) return sendErrorReply("❌ Misión inexistente.");
    if (!you.misionesActivas.includes(completarComando)) return sendErrorReply("❌ No estás realizando esa misión.");
    if (you.misionesCooldown[completarComando] && ahora - you.misionesCooldown[completarComando] < COOLDOWN_MISION) {
      const restante = COOLDOWN_MISION - (ahora - you.misionesCooldown[completarComando]);
      const minutos = Math.floor(restante / 60000), segundos = Math.floor((restante % 60000) / 1000);
      return sendErrorReply(`⏳ No podés completar esta misión todavía. Esperá ${minutos}m ${segundos}s.`);
    }

    // --- Misión con boss ---
    if (misionCompletar.boss) {
      const boss = { ...misionCompletar.boss, effects: [] };
      let player = {
        nombre: you.nick || normalizedUserId.split("@")[0],
        hp: you.hp,
        atk: (you.arma?.dano || 0) + (you.fuerza || 0),
        def: (you.armadura?.defensa || 0) + (you.defensa || 0),
        mana: you.mana,
        manamax: you.manamax,
        effects: []
      };
      const log = [];

      function aplicarEfectos(entidad) {
        entidad.effects = entidad.effects.filter(eff => {
          switch (eff.type) {
            case "burn": entidad.hp = Math.max(0, entidad.hp - eff.dmg); log.push(`🔥 ${entidad.nombre} sufre ${eff.dmg} de daño por quemadura.`); break;
            case "slow": eff.dur--; break;
            case "stun": eff.dur--; break;
            case "debuff": eff.dur--; break;
          }
          return eff.dur > 0;
        });
      }

      function calcularDañoJugador(skill) {
        let dmg = 0, heal = 0, manaCost = 0, efecto = null;
        if (skill === "espada") {
          dmg = player.atk;
        } else if (skill === "fuego" && player.mana >= 10) {
          dmg = 20 + Math.floor(Math.random() * 15); manaCost = 10; efecto = { type: "burn", dmg: 5, dur: 2 };
        } else if (skill === "curar" && player.mana >= 15) {
          heal = 50 + Math.floor(Math.random() * 20); manaCost = 15;
        }
        return { dmg, heal, manaCost, efecto };
      }

      // ---- Comando manual: .rpg gremio atacar <acción> ----
      if (accion === "atacar") {
        const accionJugador = rest[1]?.toLowerCase();
        if (!accionJugador) return sendReply("Escribí tu acción: .rpg gremio atacar <espada|fuego|curar>");

        aplicarEfectos(player); aplicarEfectos(boss);

        const { dmg, heal, manaCost, efecto } = calcularDañoJugador(accionJugador);
        if (dmg) boss.hp = Math.max(0, boss.hp - Math.max(0, dmg - Math.floor(player.def * 0.5)));
        if (heal) player.hp = Math.min(player.hp + heal, you.hp); // no puede superar hp original
        if (efecto) boss.effects.push(efecto);
        player.mana = Math.max(0, player.mana - manaCost);
        log.push(`${player.nombre} usa ${accionJugador} y causa ${dmg || heal} a ${boss.nombre || player.nombre}`);

        const bossSkill = boss.skills[Math.floor(Math.random() * boss.skills.length)];
        if (bossSkill.dmg) player.hp = Math.max(0, player.hp - Math.max(0, bossSkill.dmg - Math.floor(player.def * 0.3)));
        if (bossSkill.heal) boss.hp = Math.min(boss.hp + bossSkill.heal, boss.hp);
        if (bossSkill.effect) boss.effects.push({ ...bossSkill.effect });
        log.push(`💀 ${boss.nombre} usa ${bossSkill.name} y causa ${bossSkill.dmg || bossSkill.heal || 0}`);

        await sendReply(log.join("\n"));

        // Guardar resultados y continuar combate
        you.hp = player.hp; you.mana = player.mana;

        if (player.hp <= 0) return sendReply("💀 Fuiste derrotado! Intentá de nuevo la misión más tarde.");
        if (boss.hp <= 0) {
          you.misionesActivas = you.misionesActivas.filter(c => c !== completarComando);
          you.misionesCooldown[completarComando] = ahora;
          you.misionesCompletadas.push(completarComando);
          you.monedas += misionCompletar.recompensa.monedas;
          addXP(you, misionCompletar.recompensa.xp);
          saveDB();
          return sendReply(`🏰 Derrotaste a ${boss.nombre}!\n💰 Monedas: ${misionCompletar.recompensa.monedas}\n✨ XP: ${misionCompletar.recompensa.xp}`);
        }

        return sendReply(`💡 Tu HP: ${player.hp}, Mana: ${player.mana}\nBoss HP: ${boss.hp}\nVolvé a atacar con: .rpg gremio atacar <espada|fuego|curar>`);
      }
    }

    // --- Misión sin boss ---
    you.misionesActivas = you.misionesActivas.filter(c => c !== completarComando);
    you.misionesCooldown[completarComando] = ahora;
    you.misionesCompletadas.push(completarComando);
    you.monedas += misionCompletar.recompensa.monedas;
    addXP(you, misionCompletar.recompensa.xp);
    saveDB();
    return sendReply(`🎉 Completaste la misión *${misionCompletar.comando}* y recibiste:\n💰 Monedas: ${misionCompletar.recompensa.monedas}\n✨ XP: ${misionCompletar.recompensa.xp}`);
  }

  // ------------------ AYUDA ------------------
  return sendReply(
    `✨ Comando Gremio:\n` +
    `.rpg gremio unirse - Unirte al gremio de aventureros\n` +
    `.rpg gremio misiones - Ver misiones disponibles según tu nivel\n` +
    `.rpg gremio tomar <misión> - Tomar una misión disponible\n` +
    `.rpg gremio completar <misión> - Completar una misión que estás realizando\n` +
    `.rpg gremio atacar <espada|fuego|curar> - Atacar al boss si la misión lo tiene`
  );
}




// ----------------- Casino Ultra-Interactivo Sin Botones -----------------
if (!global.CASINO_SESSIONS) global.CASINO_SESSIONS = {}; // sesiones por usuario
if (!global.CASINO_LOG) global.CASINO_LOG = {};           // historial por usuario

if (cmd === "casino") {
  if (!you || (you.monedas ?? 0) <= 0)
    return sendErrorReply("💸 No tenés monedas para jugar.");

  const action = (rest[0] || "").toLowerCase(); // "cara_cruz", "ruleta", "dados", "slots", "historial", "salir"
  const userKey = normalizedUserId;             // No tenemos m.chat, así que lo hacemos por usuario
  const displayName = you.nick || userKey.split("@")[0];

  if (!global.CASINO_LOG[userKey]) global.CASINO_LOG[userKey] = [];

  // Salir del casino
  if (action === "salir") {
    delete global.CASINO_SESSIONS[userKey];
    return sendReply("🚪 Saliste del Casino.");
  }

  // Historial
  if (action === "historial") {
    const logs = global.CASINO_LOG[userKey];
    if (!logs || logs.length === 0) return sendReply("📜 No hay apuestas registradas aún.");
    const last10 = logs.slice(-10).map(l => `${l.user}: ${l.result}`).join("\n");
    return sendReply(`📜 Últimas 10 apuestas (personales):\n${last10}`);
  }

  // Evita doble sesión
  if (global.CASINO_SESSIONS[userKey])
    return sendErrorReply("⏳ Ya estás jugando un juego, terminá ese primero.");

  // Marcar sesión activa (se limpia al final, pase lo que pase)
  global.CASINO_SESSIONS[userKey] = action;

  try {
    switch (action) {
      case "cara_cruz":
        await startCaraCruz(rest, you, sendReply, sendErrorReply, userKey, displayName);
        return;
      case "ruleta":
        await startRuleta(rest, you, sendReply, sendErrorReply, userKey, displayName);
        return;
      case "dados":
        await startDados(rest, you, sendReply, sendErrorReply, userKey, displayName);
        return;
      case "slots":
        await startSlots(rest, you, sendReply, sendErrorReply, userKey, displayName);
        return;
      default:
        return sendReply(`🎰 Bienvenido al Ultra Casino RPG 🏛️
💰 Monedas: ${fmt(you.monedas)}

Usá el comando así:
- *${PREFIX}rpg casino cara_cruz cara|cruz <monto>*
- *${PREFIX}rpg casino ruleta rojo|negro <monto>*
- *${PREFIX}rpg casino dados <número 1-6> <monto>*
- *${PREFIX}rpg casino slots <monto>*
- *${PREFIX}rpg casino historial* (ver historial)
- *${PREFIX}rpg casino salir* (salir del casino)`);
    }
  } finally {
    // Limpiar sesión siempre
    delete global.CASINO_SESSIONS[userKey];
  }

  return; // 👈 cierre final de seguridad
}

// ----------------- Función de registro en historial -----------------
function logCasino(userKey, userName, result) {
  if (!global.CASINO_LOG[userKey]) global.CASINO_LOG[userKey] = [];
  global.CASINO_LOG[userKey].push({ user: userName, result, time: Date.now() });
  if (global.CASINO_LOG[userKey].length > 50) global.CASINO_LOG[userKey].shift();
}

// ----------------- Juegos sin botones con apuesta definida por jugador -----------------
async function startCaraCruz(rest, you, sendReply, sendErrorReply, userKey, displayName) {
  const amount = parseInt(rest[2], 10) || 100;
  if ((you.monedas ?? 0) < amount) return sendErrorReply(`💸 Necesitás al menos ${amount} monedas para jugar.`);

  const choice = (rest[1] || "").toLowerCase(); // "cara" o "cruz"
  if (!["cara","cruz"].includes(choice))
    return sendErrorReply(`Uso: *${PREFIX}rpg casino cara_cruz cara <monto>* o *${PREFIX}rpg casino cara_cruz cruz <monto>*`);

  const result = Math.random() < 0.5 ? "cara" : "cruz";
  const win = choice === result;

  if (win) {
    const ganancia = Math.round(amount*1.5);
    you.monedas += ganancia;
    sendReply(`🎉 Salió *${result}*! Ganaste ${ganancia} monedas 💰 Total: ${fmt(you.monedas)}`);
    logCasino(userKey, displayName, `Ganó Cara o Cruz +${ganancia}`);
  } else {
    you.monedas -= amount;
    sendReply(`💸 Salió *${result}*. Perdiste ${amount} monedas. Total: ${fmt(you.monedas)}`);
    logCasino(userKey, displayName, `Perdió Cara o Cruz -${amount}`);
  }
  saveDB();
}

async function startRuleta(rest, you, sendReply, sendErrorReply, userKey, displayName) {
  const amount = parseInt(rest[2], 10) || 200;
  if ((you.monedas ?? 0) < amount) return sendErrorReply(`💸 Necesitás al menos ${amount} monedas para jugar.`);

  const choice = (rest[1] || "").toLowerCase(); // "rojo" o "negro"
  if (!["rojo","negro"].includes(choice))
    return sendErrorReply(`Uso: *${PREFIX}rpg casino ruleta rojo <monto>* o *${PREFIX}rpg casino ruleta negro <monto>*`);

  const result = Math.random() < 0.5 ? "rojo" : "negro";
  const win = choice === result;

  if (win) {
    const ganancia = Math.round(amount*1.5);
    you.monedas += ganancia;
    sendReply(`🎉 Salió *${result}*! Ganaste ${ganancia} monedas 💰 Total: ${fmt(you.monedas)}`);
    logCasino(userKey, displayName, `Ganó Ruleta +${ganancia}`);
  } else {
    you.monedas -= amount;
    sendReply(`💸 Salió *${result}*. Perdiste ${amount} monedas. Total: ${fmt(you.monedas)}`);
    logCasino(userKey, displayName, `Perdió Ruleta -${amount}`);
  }
  saveDB();
}

async function startDados(rest, you, sendReply, sendErrorReply, userKey, displayName) {
  const amount = parseInt(rest[2], 10) || 150;
  if ((you.monedas ?? 0) < amount) return sendErrorReply(`💸 Necesitás al menos ${amount} monedas para jugar.`);

  const choice = parseInt(rest[1], 10);
  if (!choice || choice < 1 || choice > 6)
    return sendErrorReply(`Uso: *${PREFIX}rpg casino dados <número del 1 al 6> <monto>*`);

  const roll = Math.floor(Math.random()*6)+1;
  const win = roll === choice;

  if (win) {
    const ganancia = Math.round(amount*1.5);
    you.monedas += ganancia;
    sendReply(`🎲 Tiraste *${roll}*! Ganaste ${ganancia} monedas 🎉 Total: ${fmt(you.monedas)}`);
    logCasino(userKey, displayName, `Ganó Dados +${ganancia}`);
  } else {
    you.monedas -= amount;
    sendReply(`🎲 Tiraste *${roll}*. Perdiste ${amount} monedas 💸 Total: ${fmt(you.monedas)}`);
    logCasino(userKey, displayName, `Perdió Dados -${amount}`);
  }
  saveDB();
}

async function startSlots(rest, you, sendReply, sendErrorReply, userKey, displayName) {
  const amount = parseInt(rest[1], 10) || 200; // ahora el jugador puede definir la apuesta
  if ((you.monedas ?? 0) < amount) 
    return sendErrorReply(`💸 Necesitás al menos ${amount} monedas para jugar Tragamonedas.`);

  const symbols = ["🍒","🍋","🍊","🍉","⭐","💎"];
  you.monedas -= amount;

  const roll = [
    symbols[Math.floor(Math.random()*symbols.length)],
    symbols[Math.floor(Math.random()*symbols.length)],
    symbols[Math.floor(Math.random()*symbols.length)]
  ];

  let win = false;
  let payout = 0;

  if (roll[0] === roll[1] && roll[1] === roll[2]) { // triple
    win = true;
    payout = amount * 5;
  } else if (roll[0] === roll[1] || roll[1] === roll[2] || roll[0] === roll[2]) { // doble
    win = true;
    payout = amount * 2;
  }

  if (win) {
    you.monedas += payout;
    sendReply(`🎰 Tragamonedas: ${roll.join(' ')}\n🎉 Ganaste ${payout} monedas! Total: ${fmt(you.monedas)}`);
    logCasino(userKey, displayName, `Ganó Slots +${payout}`);
  } else {
    sendReply(`🎰 Tragamonedas: ${roll.join(' ')}\n💸 Perdiste ${amount} monedas. Total: ${fmt(you.monedas)}`);
    logCasino(userKey, displayName, `Perdió Slots -${amount}`);
  }
  saveDB();
  return;
}


// ----------------- iDrops Ultra Dinámicos Adaptados -----------------
if (!global.IDROPS) global.IDROPS = [];
if (!global.LAST_RPG_GROUP) global.LAST_RPG_GROUP = null;

// Inicializar stats de usuario si faltan
if (you.monedas === undefined) you.monedas = 0;
if (!you.inventario) you.inventario = [];

// Guardar último grupo RPG donde el usuario ejecutó un comando
if (userJid.endsWith("@g.us")) {
  global.LAST_RPG_GROUP = userJid;
}

// Pool de recompensas
const IDROP_POOL = [
  { tipo: "monedas", min: 5000, max: 10000, prob: 0.3 },
  { tipo: "xp", min: 500, max: 1000, prob: 0.3 },
  { tipo: "item_comun", lista: ["MP1","MP2","P1","P2","C01","C02","C03","C04","C05","C06","C07","C08","C09","C10"], prob: 0.2 },
  { tipo: "item_raro", lista: ["MP3","MP4","P3","P4","Z01","Z02","Z03","Z04","Z05"], prob: 0.1 },
  { tipo: "item_legendario", lista: ["MP5","MP6","P5","P6","L01","L02","L03"], prob: 0.09 },
  { tipo: "item_fantastico", lista: ["F01","F02","F03","F04","F05"], prob: 0.01 },
  { tipo: "item_mitico", lista: ["H01","H02","H03","H04","H05"], prob: 0.001 }
];

// Mapa de emojis
const emojiMap = {
  item_comun: "⚪",
  item_raro: "🔵",
  item_legendario: "🟣",
  item_fantastico: "🟠",
  item_mitico: "🔥",
  monedas: "💰",
  xp: "✨"
};

// ----------------- Función: generar drop -----------------
function generarDrop(sendReply) {
  if (global.IDROPS.length >= 5) return; // máximo 5 simultáneos
  const roll = Math.random();
  let acumulado = 0;
  let recompensa = null;

  for (let i of IDROP_POOL) {
    acumulado += i.prob;
    if (roll <= acumulado) {
      recompensa = i;
      break;
    }
  }
  if (!recompensa) return;

  // ID simple tipo U1...U5
  const usedIds = global.IDROPS.map(d => d.simpleId);
  let simpleId;
  for (let i = 1; i <= 5; i++) {
    if (!usedIds.includes("U" + i)) { simpleId = "U" + i; break; }
  }
  if (!simpleId) return;

  let drop = { 
    id: Date.now(), 
    creado: Date.now(), 
    tipo: recompensa.tipo,
    simpleId 
  };

  switch (recompensa.tipo) {
    case "monedas":
    case "xp":
      drop.cantidad = Math.floor(Math.random() * (recompensa.max - recompensa.min + 1)) + recompensa.min;
      break;
    default:
      drop.itemCode = recompensa.lista[Math.floor(Math.random() * recompensa.lista.length)];
      break;
  }

  global.IDROPS.push(drop);

  const rarezaText = drop.tipo.replace("item_", "").toUpperCase();
  const emoji = emojiMap[drop.tipo] || "💥";

  // Mensaje global: solo al último grupo RPG activo
  if (global.LAST_RPG_GROUP) {
    sendReply(global.LAST_RPG_GROUP, `💥 ¡Drop ${rarezaText} ha aparecido! ${emoji}\nUsá *${PREFIX}rpg agarrar ${drop.simpleId}* para reclamarlo antes de que desaparezca.`);
  }

  // Expiración automática
  setTimeout(() => {
    const idx = global.IDROPS.findIndex(d => d.simpleId === drop.simpleId);
    if (idx !== -1) {
      global.IDROPS.splice(idx, 1);
      if (global.LAST_RPG_GROUP)
        sendReply(global.LAST_RPG_GROUP, `⌛ El drop ${drop.simpleId} (${rarezaText}) ha desaparecido...`);
    }
  }, 60 * 1000);
}

// ----------------- Ultra drops automáticos -----------------
let lastDropTime = 0;
function startUltraDrops() {
  async function loop() {
    const nowTime = Date.now();

    if (global.LAST_RPG_GROUP && (nowTime - lastDropTime >= 5 * 60 * 1000)) { // al menos 5 min
      generarDrop((msg) => sendReply(global.LAST_RPG_GROUP, msg));
      lastDropTime = nowTime;
    }

    // Próximo drop entre 5 min y 2h
    const min = 5 * 60 * 1000;
    const max = 2 * 60 * 60 * 1000;
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;

    setTimeout(loop, delay);
  }

  loop();
}

// ⚠️ Llamar solo una vez al iniciar el bot
if (!global.ULTRA_DROPS_STARTED) {
  global.ULTRA_DROPS_STARTED = true;
  startUltraDrops();
}

// ----------------- Comando: agarrar -----------------
if (cmd === "agarrar") {
  const dropId = rest[0];
  if (!dropId) return sendErrorReply(`Uso: *${PREFIX}rpg agarrar <id_drop>* (ej: U1)`);

  const idx = global.IDROPS.findIndex(d => d.simpleId.toUpperCase() === dropId.toUpperCase());
  if (idx === -1) return sendErrorReply("❌ Ese drop no existe o ya fue reclamado.");

  const drop = global.IDROPS[idx];
  global.IDROPS.splice(idx, 1); // eliminar del array global

  // Mensaje que vamos a enviar
  let msg = "";

  switch (drop.tipo) {
    case "monedas":
      you.monedas += drop.cantidad;
      msg = `💰 Agarraste $${fmt(drop.cantidad)} monedas del drop.`;
      break;
    case "xp":
      addXP(you, drop.cantidad);
      msg = `✨ Agarraste +${drop.cantidad} XP del drop.`;
      break;
    default:
      // Buscar item por código
      const item = findItemByCode(drop.itemCode);
      if (!item) return sendErrorReply("❌ Error, item no encontrado.");
      pushInv(you, item);
      const emojiItem = emojiMap[drop.tipo] || "💥";
      msg = `🎉 Agarraste un item del drop: ${emojiItem} *${item.nombre}*`;
      break;
  }

  saveDB();
  await sendSuccessReact();
  return sendReply(msg);
}



//---DUNGEON----
if (cmd === "dungeon") {
  const DUNGEONS = [
    { code: "D1", nombre: "Cueva Abandonada", nivelReq: 1, enemigos: [{ nombre: "Momo benavides", hp: 1100, atk: 30 }], recompensa: { monedas: 5000, xp: 300 } },
    { code: "D2", nombre: "Tumba del Rey Lich", nivelReq: 20, enemigos: [{ nombre: "Esqueleto sombrio", hp: 1300, atk: 70 }], recompensa: { monedas: 10000, xp: 700 } },
    { code: "D3", nombre: "Fortaleza de Fuego", nivelReq: 40, enemigos: [{ nombre: "Dragón destructor de mundos", hp: 1500, atk: 110 }], recompensa: { monedas: 15000, xp: 1000 } }
  ];

  const COOLDOWN = 2 * 60 * 60 * 1000; // 2 horas
  if (!you.lastDungeon) you.lastDungeon = 0;
  const cd = you.lastDungeon + COOLDOWN - now();
  if (cd > 0) return sendErrorReply(`⏳ Podés explorar otra dungeon en ${timeLeft(cd)}.`);

  const codeInput = rest.join(" ").toUpperCase().trim();
  if (!codeInput) return sendErrorReply(`Uso: *${PREFIX}rpg dungeon <código>*\nEj: D1`);
  const dungeon = DUNGEONS.find(d => d.code === codeInput);
  if (!dungeon) return sendErrorReply("Mazmorra inválida.");

  const nivelJugador = you.nivel !== undefined ? you.nivel : 0;
if (nivelJugador < dungeon.nivelReq) {
  return sendErrorReply(`⚠️ Necesitas nivel ${dungeon.nivelReq} para entrar a ${dungeon.nombre}. (Tu nivel actual: ${nivelJugador})`);
}
  if (you.hp <= 0) return sendErrorReply("Estás K.O., no podés entrar a la mazmorra.");
  you.lastDungeon = now();

  // Copia de enemigos
  const enemies = dungeon.enemigos.map(e => ({ ...e }));
  const log = [];
  let player = { nombre: you.nick || normalizedUserId.split("@")[0], hp: you.hp, atk: getAttack(you), def: getDefense(you) };

  for (let ronda = 1; ronda <= 10; ronda++) {
    if (player.hp <= 0 || enemies.every(e => e.hp <= 0)) break;

    // Turno jugador
    const target = enemies.find(e => e.hp > 0);
    const damage = Math.max(0, player.atk - Math.floor(target.atk * 0.3)) + Math.floor(Math.random() * 6);
    target.hp = Math.max(0, target.hp - damage);
    log.push(`Ronda ${ronda}: 🗡️ ${player.nombre} golpea a ${target.nombre} por ${damage} HP. Quedan ${target.hp} HP.`);

    // Turno enemigos
    enemies.forEach(e => {
      if (e.hp > 0) {
        const dmg = Math.max(0, e.atk - Math.floor(player.def * 0.3)) + Math.floor(Math.random() * 4);
        player.hp = Math.max(0, player.hp - dmg);
        log.push(`Ronda ${ronda}: 💀 ${e.nombre} golpea a ${player.nombre} por ${dmg} HP. Te quedan ${player.hp} HP.`);
      }
    });
  }

  // Resultado
  let result;
  let itemsGanados = [];
  let coins = 0;
  let xp = 0;

  if (player.hp > 0 && enemies.every(e => e.hp <= 0)) {
    result = `🏰 Completaste *${dungeon.nombre}* ✅`;

    // Cantidad de drops según mazmorra
    let minDrop = 1, maxDrop = 1;
    switch (dungeon.code) {
      case "D1": minDrop = 1; maxDrop = 2; break;
      case "D2": minDrop = 1; maxDrop = 3; break;
      case "D3": minDrop = 2; maxDrop = 4; break;
    }
    const numItems = Math.floor(Math.random() * (maxDrop - minDrop + 1)) + minDrop;

    // Listas de items por rareza
    const comunes = ["MP1","MP2","P1","P2","C01","C02","C03","C04","C05","C06","C07","C08","C09","C10","C11","C12","C13","C14","C15","C16","C17","C18","C19","C20"];
    const raros = ["MP3","MP4","P3","P4","Z01","Z02","Z03","Z04","Z05","Z06","Z07","Z08","Z09","Z10","Z11","Z12","Z13","Z14","Z15","Z16","Z17","Z18","Z19","Z20"];
    const legendarios = ["MP5","MP6","P5","P6","L01","L02","L03","L04","L05","L06","L07","L08","L09","L10","L11","L12","L13","L14","L15","L16","L17","L18","L19","L20"];

    // Probabilidad por dungeon y rareza
    let dropChance;
    switch(dungeon.code){
      case "D1": dropChance = { comun: 0.7, raro: 0.25, legendario: 0.05 }; break;
      case "D2": dropChance = { comun: 0.55, raro: 0.35, legendario: 0.10 }; break;
      case "D3": dropChance = { comun: 0.4, raro: 0.45, legendario: 0.15 }; break;
    }

    for (let i = 0; i < numItems; i++) {
      const roll = Math.random();
      let selectedList;
      let rarity;

      if (roll < dropChance.legendario) {
        selectedList = [...legendarios];
        rarity = "legendario";
      } else if (roll < dropChance.raro + dropChance.legendario) {
        selectedList = [...raros];
        rarity = "raro";
      } else {
        selectedList = [...comunes];
        rarity = "comun";
      }

      if (!selectedList.length) continue;
      const index = Math.floor(Math.random() * selectedList.length);
      const code = selectedList[index];
      const item = findItemByCode(code);
      if (!item) continue;

      pushInv(you, item);
      const emoji = rarity === "comun" ? "⚪" : rarity === "raro" ? "🔵" : "🟣";
      itemsGanados.push(`${emoji} *${item.nombre}*`);
    }

    // Guardamos las recompensas pero solo se muestran al abrir el cofre
    coins = dungeon.recompensa.monedas;
    xp = dungeon.recompensa.xp;

  } else {
    result = `💀 Fallaste en *${dungeon.nombre}* y recibiste daño.`;
    // Si perdiste no se asignan monedas ni XP
  }

  // Actualizamos HP del jugador
  you.hp = player.hp;

  // Resumen final de la mazmorra (primero)
  await sendReply(
    `⚔️ *Mazmorra*\n` +
    log.join("\n") +
    `\n\n${result}`
  );

  // Si ganaste, abrimos el cofre con todas las recompensas
  if (player.hp > 0 && enemies.every(e => e.hp <= 0)) {
    you.monedas += coins;
    addXP(you, xp);

    await sendReply("📦 Abriste un cofre... ¡Veamos qué hay dentro!");
    await new Promise(r => setTimeout(r, 1500));
    let premioTexto = [];
    if (itemsGanados.length > 0) premioTexto.push(`🎉 Items:\n${itemsGanados.join("\n")}`);
    if (coins) premioTexto.push(`💰 Monedas: +$${fmt(coins)}`);
    if (xp) premioTexto.push(`✨ XP: +${xp}`);
    if (premioTexto.length > 0) {
      await sendReply(premioTexto.join("\n\n"));
    } else {
      await sendReply("😢 El cofre estaba vacío...");
    }
  }

  saveDB();
  await sendSuccessReact();
  return;
}

// --- Isla Corrupta ---
if (cmd === "isla" && rest[0]?.toLowerCase() === "corrupta") {
  const DUNGEONS_LEGEND = [
    { code: "I1", nombre: "Hospital Garrahan", nivelReq: 60, enemigos: [{ nombre: "Axel Kicillof", hp: 9500, atk: 270 }], recompensa: { monedas: 50000, xp: 3000 } },
    { code: "I2", nombre: "Camara de Diputados", nivelReq: 80, enemigos: [{ nombre: "Sergio Massa", hp: 9800, atk: 310 }], recompensa: { monedas: 100000, xp: 7000 } },
    { code: "I3", nombre: "Casa Rosada", nivelReq: 100, enemigos: [{ nombre: "Cristina Fernandez de Kirchner", hp: 10000, atk: 350 }], recompensa: { monedas:150000, xp: 10000 } }
  ];

  const COOLDOWN = 2 * 60 * 60 * 1000; // 2 horas
  if (!you.lastDungeon) you.lastDungeon = 0;
  const cd = you.lastDungeon + COOLDOWN - now();
  if (cd > 0) return sendErrorReply(`⏳ Podés explorar otra Isla Corrupta en ${timeLeft(cd)}.`);

  const codeInput = rest[1]?.toUpperCase().trim();
  if (!codeInput) return sendErrorReply(`Uso: *${PREFIX}rpg isla corrupta <código>*\nEj: I1`);

  const dungeon = DUNGEONS_LEGEND.find(d => d.code === codeInput);
  if (!dungeon) return sendErrorReply("Isla inválida.");

const nivelJugador = you.nivel !== undefined ? you.nivel : 0;
if (nivelJugador < dungeon.nivelReq) {
  return sendErrorReply(`⚠️ Necesitas nivel ${dungeon.nivelReq} para entrar a ${dungeon.nombre}. (Tu nivel actual: ${nivelJugador})`);
}
  if (you.hp <= 0) return sendErrorReply("Estás K.O., no podés entrar a la isla.");
  you.lastDungeon = now();

  // Copia de enemigos
  const enemies = dungeon.enemigos.map(e => ({ ...e }));
  const log = [];
  let player = { nombre: you.nick || normalizedUserId.split("@")[0], hp: you.hp, atk: getAttack(you), def: getDefense(you) };

  for (let ronda = 1; ronda <= 10; ronda++) {
    if (player.hp <= 0 || enemies.every(e => e.hp <= 0)) break;

    // Turno jugador
    const target = enemies.find(e => e.hp > 0);
    const damage = Math.max(0, player.atk - Math.floor(target.atk * 0.3)) + Math.floor(Math.random() * 6);
    target.hp = Math.max(0, target.hp - damage);
    log.push(`Ronda ${ronda}: 🗡️ ${player.nombre} golpea a ${target.nombre} por ${damage} HP. Quedan ${target.hp} HP.`);

    // Turno enemigos
    enemies.forEach(e => {
      if (e.hp > 0) {
        const dmg = Math.max(0, e.atk - Math.floor(player.def * 0.3)) + Math.floor(Math.random() * 4);
        player.hp = Math.max(0, player.hp - dmg);
        log.push(`Ronda ${ronda}: 💀 ${e.nombre} golpea a ${player.nombre} por ${dmg} HP. Te quedan ${player.hp} HP.`);
      }
    });
  }

  // Resultado
  let result;
  let itemsGanados = [];
  let coins = 0;
  let xp = 0;

  if (player.hp > 0 && enemies.every(e => e.hp <= 0)) {
    result = `🏰 Completaste *${dungeon.nombre}* ✅`;

    // Cantidad de drops según mazmorra
    let minDrop = 1, maxDrop = 1; // se puede ajustar por nivel
     switch (dungeon.code) {
      case "I1": minDrop = 1; maxDrop = 2; break;
      case "I2": minDrop = 1; maxDrop = 3; break;
      case "I3": minDrop = 2; maxDrop = 4; break;
    }
    const numItems = Math.floor(Math.random() * (maxDrop - minDrop + 1)) + minDrop;

     // Listas de items por rareza
    const comunes = ["MP1","MP2","P1","P2","C01","C02","C03","C04","C05","C06","C07","C08","C09","C10","C11","C12","C13","C14","C15","C16","C17","C18","C19","C20"];
    const raros = ["MP3","MP4","P3","P4","Z01","Z02","Z03","Z04","Z05","Z06","Z07","Z08","Z09","Z10","Z11","Z12","Z13","Z14","Z15","Z16","Z17","Z18","Z19","Z20"];
    const legendarios = ["MP5","MP6","P5","P6","L01","L02","L03","L04","L05","L06","L07","L08","L09","L10","L11","L12","L13","L14","L15","L16","L17","L18","L19","L20"];
    const fantasticos = ["F01","F02","F03","F04","F05","F06","F07","F08","F09","F10"]; // nuevas armas míticas

    // Probabilidad por dungeon y rareza
    let dropChance = { comun: 0.35, raro: 0.4, legendario: 0.20, fantastico: 0.05 };
    if (dungeon.code === "I2") dropChance = { comun: 0.3, raro: 0.3, legendario: 0.3, fantastico: 0.1 };
    if (dungeon.code === "I3") dropChance = { comun: 0.2, raro: 0.2, legendario: 0.4, fantastico: 0.2 };

    for (let i = 0; i < numItems; i++) {
      const roll = Math.random();
      let selectedList;
      let rarity;

      if (roll < dropChance.fantastico) {
        selectedList = [...fantasticos];
        rarity = "fantasticos";
      } else if (roll < dropChance.legendario + dropChance.fantastico) {
        selectedList = [...legendarios];
        rarity = "legendario";
      } else if (roll < dropChance.raro + dropChance.legendario + dropChance.fantastico) {
        selectedList = [...raros];
        rarity = "raro";
      } else {
        selectedList = [...comunes];
        rarity = "comun";
      }

      if (!selectedList.length) continue;
      const index = Math.floor(Math.random() * selectedList.length);
      const code = selectedList[index];
      const item = findItemByCode(code);
      if (!item) continue;

      pushInv(you, item);
      const emoji = rarity === "comun" ? "⚪" : rarity === "raro" ? "🔵" : rarity === "legendario" ? "🟣" : "🔶";
      itemsGanados.push(`${emoji} *${item.nombre}*`);
    }

    coins = dungeon.recompensa.monedas;
    xp = dungeon.recompensa.xp;
  } else {
    result = `💀 Fallaste en *${dungeon.nombre}* y recibiste daño.`;
  }

  you.hp = player.hp;

  await sendReply(`⚔️ *Isla Corrupta*\n` + log.join("\n") + `\n\n${result}`);

  if (player.hp > 0 && enemies.every(e => e.hp <= 0)) {
    you.monedas += coins;
    addXP(you, xp);

    await sendReply("📦 Abriste un cofre... ¡Veamos qué hay dentro!");
    await new Promise(r => setTimeout(r, 1500));
    let premioTexto = [];
    if (itemsGanados.length > 0) premioTexto.push(`🎉 Items:\n${itemsGanados.join("\n")}`);
    if (coins) premioTexto.push(`💰 Monedas: +$${fmt(coins)}`);
    if (xp) premioTexto.push(`✨ XP: +${xp}`);
    if (premioTexto.length > 0) await sendReply(premioTexto.join("\n\n"));
    else await sendReply("😢 El cofre estaba vacío...");
  }

  saveDB();
  await sendSuccessReact();
  return;
}

// --- DUNGEON LEGENDARIA ---
if (cmd === "mazmorra" && rest[0]?.toLowerCase() === "legendaria") {
  const DUNGEONS_LEGEND = [
    { code: "L1", nombre: "Caverna de la Eternidad", nivelReq: 150, enemigos: [{ nombre: "Señor de las Sombras", hp: 15000, atk: 749 }], recompensa: { monedas: 250000, xp: 13000 } },
    { code: "L2", nombre: "Templo del Dragón Negro", nivelReq: 200, enemigos: [{ nombre: "Dragón Negro", hp: 15500, atk: 847 }], recompensa: { monedas: 500000, xp: 15000 } },
    { code: "L3", nombre: "Fortaleza de la Apocalipsis", nivelReq: 250, enemigos: [{ nombre: "Titán de Fuego", hp: 15900, atk: 945 }], recompensa: { monedas:750000, xp: 20000 } }
  ];

  const COOLDOWN = 2 * 60 * 60 * 1000; // 2 horas
  if (!you.lastDungeon) you.lastDungeon = 0;
  const cd = you.lastDungeon + COOLDOWN - now();
  if (cd > 0) return sendErrorReply(`⏳ Podés explorar otra mazmorra legendaria en ${timeLeft(cd)}.`);

  const codeInput = rest[1]?.toUpperCase().trim();
  if (!codeInput) return sendErrorReply(`Uso: *${PREFIX}rpg mazmorra legendaria <código>*\nEj: L1`);

  const dungeon = DUNGEONS_LEGEND.find(d => d.code === codeInput);
  if (!dungeon) return sendErrorReply("Mazmorra inválida.");

const nivelJugador = you.nivel !== undefined ? you.nivel : 0;
if (nivelJugador < dungeon.nivelReq) {
  return sendErrorReply(`⚠️ Necesitas nivel ${dungeon.nivelReq} para entrar a ${dungeon.nombre}. (Tu nivel actual: ${nivelJugador})`);
}
  if (you.hp <= 0) return sendErrorReply("Estás K.O., no podés entrar a la mazmorra.");
  you.lastDungeon = now();

  // Copia de enemigos
  const enemies = dungeon.enemigos.map(e => ({ ...e }));
  const log = [];
  let player = { nombre: you.nick || normalizedUserId.split("@")[0], hp: you.hp, atk: getAttack(you), def: getDefense(you) };

  for (let ronda = 1; ronda <= 10; ronda++) {
    if (player.hp <= 0 || enemies.every(e => e.hp <= 0)) break;

    // Turno jugador
    const target = enemies.find(e => e.hp > 0);
    const damage = Math.max(0, player.atk - Math.floor(target.atk * 0.3)) + Math.floor(Math.random() * 6);
    target.hp = Math.max(0, target.hp - damage);
    log.push(`Ronda ${ronda}: 🗡️ ${player.nombre} golpea a ${target.nombre} por ${damage} HP. Quedan ${target.hp} HP.`);

    // Turno enemigos
    enemies.forEach(e => {
      if (e.hp > 0) {
        const dmg = Math.max(0, e.atk - Math.floor(player.def * 0.3)) + Math.floor(Math.random() * 4);
        player.hp = Math.max(0, player.hp - dmg);
        log.push(`Ronda ${ronda}: 💀 ${e.nombre} golpea a ${player.nombre} por ${dmg} HP. Te quedan ${player.hp} HP.`);
      }
    });
  }

  // Resultado
  let result;
  let itemsGanados = [];
  let coins = 0;
  let xp = 0;

  if (player.hp > 0 && enemies.every(e => e.hp <= 0)) {
    result = `🏰 Completaste *${dungeon.nombre}* ✅`;

    // Cantidad de drops según mazmorra
    let minDrop = 1, maxDrop = 1; // se puede ajustar por nivel
     switch (dungeon.code) {
      case "L1": minDrop = 1; maxDrop = 2; break;
      case "L2": minDrop = 1; maxDrop = 3; break;
      case "L3": minDrop = 2; maxDrop = 4; break;
    }
    const numItems = Math.floor(Math.random() * (maxDrop - minDrop + 1)) + minDrop;

     // Listas de items por rareza
    const comunes = ["MP1","MP2","P1","P2","C01","C02","C03","C04","C05","C06","C07","C08","C09","C10","C11","C12","C13","C14","C15","C16","C17","C18","C19","C20"];
    const raros = ["MP3","MP4","P3","P4","Z01","Z02","Z03","Z04","Z05","Z06","Z07","Z08","Z09","Z10","Z11","Z12","Z13","Z14","Z15","Z16","Z17","Z18","Z19","Z20"];
    const legendarios = ["MP5","MP6","P5","P6","L01","L02","L03","L04","L05","L06","L07","L08","L09","L10","L11","L12","L13","L14","L15","L16","L17","L18","L19","L20"];
    const fantasticos = ["F01","F02","F03","F04","F05","F06","F07","F08","F09","F10"]; // nuevas armas míticas
    const miticos = ["H01","H02","H03","H04","H05","H06","H07","H08","H09","H10"]; // nuevas armas míticas

    // Probabilidad por dungeon y rareza
    let dropChance = { comun: 0.2, raro: 0.2, legendario: 0.35, fantastico: 0.20, mitico: 0.05 };
    if (dungeon.code === "L2") dropChance = { comun: 0.1, raro: 0.15, legendario: 0.4, fantastico: 0.25, mitico: 0.1 };
    if (dungeon.code === "L3") dropChance = { comun: 0.05, raro: 0.05, legendario: 0.45, fantastico: 0.3, mitico: 0.15 };

    for (let i = 0; i < numItems; i++) {
      const roll = Math.random();
      let selectedList;
      let rarity;

      if (roll < dropChance.mitico) {
        selectedList = [...miticos];
        rarity = "mitico";
      } else if (roll < dropChance.mitico + dropChance.fantastico) {
        selectedList = [...fantasticos];
        rarity = "fantastico";
      } else if (roll < dropChance.legendario + dropChance.mitico + dropChance.fantastico) {
        selectedList = [...legendarios];
        rarity = "legendario";
      } else if (roll < dropChance.raro + dropChance.legendario + dropChance.fantastico + dropChance.mitico) {
        selectedList = [...raros];
        rarity = "raro";
      } else {
        selectedList = [...comunes];
        rarity = "comun";
      }

      if (!selectedList.length) continue;
      const index = Math.floor(Math.random() * selectedList.length);
      const code = selectedList[index];
      const item = findItemByCode(code);
      if (!item) continue;

      pushInv(you, item);
      const emoji = rarity === "comun" ? "⚪" : rarity === "raro" ? "🔵" : rarity === "legendario" ? "🟣" : rarity === "fantastico" ? "🔶" : "🐲";
      itemsGanados.push(`${emoji} *${item.nombre}*`);
    }

    coins = dungeon.recompensa.monedas;
    xp = dungeon.recompensa.xp;
  } else {
    result = `💀 Fallaste en *${dungeon.nombre}* y recibiste daño.`;
  }

  you.hp = player.hp;

  await sendReply(`⚔️ *Mazmorra Legendaria*\n` + log.join("\n") + `\n\n${result}`);

  if (player.hp > 0 && enemies.every(e => e.hp <= 0)) {
    you.monedas += coins;
    addXP(you, xp);

    await sendReply("📦 Abriste un cofre... ¡Veamos qué hay dentro!");
    await new Promise(r => setTimeout(r, 1500));
    let premioTexto = [];
    if (itemsGanados.length > 0) premioTexto.push(`🎉 Items:\n${itemsGanados.join("\n")}`);
    if (coins) premioTexto.push(`💰 Monedas: +$${fmt(coins)}`);
    if (xp) premioTexto.push(`✨ XP: +${xp}`);
    if (premioTexto.length > 0) await sendReply(premioTexto.join("\n\n"));
    else await sendReply("😢 El cofre estaba vacío...");
  }

  saveDB();
  await sendSuccessReact();
  return;
}




// -----------------------------
// RGP DUEL & ASSASSINATE COMPLETO (Mención estilo antiguo)
// -----------------------------

global.pendingDuels = global.pendingDuels || {};
global.activeDuels = global.activeDuels || {};
global.assassinations = global.assassinations || {};

const GOLEM_KO_TIME = 5 * 60 * 1000; // 5 minutos

// --- DUELO: Solicitud ---
if (cmd === "duel") {
  const raw = rest.join(" ").trim() || "";
  const number = raw.replace(/\D/g, "");
  if (!number) return sendErrorReply(`❌ Usá: *${PREFIX}rpg duel <número>*`);

  const targetJidRaw = number + "@s.whatsapp.net";
  const targetJid = normalizeId(targetJidRaw);
  if (!targetJid) return sendErrorReply("No se pudo identificar al rival.");
  if (targetJid === normalizedUserId) return sendErrorReply("No podés retarte a vos mismo.");

  const opp = getUser(targetJid);
  if (!opp) return sendErrorReply("El rival no tiene perfil RPG.");
  if (you.hp <= 0) return sendErrorReply("Estás K.O. y no podés pelear.");
  if (opp.hp <= 0) return sendErrorReply("El rival está K.O.");

  const duelKey = `${normalizedUserId}_${targetJid}`;
  global.pendingDuels[duelKey] = { from: normalizedUserId, to: targetJid, timestamp: Date.now() };
  return sendReply(`⚔️ ${you.nick||"Tú"} retó a ${opp.nick||"Rival"} a un duelo.\n`+
                   `✅ ${opp.nick||"Rival"} puede aceptar con: ${PREFIX}rpg accept ${number}\n`+
                   `❌ o rechazar con: ${PREFIX}rpg reject ${number}`);
}

// --- ACEPTAR DUEL ---
if (cmd === "accept") {
  const raw = rest.join(" ").trim() || "";
  const number = raw.replace(/\D/g, "");
  if (!number) return sendErrorReply("Escribí el número del jugador que retaste.");
  const fromJidRaw = number + "@s.whatsapp.net";
  const fromJid = normalizeId(fromJidRaw);

  const duelKey = `${fromJid}_${normalizedUserId}`;
  if (!global.pendingDuels[duelKey]) return sendErrorReply("No hay duelo pendiente de esa persona.");
  delete global.pendingDuels[duelKey];

  global.activeDuels[duelKey] = {
    players: [fromJid, normalizedUserId],
    turn: 0,
    log: [],
    started: Date.now()
  };
  return sendReply(`🏹 ¡Duelo iniciado entre ${getUser(fromJid).nick||"Jugador"} y ${you.nick||"Tú"}!\n`+
                   `Usá ".rpg accion <ataque/magia/curar/bloquear>" para tu turno.`);
}

// --- RECHAZAR DUEL ---
if (cmd === "reject") {
  const raw = rest.join(" ").trim() || "";
  const number = raw.replace(/\D/g, "");
  if (!number) return sendErrorReply("Escribí el número del jugador que retaste.");
  const fromJidRaw = number + "@s.whatsapp.net";
  const fromJid = normalizeId(fromJidRaw);

  const duelKey = `${fromJid}_${normalizedUserId}`;
  if (!global.pendingDuels[duelKey]) return sendErrorReply("No hay duelo pendiente de esa persona.");
  delete global.pendingDuels[duelKey];

  return sendReply(`❌ ${you.nick||"Tú"} rechazó el duelo de ${getUser(fromJid).nick||"Jugador"}.`);
}

// --- ACCION EN DUELO ---
if (cmd === "accion") {
  const duelKey = Object.keys(global.activeDuels).find(k => k.includes(normalizedUserId));
  if (!duelKey) return sendErrorReply("No estás en un duelo activo.");

  const duel = global.activeDuels[duelKey];
  const currentPlayerId = duel.players[duel.turn % 2];
  if (currentPlayerId !== normalizedUserId) return sendErrorReply("No es tu turno todavía.");

  const action = rest[0]?.toLowerCase();
  if (!action) return sendErrorReply("Escribí la acción a realizar: ataque, magia, curar, bloquear");

  const [p1Jid, p2Jid] = duel.players;
  const player1 = getUser(p1Jid);
  const player2 = getUser(p2Jid);

  const atacante = normalizedUserId === p1Jid ? player1 : player2;
  const defensor = normalizedUserId === p1Jid ? player2 : player1;

  const acaA = atacante.academia?.especialidades || {};
  const acaD = defensor.academia?.especialidades || {};

  let damage = 0;
  let logEntry = "";

  if (action === "ataque") {
    const baseAtk = (atacante.arma?.dano || 0) + (atacante.fuerza || 0) + (acaA.fuerza || 0);
    const defensa = (defensor.armadura?.defensa || 0) + (defensor.defensa || 0) + (acaD.defensa || 0);
    const hitChance = 0.7 + (acaA.controlEspada || 0) * 0.02;
    if (Math.random() < hitChance) {
      damage = Math.max(0, baseAtk - Math.floor(defensa * 0.5));
      defensor.hp = Math.max(0, defensor.hp - damage);
      logEntry = `⚔️ ${atacante.nick||"Tú"} golpea a ${defensor.nick||"Rival"} por ${damage} HP.`;
    } else {
      logEntry = `❌ ${atacante.nick||"Tú"} falló su ataque.`;
    }
  } else if (action === "magia") {
    const baseMagic = 10 + (acaA.magia || 0) * 3;
    damage = Math.max(0, baseMagic - (acaD.defensa || 0));
    defensor.hp = Math.max(0, defensor.hp - damage);
    logEntry = `✨ ${atacante.nick||"Tú"} lanza hechizo y causa ${damage} de daño.`;
  } else if (action === "curar") {
    const heal = Math.floor(atacante.totalHP * (0.005 + (acaA.curacion || 0) * 0.01));
    atacante.hp = Math.min(atacante.totalHP, atacante.hp + heal);
    logEntry = `💖 ${atacante.nick||"Tú"} se cura ${heal} HP.`;
  } else if (action === "bloquear") {
    atacante.blocking = true;
    logEntry = `🛡️ ${atacante.nick||"Tú"} se prepara para bloquear el próximo ataque.`;
  } else return sendErrorReply("Acción inválida.");

  duel.log.push(logEntry);

  if (defensor.hp <= 0) {
    defensor.hp = 0;
    duel.log.push(`💥 ${defensor.nick||"Rival"} quedó K.O.! Fin del duelo.`);
    atacante.monedas += 2000;
    addXP(atacante, 500);
    addXP(defensor, 200);
    delete global.activeDuels[duelKey];
  } else duel.turn++;

  saveDB();
  return sendReply(duel.log.slice(-5).join("\n"));
}

// --- ASSESINAR ---
if (cmd === "asesinar") {
  const raw = rest.join(" ").trim() || "";
  const number = raw.replace(/\D/g, "");
  if (!number) return sendErrorReply(`❌ ¡Error! Usá: *${PREFIX}rpg asesinar <número>*`);

  const targetJidRaw = number + "@s.whatsapp.net";
  const normalizedTargetId = normalizeId(targetJidRaw);
  if (!normalizedTargetId) return sendErrorReply("No se pudo identificar a la victima.");
  if (normalizedTargetId === normalizedUserId) return sendErrorReply("No podés asesinarte a vos mismo.");
  const opp = getUser(normalizedTargetId);
  if (!opp) return sendErrorReply("la victima no tiene perfil RPG todavía.");

  if (you.hp <= 0) return sendErrorReply("Estás K.O. Usá pociones o esperá a subir de nivel.");
  if (opp.hp <= 0) return sendErrorReply("La victima está muerta No hace falta rematarlo.");

  const ahora = Date.now();
  const golemKOtime = 5 * 60 * 1000; // 5 minutos de gólem noqueado

  const log = [];

  // --- Preparar defensor ---
  let defensor = { ...opp };
  let defensorTipo = "jugador"; // puede ser "jugador" o "golem"

  // --- Verificamos si defensor está en casa y tiene gólem ---
  if (opp.enCasa && opp.golem) {
    if (opp.golem.lastKO && ahora - opp.golem.lastKO < golemKOtime) {
      log.push(`⚔️ El gólem de ${opp.nick || "victima"}esta noqueado, podés atacar directamente al jugador.`);
      defensor.hp = opp.hp;
    } else {
      defensorTipo = "golem";
      defensor.hp = opp.golem.hp;
      defensor.atk = opp.golem.atk;
      log.push(`🛡️ ${opp.nick || "victima"} tiene un gólem nivel ${opp.golem.nivel}. Primero debes derrotarlo.`);
    }
  }

  // --- Si atacante tenía inmunidad, se la quitamos ---
  if (you.inmunidadKO) {
    you.inmunidadKO = false;
    you.inmunidadKOStart = 0;
    log.push(`⚔️ ${you.nick || "Tú"} pierde su inmunidad por atacar.`);
  }

  // --- Preparamos estadísticas del atacante ---
  const A = { id: you.nick || normalizedUserId.split("@")[0], atk: getAttack(you), def: getDefense(you), hp: you.hp };
  const B = { id: defensor.id || defensor.nick || normalizedTargetId.split("@")[0], atk: defensor.atk || getAttack(defensor), def: getDefense(defensor), hp: defensor.hp };

  for (let ronda = 1; ronda <= 6; ronda++) {
    // --- ATAQUE DE A ---
    const aRoll = Math.max(0, A.atk - Math.floor(B.def * 0.6)) + Math.floor(Math.random() * 6);
    if (aRoll > 0) B.hp = Math.max(0, B.hp - aRoll);
    log.push(`Ronda ${ronda}: *${A.id}* golpea por ${aRoll}. ${B.id} queda en ${B.hp} HP.`);

    if (B.hp <= 0) {
      B.hp = 0;

      if (defensorTipo === "golem") {
        opp.golem.lastKO = ahora;
        log.push(`💥 ¡Derrotaste al gólem! Queda noqueado por 5 minutos.`);
      } else {
        if (!opp.inmunidadKO) {
          opp.inmunidadKO = true;
          opp.inmunidadKOStart = ahora;
          log.push(`💥 ${B.id} esta muerto y gana inmunidad por 1 hora.`);
        }
      }
      break;
    }

    // --- ATAQUE DE DEFENSOR ---
    const bRoll = Math.max(0, B.atk - Math.floor(A.def * 0.6)) + Math.floor(Math.random() * 6);
    if (bRoll > 0) A.hp = Math.max(0, A.hp - bRoll);
    log.push(`Ronda ${ronda}: *${B.id}* responde con ${bRoll}. ${A.id} queda en ${A.hp} HP.`);

    if (A.hp <= 0) {
      A.hp = 0;
      if (!you.inmunidadKO) {
        you.inmunidadKO = true;
        you.inmunidadKOStart = ahora;
        log.push(`💥 ${A.id} esta muerto y gana inmunidad por 1 hora.`);
      }
      break;
    }
  }

  // --- Guardamos HP finales ---
  you.hp = A.hp;
  if (defensorTipo === "golem") {
    // Gólem no pierde HP, solo queda KO temporal
  } else {
    opp.hp = B.hp;
  }

  // --- Recompensas ---
  let result, coins, xpA, xpB;
  if (A.hp === B.hp) {
    result = "🤝 ¡Empate!";
    coins = 5000;
    xpA = xpB = 200;
    you.monedas += coins;
    opp.monedas += coins;
    addXP(you, xpA);
    addXP(opp, xpB);
  } else if (A.hp > B.hp) {
    result = "asesinaste al rival";
    coins = 10000;
    xpA = 800;
    xpB = 100;
    you.monedas += coins;
    addXP(you, xpA);
    addXP(opp, xpB);
  } else {
    result = "te asesinaron";
    coins = 1000;
    xpA = 100;
    xpB = 800;
    opp.monedas += coins;
    addXP(you, xpA);
    addXP(opp, xpB);
  }

  you.hp = Math.max(0, Math.min(you.hp, you.hpMax));
  opp.hp = Math.max(0, Math.min(opp.hp, opp.hpMax));

  saveDB();

  await sendSuccessReact();
  return sendReply(
    `⚔️ *ASESINATO*\n` +
    log.join("\n") +
    `\n\n${result}\n` +
    `Recompensas: ${A.hp > B.hp ? `Vos: +$${fmt(coins)}, +${xpA} XP | Victima: +${xpB} XP` :
      A.hp < B.hp ? `Victima: +$${fmt(coins)}, +${xpB} XP | Vos: +${xpA} XP` :
      `Ambos: +$${fmt(coins)}, +${xpA} XP`}`
  );
}



// -----------------------------
// EVENTO GRUPAL DE BOSS PARA CONSEGUIR MASCOTAS (resumen en 1 mensaje)
// -----------------------------
if (cmd === "evento-mascota") {
  if (!you.nivel) you.nivel = 1;
  if (!you.totalHP) you.totalHP = 100;
  if (!you.hp) you.hp = you.totalHP;
  if (!you.inventario) you.inventario = [];
  if (!you.mascotaEquipada) you.mascotaEquipada = null;

  const eventId = "global"; 
  if (!global.eventoMascotaGrupal) global.eventoMascotaGrupal = {};
  if (!global.eventoMascotaGrupal[eventId]) {
    global.eventoMascotaGrupal[eventId] = { players: [], started: false };
  }
  const evento = global.eventoMascotaGrupal[eventId];

  const playerId = userJid.split("@")[0];

  // Registrar jugador
  if (!evento.players.find(p => p.id === playerId)) {
    evento.players.push({
      id: playerId,
      nick: you.nick || "Jugador",
      nivel: you.nivel,
      hp: you.hp,
      hpMax: you.totalHP,
      fuerza: you.fuerza || 0,
      defensa: you.defensa || 0,
      arma: you.arma || null,
      armadura: you.armadura || null,
      academia: { ...(you.academia || {}) },
      golem: you.golem || null,
      mascotaEquipada: you.mascotaEquipada || null,
      dmgTotal: 0
    });
  }

  // Si aún faltan jugadores
  if (evento.players.length < 3) {
    return sendReply(`👥 Esperando jugadores para el evento de boss... (${evento.players.length}/3)`);
  }

  // Iniciar evento si aún no comenzó
  if (!evento.started) {
    evento.started = true;

    const boss = {
      nombre: "Leviatán Mítico",
      hp: 40000,
      atk: 600,
      maxHp: 40000,
      skills: [
        { name: "Tormenta de Agua", dmg: 700 },
        { name: "Colmillo Atronador", dmg: 850 }
      ]
    };

    const MASCOTAS = [
      { code: "T01", nombre: "Draco", emoji: "🐉", atkBuff: 30, defBuff: 15, hpBuff: 50, precio: 100000 },
      { code: "T02", nombre: "Fénix", emoji: "🔥", atkBuff: 27, defBuff: 25, hpBuff: 40, precio: 120000 },
      { code: "T03", nombre: "Golem de Piedra", emoji: "🪨", atkBuff: 25, defBuff: 40, hpBuff: 80, precio: 150000 },
      { code: "T04", nombre: "Lobo Espiritual", emoji: "🐺", atkBuff: 35, defBuff: 20, hpBuff: 40, precio: 130000 },
      { code: "T05", nombre: "Ser de Luz", emoji: "✨", atkBuff: 40, defBuff: 15, hpBuff: 55, precio: 200000 },
    ];
    const RAREZAS = [
      { nombre: "Común", chance: 0.4, multAtk: 2, multDef: 2, multHp: 4, emoji: "⚪" },
      { nombre: "Rara", chance: 0.3, multAtk: 4, multDef: 4, multHp: 8, emoji: "🔵" },
      { nombre: "Legendaria", chance: 0.2, multAtk: 8, multDef: 8, multHp: 12, emoji: "🟣" },
      { nombre: "Fantástica", chance: 0.08, multAtk: 16, multDef: 16, multHp: 20, emoji: "🔶" },
      { nombre: "Mítica", chance: 0.02, multAtk: 20, multDef: 20, multHp: 30, emoji: "🐲" }
    ];

    const getAttack = (u) =>
      (u.arma?.dano || 0) + (u.fuerza || 0) + (u.academia?.especialidades?.fuerza || 0)
      + (u.golem?.atkBuff || 0) + (u.mascotaEquipada?.atkBuff || 0);

    const getDefense = (u) =>
      (u.armadura?.defensa || 0) + (u.defensa || 0) + (u.academia?.especialidades?.defensa || 0)
      + (u.golem?.defBuff || 0) + (u.mascotaEquipada?.defBuff || 0);

    // -----------------------
    // Simulación de batalla
    // -----------------------
    while (boss.hp > 0 && evento.players.some(p => p.hp > 0)) {
      // Jugadores atacan
      for (const p of evento.players.filter(p => p.hp > 0)) {
        const totalAtk = getAttack(p);
        boss.hp = Math.max(0, boss.hp - totalAtk);
        p.dmgTotal += totalAtk;
      }

      if (boss.hp <= 0) break;

      // Boss ataca
      const skill = boss.skills[Math.floor(Math.random() * boss.skills.length)];
      for (const target of evento.players.filter(p => p.hp > 0)) {
        const totalDef = getDefense(target);
        const dmgBoss = Math.max(0, skill.dmg - totalDef);
        target.hp = Math.max(0, target.hp - dmgBoss);
      }
    }

    // -----------------------
    // Resumen en un solo mensaje
    // -----------------------
    let resumen = `⚔️ **Batalla contra ${boss.nombre}** ⚔️\n\n`;
    for (const p of evento.players) {
      resumen += `👤 ${p.nick}\n   🗡️ Daño total: ${p.dmgTotal}\n   ❤️ HP restante: ${p.hp}/${p.hpMax}\n\n`;
    }
    resumen += boss.hp <= 0 ? `🏆 ¡El ${boss.nombre} fue derrotado!` : "💀 Los jugadores fueron derrotados...";
    await sendReply(resumen);

    // -----------------------
    // Recompensas si ganaron
    // -----------------------
    if (boss.hp <= 0) {
      for (const p of evento.players) {
        const usuarioDB = getUser(p.id);
        if (!usuarioDB.inventario) usuarioDB.inventario = [];

        // Selección de mascota base
        const base = MASCOTAS[Math.floor(Math.random() * MASCOTAS.length)];

        // Selección de rareza
        let roll = Math.random(), acumulado = 0, rareza = RAREZAS[0];
        for (const r of RAREZAS) {
          acumulado += r.chance;
          if (roll <= acumulado) {
            rareza = r;
            break;
          }
        }

        // Generar UID único para el ítem
        const uid = Date.now().toString(36) + Math.random().toString(36).substring(2,8);

        // Crear mascota con stats, rareza y precio guardados
        const mascotaDrop = {
          uid,
          tipo: "mascota",
          code: base.code,
          nombre: `${base.nombre} (${rareza.nombre})`,
          atkBuff: Math.round(base.atkBuff * rareza.multAtk),
          defBuff: Math.round(base.defBuff * rareza.multDef),
          hpBuff: Math.round(base.hpBuff * rareza.multHp),
          rareza: rareza.nombre,
          emoji: base.emoji + rareza.emoji,
          precio: Math.round(base.precio * rareza.multHp / 4)
        };

        // Guardar en inventario
        pushInv(usuarioDB, mascotaDrop);
        saveDB();

        await sendReply(
          `🎁 ${usuarioDB.nick} obtuvo la mascota *${mascotaDrop.nombre}* ${mascotaDrop.emoji}\n` +
          `Para usarla debes equiparla con: *.rpg equipar ${mascotaDrop.uid}*\n` +
          `Stats: +${mascotaDrop.atkBuff} ATK, +${mascotaDrop.defBuff} DEF, +${mascotaDrop.hpBuff} HP\n` +
          `Precio: ${mascotaDrop.precio.toLocaleString()} 💰`
        );
      }
    }

    // Limpiar evento
    delete global.eventoMascotaGrupal[eventId];
    return;
  }

  // Retorno por defecto si el evento ya inició
  return sendReply(`⚠️ El evento de mascota ya está en curso.`);
}





// -------- RANKING GAMIFICADO --------
if (cmd === "ranking" || cmd === "leaderboard") {
  const arr = Object.entries(DB).map(([id, u]) => ({
    id,
    nivel: u.nivel || 0,
    xp: u.xp || 0,
    monedas: u.monedas || 0,
  }));

  // Ordenamos por nivel, luego XP, luego monedas
  arr.sort((a, b) => (b.nivel - a.nivel) || (b.xp - a.xp) || (b.monedas - a.monedas));

  const top = arr.slice(0, 10);
  if (!top.length) return sendReply("Aún no hay jugadores.");

  const lvlColors = ["🟥","🟧","🟨","🟩","🟦","🟪","⬛","⬜","🟫","🔵"]; // 10 bloques distintos
  const xpColors = ["🟩","🟦","🟪","🟧","🟥","🟨","⬛","⬜","🟫","🔵"]; // XP también gamificado

  let txt = "🏅 *Ranking RPG* (Top 10)\n\n";
  const mentionsList = [];

  top.forEach((p, index) => {
    const jugador = getUser(p.id);
    const displayName = jugador?.nick || p.id.split("@")[0];

    // Emoji de premio para los tres primeros
    let puestoEmoji;
    switch(index) {
      case 0: puestoEmoji = "🥇"; break;
      case 1: puestoEmoji = "🥈"; break;
      case 2: puestoEmoji = "🥉"; break;
      default: puestoEmoji = `${index + 1}.`; break;
    }

    // Barra de nivel (max 10 bloques)
    const lvlBlocks = 10;
    const lvlFilled = Math.min(p.nivel, lvlBlocks);
    let lvlBar = "";
    for (let i = 0; i < lvlBlocks; i++) {
      lvlBar += i < lvlFilled ? lvlColors[i] : "⬜";
    }

    // Barra de XP (max 10 bloques)
    const xpPerLevel = 100; // Ajusta según tu RPG
    const xpBlocks = 10;
    const xpFilled = Math.floor((p.xp % xpPerLevel) / (xpPerLevel / xpBlocks));
    let xpBar = "";
    for (let i = 0; i < xpBlocks; i++) {
      xpBar += i < xpFilled ? xpColors[i] : "⬜";
    }

    txt += `${puestoEmoji} *${displayName}*\n`;
    txt += `Nivel: ${lvlBar} ⭐ ${p.nivel}\n`;
    txt += `XP: ${xpBar} (${p.xp} XP)\n`;
    txt += `💰 Monedas: $${fmt(p.monedas)}\n\n`;

    mentionsList.push(p.id);
  });

  return sendReply(txt, { mentions: mentionsList });
}


    // Subcomando no reconocido
    return sendErrorReply("Subcomando inválido.\n\n" + helpText());

  } catch (err) {
    console.error("[RPG] Error:", err);
    return sendErrorReply(`Error en RPG: ${err.message}`);
  }
  },
};
