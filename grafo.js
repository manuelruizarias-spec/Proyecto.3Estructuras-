/* =====================================================================
   grafo.js - Grafo de relaciones y lista de adyacencia (S3-1)
   Responsable: Cris - Backend de funcionalidades sociales

   construir(baseDatos) no valida ni muta nada: solo lee y arma la
   representación. Devuelve { ok, datos } (o { ok:false, error, codigo }).
   ===================================================================== */

/**
 * Construye el grafo de relaciones a partir de amistades.json y clubes.json.
 *
 * Estructura de datos: el formato es EXACTAMENTE el que consume
 * datosGrafo() en public/js/vistas.js, para que la vista pueda pasar a
 * leer /api/grafo sin cambiar su lógica (hoy la calcula en el navegador
 * con /api/estado):
 *
 *   - nodos: [{ id: 'u:<usuario>' | 'c:<club>', etiqueta, tipo: 'u' | 'c' }]
 *     "tipo" es UNA letra porque así lo pinta vistaGrafo(): 'u' dibuja un
 *     círculo y 'c' un cuadrado. El prefijo 'u:'/'c:' evita colisiones de
 *     id entre usuarios y clubes (los dos usan ids cortos). La etiqueta
 *     del usuario es solo la PRIMERA palabra del nombre
 *     (u.nombre.split(' ')[0]), igual que en datosGrafo(): en el grafo el
 *     texto largo taparía las líneas; el club usa el nombre completo.
 *
 *   - aristas: [{ a, b, t: 'f' | 'm' }]
 *     Aristas NO dirigidas (a y b son intercambiables). La letra "t" es
 *     'f' de amistad (friend) o 'm' de pertenencia a club (member): las
 *     mismas letras que compara vistaGrafo() para pintar y filtrar
 *     (e.t === 'f').
 *
 *   - lista_adyacencia: { '<idNodo>': [{ vecino, t }] }
 *     Índice nodo → vecinos, la representación clásica de un grafo:
 *     responder "¿con quién conecta este nodo?" cuesta O(vecinos) en lugar
 *     de O(aristas). Cada vecino repite la letra "t" de la arista para que
 *     se pueda filtrar sin volver a recorrer aristas.
 *
 * Reglas de contenido (las mismas que datosGrafo()):
 *   - solo las amistades en estado 'aceptada' generan arista;
 *   - solo los miembros que existen como usuario generan arista: un id
 *     huérfano en clubes.json no tendría nodo y dej entradas indefinidas
 *     en la lista de adyacencia;
 *   - las amistades se deduplican por pareja (amistades.json guarda un
 *     registro por pareja, pero así no se duplica la línea si en el
 *     archivo hubiera la relación en los dos sentidos).
 */
function construir(baseDatos) {
    const usuarios = new Set(baseDatos.usuarios.map(u => u.id)); // ¿existe el usuario?

    const nodos = [];
    baseDatos.usuarios.forEach(u => nodos.push({ id: 'u:' + u.id, etiqueta: u.nombre.split(' ')[0], tipo: 'u' }));
    baseDatos.clubes.forEach(c => nodos.push({ id: 'c:' + c.id, etiqueta: c.nombre, tipo: 'c' }));

    const aristas = [];
    const vistas = new Set();

    baseDatos.amistades.filter(a => a.estado === 'aceptada').forEach(a => {
        if (!usuarios.has(a.de) || !usuarios.has(a.a)) return; // sin nodo no hay arista
        const clave = ['u:' + a.de, 'u:' + a.a].sort().join('|');
        if (vistas.has(clave)) return;
        vistas.add(clave);
        aristas.push({ a: 'u:' + a.de, b: 'u:' + a.a, t: 'f' });
    });

    baseDatos.clubes.forEach(c => c.miembros.forEach(m => {
        if (!usuarios.has(m)) return; // miembro sin usuario: no se dibuja
        aristas.push({ a: 'u:' + m, b: 'c:' + c.id, t: 'm' });
    }));

    const lista_adyacencia = {};
    nodos.forEach(n => { lista_adyacencia[n.id] = []; });
    aristas.forEach(e => {
        lista_adyacencia[e.a].push({ vecino: e.b, t: e.t });
        lista_adyacencia[e.b].push({ vecino: e.a, t: e.t });
    });

    return { ok: true, datos: { nodos, aristas, lista_adyacencia } };
}

module.exports = { construir };
