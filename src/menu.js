/**
 * Menú del bot
 *
 * @author Dev Gui
 */
const { BOT_NAME } = require("./config");
const packageInfo = require("../package.json");
const { readMore } = require("./utils");
const { getPrefix } = require("./utils/database");

exports.menuMessage = (groupJid) => {
  const date = new Date();

  const prefix = getPrefix(groupJid);

  return `╭━━⪩ ¡BIENVENIDO! ⪨━━${readMore()}
▢
▢ • \`${BOT_NAME}\`
▢ • \`Fecha: ${date.toLocaleDateString("es-es")}\`
▢ • \`Hora: ${date.toLocaleTimeString("es-es")}\`
▢ • \`Prefijo: ${prefix}\`
▢ • \`Versión: ${packageInfo.version}\`
▢
╰━━─「🪐」─━━

╭━━⪩ MIS REDES SOCIALES ⪨━━
▢
▢ • \`YOU TUBE : https://youtube.com/@elmomero200_?si=WRYo5zmd-YuyGxqe\`
▢ • \`FACEBOOK : https://www.facebook.com/share/1YtaNEAwyU/\`
▢ • \`INSTAGRAM : https://www.instagram.com/elmomero200_?igsh=MXBlbGdoOGRvaTF5NQ==\`
▢
╰━━─「🌌」─━━

╭━━⪩ DUEÑO ⪨━━
▢
▢ • \`${prefix}newtc on/off/status/reset\` <-- *para el sistema de noticias global*
▢ • \`${prefix}exec\`
▢ • \`${prefix}get-id\`
▢ • \`${prefix}off\`
▢ • \`${prefix}on\`
▢ • \`${prefix}set-menu-image\`
▢ • \`${prefix}set-prefix\` <-- *este es para cambiar el prifix del comando ejemplo: .menu a #menu*
▢
╰━━─「🌌」─━━

╭━━⪩ PERFIL ⪨━━
▢
▢ • \`${prefix}reg\` <-- *para registrar tu pefil*
▢ • \`${prefix}reg2\` <-- *para restablecer tu pefil*
▢ • \`${prefix}profile\` <-- *para ver tu perfil*
▢
╰━━─「🌌」─━━

╭━━⪩ ADMINS ⪨━━
▢
▢ • \`${prefix}only-admin (1/0)\` <-- *activa esto y solo los admmins pueden usar el bot*
▢ • \`${prefix}add-auto-responder\` <-- *para agregar mensaje y respuesta para el mismo*
▢ • \`${prefix}delete-auto-responder\` <-- *elimina el texto que agregaste con el add*
▢ • \`${prefix}anti-audio (1/0)\` 
▢ • \`${prefix}anti-document (1/0)\`
▢ • \`${prefix}anti-event (1/0)\`
▢ • \`${prefix}anti-image (1/0)\`
▢ • \`${prefix}anti-link (1/0)\`
▢ • \`${prefix}anti-product (1/0)\`
▢ • \`${prefix}anti-sticker (1/0)\`
▢ • \`${prefix}anti-video (1/0)\`
▢ • \`${prefix}auto-responder (1/0)\` <-- *para que el bot hable*
▢ • \`${prefix}elmobotia (1/0)\` <-- *para que hable tambien pero mas inteligente?*
▢ • \`${prefix}tyc (1/0)\` <-- *manda noticias de tyc sport al grupo*
▢ • \`${prefix}agregar\` <-- *para agregar a alguien al grupo*
▢ • \`${prefix}ban\` <-- *para eliminar gente del grupo*
▢ • \`${prefix}afk\` <-- *da informacion de los inactivos del grupo*
▢ • \`${prefix}clear\` <-- *limpia el chat con un largo msj sin texto*
▢ • \`${prefix}delete\` <-- *borra un mensaje seleccionado*
▢ • \`${prefix}promote\` <-- *le da admin a alguien*
▢ • \`${prefix}demote\` <-- *le quita el admin a un admin*
▢ • \`${prefix}tag\` <-- *etiqueta a todo el grupo*
▢ • \`${prefix}link-group\` <-- *dar el link del grupo*
▢ • \`${prefix}list-auto-responder\` <-- *da la lista de mensajes que puede responder el bot*
▢ • \`${prefix}mute\` <-- *mutea a un usuario*
▢ • \`${prefix}unmute\` <-- *este desmutea*
▢ • \`${prefix}warn\` <-- *para ponerle strikes a alguien*
▢ • \`${prefix}unwarn\` <-- *quita los strikes*
▢ • \`${prefix}only-admin (1/0)\` <-- *activa esto y solo los admmins pueden usar el bot*
▢ • \`${prefix}open\` <-- *abre el grupo*
▢ • \`${prefix}close\` <-- *cierra el grupo*
▢ • \`${prefix}reveal\` <-- *revela el contenido de una ft o video de una sola vez*
▢ • \`${prefix}welcome (1/0)\` <-- *da la bienvenida en el grupo a los nuevos*
▢ • \`${prefix}exit (1/0)\` <-- *manda un msj de despedida a quien se sale del grupo*
▢
╰━━─「⭐」─━━

╭━━⪩ 🎮RPG ⪨━━
▢
▢ • \`${prefix}aventura\`<-- *da esta lista en un mensaje sin todo el menu*
▢ • \`${prefix}rpg setname\` <-- *para ponerte nombre en el juego*
▢ • \`${prefix}rpg stats\` <-- *para ver tus estadisticas*
▢ • \`${prefix}rpg inventory\` <-- *para ver tu inventario*
▢ • \`${prefix}rpg daily\` <-- *reclama la recompensa diaria*
▢ • \`${prefix}rpg hunt | mine | fish | work\` <-- *trabajas te da xp y dinero*
▢ • \`${prefix}rpg gremio\` <-- *para ver el gremio*
▢ • \`${prefix}rpg academia\` <-- *para estudiar habilidades*
▢ • \`${prefix}rpg casino\` <-- *la timba bro*
▢ • \`${prefix}rpg dungeon D1/D2/D3\` <-- *da xp, dinero y objetos -- la D1 desde nivel 0, D2 desde nivel 20, D3 desde nivel 40*
▢ • \`${prefix}rpg isla corrupta I1/I2/I3\` <-- *da xp, dinero y objetos -- la I1 desde nivel 60, I2 desde nivel 80, I3 desde nivel 100*
▢ • \`${prefix}rpg mazmorra legendaria L1/L2/L3\` <-- *da xp, dinero y objetos -- la L1 desde nivel 150, L2 desde nivel 200, L3 desde nivel 250*
▢ • \`${prefix}rpg evento-mascota\` <-- *se juega de a 3 usuarios y podes conseguir un pokemon*
▢ • \`${prefix}rpg shop\` <-- *es una tienda basica de objetos*
▢ • \`${prefix}rpg home\` <-- *para comprarte una casa y demas*
▢ • \`${prefix}rpg buy <código>\` <-- *para comprar un item en la shop*
▢ • \`${prefix}rpg equip <código>\` <-- *para equiparte items*
▢ • \`${prefix}rpg equip mascota <código>\` <-- *para equipar la mascota*
▢ • \`${prefix}rpg unequip arma/armadura/mascota\` <-- *para quitarte objetos equipados*
▢ • \`${prefix}rpg use <código> (solo pociones)\` <-- *para tomar posiones*
▢ • \`${prefix}rpg magia curar\` <-- *para curarte a vos mismo*
▢ • \`${prefix}rpg magia curar @otrouser\` <-- *para curar a otro usuario*
▢ • \`${prefix}rpg duel @usuario\` <-- *para un mano a mano con otro usuario*
▢ • \`${prefix}rpg asesinar @usuario\` <-- *se la metes mientras duerme el otro usuario XD*
▢ • \`${prefix}rpg ranking\` <-- *donde podes ver tu posicion y de los top globals*
▢ • \`${prefix}rpg list <código> <precio>\` <-- *para vender items*
▢ • \`${prefix}rpg dar <dinero/item> <cantidad/código> @usuario\` <-- *le das monedas a un pobre*
▢ • \`${prefix}rpg market\` <-- *aca se listan los items que venden otros usuarios y los podes comprar vos*
▢ • \`${prefix}rpg buyplayer <código> <vendedor>\` <-- *para comprar en el market*
▢
╰━━─「⭐」─━━

╭━━⪩ PRINCIPAL ⪨━━
▢
▢ • \`${prefix}casarse\` <-- *para eso obvio*
▢ • \`${prefix}divorce\` <-- *por si todo terminó*
▢ • \`${prefix}infomatrimonio\` <-- *para ver como vas con tu amorcito*
▢ • \`${prefix}fake-chat\` <-- *manda un mensaje respondiendo un mensaje que nunca envio la otra persona XD*
▢ • \`${prefix}sticker\` <-- *te crea un sticker si seleccionas una imagen o video*
▢ • \`${prefix}pm\` <-- *para descargar audios como musica*
▢ • \`${prefix}pv\` <-- *para descargar videos*
▢ • \`${prefix}mp3\` <-- *para descargar audios como musica pero en mp3 guardable*
▢ • \`${prefix}abrazar\` <--|
▢ • \`${prefix}besar\`      |
▢ • \`${prefix}bofetada\`   |
▢ • \`${prefix}cenar\`      |
▢ • \`${prefix}dado\`       |
▢ • \`${prefix}golpear\` <-- *solo selecciona el mensaje de la otra persona y disfruta*
▢ • \`${prefix}luchar\`     |
▢ • \`${prefix}matar\`      |
▢ • \`${prefix}follar\`     |
▢ • \`${prefix}pete\`       |
▢ • \`${prefix}cum\` <--    |
▢
╰━━─「🎡」─━━`;
};
