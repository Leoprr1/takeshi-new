const userData = new Map();

const COOLDOWN_SECONDS = 2;
const MAX_WARNINGS = 3;
const SUSPENSION_TIME = 30 * 60 * 1000; // 30 minutos
const WARNING_RESET_TIME = 5 * 60 * 1000; // 5 minutos sin spam = reset advertencias

function checkAntiSpam(userJid) {
  const now = Date.now();

  if (!userData.has(userJid)) {
    userData.set(userJid, {
      lastUsed: 0,
      warnings: 0,
      suspendedUntil: 0,
      lastWarningTime: 0,
    });
  }

  const data = userData.get(userJid);

  // 🔒 Si está suspendido
  if (data.suspendedUntil > now) {
    const remaining = Math.ceil(
      (data.suspendedUntil - now) / 60000
    );

    return {
      blocked: true,
      suspended: true,
      remainingMinutes: remaining,
    };
  }

  // 🔄 Reset automático de advertencias
  if (
    data.warnings > 0 &&
    now - data.lastWarningTime > WARNING_RESET_TIME
  ) {
    data.warnings = 0;
  }

  const diff = (now - data.lastUsed) / 1000;

  // ⏳ Cooldown
  if (diff < COOLDOWN_SECONDS) {
    data.warnings++;
    data.lastWarningTime = now;

    if (data.warnings >= MAX_WARNINGS) {
      data.suspendedUntil = now + SUSPENSION_TIME;
      data.warnings = 0;

      return {
        blocked: true,
        suspended: true,
        remainingMinutes: 30,
      };
    }

    return {
      blocked: true,
      suspended: false,
      remainingWarnings: MAX_WARNINGS - data.warnings,
      remainingSeconds: Math.ceil(COOLDOWN_SECONDS - diff),
    };
  }

  data.lastUsed = now;

  return { blocked: false };
}

module.exports = { checkAntiSpam };
