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
▢ • ${BOT_NAME}
▢ • Fecha: ${date.toLocaleDateString("es-es")}
▢ • Hora: ${date.toLocaleTimeString("es-es")}
▢ • Prefijo: ${prefix}
▢ • Versión: ${packageInfo.version}
▢
╰━━─「🪐」─━━

╭━━⪩ MIS REDES SOCIALES ⪨━━
▢
▢ • YOU TUBE : https://youtube.com/@elmomero200_?si=WRYo5zmd-YuyGxqe
▢ • FACEBOOK : https://www.facebook.com/share/1YtaNEAwyU/
▢ • INSTAGRAM : https://www.instagram.com/elmomero200_?igsh=MXBlbGdoOGRvaTF5NQ==
▢
╰━━─「🌌」─━━

╭━━⪩ DUEÑO ⪨━━
▢
▢ • ${prefix}exec
▢ • ${prefix}get-id
▢ • ${prefix}off
▢ • ${prefix}on
▢ • ${prefix}set-menu-image
▢ • ${prefix}set-prefix
▢
╰━━─「🌌」─━━

╭━━⪩ ADMINS ⪨━━
▢
▢ • ${prefix}add-auto-responder
▢ • ${prefix}anti-audio (1/0)
▢ • ${prefix}anti-document (1/0)
▢ • ${prefix}anti-event (1/0)
▢ • ${prefix}anti-image (1/0)
▢ • ${prefix}anti-link (1/0)
▢ • ${prefix}anti-product (1/0)
▢ • ${prefix}anti-sticker (1/0)
▢ • ${prefix}anti-video (1/0)
▢ • ${prefix}auto-responder (1/0)
▢ • ${prefix}elmobotia (1/0)
▢ • ${prefix}tyc (1/0)
▢ • ${prefix}agregar
▢ • ${prefix}ban
▢ • ${prefix}afk
▢ • ${prefix}clear
▢ • ${prefix}close
▢ • ${prefix}delete
▢ • ${prefix}delete-auto-responder
▢ • ${prefix}demote
▢ • ${prefix}exit (1/0)
▢ • ${prefix}tag
▢ • ${prefix}link-group
▢ • ${prefix}list-auto-responder
▢ • ${prefix}mute
▢ • ${prefix}unmute
▢ • ${prefix}warn
▢ • ${prefix}unwarn
▢ • ${prefix}only-admin (1/0)
▢ • ${prefix}open
▢ • ${prefix}promote
▢ • ${prefix}reveal
▢ • ${prefix}schedule-message
▢ • ${prefix}welcome (1/0)
▢
╰━━─「⭐」─━━

╭━━⪩ 🎮RPG ⪨━━
▢
▢ • ${prefix}aventura 
▢ • ${prefix}rpg setname
▢ • ${prefix}rpg stats
▢ • ${prefix}rpg inventory
▢ • ${prefix}rpg daily
▢ • ${prefix}rpg work
▢ • ${prefix}rpg gremio
▢ • ${prefix}rpg academia
▢ • ${prefix}rpg casino
▢ • ${prefix}rpg dungeon D1/D2/D3
▢ • ${prefix}rpg mazmorra legendaria L1/L2/L3
▢ • ${prefix}rpg isla corrupta I1/I2/I3
▢ • ${prefix}rpg evento-mascota
▢ • ${prefix}rpg hunt | mine | fish
▢ • ${prefix}rpg shop
▢ • ${prefix}rpg home
▢ • ${prefix}rpg buy <código>
▢ • ${prefix}rpg equip <código>
▢ • ${prefix}rpg equip mascota <código>
▢ • ${prefix}rpg unequip arma/armadura/mascota
▢ • ${prefix}rpg use <código> (solo pociones)
▢ • ${prefix}rpg magia curar
▢ • ${prefix}rpg magia curar @otrouser
▢ • ${prefix}rpg duel @usuario
▢ • ${prefix}rpg asesinar @usuario
▢ • ${prefix}rpg ranking

  ventas a otros players:
▢ • ${prefix}rpg list <código> <precio>
▢ • ${prefix}rpg dar <dinero/item> <cantidad/código> @usuario 
▢ • ${prefix}rpg market
▢ • ${prefix}rpg buyplayer <código> <vendedor>

💬 Ejemplos:
▢ • ${prefix}rpg buy A2
▢ • ${prefix}rpg equip R3
▢ • ${prefix}rpg use P1
▢
╰━━─「⭐」─━━

╭━━⪩ PRINCIPAL ⪨━━
▢
▢ • ${prefix}casarse
▢ • ${prefix}divorce
▢ • ${prefix}infomatrimonio
▢ • ${prefix}attp
▢ • ${prefix}fake-chat
▢ • ${prefix}generate-link
▢ • ${prefix}get-lid
▢ • ${prefix}google-search
▢ • ${prefix}perfil
▢ • ${prefix}profile
▢ • ${prefix}raw-message
▢ • ${prefix}rename
▢ • ${prefix}samples-of-messages
▢ • ${prefix}sticker
▢ • ${prefix}to-image
▢ • ${prefix}tts
▢ • ${prefix}ttp
▢ • ${prefix}yt-search
▢
╰━━─「🚀」─━━

╭━━⪩ DESCARGAS ⪨━━
▢
▢ • ${prefix}pm
▢ • ${prefix}pv
▢
╰━━─「🎶」─━━

╭━━⪩ JUEGOS ⪨━━
▢
▢ • ${prefix}abrazar
▢ • ${prefix}besar
▢ • ${prefix}bofetada
▢ • ${prefix}cenar
▢ • ${prefix}dado
▢ • ${prefix}golpear
▢ • ${prefix}luchar
▢ • ${prefix}matar
▢ • ${prefix}follar
▢ • ${prefix}pete
▢ • ${prefix}cum
▢
╰━━─「🎡」─━━`;
};
