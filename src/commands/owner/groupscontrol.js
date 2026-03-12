const { PREFIX } = require(`${BASE_DIR}/config`);
const { isBotOwner } = require(`${BASE_DIR}/middlewares`);
const {
  disableGroup,
  enableGroup,
  isGroupGloballyDisabled
} = require(`${BASE_DIR}/utils/globalGroups`);

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* =========================
   FUNCION PARA OBTENER GRUPOS
========================= */

async function getGroupList(socket) {

  const groups = await socket.groupFetchAllParticipating();
  let list = Object.values(groups);

  list.sort((a, b) => {
    const mA = a.participants?.length || 0;
    const mB = b.participants?.length || 0;
    return mB - mA;
  });

  return list;
}

module.exports = {
  name: "groupscontrol",
  description: "Control global de grupos",
  commands: [
    "menugrupo",
    "grupolist",
    "desactivegrupo",
    "activegrupo",
    "salirgrupo",
    "entrargrupo",
    "mensajeglobal"
  ],

  handle: async ({
    socket,
    commandName,
    args,
    sendReply,
    userJid,
    isLid,
    fullArgs
  }) => {

    if (!isBotOwner({ userJid, isLid })) {
      return sendReply("❌ Este comando solo puede usarlo el owner.");
    }

    /* =========================
       📜 MENU GRUPO
    ========================= */

    if (commandName === "menugrupo") {

      let text = "📜 *MENÚ CONTROL DE GRUPOS*\n\n";

      text += "📋 LISTAR GRUPOS\n";
      text += `${PREFIX}grupolist\n\n`;

      text += "🚫 DESACTIVAR BOT\n";
      text += `${PREFIX}desactivegrupo 1\n`;
      text += `${PREFIX}desactivegrupo all\n\n`;

      text += "✅ ACTIVAR BOT\n";
      text += `${PREFIX}activegrupo 1\n`;
      text += `${PREFIX}activegrupo all\n\n`;

      text += "🚪 SALIR DE GRUPO\n";
      text += `${PREFIX}salirgrupo 1\n`;
      text += `${PREFIX}salirgrupo all\n\n`;

      text += "➕ ENTRAR A GRUPO\n";
      text += `${PREFIX}entrargrupo link\n\n`;

      text += "📢 MENSAJE GLOBAL\n";
      text += `${PREFIX}mensajeglobal 1 Hola grupo\n`;
      text += `${PREFIX}mensajeglobal all Hola a todos\n`;

      return sendReply(text);
    }

    /* =========================
       📊 LISTA DE GRUPOS
    ========================= */

    if (commandName === "grupolist") {

      const list = await getGroupList(socket);

      if (!list.length) {
        return sendReply("El bot no está en ningún grupo.");
      }

      let text = "📊 *RANKING DE GRUPOS*\n\n";

      list.forEach((g, i) => {

        const members = g.participants?.length || 0;

        const state = isGroupGloballyDisabled(g.id)
          ? "🚫 DESACTIVADO"
          : "✅ ACTIVO";

        text += `*${i + 1}.* ${g.subject}\n`;
        text += `👥 ${members} miembros\n`;
        text += `Estado: ${state}\n\n`;

      });

      return sendReply(text);
    }

    /* =========================
       🚫 DESACTIVAR GRUPO
    ========================= */

    if (commandName === "desactivegrupo") {

      const list = await getGroupList(socket);

      if (!args[0]) {
        return sendReply(`Uso:\n${PREFIX}desactivegrupo 1`);
      }

      if (args[0].toLowerCase() === "all") {

        list.forEach(g => disableGroup(g.id));

        return sendReply("🚫 Bot desactivado en todos los grupos.");
      }

      const index = parseInt(args[0]) - 1;
      const group = list[index];

      if (!group) return sendReply("❌ Grupo inválido.");

      disableGroup(group.id);

      return sendReply(`🚫 Bot desactivado en ${group.subject}`);
    }

    /* =========================
       ✅ ACTIVAR GRUPO
    ========================= */

    if (commandName === "activegrupo") {

      const list = await getGroupList(socket);

      if (!args[0]) {
        return sendReply(`Uso:\n${PREFIX}activegrupo 1`);
      }

      if (args[0].toLowerCase() === "all") {

        list.forEach(g => enableGroup(g.id));

        return sendReply("✅ Bot activado en todos los grupos.");
      }

      const index = parseInt(args[0]) - 1;
      const group = list[index];

      if (!group) return sendReply("❌ Grupo inválido.");

      enableGroup(group.id);

      return sendReply(`✅ Bot activado en ${group.subject}`);
    }

    /* =========================
       🚪 SALIR DE GRUPO
    ========================= */

    if (commandName === "salirgrupo") {

      const list = await getGroupList(socket);

      if (!args[0]) {
        return sendReply(`Uso:\n${PREFIX}salirgrupo 1`);
      }

      if (args[0].toLowerCase() === "all") {

        for (const g of list) {
          try {
            await socket.groupLeave(g.id);
            await sleep(1500);
          } catch {}
        }

        return sendReply("🚪 El bot salió de todos los grupos.");
      }

      const index = parseInt(args[0]) - 1;
      const group = list[index];

      if (!group) return sendReply("❌ Grupo inválido.");

      await socket.groupLeave(group.id);

      return sendReply(`🚪 Bot salió de ${group.subject}`);
    }

    /* =========================
       ➕ ENTRAR A GRUPO
    ========================= */

    if (commandName === "entrargrupo") {

      const input = args.join(" ").trim();

      if (!input) {
        return sendReply(
`Uso:
${PREFIX}entrargrupo https://chat.whatsapp.com/XXXX`
        );
      }

      try {

        const match = input.match(/([A-Za-z0-9]{20,24})/);

        if (!match) {
          return sendReply("❌ Link inválido.");
        }

        const code = match[1];

        await socket.groupAcceptInvite(code);

        return sendReply("✅ El bot entró al grupo correctamente.");

      } catch (err) {

        console.log("ERROR ENTRAR GRUPO:", err);

        return sendReply("❌ No pude entrar al grupo.");
      }
    }

    /* =========================
       📢 MENSAJE GLOBAL
       (NO TOCADO COMO PEDISTE)
    ========================= */

    if (commandName === "mensajeglobal") {

      const list = await getGroupList(socket);

      const fullText = fullArgs.trim();

      if (!fullText) {
        return sendReply(
`Uso:
${PREFIX}mensajeglobal 1 Hola grupo
${PREFIX}mensajeglobal all Hola a todos`
        );
      }

      const parts = fullText.split(" ");
      const target = parts.shift();
      const message = fullText.slice(target.length).trim();

      if (!message) {
        return sendReply("❌ Debes escribir un mensaje.");
      }

      const sendToGroup = async (group) => {

        try {

          if (isGroupGloballyDisabled(group.id)) return false;

          const members = (group.participants || []).map(p => p.id);

          const text =
`📢 \`*MENSAJE GLOBAL*\` 

     ${message}`;

          await socket.sendMessage(group.id, {
            text,
            mentions: members
          });

          return true;

        } catch (err) {
          console.log("Error enviando a grupo:", group.subject);
          return false;
        }

      };

      if (target.toLowerCase() === "all") {

        let sent = 0;

        for (const g of list) {

          const ok = await sendToGroup(g);

          if (ok) sent++;

          await sleep(2000);
        }

        return sendReply(`✅ Mensaje enviado a ${sent} grupos.`);
      }

      const index = parseInt(target) - 1;
      const group = list[index];

      if (!group) {
        return sendReply("❌ Grupo inválido.");
      }

      await sendToGroup(group);

      return sendReply(`📢 Mensaje enviado a ${group.subject}`);
    }

  },
};
