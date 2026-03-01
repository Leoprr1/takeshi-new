const {
  readJSON,
  writeJSON
} = require("./database"); // 📍 IMPORTANTE: usa la util base que ya tenés!

const ELMO_BOTIA_FILE = "elmo-botia";

// Activar ElmoBotia en un grupo
function activateElmoBotiaGroup(groupId) {
  const groups = readJSON(ELMO_BOTIA_FILE, []);
  if (!groups.includes(groupId)) {
    groups.push(groupId);
    writeJSON(ELMO_BOTIA_FILE, groups);
  }
}

// Desactivar ElmoBotia en un grupo
function deactivateElmoBotiaGroup(groupId) {
  const groups = readJSON(ELMO_BOTIA_FILE, []);
  const index = groups.indexOf(groupId);
  if (index !== -1) {
    groups.splice(index, 1);
    writeJSON(ELMO_BOTIA_FILE, groups);
  }
}

// Verificar si ElmoBotia está activo en un grupo
function isActiveElmoBotiaGroup(groupId) {
  const groups = readJSON(ELMO_BOTIA_FILE, []);
  return groups.includes(groupId);
}

module.exports = {
  activateElmoBotiaGroup,
  deactivateElmoBotiaGroup,
  isActiveElmoBotiaGroup,
};
