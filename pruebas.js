#!/usr/bin/env node
/* =====================================================================
   pruebas.js - pruebas end-to-end de UNA Connect.

   Solo Node, sin dependencias: usa assert, http, child_process y fs.
   Qué hace:
     1. Copia el código del servidor (server.js, los módulos y
        auditoria/) a una carpeta TEMPORAL del sistema operativo, con su
        data/ vacía: nunca se escribe en data/ del repo.
     2. Busca un puerto libre y arranca node server.js ahí.
     3. Le pega por HTTP y comprueba respuestas, códigos y persistencia.
     4. Al final mata el servidor, borra la carpeta temporal y comprueba
        que los data/*.json del repo siguen intactos (mismo hash).

   Uso:  node pruebas.js      (o: npm test)
   Sale con código 0 si todo pasa y 1 si algo falla.
   ===================================================================== */

'use strict';

const assert = require('assert');
const { spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');

const RAIZ = __dirname;                    // raíz del repo (donde está server.js)
const CLAVE = 'clave-de-prueba-1234';      // contraseña que usan todas las pruebas

// --------------------------------------------------------------- utilidades
const dormir = ms => new Promise(r => setTimeout(r, ms));

// Puerto libre: se abre un servidor temporal en el puerto 0 y se cierra;
// el sistema nos devuelve el puerto que quedó reservado para nosotros.
function puertoLibre() {
    return new Promise((resolve, reject) => {
        const s = net.createServer();
        s.on('error', reject);
        s.listen(0, '127.0.0.1', () => {
            const p = s.address().port;
            s.close(() => resolve(p));
        });
    });
}

// Petición HTTP simple. Devuelve { codigo, json, bruto }.
function pedir(puerto, ruta, { cuerpo, token } = {}) {
    return new Promise((resolve, reject) => {
        const datos = cuerpo === undefined ? '' : JSON.stringify(cuerpo);
        const cabeceras = { 'Content-Type': 'application/json' };
        if (token) cabeceras.Authorization = 'Bearer ' + token;
        const req = http.request({
            host: '127.0.0.1', port: puerto, path: ruta, method: 'POST', headers: cabeceras
        }, res => {
            let bruto = '';
            res.on('data', c => { bruto += c; });
            res.on('end', () => {
                let json = null;
                try { json = JSON.parse(bruto); } catch { json = null; }
                resolve({ codigo: res.statusCode, json, bruto });
            });
        });
        req.on('error', reject);
        if (datos) req.write(datos);
        req.end();
    });
}

// Carpeta temporal con el código del servidor y data/ vacía.
// (El server.js usa __dirname/data, así que copiar el código basta para
//  que todo lo que se guarde caiga en la carpeta temporal.)
function prepararCopia() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'una-pruebas-'));
    for (const archivo of ['server.js', 'amistades.js', 'publicaciones.js', 'clubes.js', 'grafo.js']) {
        fs.copyFileSync(path.join(RAIZ, archivo), path.join(dir, archivo));
    }
    fs.cpSync(path.join(RAIZ, 'auditoria'), path.join(dir, 'auditoria'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'data'), { recursive: true }); // vacía: nunca data/ del repo
    return dir;
}

// Arranca server.js en dir escuchando en puerto. Espera hasta que responda.
async function arrancar(dir, puerto) {
    const hijo = spawn(process.execPath, ['server.js'], {
        cwd: dir,
        env: Object.assign({}, process.env, { PORT: String(puerto) }),
        stdio: ['ignore', 'pipe', 'pipe']
    });
    let salida = '';
    hijo.stdout.on('data', c => { salida += c; });
    hijo.stderr.on('data', c => { salida += c; });

    const limite = Date.now() + 10000;
    for (;;) {
        try {
            await pedir(puerto, '/api/estado', { cuerpo: {} });
            return { hijo, salida: () => salida };
        } catch (e) {
            if (hijo.exitCode !== null) {
                throw new Error('el servidor terminó antes de arrancar:\n' + salida);
            }
            if (Date.now() > limite) {
                hijo.kill('SIGKILL');
                throw new Error('el servidor no respondió en 10 s:\n' + salida);
            }
            await dormir(100);
        }
    }
}

// Detiene el servidor y espera a que muera de verdad.
function detener(hijo) {
    if (!hijo || hijo.exitCode !== null) return Promise.resolve();
    return new Promise(resolve => {
        hijo.once('exit', resolve);
        hijo.kill('SIGTERM');
        const fuerza = setTimeout(() => { if (hijo.exitCode === null) hijo.kill('SIGKILL'); }, 3000);
        if (fuerza.unref) fuerza.unref();
    });
}

// Hash de los data/*.json del repo, para demostrar que no los tocamos.
function huellaDataDelRepo() {
    const dir = path.join(RAIZ, 'data');
    const resultado = {};
    let archivos = [];
    try { archivos = fs.readdirSync(dir).sort(); } catch { return resultado; }
    for (const a of archivos) {
        resultado[a] = crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, a))).digest('hex');
    }
    return resultado;
}

// ----------------------------------------------------------- marco de pruebas
let correctas = 0, fallidas = 0;
const titulo = t => console.log('\n== ' + t + ' ==');
async function prueba(nombre, fn) {
    try {
        await fn();
        correctas++;
        console.log('   ok    ' + nombre);
    } catch (e) {
        fallidas++;
        console.log('   FALLA ' + nombre);
        console.log('          ' + (e && e.message ? e.message.split('\n')[0] : e));
    }
}

// ===================================================================== pruebas
async function main() {
    const repoAntes = huellaDataDelRepo();
    const dir = prepararCopia();
    let hijo = null;

    try {
        // let (no const): al reiniciar el servidor para probar la
        // persistencia puede quedar en otro puerto, y los helpers de
        // abajo (post/acc/estado) leen esta variable.
        let puerto = await puertoLibre();
        const servidor = await arrancar(dir, puerto);
        hijo = servidor.hijo;
        console.log('Servidor de prueba en http://127.0.0.1:' + puerto +
            '  (datos en ' + dir + path.sep + 'data)');

        const post = (ruta, cuerpo, token) => pedir(puerto, ruta, { cuerpo, token });
        const acc = (token, cuerpo) => post('/api/accion', cuerpo, token);
        const estado = async token => (await post('/api/estado', {}, token)).json;

        let TA = null, TL = null, TM = null, TD = null; // tokens de ana, luis, marta, diego

        // ---------------------------------------------------------- registro
        titulo('Registro');
        await prueba('registro válido devuelve token e id', async () => {
            const r = await post('/api/registro', { identificacion: '100000001', nombre: 'Ana Rojas', usuario: 'ana', pass: CLAVE });
            assert.strictEqual(r.codigo, 200, 'código 200, llegó ' + r.codigo);
            assert.ok(r.json.token, 'debe devolver un token');
            assert.strictEqual(r.json.id, 'ana', 'el id debe ser el usuario');
        });

        await prueba('registro inválido: campos vacíos', async () => {
            const sinIdentificacion = await post('/api/registro', {});
            assert.strictEqual(sinIdentificacion.codigo, 400, 'sin identificación -> 400');
            assert.strictEqual(sinIdentificacion.json.error, 'La identificación es obligatoria.');

            const sinNombre = await post('/api/registro', { identificacion: '100000002', nombre: '   ', usuario: 'otro', pass: CLAVE });
            assert.strictEqual(sinNombre.codigo, 400, 'sin nombre -> 400');
            assert.strictEqual(sinNombre.json.error, 'Debe ingresar su nombre completo.');

            const sinClave = await post('/api/registro', { identificacion: '100000003', nombre: 'Otro Alumno', usuario: 'otro2', pass: '' });
            assert.strictEqual(sinClave.codigo, 400, 'sin contraseña -> 400');
            assert.strictEqual(sinClave.json.error, 'La contraseña debe tener entre 4 y 128 caracteres.');
        });

        await prueba('registro inválido: usuario repetido', async () => {
            const r = await post('/api/registro', { identificacion: '100000004', nombre: 'Ana Otra', usuario: 'ana', pass: CLAVE });
            assert.strictEqual(r.codigo, 409, 'código 409, llegó ' + r.codigo);
            assert.strictEqual(r.json.error, 'El nombre de usuario ya está registrado.');
        });

        await prueba('registran los otros 3 usuarios (4 en total)', async () => {
            const otros = [['100000005', 'Luis Pérez', 'luis'], ['100000006', 'Marta Gómez', 'marta'], ['100000007', 'Diego Sol', 'diego']];
            for (const [identificacion, nombre, usuario] of otros) {
                const r = await post('/api/registro', { identificacion, nombre, usuario, pass: CLAVE });
                assert.strictEqual(r.codigo, 200, usuario + ' -> 200, llegó ' + r.codigo);
                assert.strictEqual(r.json.id, usuario);
            }
            const e = await estado('x-token'); // sin token: solo para leer el error
            assert.ok(e === null || e.error, 'sin token no se lee el estado');
        });

        // ------------------------------------------------------------- login
        titulo('Login');
        await prueba('login correcto', async () => {
            const r = await post('/api/login', { usuario: 'ana', pass: CLAVE });
            assert.strictEqual(r.codigo, 200, 'código 200, llegó ' + r.codigo);
            assert.ok(r.json.token, 'debe devolver token');
            TA = r.json.token;
            for (const u of ['luis', 'marta', 'diego']) {
                const x = await post('/api/login', { usuario: u, pass: CLAVE });
                assert.strictEqual(x.codigo, 200, u + ' debe poder entrar');
                if (u === 'luis') TL = x.json.token;
                if (u === 'marta') TM = x.json.token;
                if (u === 'diego') TD = x.json.token;
            }
        });

        await prueba('login incorrecto (contraseña mala)', async () => {
            const r = await post('/api/login', { usuario: 'ana', pass: 'otra-clave' });
            assert.strictEqual(r.codigo, 401, 'código 401, llegó ' + r.codigo);
            assert.strictEqual(r.json.error, 'Credenciales incorrectas.');
        });

        await prueba('login de usuario inexistente', async () => {
            const r = await post('/api/login', { usuario: 'nadie', pass: CLAVE });
            assert.strictEqual(r.codigo, 401, 'código 401, llegó ' + r.codigo);
            assert.strictEqual(r.json.error, 'Credenciales incorrectas.');
        });

        // ------------------------------------------------------ sin sesión
        titulo('Rutas protegidas');
        await prueba('/api/estado sin token responde 401', async () => {
            const r = await post('/api/estado', {});
            assert.strictEqual(r.codigo, 401, 'código 401, llegó ' + r.codigo);
            assert.strictEqual(r.json.error, 'Sesión no válida.');
        });

        await prueba('/api/accion sin token responde 401', async () => {
            const r = await acc(null, { tipo: 'publicar', texto: 'intruso' });
            assert.strictEqual(r.codigo, 401, 'código 401, llegó ' + r.codigo);
            assert.strictEqual(r.json.error, 'Sesión no válida.');
        });

        // ------------------------------------------------------- amistades
        titulo('Solicitudes y amistades');
        await prueba('solicitar y aceptar', async () => {
            const s = await acc(TA, { tipo: 'solicitar', a: 'luis' });
            assert.strictEqual(s.codigo, 200, 'solicitar -> 200, llegó ' + s.codigo);
            const a = await acc(TL, { tipo: 'aceptar', de: 'ana' });
            assert.strictEqual(a.codigo, 200, 'aceptar -> 200, llegó ' + a.codigo);
            const e = await estado(TA);
            const par = e.amistades.find(x => x.de === 'ana' && x.a === 'luis');
            assert.ok(par, 'la relación debe quedar registrada');
            assert.strictEqual(par.estado, 'aceptada', 'debe quedar aceptada');
        });

        await prueba('solicitud duplicada responde 400', async () => {
            const r = await acc(TA, { tipo: 'solicitar', a: 'luis' });
            assert.strictEqual(r.codigo, 400, 'código 400, llegó ' + r.codigo);
            assert.strictEqual(r.json.error, 'Ya existe una solicitud o amistad.');
        });

        await prueba('rechazar: el receptor elimina la solicitud', async () => {
            const s = await acc(TM, { tipo: 'solicitar', a: 'ana' });
            assert.strictEqual(s.codigo, 200, 'marta solicita -> 200, llegó ' + s.codigo);
            const r = await acc(TA, { tipo: 'rechazar', de: 'marta' });
            assert.strictEqual(r.codigo, 200, 'rechazar -> 200, llegó ' + r.codigo);
            const e = await estado(TA);
            assert.ok(!e.amistades.some(x => x.de === 'marta' && x.a === 'ana'), 'la solicitud debe desaparecer');
        });

        await prueba('cancelar: el emisor retira la solicitud', async () => {
            const s = await acc(TA, { tipo: 'solicitar', a: 'diego' });
            assert.strictEqual(s.codigo, 200, 'ana solicita -> 200, llegó ' + s.codigo);
            const otro = await acc(TD, { tipo: 'cancelar', a: 'ana' }); // diego no es el emisor
            assert.strictEqual(otro.codigo, 400, 'quien recibió no puede cancelar');
            assert.strictEqual(otro.json.error, 'Solo el emisor puede cancelar la solicitud.');
            const r = await acc(TA, { tipo: 'cancelar', a: 'diego' });
            assert.strictEqual(r.codigo, 200, 'cancelar -> 200, llegó ' + r.codigo);
            const e = await estado(TA);
            assert.ok(!e.amistades.some(x => x.de === 'ana' && x.a === 'diego'), 'la solicitud debe desaparecer');
        });

        // ----------------------------------------------------------- muro
        titulo('Publicaciones del muro');
        await prueba('publicar y muro ordenado de más reciente a más antiguo', async () => {
            for (const texto of ['Primero', 'Segundo', 'Tercero']) {
                const r = await acc(TA, { tipo: 'publicar', texto });
                assert.strictEqual(r.codigo, 200, texto + ' -> 200, llegó ' + r.codigo);
                await dormir(10); // para que las fechas sean distintas
            }
            const e = await estado(TA);
            const muro = e.publicaciones.filter(p => p.clubId === null);
            assert.deepStrictEqual(muro.map(p => p.texto), ['Tercero', 'Segundo', 'Primero'],
                'el muro debe salir de más reciente a más antiguo');
            for (let i = 1; i < muro.length; i++) {
                assert.ok(muro[i - 1].fecha >= muro[i].fecha, 'las fechas deben ir en orden descendente');
            }
        });

        // ---------------------------------------------------------- clubes
        titulo('Clubes');
        let idClub = null, idClub2 = null;

        await prueba('crear club devuelve el id', async () => {
            const r = await acc(TA, { tipo: 'crear-club', nombre: 'Cine Foro', categoria: 'Otro', descripcion: 'Películas del mes' });
            assert.strictEqual(r.codigo, 200, 'crear-club -> 200, llegó ' + r.codigo);
            assert.strictEqual(r.json.ok, true);
            assert.strictEqual(typeof r.json.id, 'string', 'debe devolver el id como texto');
            assert.ok(r.json.id.length > 0, 'el id no puede venir vacío');
            idClub = r.json.id;
            const e = await estado(TA);
            assert.ok(e.clubes.some(c => c.id === idClub), 'el id debe existir en el estado');
        });

        await prueba('unirse y salir de un club', async () => {
            const entrar = await acc(TL, { tipo: 'toggle-club', id: idClub });
            assert.strictEqual(entrar.codigo, 200, 'unirse -> 200, llegó ' + entrar.codigo);
            let e = await estado(TL);
            assert.ok(e.clubes.find(c => c.id === idClub).miembros.includes('luis'), 'luis debe quedar como miembro');

            const salir = await acc(TL, { tipo: 'toggle-club', id: idClub });
            assert.strictEqual(salir.codigo, 200, 'salir -> 200, llegó ' + salir.codigo);
            e = await estado(TL);
            assert.ok(!e.clubes.find(c => c.id === idClub).miembros.includes('luis'), 'luis ya no debe ser miembro');
        });

        await prueba('publicar en un club sin ser miembro responde 400', async () => {
            const r = await acc(TL, { tipo: 'publicar', texto: 'intruso', clubId: idClub });
            assert.strictEqual(r.codigo, 400, 'código 400, llegó ' + r.codigo);
            assert.strictEqual(r.json.error, 'Debes ser miembro del club.');
        });

        await prueba('el creador no puede abandonar su club', async () => {
            const r = await acc(TA, { tipo: 'toggle-club', id: idClub });
            assert.strictEqual(r.codigo, 400, 'código 400, llegó ' + r.codigo);
            assert.strictEqual(r.json.error, 'El creador no puede abandonar su club.');
            const e = await estado(TA);
            assert.ok(e.clubes.find(c => c.id === idClub).miembros.includes('ana'), 'ana sigue siendo miembro');
        });

        await prueba('toggle-club con id inexistente responde 400', async () => {
            const r = await acc(TA, { tipo: 'toggle-club', id: 'no-existe' });
            assert.strictEqual(r.codigo, 400, 'código 400, llegó ' + r.codigo);
            assert.strictEqual(r.json.error, 'Club inexistente.');
        });

        await prueba('segundo club con una miembro más (para el grafo)', async () => {
            const r = await acc(TA, { tipo: 'crear-club', nombre: 'Foto Club', categoria: 'Fotografía', descripcion: 'Salidas' });
            assert.strictEqual(r.codigo, 200, 'crear-club -> 200, llegó ' + r.codigo);
            idClub2 = r.json.id;
            const unirse = await acc(TM, { tipo: 'toggle-club', id: idClub2 });
            assert.strictEqual(unirse.codigo, 200, 'marta se une -> 200, llegó ' + unirse.codigo);
            const e = await estado(TA);
            assert.strictEqual(e.usuarios.length, 4, 'deben ser 4 usuarios');
            assert.strictEqual(e.clubes.length, 2, 'deben ser 2 clubes');
        });

        // ----------------------------------------------------------- grafo
        titulo('Grafo (4 usuarios y 2 clubes)');
        await prueba('nodos con tipo u|c y etiqueta', async () => {
            const g = await pedir(puerto, '/api/grafo', { cuerpo: {}, token: TA });
            assert.strictEqual(g.codigo, 200, 'código 200, llegó ' + g.codigo);
            const { nodos } = g.json;
            assert.strictEqual(nodos.length, 6, '4 usuarios + 2 clubes = 6 nodos, salieron ' + nodos.length);
            assert.strictEqual(nodos.filter(n => n.tipo === 'u').length, 4, '4 nodos de usuario');
            assert.strictEqual(nodos.filter(n => n.tipo === 'c').length, 2, '2 nodos de club');
            for (const n of nodos) {
                assert.ok(n.tipo === 'u' || n.tipo === 'c', 'tipo debe ser u|c, vino ' + n.tipo);
                assert.ok(n.id.startsWith(n.tipo === 'u' ? 'u:' : 'c:'), 'id debe llevar el prefijo, vino ' + n.id);
                assert.strictEqual(typeof n.etiqueta, 'string', 'etiqueta debe ser texto');
                assert.ok(n.etiqueta.length > 0, 'etiqueta no puede estar vacía');
            }
        });

        await prueba('aristas con tipo f|m entre nodos existentes', async () => {
            const g = await pedir(puerto, '/api/grafo', { cuerpo: {}, token: TA });
            const { nodos, aristas } = g.json;
            const ids = new Set(nodos.map(n => n.id));
            assert.ok(aristas.length > 0, 'debe haber aristas');
            for (const e of aristas) {
                assert.ok(e.t === 'f' || e.t === 'm', 'tipo de arista debe ser f|m, vino ' + e.t);
                assert.ok(ids.has(e.a) && ids.has(e.b), 'las aristas deben apuntar a nodos existentes');
            }
            assert.ok(aristas.some(e => e.t === 'f'), 'debe existir al menos una amistad');
            assert.ok(aristas.some(e => e.t === 'm'), 'debe existir al menos una pertenencia');
        });

        await prueba('lista de adyacencia completa y simétrica', async () => {
            const g = await pedir(puerto, '/api/grafo', { cuerpo: {}, token: TA });
            const { nodos, aristas, lista_adyacencia } = g.json;
            const ids = nodos.map(n => n.id);
            assert.deepStrictEqual(Object.keys(lista_adyacencia).sort(), ids.slice().sort(),
                'la adyacencia debe tener una entrada por cada nodo');
            for (const n of ids) {
                const vecinos = lista_adyacencia[n];
                assert.ok(Array.isArray(vecinos), n + ' debe tener lista de vecinos');
                assert.strictEqual(new Set(vecinos.map(v => v.vecino)).size, vecinos.length, n + ' sin vecinos repetidos');
                for (const v of vecinos) {
                    assert.ok(ids.includes(v.vecino), 'vecino inexistente: ' + v.vecino);
                    assert.ok(v.t === 'f' || v.t === 'm', 'el vecino debe traer t f|m');
                    assert.ok(lista_adyacencia[v.vecino].some(x => x.vecino === n), 'la adyacencia debe ser simétrica');
                }
            }
            const total = Object.values(lista_adyacencia).reduce((a, l) => a + l.length, 0);
            assert.strictEqual(total, aristas.length * 2, 'cada arista debe aparecer dos veces (una por extremo)');
        });

        // ------------------------------------------------------ contraseñas
        titulo('Contraseñas');
        await prueba('usuarios.json no guarda contraseñas en texto plano', async () => {
            const crudo = fs.readFileSync(path.join(dir, 'data', 'usuarios.json'), 'utf8');
            assert.ok(!crudo.includes(CLAVE), 'el archivo no debe contener la contraseña');
            const usuarios = JSON.parse(crudo);
            assert.strictEqual(usuarios.length, 4, 'deben ser 4 usuarios');
            for (const u of usuarios) {
                assert.strictEqual(typeof u.hash, 'string', u.usuario + ' debe tener hash');
                assert.ok(u.hash.includes(':'), 'el formato debe ser sal:hash');
                assert.notStrictEqual(u.hash, CLAVE, 'el hash no puede ser la contraseña');
                for (const [k, v] of Object.entries(u)) {
                    assert.notStrictEqual(v, CLAVE, 'ningún campo (' + k + ') puede ser la contraseña');
                }
            }
            // y por HTTP tampoco se expone
            const e = await estado(TA);
            for (const u of e.usuarios) {
                assert.ok(!('hash' in u), '/api/estado no debe mandar el hash');
                assert.ok(!('pass' in u), '/api/estado no debe mandar la contraseña');
            }
        });

        // ------------------------------------------------------ persistencia
        titulo('Persistencia');
        await prueba('los datos siguen ahí al reiniciar el servidor', async () => {
            const antes = await estado(TA);
            await detener(hijo);
            hijo = null;

            puerto = await puertoLibre();
            const otra = await arrancar(dir, puerto);
            hijo = otra.hijo;
            console.log('   (servidor reiniciado en el puerto ' + puerto + ')');

            const login = await post('/api/login', { usuario: 'ana', pass: CLAVE });
            assert.strictEqual(login.codigo, 200, 'tras reiniciar se sigue entrando, llegó ' + login.codigo);
            const despues = await estado(login.json.token);

            assert.deepStrictEqual(despues.usuarios.map(u => u.id).sort(), antes.usuarios.map(u => u.id).sort(), 'mismos usuarios');
            assert.deepStrictEqual(despues.clubes.map(c => c.id).sort(), antes.clubes.map(c => c.id).sort(), 'mismos clubes');
            assert.strictEqual(despues.publicaciones.length, antes.publicaciones.length, 'mismas publicaciones');
            assert.deepStrictEqual(despues.amistades, antes.amistades, 'mismas amistades');
        });

        // ------------------------------------------- data/ del repo intacto
        titulo('Aislamiento');
        await prueba('data/ del repo no se toca', async () => {
            assert.deepStrictEqual(huellaDataDelRepo(), repoAntes,
                'los data/*.json del repo deben quedar con el mismo hash');
        });

    } finally {
        if (hijo) await detener(hijo);
        try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ya no estaba */ }
    }

    console.log('\n=========================================');
    console.log('  ' + correctas + ' pruebas correctas, ' + fallidas + (fallidas === 1 ? ' fallo' : ' fallos'));
    console.log('=========================================');
    process.exitCode = fallidas ? 1 : 0;
}

main().catch(e => {
    console.error('\nError al ejecutar las pruebas:');
    console.error(e && e.stack ? e.stack : e);
    process.exitCode = 1;
});
