// UNA Connect - servidor completo y unificado.
// Usa módulos de auditoria para auth, y persiste en data/*.json.

const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const { registrarUsuario } = require('./auditoria/registro');
const { iniciarSesion } = require('./auditoria/login');
const { protegerContrasena } = require('./auditoria/seguridad');
const amistades = require('./amistades');
const publicaciones = require('./publicaciones');
const clubes = require('./clubes');
const grafo = require('./grafo');

const PORT = process.env.PORT || 3000;
const DIR = path.join(__dirname, 'data'), PUB = path.join(__dirname, 'public');
const K = ['usuarios', 'clubes', 'publicaciones', 'amistades'];

// ---- Persistencia: carga al iniciar, guarda tras cada cambio (escritura atómica)
const DB = {};
fs.mkdirSync(DIR, { recursive: true });
for (const k of K) {
    const f = path.join(DIR, k + '.json');
    try { DB[k] = JSON.parse(fs.readFileSync(f, 'utf8')); }
    catch { DB[k] = []; fs.writeFileSync(f, '[]'); }
}

// Último error de persistencia. Lo necesitan las rutas cuyo módulo llama a
// guardar() sin poder recoger su resultado (registro desde auditoria/ y
// seed()): aquí queda el motivo en español para responderle al cliente.
let errorGuardado = null;

// Escritura atómica en dos fases: primero se escriben TODOS los .tmp y luego
// se renombran todos. Si algo falla en medio, se borran los temporales y no se
// renombra ninguno: una operación fallida no daña los datos ya guardados.
function guardar() {
    errorGuardado = null;
    const temporales = [];
    try {
        for (const k of K) {
            const f = path.join(DIR, k + '.json');
            fs.writeFileSync(f + '.tmp', JSON.stringify(DB[k], null, 2));
            temporales.push(f);
        }
        for (const f of temporales) fs.renameSync(f + '.tmp', f);
        return null;
    } catch (e) {
        // Limpieza de temporales; el detalle real solo va al log del servidor.
        for (const f of temporales) { try { fs.unlinkSync(f + '.tmp'); } catch { /* ya no estaba */ } }
        console.error('No se pudieron guardar los datos:', e && e.message);
        errorGuardado = 'No se pudieron guardar los datos. Inténtalo de nuevo.';
        return errorGuardado;
    }
}

// ---- Sesiones en memoria
const sesiones = new Map();
const nuevaSesion = id => { 
    const t = crypto.randomBytes(24).toString('hex'); 
    sesiones.set(t, id); 
    return { token: t, id }; 
};

// ---- Helper de dominio: lo usa seed() para crear ids de ejemplo.
// (U, C, rel, limpio y CATS se movieron a los módulos que los usan.)
const uid = () => crypto.randomBytes(4).toString('hex');

// Lo que ve el Frontend por /api/estado. Sin la identificación (cédula): la
// interfaz no la muestra y no hace falta exponerla a todos los usuarios.
const estado = () => ({
    usuarios: DB.usuarios.map(({ id, nombre, usuario }) => ({ id, nombre, usuario })),
    clubes: DB.clubes, 
    publicaciones: DB.publicaciones, 
    amistades: DB.amistades
});

// ---- Acciones sociales (Cris): server.js no guarda lógica de negocio.
// Cada "tipo" se resuelve en su módulo y aquí solo se traduce la respuesta
// { ok, error?, codigo? } al formato de api.js: en fallo { error } con su
// código (400 por defecto) y en éxito { ok: true }.
const ACCIONES = {
    'solicitar': amistades.solicitar,
    'aceptar': amistades.aceptar,
    'rechazar': amistades.rechazar,   // receptor elimina la solicitud pendiente
    'cancelar': amistades.cancelar,   // emisor la retira
    'publicar': publicaciones.publicar,
    'crear-club': clubes.crearClub,
    'toggle-club': clubes.toggleClub
};

// ---- Grafo: la construcción de la lista de adyacencia vive en grafo.js (S3-1);
// aquí server.js solo lo pide y traduce su respuesta.

// ---- Datos semilla
// Solo se siembra si data/usuarios.json está vacío (y la memoria también):
// nunca se pisan usuarios reales ni el resto de los datos ya guardados.
function seed() {
    let enDisco;
    try { enDisco = JSON.parse(fs.readFileSync(path.join(DIR, 'usuarios.json'), 'utf8')); }
    catch { enDisco = []; } // archivo ausente o ilegible: se trata como vacío
    if (!Array.isArray(enDisco)) return 'data/usuarios.json no tiene un formato válido; revísalo antes de sembrar.';
    if (enDisco.length || DB.usuarios.length) return 'Ya hay datos en data/usuarios.json; vacía ese archivo para recargar el ejemplo.';
    const h = protegerContrasena('1234');
    DB.usuarios = ['Ana', 'Luis', 'Marta', 'Diego'].map((n, i) => ({ 
        id: n.toLowerCase(), 
        identificacion: '11823000' + (i + 1),
        nombre: n, 
        usuario: n.toLowerCase(), 
        hash: h 
    }));
    
    const t0 = Date.now();
    DB.amistades = [
        { de: 'ana', a: 'luis', estado: 'aceptada', fecha: t0 - 7200000 }, 
        { de: 'marta', a: 'ana', estado: 'aceptada', fecha: t0 - 3600000 }, 
        { de: 'diego', a: 'luis', estado: 'pendiente', fecha: t0 - 1800000 }
    ];
    
    DB.clubes = [
        { id: 'c1', nombre: 'Club de Lectura', categoria: 'Lectura', descripcion: 'Un libro al mes', miembros: ['ana', 'marta'], creador: 'ana' },
        { id: 'c2', nombre: 'FotoUNA', categoria: 'Fotografía', descripcion: 'Salidas fotográficas por el campus', miembros: ['luis', 'ana'], creador: 'luis' },
        { id: 'c3', nombre: 'Gamers UNA', categoria: 'Videojuegos', descripcion: 'Torneos y noches de juegos', miembros: ['diego', 'luis'], creador: 'diego' }
    ];
    
    const t = Date.now();
    DB.publicaciones = [
        { id: uid(), autor: 'ana', clubId: null, texto: '¡Bienvenidos a UNA Connect!', fecha: t - 7200000 },
        { id: uid(), autor: 'luis', clubId: null, texto: '¿Quién va a la feria de clubes?', fecha: t - 3600000 },
        { id: uid(), autor: 'marta', clubId: 'c1', texto: 'Este mes leemos Cien años de soledad.', fecha: t - 1800000 }
    ];
    
    guardar(); 
    return null;
}

// ---- Servidor HTTP
const json = (res, code, obj) => { 
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); 
    res.end(JSON.stringify(obj)); 
};

// ---- Archivos estáticos: se sirve TODO lo que esté dentro de public/ (cualquier
// subruta). Fuera de public/ no se lee nada: así server.js, data/ y auditoria/
// quedan inaccesibles por HTTP, porque su ruta resuelta cae fuera de la base.
const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.txt': 'text/plain; charset=utf-8'
};

// Devuelve true si la petición quedó atendida (con error incluido) y false
// si el método no corresponde a un archivo estático.
function estatico(req, res, url) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return false;

    const ruta = url.split('?')[0].split('#')[0];
    let decodificada;
    try { decodificada = decodeURIComponent(ruta); }
    catch { json(res, 400, { error: 'Ruta no válida.' }); return true; }

    // La raíz y /index.html sirven la página principal
    const relativa = (decodificada === '/' || decodificada === '/index.html')
        ? 'index.html'
        : decodificada.replace(/^\/+/, '');

    // Bloqueo de traversal: sin segmentos "." ni "..", sin bytes nulos y sin
    // rutas absolutas (también atrapa lo codificado como %2e%2e o %2f).
    const segmentos = relativa.split('/');
    if (!relativa || path.isAbsolute(relativa) || relativa.includes('\0') ||
        segmentos.some(s => s === '.' || s === '..')) {
        json(res, 403, { error: 'Ruta no permitida.' });
        return true;
    }

    // Defensa doble: aunque pase lo anterior, la ruta resolvida debe seguir
    // dentro de public/ (resuelve ataques con separadores o símbolos raros).
    const base = path.resolve(PUB);
    const absoluto = path.resolve(base, segmentos.join('/'));
    if (absoluto !== base && !absoluto.startsWith(base + path.sep)) {
        json(res, 403, { error: 'Ruta no permitida.' });
        return true;
    }

    fs.readFile(absoluto, (e, d) => {
        if (e) return json(res, 404, { error: 'No encontrado.' }); // directorios y ausentes
        const tipo = MIME[path.extname(absoluto).toLowerCase()] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': tipo, 'X-Content-Type-Options': 'nosniff' });
        res.end(req.method === 'HEAD' ? undefined : d);
    });
    return true;
}

http.createServer((req, res) => {
    // Todo lo que no sea /api/ se resuelve como archivo estático dentro de public/
    if (!req.url.startsWith('/api/')) {
        if (estatico(req, res, req.url)) return;
        return json(res, 405, { error: 'Método no permitido.' });
    }

    let raw = '';
    req.on('data', c => { raw += c; if (raw.length > 1e5) req.destroy(); });
    req.on('end', () => {
        let b = {}; 
        try { b = raw ? JSON.parse(raw) : {}; } 
        catch { return json(res, 400, { error: 'JSON inválido' }); }
        
        const url = req.url;
        errorGuardado = null; // estado limpio de guardado para esta petición
        
        if (url === '/api/seed') { 
            const e = seed() || errorGuardado; 
            return e ? json(res, 400, { error: e }) : json(res, 200, { ok: true }); 
        }
        
        if (url === '/api/registro') {
            const r = registrarUsuario(DB, b, guardar);
            if (r.error) return json(res, r.codigo || 400, { error: r.error });
            if (errorGuardado) return json(res, 500, { error: errorGuardado });
            const ses = nuevaSesion(r.usuario.id);
            return json(res, 200, ses);
        }
        
        if (url === '/api/login') {
            const r = iniciarSesion(DB, b);
            if (r.error) return json(res, r.codigo || 400, { error: r.error });
            const ses = nuevaSesion(r.usuario.id);
            return json(res, 200, ses);
        }
        
        const me = sesiones.get((req.headers.authorization || '').replace('Bearer ', ''));
        if (!me) return json(res, 401, { error: 'Sesión no válida.' });
        
        if (url === '/api/estado') return json(res, 200, estado());
        if (url === '/api/accion') {
            const ejecutar = ACCIONES[b.tipo];
            if (!ejecutar) return json(res, 400, { error: 'Acción desconocida.' });
            const r = ejecutar(DB, me, b);            // módulo -> { ok, error?, codigo? }
            if (!r.ok) return json(res, r.codigo || 400, { error: r.error });
            const e = guardar();                      // solo se persiste si la acción fue válida
            if (e) return json(res, 500, { error: e });
            // crear-club informa además el id del club creado, para que la
            // interfaz lo abra directamente sin tener que adivinarlo.
            if (b.tipo === 'crear-club') return json(res, 200, { ok: true, id: r.datos.id });
            return json(res, 200, { ok: true });
        }
        if (url === '/api/grafo') {
            const g = grafo.construir(DB);
            return g.ok ? json(res, 200, g.datos) : json(res, g.codigo || 400, { error: g.error });
        }
        
        json(res, 404, { error: 'No encontrado' });
    });
}).listen(PORT, () => console.log(`UNA Connect en http://localhost:${PORT}`));