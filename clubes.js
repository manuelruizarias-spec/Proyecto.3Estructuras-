/* =====================================================================
   clubes.js - Clubes y membresías (S2-2)
   Responsable: Cris - Backend de funcionalidades sociales

   Cada función recibe (baseDatos, me, datos) y devuelve
   { ok, error?, datos?, codigo? }. La persistencia y la traducción al
   formato de api.js las hace server.js.
   ===================================================================== */

// --- Utilidades locales (sin dependencias con otros módulos).
const crypto = require('crypto');
const uid = () => crypto.randomBytes(4).toString('hex');
const limpio = (s, n) => String(s || '').trim().slice(0, n);

// Categorías permitidas: son las mismas que usa el Frontend (ui.js) con la
// misma grafía y mayúsculas, porque el filtro de la interfaz compara el texto
// exacto. Cualquier valor fuera de la lista se normaliza a 'Otro'.
const CATS = ['Lectura', 'Fotografía', 'Manualidades', 'Videojuegos', 'Deportes', 'Otro'];

/**
 * Crea un club y a su creador como primer miembro.
 *
 * Estructura de datos: baseDatos.clubes es un ARREGLO de objetos
 * { id, nombre, categoria, descripcion, miembros, creador }.
 *   - "miembros" es un ARREGLO de ids de usuario dentro del propio club
 *     (lista denormalizada): la pregunta "¿es miembro?" se resuelve en O(n)
 *     recorriendo un solo club, sin cruzar amistadas ni leer otro archivo;
 *     es la consulta que más se repite (publicar, tablón, unirse/salir).
 *   - "creador" queda aparte de "miembros" para poder mostrar la etiqueta
 *     "Creador" aunque más tarde abandone el club.
 *   - Los ids de usuario son strings (el nombre de usuario), igual que en
 *     usuarios.json, así no hay que convertir nada al cruzar datos.
 */
function crearClub(baseDatos, me, datos) {
    const nombre = limpio(datos.nombre, 60);
    if (!nombre) {
        return { ok: false, error: 'El club necesita un nombre.', codigo: 400 };
    }
    const club = {
        id: uid(),
        nombre,
        categoria: CATS.includes(datos.categoria) ? datos.categoria : 'Otro',
        descripcion: limpio(datos.descripcion, 140), // límite del Frontend: 140
        miembros: [me],
        creador: me
    };
    baseDatos.clubes.push(club);
    return { ok: true, datos: club };
}

/**
 * Alterna la membresía: une al usuario si no está y lo saca si está.
 *
 * Excepción (regla del Sprint): el CREADOR no puede abandonar su club,
 * así que se devuelve { ok:false, error: 'El creador no puede abandonar
 * su club.' } y no se toca "miembros". La interfaz muestra ese mensaje
 * en el toast de error.
 *
 * Misma estructura que crearClub(): se reemplaza "miembros" con un arreglo
 * nuevo (filter o spread) en lugar de mutarlo con push/splice, porque así
 * nunca queda un miembro duplicado ni un hueco raro si la operación se
 * repite; el arreglo siempre se reconstruye desde cero.
 */
function toggleClub(baseDatos, me, datos) {
    const club = baseDatos.clubes.find(c => c.id === datos.id);
    if (!club) {
        return { ok: false, error: 'Club inexistente.', codigo: 400 };
    }
    // El creador responde por el club: si pudiera salir quedaría sin dueño
    // (la etiqueta "Creador" apuntaría a alguien fuera del club) y hoy no
    // existe forma de pasarle la creación a otro miembro. Solo se bloquea
    // la SALIDA: si el creador ya no es miembro, puede volver a unirse.
    if (club.creador === me && club.miembros.includes(me)) {
        return { ok: false, error: 'El creador no puede abandonar su club.', codigo: 400 };
    }
    club.miembros = club.miembros.includes(me)
        ? club.miembros.filter(m => m !== me)
        : [...club.miembros, me];
    return { ok: true, datos: { id: club.id, miembros: club.miembros } };
}

module.exports = { crearClub, toggleClub };
