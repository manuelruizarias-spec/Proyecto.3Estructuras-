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
const limpio = (s, n) => String(s || '').trim().slice(0, n);

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
 */
function publicar(baseDatos, me, datos) {
    const texto = limpio(datos.texto, 500); // límite del Frontend: textarea de 500
    if (!texto) {
        return { ok: false, error: 'Escribe algo antes de publicar.', codigo: 400 };
    }
    // Regla de permisos (S2-5, Manuel): solo escribe en el club quien está
    // en miembros. Se comprueba aquí para no guardar una publicación inválida.
    if (datos.clubId) {
        const club = baseDatos.clubes.find(c => c.id === datos.clubId);
        if (!club || !club.miembros.includes(me)) {
            return { ok: false, error: 'Debes ser miembro del club.', codigo: 400 };
        }
    }
    const publicacion = { id: uid(), autor: me, clubId: datos.clubId || null, texto, fecha: Date.now() };
    baseDatos.publicaciones.unshift(publicacion);
    return { ok: true, datos: publicacion };
}

module.exports = { publicar };
