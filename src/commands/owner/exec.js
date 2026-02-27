/**
 * Desarrollado por: Mkg
 * Refactorizado por: Dev Gui
 * Adaptado para Windows con PM2
 */

const { exec } = require("child_process");
const { isBotOwner } = require(`${BASE_DIR}/middlewares`);
const { PREFIX } = require(`${BASE_DIR}/config`);
const { DangerError } = require(`${BASE_DIR}/errors`);

// Comandos peligrosos bloqueados
const DANGEROUS_COMMANDS = [
  ":()", "attrib", "cacls", "chmod", "chown", "cp /etc", "dd", "del /f", "fdisk",
  "format", "halt", "init", "iptables", "kill", "killall", "mkfs", "mv /etc",
  "passwd", "pkill", "poweroff", "rd /s", "reboot", "rm", "rmdir", "shutdown",
  "su", "sudo", "ufw", "unlink", "yes"
];

// Patrones peligrosos
const DANGEROUS_PATTERNS = [
  /;\s*(rm|mv|cp|del)/i,
  /\/dev\/sd[a-z]/i,
  /\|\s*sh/i,
  /\$\(.*\)/i,
  /&&\s*(rm|mv|cp|del)/i,
  /`.*`/,
  />\s*\/dev\/(null|zero|random)/i
];

// Comandos permitidos en Windows
const SAFE_COMMANDS = [
  "dir",
  "tasklist",
  "echo",
  "ver",
  "whoami",
  "systeminfo",
  "cd",
  "type",
  "tree",
  "netstat",
  "nslookup",
  "pm2" // Ahora podés usar pm2 restart, pm2 list, etc.
];

function isSafeCommand(command) {
  const trimmed = command.trim().toLowerCase();

  // Bloquear comandos peligrosos explícitos
  for (const c of DANGEROUS_COMMANDS) {
    if (trimmed.includes(c.toLowerCase())) {
      return { safe: false, reason: `Comando prohibido detectado: ${c}` };
    }
  }

  // Bloquear patrones peligrosos
  for (const p of DANGEROUS_PATTERNS) {
    if (p.test(trimmed)) {
      return { safe: false, reason: `Patrón peligroso detectado: ${p.toString()}` };
    }
  }

  // Bloquear acceso a rutas sensibles
  const sensitivePaths = ["c:\\windows", "c:\\system32"];
  for (const path of sensitivePaths) {
    if (trimmed.includes(path.toLowerCase())) {
      return { safe: false, reason: "Acceso a directorios del sistema prohibido" };
    }
  }

  // Solo permitir comandos seguros
  const firstWord = trimmed.split(" ")[0];
  if (!SAFE_COMMANDS.includes(firstWord)) {
    return { safe: false, reason: `Comando no permitido: ${firstWord}` };
  }

  return { safe: true };
}

module.exports = {
  name: "exec",
  description: "Ejecuta comandos seguros de la terminal desde WhatsApp",
  commands: ["exec"],
  usage: `${PREFIX}exec comando
Ejemplos: dir, tasklist, pm2 list, pm2 restart bot`,

  handle: async ({ fullArgs, sendSuccessReply, sendErrorReply, userJid, isLid }) => {
    if (!isBotOwner({ userJid, isLid })) {
      throw new DangerError("¡Solo el dueño del bot puede usar este comando!");
    }

    if (!fullArgs) {
      throw new DangerError(`Uso: ${PREFIX}exec comando
Solo se permiten comandos seguros de Windows: dir, tasklist, pm2 list, pm2 restart`);
    }

    const safetyCheck = isSafeCommand(fullArgs);
    if (!safetyCheck.safe) {
      throw new DangerError(`¡Comando bloqueado por seguridad!\nMotivo: ${safetyCheck.reason}`);
    }

    console.log(`[EXEC_AUDIT] ${userJid} ejecutó: ${fullArgs}`);

    exec(
      fullArgs,
      { timeout: 20000, maxBuffer: 5 * 1024 * 1024 }, // 20s y 5MB max buffer
      (error, stdout, stderr) => {
        if (error) {
          if (error.killed) return sendErrorReply("⏱️ Comando cancelado por timeout");
          return sendErrorReply(`❌ Error: ${error.message}`);
        }

        let output = stdout || stderr || "Comando ejecutado sin salida";
        const maxLength = 3500;
        if (output.length > maxLength) {
          output = output.substring(0, maxLength) + "\n\n... (salida truncada)";
        }

        // Limpiar caracteres no imprimibles
        output = output.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

        sendSuccessReply(`Resultado de \`${fullArgs}\`:\n\`\`\`\n${output}\n\`\`\``);
      }
    );
  },
};
