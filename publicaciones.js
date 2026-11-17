/* =====================================================================
   publicaciones.js - Publicaciones del muro y de clubes (S2-1)
   Responsable: Cris - Backend de funcionalidades sociales

   Cada función recibe (baseDatos, me, datos) y devuelve
   { ok, error?, datos?, codigo? }. Aquí solo se valida y se muta la
   memoria: quien persiste es server.js.
   ===================================================================== */

// --- Utilidades locales (sin dependencias con otros módulos).
const crypto = require('crypto');
const uid = () => crypto.randomBytes(4).toString('hex');

// Largo máximo del texto: el mismo que impone el Frontend (textarea de 500
// caracteres). Se comprueba aquí porque el Frontend se puede saltar o no
// ser el único cliente del servidor.
const MAX_TEXTO = 500;

/**
 * Crea una publicación (muro general o tablón de un club).
 *
 * Estructura de datos: baseDatos.publicaciones es un ARREGLO de objetos
 * { id, autor, clubId, texto, fecha }.
 *   - Un solo arreglo para muro y clubes, distinguiendo la zona con
 *     "clubId" (null = muro general): evita duplicar archivos/estructuras
 *     y permite filtrar por zona en una sola pasada (muro propio, muro de
 *     amigos, tablón de un club, tablón de mis clubes).
 *   - "autor" guarda el id de usuario (string = nombre de usuario), el
 *     mismo id que usa usuarios.json, para cruzar sin conversiones.
 *   - "fecha" en milisegundos (Date.now()): el Frontend la resta para
 *     ordenar de más reciente a más antiguo y para mostrar "hace 5 min".
 *   - Se inserta con unshift (al inicio) porque el muro lee el arreglo en
 *     orden y lo más reciente debe salir primero.
 *
 * Antes de guardar se validan tipo de dato, vacío, largo máximo (500) y
 * que el club (si viene) exista: todo con mensaje en español.
 */
function publicar(baseDatos, me, datos) {
    // 1) Tipo: el texto debe ser TEXTO. En JSON puede llegar cualquier cosa
    //    ("texto": 123, null, un objeto) y eso no es algo que publicar.
    if (typeof datos.texto !== 'string') {
        return { ok: false, error: 'Texto inválido.', codigo: 400 };
    }
    // 2) Vacío y 3) largo máximo: se mide sobre el texto ya recortado,
    //    igual que lo que quedará guardado.
    const texto = datos.texto.trim();
    if (!texto) {
        return { ok: false, error: 'Escribe algo antes de publicar.', codigo: 400 };
    }
    if (texto.length > MAX_TEXTO) {
        return { ok: false, error: `El texto no puede superar los ${MAX_TEXTO} caracteres.`, codigo: 400 };
    }
    // 4) Club: si viene clubId debe ser TEXTO y el club debe EXISTIR; la
    //    pertenencia es la regla de permisos (S2-5, Manuel). Antes de este
    //    chequeo un id inexistente caía en "Debes ser miembro", que
    //    escondía el problema real (el club no existe).
    if (datos.clubId !== null && datos.clubId !== undefined && datos.clubId !== '') {
        const club = typeof datos.clubId === 'string'
            ? baseDatos.clubes.find(c => c.id === datos.clubId)
            : null;
        if (!club) {
            return { ok: false, error: 'Club inexistente.', codigo: 400 };
        }
        if (!club.miembros.includes(me)) {
            return { ok: false, error: 'Debes ser miembro del club.', codigo: 400 };
        }
    }
    const publicacion = { id: uid(), autor: me, clubId: datos.clubId || null, texto, fecha: Date.now() };
    baseDatos.publicaciones.unshift(publicacion);
    return { ok: true, datos: publicacion };
}

module.exports = { publicar };
