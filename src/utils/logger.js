/**
 * Logs
 *
 * @author Dev Gui
 */
const { version } = require("../../package.json");

exports.sayLog = (message) => {
  console.log("\x1b[36m[ELMOBOT | TALK]\x1b[0m", message);
};

exports.inputLog = (message) => {
  console.log("\x1b[30m[ELMOBOT | INPUT]\x1b[0m", message);
};

exports.infoLog = (message) => {
  console.log("\x1b[34m[ELMOBOT | INFO]\x1b[0m", message);
};

exports.successLog = (message) => {
  console.log("\x1b[32m[ELMOBOT | SUCCESS]\x1b[0m", message);
};

exports.errorLog = (message) => {
  console.log("\x1b[31m[ELMOBOT | ERROR]\x1b[0m", message);
};

exports.warningLog = (message) => {
  console.log("\x1b[33m[ELMOBOT | WARNING]\x1b[0m", message);
};

exports.bannerLog = () => {
  console.log(`\x1b[36m███████╗██╗     ███╗   ███╗ ██████╗ ██████╗  ██████╗ ██████╗\x1b[0m`);
  console.log(`\x1b[36m██╔════╝██║     ████╗ ████║██╔═══██╗██╔══██╗██╔═══██╗╚═██╔═╝\x1b[0m`);
  console.log(`\x1b[36m█████╗  ██║     ██╔████╔██║██║   ██║██████╔╝██║   ██║  ██║ \x1b[0m`);
  console.log(`\x1b[36m██╔══╝  ██║     ██║╚██╔╝██║██║   ██║██╔══██╗██║   ██║  ██║ \x1b[0m`);
  console.log(`\x1b[36m███████╗███████╗██║ ╚═╝ ██║╚██████╔╝██████╔╝ ██████╔╝  ██║ \x1b[0m`);
  console.log(`\x1b[36m╚══════╝╚══════╝╚═╝     ╚═╝ ╚═════╝ ╚═════╝  ╚═════╝   ╚═╝\x1b[0m`);
  console.log(`\x1b[36m🤖 Versión: \x1b[0m${version}\n`);
};