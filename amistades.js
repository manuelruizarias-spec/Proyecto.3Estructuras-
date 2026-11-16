/* =====================================================================
   amistades.js - Solicitudes y amistades (S1-3)
   Responsable: Cris - Backend de funcionalidades sociales

   Cada función recibe (baseDatos, me, datos) y devuelve
   { ok, error?, datos?, codigo? }: nada se escribe en disco desde aquí,
   server.js persiste y traduce la respuesta.
   ===================================================================== */

// --- Utilidades locales: cada módulo tiene las suyas para no crear
// dependencias entre módulos ni con server.js.
const existeUsuario = (baseDatos, id) => baseDatos.usuarios.some(u => u.id === id);

// Relación entre dos usuarios en cualquier dirección (una sola vez, sin duplicados).
const relacion = (baseDatos, a, b) =>
    baseDatos.amistades.find(x => (x.de === a && x.a === b) || (x.de === b && x.a === a));

/**
 * Envía una solicitud de amistad.
 *
 * Estructura de datos: baseDatos.amistades es un ARREGLO de objetos
 * { de, a, estado, fecha } donde "de" envía y "a" recibe.
 * Se usa un único registro por pareja con un campo "estado"
 * ('pendiente' | 'aceptada') en lugar de dos listas (enviadas/recibidas):
 * así no puede haber solicitudes duplicadas en ninguna dirección y el
 * Frontend deriva tanto las recibidas como las enviadas con un solo filtro.
 * "fecha" va en milisegundos (Date.now()) para poder ordenar y mostrar
 * "hace 5 min" restando, igual que en las publicaciones.
 */
function solicitar(baseDatos, me, datos) {
    if (datos.a === me || !existeUsuario(baseDatos, datos.a)) {
        return { ok: false, error: 'Usuario inválido.', codigo: 400 };
    }
    if (relacion(baseDatos, me, datos.a)) {
        return { ok: false, error: 'Ya existe una solicitud o amistad.', codigo: 400 };
    }
    const solicitud = { de: me, a: datos.a, estado: 'pendiente', fecha: Date.now() };
    baseDatos.amistades.push(solicitud);
    return { ok: true, datos: solicitud };
}

/**
 * Acepta una solicitud pendiente de otro usuario.
 *
 * Misma estructura que solicitar(): se localiza el registro que va de "de"
 * hacia "me" en estado 'pendiente' y se cambia el estado a 'aceptada' en el
 * MISMO objeto. No se crea una fila nueva ni se borra la original: con un
 * solo registro por pareja, aceptar es una actualización y la relación
 * sigue siendo única (imposible duplicar la amistad).
 */
function aceptar(baseDatos, me, datos) {
    const solicitud = baseDatos.amistades.find(
        x => x.de === datos.de && x.a === me && x.estado === 'pendiente'
    );
    if (!solicitud) {
        return { ok: false, error: 'No hay solicitud pendiente.', codigo: 400 };
    }
    solicitud.estado = 'aceptada';
    solicitud.fecha = Date.now();
    return { ok: true, datos: solicitud };
}

module.exports = { solicitar, aceptar };
