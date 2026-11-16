// UNA Connect - servidor sin dependencias externas. Persiste en data/*.json
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const PORT = process.env.PORT || 3000;
const DIR = path.join(__dirname, 'data'), PUB = path.join(__dirname, 'public');
const K = ['usuarios', 'clubes', 'publicaciones', 'amistades'];
const CATS = ['Lectura', 'Fotografía', 'Manualidades', 'Videojuegos', 'Deportes', 'Otro'];

// ---- Persistencia: carga al iniciar, guarda tras cada cambio (escritura atómica)
const DB = {};
fs.mkdirSync(DIR, { recursive: true });
for (const k of K) {
    const f = path.join(DIR, k + '.json');
    try { DB[k] = JSON.parse(fs.readFileSync(f, 'utf8')); }
    catch { DB[k] = []; fs.writeFileSync(f, '[]'); }
}
function guardar() {
    for (const k of K) {
        const f = path.join(DIR, k + '.json');
        fs.writeFileSync(f + '.tmp', JSON.stringify(DB[k], null, 2));
        fs.renameSync(f + '.tmp', f);
    }
}

// ---- Contraseñas (scrypt con sal) y sesiones en memoria
const hash = (p, s = crypto.randomBytes(16).toString('hex')) => s + ':' + crypto.scryptSync(p, s, 32).toString('hex');
const verificar = (p, h) => { const a = Buffer.from(hash(p, h.split(':')[0])), b = Buffer.from(h); return a.length === b.length && crypto.timingSafeEqual(a, b); };
const sesiones = new Map();
const nuevaSesion = id => { const t = crypto.randomBytes(24).toString('hex'); sesiones.set(t, id); return { token: t, id }; };

// ---- Helpers de dominio
const U = id => DB.usuarios.find(u => u.id === id);
const C = id => DB.clubes.find(c => c.id === id);
const rel = (a, b) => DB.amistades.find(x => (x.de === a && x.a === b) || (x.de === b && x.a === a));
const uid = () => crypto.randomBytes(4).toString('hex');
const limpio = (s, n) => String(s || '').trim().slice(0, n);
const estado = () => ({
    usuarios: DB.usuarios.map(({ id, nombre, usuario }) => ({ id, nombre, usuario })),
    clubes: DB.clubes, publicaciones: DB.publicaciones, amistades: DB.amistades
});

function accion(me, b) {
    switch (b.tipo) {
        case 'publicar': {
            const texto = limpio(b.texto, 500); if (!texto) return 'Escribe algo antes de publicar.';
            if (b.clubId) { const c = C(b.clubId); if (!c || !c.miembros.includes(me)) return 'Debes ser miembro del club.'; }
            DB.publicaciones.unshift({ id: uid(), autor: me, clubId: b.clubId || null, texto, fecha: Date.now() }); break;
        }
        case 'solicitar':
            if (b.a === me || !U(b.a)) return 'Usuario inválido.';
            if (rel(me, b.a)) return 'Ya existe una solicitud o amistad.';
            DB.amistades.push({ de: me, a: b.a, estado: 'pendiente' }); break;
        case 'aceptar': {
            const r = DB.amistades.find(x => x.de === b.de && x.a === me && x.estado === 'pendiente');
            if (!r) return 'No hay solicitud pendiente.'; r.estado = 'aceptada'; break;
        }
        case 'crear-club': {
            const nombre = limpio(b.nombre, 60); if (!nombre) return 'El club necesita un nombre.';
            DB.clubes.push({ id: uid(), nombre, categoria: CATS.includes(b.categoria) ? b.categoria : 'Otro', descripcion: limpio(b.descripcion, 140), miembros: [me], creador: me }); break;
        }
        case 'toggle-club': {
            const c = C(b.id); if (!c) return 'Club inexistente.';
            c.miembros = c.miembros.includes(me) ? c.miembros.filter(m => m !== me) : [...c.miembros, me]; break;
        }
        default: return 'Acción desconocida.';
    }
    guardar(); return null;
}

function seed() {
    if (DB.usuarios.length) return 'Ya hay datos; vacía los archivos de data/ para recargar el ejemplo.';
    const h = hash('1234');
    DB.usuarios = ['Ana', 'Luis', 'Marta', 'Diego'].map(n => ({ id: n.toLowerCase(), nombre: n, usuario: n.toLowerCase(), hash: h }));
    DB.amistades = [{ de: 'ana', a: 'luis', estado: 'aceptada' }, { de: 'marta', a: 'ana', estado: 'aceptada' }, { de: 'diego', a: 'luis', estado: 'pendiente' }];
    DB.clubes = [
        { id: 'c1', nombre: 'Club de Lectura', categoria: 'Lectura', descripcion: 'Un libro al mes', miembros: ['ana', 'marta'], creador: 'ana' },
        { id: 'c2', nombre: 'FotoUNA', categoria: 'Fotografía', descripcion: 'Salidas fotográficas por el campus', miembros: ['luis', 'ana'], creador: 'luis' },
        { id: 'c3', nombre: 'Gamers UNA', categoria: 'Videojuegos', descripcion: 'Torneos y noches de juegos', miembros: ['diego', 'luis'], creador: 'diego' }];
    const t = Date.now();
    DB.publicaciones = [
        { id: uid(), autor: 'ana', clubId: null, texto: '¡Bienvenidos a UNA Connect!', fecha: t - 7200000 },
        { id: uid(), autor: 'luis', clubId: null, texto: '¿Quién va a la feria de clubes?', fecha: t - 3600000 },
        { id: uid(), autor: 'marta', clubId: 'c1', texto: 'Este mes leemos Cien años de soledad.', fecha: t - 1800000 }];
    guardar(); return null;
}

// ---- Servidor HTTP
const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); };
http.createServer((req, res) => {
    if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
        return fs.readFile(path.join(PUB, 'index.html'), (e, d) => {
            if (e) return json(res, 500, { error: 'Falta public/index.html' });
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(d);
        });
    }
    if (!req.url.startsWith('/api/')) return json(res, 404, { error: 'No encontrado' });
    let raw = '';
    req.on('data', c => { raw += c; if (raw.length > 1e5) req.destroy(); });
    req.on('end', () => {
        let b = {}; try { b = raw ? JSON.parse(raw) : {}; } catch { return json(res, 400, { error: 'JSON inválido' }); }
        const url = req.url;
        if (url === '/api/seed') { const e = seed(); return e ? json(res, 400, { error: e }) : json(res, 200, { ok: true }); }
        if (url === '/api/registro') {
            const nombre = limpio(b.nombre, 60), usuario = limpio(b.usuario, 30).toLowerCase(), pass = String(b.pass || '');
            if (!nombre || usuario.length < 3 || pass.length < 4) return json(res, 400, { error: 'Completa los datos (usuario mín. 3, contraseña mín. 4).' });
            if (!/^[a-z0-9_.-]+$/.test(usuario)) return json(res, 400, { error: 'Usuario: solo letras, números, punto, guion y guion bajo.' });
            if (DB.usuarios.some(u => u.usuario === usuario)) return json(res, 400, { error: 'Ese usuario ya existe.' });
            DB.usuarios.push({ id: usuario, nombre, usuario, hash: hash(pass) }); guardar();
            return json(res, 200, nuevaSesion(usuario));
        }
        if (url === '/api/login') {
            const u = DB.usuarios.find(x => x.usuario === limpio(b.usuario, 30).toLowerCase());
            if (!u || !verificar(String(b.pass || ''), u.hash)) return json(res, 401, { error: 'Credenciales incorrectas.' });
            return json(res, 200, nuevaSesion(u.id));
        }
        const me = sesiones.get((req.headers.authorization || '').replace('Bearer ', ''));
        if (!me) return json(res, 401, { error: 'Sesión no válida.' });
        if (url === '/api/estado') return json(res, 200, estado());
        if (url === '/api/accion') { const e = accion(me, b); return e ? json(res, 400, { error: e }) : json(res, 200, { ok: true }); }
        json(res, 404, { error: 'No encontrado' });
    });
}).listen(PORT, () => console.log(`UNA Connect en http://localhost:${PORT}`));