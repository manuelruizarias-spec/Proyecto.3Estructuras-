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

/**
 * Rechaza una solicitud pendiente: la elimina. Solo puede hacerlo el
 * receptor (quien la recibió).
 *
 * Misma estructura que aceptar(): se localiza el registro que va de "de"
 * hacia "me". La diferencia es que aquí el registro se BORRA del arreglo
 * (splice) en vez de actualizarse: una solicitud rechazada no deja rastro
 * (igual que la que retira el emisor), así no queda un estado 'rechazada'
 * que la interfaz tendría que filtrar y explicar.
 *
 * El permiso está en la búsqueda: "x.a === me" significa que solo quien
 * RECIBE la solicitud puede rechazarla. Si el registro viene en el otro
 * sentido (yo fui quien la envié), no se encuentra y se responde con el
 * motivo en español en lugar de borrar algo que no me pertenece.
 */
function rechazar(baseDatos, me, datos) {
    const i = baseDatos.amistades.findIndex(x => x.de === datos.de && x.a === me);
    if (i < 0) {
        // ¿Existe en el sentido contrario? Entonces yo soy el emisor.
        const contraria = baseDatos.amistades.find(x => x.de === me && x.a === datos.de);
        if (contraria) {
            return { ok: false, error: 'Solo el receptor puede rechazar la solicitud.', codigo: 400 };
        }
        return { ok: false, error: 'No hay solicitud pendiente.', codigo: 400 };
    }
    const solicitud = baseDatos.amistades[i];
    if (solicitud.estado !== 'pendiente') {
        return { ok: false, error: 'No hay solicitud pendiente.', codigo: 400 };
    }
    baseDatos.amistades.splice(i, 1); // se elimina la solicitud del arreglo
    return { ok: true, datos: solicitud };
}

/**
 * Cancela una solicitud pendiente: el EMISOR la retira antes de que le
 * respondan. Es el espejo exacto de rechazar().
 *
 * Estructura: mismo registro { de, a, estado, fecha }, pero la búsqueda es
 * "x.de === me": solo quien la envió puede retirarla. Se borra con splice
 * por el mismo motivo que en rechazar(): al desaparecer la solicitud, el
 * Frontend vuelve a ofrecer el botón "Agregar" como si nunca hubiera
 * pasado nada (relacion() ya no encuentra registro).
 */
function cancelar(baseDatos, me, datos) {
    const i = baseDatos.amistades.findIndex(x => x.de === me && x.a === datos.a);
    if (i < 0) {
        // ¿Existe en el sentido contrario? Entonces yo soy el receptor.
        const contraria = baseDatos.amistades.find(x => x.de === datos.a && x.a === me);
        if (contraria) {
            return { ok: false, error: 'Solo el emisor puede cancelar la solicitud.', codigo: 400 };
        }
        return { ok: false, error: 'No hay solicitud pendiente.', codigo: 400 };
    }
    const solicitud = baseDatos.amistades[i];
    if (solicitud.estado !== 'pendiente') {
        return { ok: false, error: 'No hay solicitud pendiente.', codigo: 400 };
    }
    baseDatos.amistades.splice(i, 1); // se elimina la solicitud del arreglo
    return { ok: true, datos: solicitud };
}

module.exports = { solicitar, aceptar, rechazar, cancelar };
