let privateCommands = false; // por defecto SOLO grupos

function setPrivateMode(state) {
  privateCommands = state;
}

function isPrivateModeEnabled() {
  return privateCommands;
}

module.exports = {
  setPrivateMode,
  isPrivateModeEnabled,
};