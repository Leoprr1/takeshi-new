/**
 * Este es un modelo de comando.
 * Copia y pega este archivo para crear un nuevo comando en una de las carpetas: admin, member u owner
 * Debes renombrarlo para que sea fácil de identificar en la carpeta de destino.
 *
 * Carpeta owner: Comandos que solo pueden ser ejecutados por el dueño del grupo/bot
 * Carpeta admin: Comandos que solo pueden ser ejecutados por administradores del grupo
 * Carpeta member: Comandos que pueden ser ejecutados por cualquier miembro del grupo
 *
 * Funciones y variables que pueden extraerse de handle en "handle: async ({ aquí })"
 * Lo que puedes extraer de handle está definido en src/@types/index.d.ts
 * ¡Cuidado, respeta mayúsculas y minúsculas!
 *
* @author Leo
*/
const { PREFIX } = require(`${BASE_DIR}/config`);
const { InvalidParameterError, WarningError } = require(`${BASE_DIR}/errors`);
const { toUserJid, onlyNumbers } = require(`${BASE_DIR}/utils`);

module.exports = {
  name: "agregar",
  description: "Agrega un participante al grupo (si no se puede, envía invitación)",
  commands: ["agregar", "add"],
  usage: `${PREFIX}agregar 1123456789`,
  /**
   * @param {CommandHandleProps} props
   * @returns {Promise<void>}
   */
  handle: async ({ args, socket, remoteJid, sendReply, isLid }) => {
    if (!args.length) {
      throw new InvalidParameterError("¡Debes proporcionar un número!");
    }

    // Limpiar y validar número
    const number = onlyNumbers(args[0].trim());
    if (number.length < 7 || number.length > 15) {
      throw new InvalidParameterError("¡Número inválido!");
    }

    // Verificar si el número existe en WhatsApp
    const [result] = await socket.onWhatsApp(number);
    if (!result) {
      throw new WarningError("¡El número no está registrado en WhatsApp!");
    }

    const jidToAdd = isLid ? result.lid : toUserJid(number);

    try {
      const response = await socket.groupParticipantsUpdate(remoteJid, [jidToAdd], "add");
      console.log("Respuesta de agregar:", response);

      const r = response[0];

      if (r.status === "200") {
        await sendReply("✅ Usuario agregado exitosamente.");
      } else {
        // Si no se puede agregar (por privacidad o aprobación), enviar link automático
        const code = await socket.groupInviteCode(remoteJid);
        const inviteMsg = `🤖 No se pudo agregar directamente al número *${number}*.\n\n✅ Invítalo con este enlace:\nhttps://chat.whatsapp.com/${code}`;
        await sendReply(inviteMsg);
      }
    } catch (error) {
      console.error("Error al agregar:", error);

      // Manejo de error bad-request u otros
      const code = await socket.groupInviteCode(remoteJid);
      const inviteMsg = `🤖 No se pudo agregar directamente al número *${number}* (posible privacidad o aprobación activa).\n\n✅ Invítalo con este enlace:\nhttps://chat.whatsapp.com/${code}`;
      await sendReply(inviteMsg);
    }
  },
};
