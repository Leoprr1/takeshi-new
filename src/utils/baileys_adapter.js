let baileys;

async function loadBaileys() {
  if (!baileys) {
    baileys = await import("@whiskeysockets/baileys");
  }
  return baileys;
}

async function getBaileysHelpers() {
  const b = await loadBaileys();

  return {
    delay: b.delay,
    downloadContentFromMessage: b.downloadContentFromMessage,
    DisconnectReason: b.DisconnectReason,
    isJidBroadcast: b.isJidBroadcast,
    isJidStatusBroadcast: b.isJidStatusBroadcast,
    isJidNewsletter: b.isJidNewsletter,
  };
}

// 👇 Exposición directa de downloadContentFromMessage
async function downloadContentFromMessage(message, type) {
  const { downloadContentFromMessage } = await getBaileysHelpers();
  return downloadContentFromMessage(message, type);
}

async function delay(ms) {
  const { delay } = await getBaileysHelpers();
  return delay(ms);
}

module.exports = {
  getBaileysHelpers,
  downloadContentFromMessage, // ← ahora sí existe
  delay,
};
