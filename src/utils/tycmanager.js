const { readJSON, writeJSON } = require("./database");

const TYC_FILE = "news-tyc";

// Activar TyC en un grupo
function activateTyCGroup(groupId) {
  const data = readJSON(TYC_FILE, { lastUrl: "", groupsEnabled: [] });

  if (!data.groupsEnabled.includes(groupId)) {
    data.groupsEnabled.push(groupId);
    writeJSON(TYC_FILE, data);
  }
}

// Desactivar TyC en un grupo
function deactivateTyCGroup(groupId) {
  const data = readJSON(TYC_FILE, { lastUrl: "", groupsEnabled: [] });

  data.groupsEnabled = data.groupsEnabled.filter(
    (group) => group !== groupId
  );

  writeJSON(TYC_FILE, data);
}

// Verificar si está activo
function isActiveTyCGroup(groupId) {
  const data = readJSON(TYC_FILE, { lastUrl: "", groupsEnabled: [] });
  return data.groupsEnabled.includes(groupId);
}

module.exports = {
  activateTyCGroup,
  deactivateTyCGroup,
  isActiveTyCGroup,
};
