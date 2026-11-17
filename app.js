/* =====================================================================
   app.js - Controlador: estado de la pantalla, eventos del usuario y
   coordinación entre las vistas (vistas.js) y el servidor (api.js).
   ===================================================================== */

// Estado global del Frontend. E.d son los datos que devuelve /api/estado.
const E = {
  d: { usuarios: [], clubes: [], publicaciones: [], amistades: [] },
  yo: Api.yo, tab: 'inicio', modo: 'login', cargando: false,
  cat: 'Todos', ctab: 'explorar', club: null, q: '', borrador: '',
  sel: null, gAmistades: true, gClubes: true
};

function pintar() {
  const app = document.getElementById('app');
  if (E.cargando) { app.innerHTML = '<div class="cargando"><span class="spin"></span></div>'; return; }
  if (!Api.haySesion() || !usuario(E.yo)) { app.innerHTML = vistaAcceso(); }
  else { app.innerHTML = vistaApp(); }
  enlazarCampos();
}

// Eventos de campos que no usan delegación (se recrean en cada pintado)
function enlazarCampos() {
  const buscador = document.getElementById('buscador');
  if (buscador) buscador.oninput = e => { E.q = e.target.value; document.getElementById('resultados').innerHTML = htmlResultados(); };
  const t = document.querySelector('.composer textarea');
  if (t) t.oninput = e => { E.borrador = e.target.value; document.getElementById('cuenta-' + t.id.replace('texto-', '')).textContent = E.borrador.length; };
  const fa = document.getElementById('filtroAmistades'); if (fa) fa.onchange = e => { E.gAmistades = e.target.checked; pintar(); };
  const fc = document.getElementById('filtroClubes'); if (fc) fc.onchange = e => { E.gClubes = e.target.checked; pintar(); };
  const f1 = document.getElementById('formLogin'); if (f1) f1.onsubmit = e => { e.preventDefault(); iniciarSesion(); };
  const f2 = document.getElementById('formRegistro'); if (f2) f2.onsubmit = e => { e.preventDefault(); registrarse(); };
  const f3 = document.getElementById('formClub'); if (f3) f3.onsubmit = e => { e.preventDefault(); crearClub(); };
}

// ---------- Datos del servidor ----------
async function refrescar() {
  const r = await Api.estado();
  if (!r.ok) { if (Api.haySesion()) toast(r.error); return false; }
  E.d = r.datos;
  return true;
}
async function entrarAlSistema() {
  E.cargando = true; pintar();
  const ok = await refrescar();
  E.cargando = false;
  if (!ok || !usuario(E.yo)) { Api.cerrarSesion(); E.yo = null; }
  pintar();
}
function salir() { Api.cerrarSesion(); E.yo = null; E.modo = 'login'; E.tab = 'inicio'; E.club = null; pintar(); }
Api.onSesionExpirada = () => { E.yo = null; pintar(); toast('Tu sesión expiró. Inicia sesión de nuevo.'); };

// ---------- Acceso (S1-2) ----------
async function iniciarSesion() {
  const us = valorCampo('lus'), pw = document.getElementById('lpw').value;
  document.getElementById('avisoLogin').innerHTML = '';
  errorCampo('lus', us ? '' : 'Escribe tu usuario.'); errorCampo('lpw', pw ? '' : 'Escribe tu contraseña.');
  if (!us || !pw) return;
  const r = await conCarga(document.getElementById('btnLogin'), 'Ingresando…', () => Api.login(us, pw));
  if (!r.ok) { document.getElementById('avisoLogin').innerHTML = bannerError(r.error); return; }
  Api.guardarSesion(r.datos.token, r.datos.id); E.yo = r.datos.id; E.tab = 'inicio';
  await entrarAlSistema(); toast('Sesión iniciada');
}
async function registrarse() {
  const id = valorCampo('rid'), nombre = valorCampo('rnom'), us = valorCampo('rus').toLowerCase(), pw = document.getElementById('rpw').value;
  document.getElementById('avisoRegistro').innerHTML = '';
  errorCampo('rid', id ? '' : 'Escribe tu número de identificación.');
  errorCampo('rnom', nombre ? '' : 'Escribe tu nombre.');
  errorCampo('rus', us.length < 3 ? 'El usuario debe tener al menos 3 caracteres.' : !/^[a-z0-9_.-]+$/.test(us) ? 'Solo letras, números, punto, guion y guion bajo.' : '');
  errorCampo('rpw', pw.length < 4 ? 'La contraseña debe tener al menos 4 caracteres.' : '');
  if (document.querySelector('#formRegistro .in.bad')) return;
  const r = await conCarga(document.getElementById('btnRegistro'), 'Creando cuenta…', () => Api.registro({ identificacion: id, nombre, usuario: us, pass: pw }));
  if (!r.ok) { document.getElementById('avisoRegistro').innerHTML = bannerError(r.error); return; }
  Api.guardarSesion(r.datos.token, r.datos.id); E.yo = r.datos.id; E.tab = 'inicio';
  await entrarAlSistema(); toast('¡Cuenta creada! Bienvenido a UNA Connect');
}

// ---------- Acciones sociales (usan /api/accion) ----------
async function ejecutar(cuerpo, mensajeOk) {
  const r = await Api.accion(cuerpo);
  if (!r.ok) { toast(r.error); return false; }
  await refrescar(); pintar(); if (mensajeOk) toast(mensajeOk); return true;
}
async function publicar(zona) {
  const texto = document.getElementById('texto-' + zona).value.trim(), aviso = document.getElementById('aviso-' + zona);
  aviso.innerHTML = '';
  if (!texto) { aviso.innerHTML = bannerError('Escribe algo antes de publicar.'); return; }
  const clubId = zona === 'club' ? E.club : zona === 'tablon' ? document.getElementById('club-destino').value : null;
  const r = await conCarga(document.getElementById('btn-' + zona), 'Publicando…', () => Api.accion({ tipo: 'publicar', texto, clubId }));
  if (!r.ok) { aviso.innerHTML = bannerError(r.error); return; } // incluye "Debes ser miembro del club." del servidor
  E.borrador = ''; await refrescar(); pintar(); toast('Publicación enviada');
}
async function crearClub() {
  const nombre = valorCampo('cn'); errorCampo('cn', nombre ? '' : 'El club necesita un nombre.');
  if (!nombre) return;
  const r = await conCarga(document.getElementById('btnClub'), 'Creando…', () => Api.accion({ tipo: 'crear-club', nombre, categoria: document.getElementById('cc').value, descripcion: valorCampo('cds') }));
  if (!r.ok) { document.getElementById('avisoClub').innerHTML = bannerError(r.error); return; }
  await refrescar();
  const nuevo = E.d.clubes.filter(c => c.creador === E.yo && c.nombre === nombre).pop(); // el servidor no devuelve el id del club creado
  E.club = nuevo ? nuevo.id : null; E.ctab = 'explorar'; pintar(); toast('Club creado');
}

// ---------- Clics (delegación de eventos) ----------
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const a = b.dataset.act, id = b.dataset.id;
  if (b.tagName === 'A') e.preventDefault();
  if (a === 'modo') { E.modo = id; pintar(); }
  else if (a === 'salir') salir();
  else if (a === 'seed') { const r = await Api.seed(); toast(r.ok ? 'Datos de ejemplo cargados. Entra con ana / 1234.' : r.error); }
  else if (a === 'tab') { E.tab = id; E.club = null; E.borrador = ''; pintar(); window.scrollTo(0, 0); }
  else if (a === 'solicitar') { const r = await ejecutar({ tipo: 'solicitar', a: id }, 'Solicitud enviada a ' + nombreDe(id)); }
  else if (a === 'aceptar') await ejecutar({ tipo: 'aceptar', de: id }, 'Ahora eres amigo de ' + nombreDe(id));
  else if (a === 'publicar') publicar(id);
  else if (a === 'ctab') { E.ctab = id; E.club = null; E.borrador = ''; pintar(); }
  else if (a === 'categoria') { E.cat = id; pintar(); }
  else if (a === 'abrirClub') { E.club = id || null; E.tab = 'clubes'; E.borrador = ''; pintar(); window.scrollTo(0, 0); }
  else if (a === 'unirse') { const c = club(id), era = c.miembros.includes(E.yo); await ejecutar({ tipo: 'toggle-club', id }, era ? 'Saliste de ' + c.nombre : 'Te uniste a ' + c.nombre); }
  else if (a === 'nodo') { E.sel = E.sel === id ? null : id; pintar(); }
});
document.addEventListener('keydown', e => { // accesibilidad: nodos del grafo con teclado
  if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('gn')) { e.preventDefault(); e.target.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
});

// ---------- Inicio de la aplicación ----------
if (Api.haySesion()) entrarAlSistema(); else pintar();