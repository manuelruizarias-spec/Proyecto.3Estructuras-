/* =====================================================================
   grafo.js - Lista de adyacencia / grafo de relaciones (S3-1)
   Responsable: Cris - Backend de funcionalidades sociales

   construir(baseDatos) no valida ni muta nada: solo lee y arma la
   representación. Devuelve { ok, datos } (o { ok:false, error, codigo }).
   ===================================================================== */

/**
 * Construye el grafo de relaciones a partir de amistades.json y clubes.json.
 *
 * Estructura de datos: se devuelven tres vistas del MISMO grafo, porque
 * cada consumidor recorre la información de forma distinta:
 *
 *   - nodos: [{ id: 'u:<usuario>' | 'c:<club>', etiqueta, tipo }]
 *     Arreglo para pintar: el Frontend lo recorre una sola vez para crear
 *     los círculos. El prefijo 'u:'/'c:' evita colisiones de id entre
 *     usuarios y clubes (los dos usan ids cortos).
 *   - aristas: [{ a, b, tipo: 'amistad' | 'pertenencia' }]
 *     Arreglo de aristas NO dirigidas (a y b son intercambiables) para
 *     dibujar las líneas. "tipo" permite filtrar amistades vs clubes sin
 *     recalcular nada.
 *   - lista_adyacencia: { '<idNodo>': [{ vecino, tipo }] }
 *     Índice objeto → lista de vecinos, la representación clásica de un
 *     grafo: responder "¿con quién conecta este nodo?" es O(vecinos) en
 *     lugar de O(aristas), que es lo que necesita la vista de lista de
 *     adyacencia y el resaltado de vecinos al seleccionar un nodo.
 *
 * Deduplicado: las amistades se guardan con un registro por pareja, pero
 * aquí se usa un Set por si en amistades.json existiera la relación en los
 * dos sentidos; así nunca salen dos aristas para la misma pareja. Las
 * pertenencias no se deduplican porque "miembros" no admite duplicados.
 */
function construir(baseDatos) {
    const nodos = [];
    baseDatos.usuarios.forEach(u => nodos.push({ id: 'u:' + u.id, etiqueta: u.nombre, tipo: 'usuario' }));
    baseDatos.clubes.forEach(c => nodos.push({ id: 'c:' + c.id, etiqueta: c.nombre, tipo: 'club' }));

    const aristas = [];
    const vistas = new Set();

    baseDatos.amistades.filter(a => a.estado === 'aceptada').forEach(a => {
        const clave = ['u:' + a.de, 'u:' + a.a].sort().join('|');
        if (vistas.has(clave)) return;
        vistas.add(clave);
        aristas.push({ a: 'u:' + a.de, b: 'u:' + a.a, tipo: 'amistad' });
    });

    baseDatos.clubes.forEach(c => c.miembros.forEach(m => {
        aristas.push({ a: 'u:' + m, b: 'c:' + c.id, tipo: 'pertenencia' });
    }));

    const lista_adyacencia = {};
    nodos.forEach(n => { lista_adyacencia[n.id] = []; });
    aristas.forEach(e => {
        lista_adyacencia[e.a].push({ vecino: e.b, tipo: e.tipo });
        lista_adyacencia[e.b].push({ vecino: e.a, tipo: e.tipo });
    });

    return { ok: true, datos: { nodos, aristas, lista_adyacencia } };
}

module.exports = { construir };
