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

// Límites de texto: los mismos que impone el Frontend (inputs con
// maxlength). Se comprueban aquí porque el Frontend se puede saltar o no
// ser el único cliente del servidor.
const MAX_NOMBRE = 60, MAX_DESCRIPCION = 140;

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
    // 1) Tipo: el nombre debe ser TEXTO. En JSON puede llegar cualquier
    //    cosa ("nombre": 123, null, un objeto) y eso no es un nombre.
    if (typeof datos.nombre !== 'string') {
        return { ok: false, error: 'Nombre inválido.', codigo: 400 };
    }
    // 2) Vacío y 3) largo máximo, medidos sobre el valor ya recortado,
    //    igual que lo que quedará guardado.
    const nombre = datos.nombre.trim();
    if (!nombre) {
        return { ok: false, error: 'El club necesita un nombre.', codigo: 400 };
    }
    if (nombre.length > MAX_NOMBRE) {
        return { ok: false, error: `El nombre no puede superar los ${MAX_NOMBRE} caracteres.`, codigo: 400 };
    }
    // Campos opcionales: si vienen deben ser texto; la categoría además se
    // normaliza a 'Otro' si no está en la lista (así siempre se puede filtrar).
    if (datos.categoria !== undefined && datos.categoria !== null && typeof datos.categoria !== 'string') {
        return { ok: false, error: 'Categoría inválida.', codigo: 400 };
    }
    if (datos.descripcion !== undefined && datos.descripcion !== null && typeof datos.descripcion !== 'string') {
        return { ok: false, error: 'Descripción inválida.', codigo: 400 };
    }
    const descripcion = typeof datos.descripcion === 'string' ? datos.descripcion.trim() : '';
    if (descripcion.length > MAX_DESCRIPCION) {
        return { ok: false, error: `La descripción no puede superar los ${MAX_DESCRIPCION} caracteres.`, codigo: 400 };
    }
    const club = {
        id: uid(),
        nombre,
        categoria: CATS.includes(datos.categoria) ? datos.categoria : 'Otro',
        descripcion,
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
    // Id: debe ser TEXTO no vacío y el club debe EXISTIR. Un id de otro
    // tipo (número, null) nunca coincide con ningún club, así que se
    // responde con el mismo motivo que cuando el club no está.
    if (typeof datos.id !== 'string' || !datos.id) {
        return { ok: false, error: 'Club inexistente.', codigo: 400 };
    }
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
