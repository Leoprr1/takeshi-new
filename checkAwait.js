const fs = require("fs");
const path = require("path");

const commandsFolder = path.join(__dirname, "src"); // Ajusta la ruta a tu carpeta de comandos

function checkAwaitOutsideAsync(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split(/\r?\n/);

  let inAsyncFunction = false;
  const asyncStack = [];

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    // Detecta inicio de función async
    if (/async\s+function|\s*=\s*async\s*\(/.test(trimmed)) {
      asyncStack.push(true);
    }

    // Detecta fin de bloque
    if (trimmed.endsWith("}") && asyncStack.length > 0) {
      asyncStack.pop();
    }

    // Detecta await
    if (/await\s+/.test(trimmed) && asyncStack.length === 0) {
      console.log(`⚠️  'await' fuera de async en ${filePath} -> línea ${index + 1}`);
      console.log(`   ${trimmed}`);
    }
  });
}

// Recorre todos los archivos de comandos
fs.readdirSync(commandsFolder).forEach((file) => {
  const filePath = path.join(commandsFolder, file);
  if (file.endsWith(".js")) {
    checkAwaitOutsideAsync(filePath);
  }
});

