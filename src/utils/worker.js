const { parentPort } = require("worker_threads");
const fs = require("fs");

parentPort.on("message", (task) => {
  const { id, type, path, data } = task;

  try {
    if (type === "load") {
      const file = fs.readFileSync(path, "utf8");
      const json = JSON.parse(file);
      parentPort.postMessage({ id, success: true, data: json });
    }

    if (type === "save") {
      const jsonString = JSON.stringify(data, null, 2);

      fs.writeFileSync(path + ".bak", jsonString);
      fs.writeFileSync(path, jsonString);

      parentPort.postMessage({ id, success: true });
    }

  } catch (err) {
    parentPort.postMessage({
      id,
      success: false,
      error: err.message
    });
  }
});
