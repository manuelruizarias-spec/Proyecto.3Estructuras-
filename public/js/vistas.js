/* =====================================================================
   vistas.js - Presentación: cada función devuelve el HTML de una pantalla.
   No llama al servidor ni registra eventos (eso vive en app.js).
   Lee el estado global E (definido en app.js).
   ===================================================================== */

// ---------- Ayudas de datos (solo lectura sobre E.d) ----------
const usuario = id => E.d.usuarios.find(u => u.id === id);
const club = id => E.d.clubes.find(c => c.id === id);
const nombreDe = id => (usuario(id) || {}).nombre || id;
const relacion = (a, b) => E.d.amistades.find(x => (x.de === a && x.a === b) || (x.de === b && x.a === a));
const amigosDe = id => E.d.amistades.filter(x => x.estado === 'aceptada' && (x.de === id || x.a === id)).map(x => x.de === id ? x.a : x.de);
const solicitudesRecibidas = () => E.d.amistades.filter(x => x.a === E.yo && x.estado === 'pendiente');
const misClubes = () => E.d.clubes.filter(c => c.miembros.includes(E.yo));
const publicacionesDelMuro = () => {
  const ids = new Set([E.yo, ...amigosDe(E.yo)]);
  return E.d.publicaciones.filter(p => !p.clubId && ids.has(p.autor)).sort((a, b) => b.fecha - a.fecha);
};

// ---------- Acceso (S1-2) ----------
function vistaAcceso() {
  const reg = E.modo === 'reg';
  return `<div class="auth"><section class="hero"><a class="logo" href="#"><span class="mk">${ic('users')}</span>UNA Connect</a>
  <h1>Tu campus, tus amigos, tus clubes.</h1>
  <p>La red de estudiantes de la universidad para conocer gente nueva, compartir lo que haces y unirte a comunidades con tus mismos intereses.</p>
  <div class="bubbles"><span>Fotografía</span><span>Lectura</span><span>Videojuegos</span><span>Manualidades</span><span>Deportes</span><span>+ tu club</span></div></section>
  <section class="formside"><div class="box">
  <div class="tabs2" role="tablist"><button role="tab" aria-selected="${!reg}" data-act="modo" data-id="login">Iniciar sesión</button><button role="tab" aria-selected="${reg}" data-act="modo" data-id="reg">Registrarme</button></div>
  ${reg ? `<h2>Crea tu cuenta</h2><p class="mute" style="margin:6px 0 18px">Completa tus datos para unirte a la comunidad.</p>
   <form id="formRegistro" novalidate><div id="avisoRegistro"></div>
   ${campo('rid', 'Identificación', 'text', 'Ej. 118230456', 'off')}${campo('rnom', 'Nombre completo', 'text', 'Ej. Ana Rojas', 'name')}${campo('rus', 'Nombre de usuario', 'text', 'Mínimo 3 caracteres, sin espacios', 'username')}${campo('rpw', 'Contraseña', 'password', 'Mínimo 4 caracteres', 'new-password')}
   <button class="btn" style="width:100%" id="btnRegistro">Crear cuenta</button></form>
   <p class="small mute" style="margin-top:14px;text-align:center">¿Ya tienes cuenta? <button class="linkbtn" data-act="modo" data-id="login">Volver a iniciar sesión</button></p>`
  : `<h2>Hola de nuevo</h2><p class="mute" style="margin:6px 0 18px">Ingresa con tu usuario de UNA Connect.</p>
   <form id="formLogin" novalidate><div id="avisoLogin"></div>${campo('lus', 'Usuario', 'text', 'Tu nombre de usuario', 'username')}${campo('lpw', 'Contraseña', 'password', 'Tu contraseña', 'current-password')}
   <button class="btn" style="width:100%" id="btnLogin">Iniciar sesión</button></form>
   <p class="small mute" style="margin-top:14px;text-align:center">¿Eres nuevo? <button class="linkbtn" data-act="modo" data-id="reg">Crea tu cuenta</button></p>
   <p class="small mute" style="margin-top:18px;text-align:center"><button class="linkbtn" data-act="seed">Cargar datos de ejemplo</button><br>usuarios: ana, luis, marta, diego · contraseña 1234</p>`}
  </div></section></div>`;
}

// ---------- Estructura general con navegación (S1-2) ----------
const SECCIONES = [['inicio', 'Inicio', 'home'], ['amigos', 'Amigos', 'users'], ['muro', 'Muro', 'wall'], ['clubes', 'Clubes', 'club'], ['grafo', 'Grafo', 'graph']];
function vistaApp() {
  const pend = solicitudesRecibidas().length;
  const vistas = { inicio: vistaInicio, amigos: vistaAmigos, muro: vistaMuro, clubes: vistaClubes, grafo: vistaGrafo };
  return `<div class="shell"><header class="top"><a class="logo" href="#inicio" data-act="tab" data-id="inicio"><span class="mk">${ic('users')}</span>UNA Connect</a>
  <nav class="nav" aria-label="Principal">${SECCIONES.map(([k, l, i]) => `<a href="#${k}" data-act="tab" data-id="${k}" ${E.tab === k ? 'aria-current="page"' : ''}>${ic(i)}${l}${k === 'amigos' && pend ? `<span class="badge" aria-label="${pend} solicitudes pendientes">${pend}</span>` : ''}</a>`).join('')}</nav>
  <div class="me">${avatar(E.yo, nombreDe(E.yo))}<span class="nm">${esc(nombreDe(E.yo))}<br><button class="linkbtn" data-act="salir">Cerrar sesión</button></span></div></header>
  <main id="main">${vistas[E.tab]()}</main></div>`;
}

// ---------- Inicio ----------
function vistaInicio() {
  const amigos = amigosDe(E.yo), recibidas = solicitudesRecibidas(), mc = misClubes();
  const ultimas = publicacionesDelMuro().slice(0, 2);
  // Mejora opcional (fuera del Scrum): personas que comparten clubes contigo
  const sugeridos = E.d.usuarios.filter(u => u.id !== E.yo && !relacion(E.yo, u.id))
    .map(u => ({ u, comunes: mc.filter(c => c.miembros.includes(u.id)) })).filter(x => x.comunes.length).slice(0, 3);
  return `<div class="welcome"><div><h1>Hola, ${esc(nombreDe(E.yo).split(' ')[0])}</h1><p style="margin-top:6px;max-width:46ch">${amigos.length || mc.length ? 'Esto es lo que pasa hoy en tu comunidad universitaria.' : 'Empieza buscando amigos o uniéndote a un club. Todo lo que hagas aparecerá aquí.'}</p></div>
  <div class="row wrap"><button class="btn" data-act="tab" data-id="muro">${ic('send')}Publicar</button><button class="btn sec" data-act="tab" data-id="clubes">Explorar clubes</button></div></div>
  <div class="cols3">
  <a class="card stat" href="#amigos" data-act="tab" data-id="amigos"><span class="ic">${ic('users')}</span><span><span class="n">${amigos.length}</span><br><span class="mute small">Amigos</span></span></a>
  <a class="card stat" href="#amigos" data-act="tab" data-id="amigos"><span class="ic">${ic('alert')}</span><span><span class="n">${recibidas.length}</span><br><span class="mute small">Solicitudes pendientes</span></span></a>
  <a class="card stat" href="#clubes" data-act="tab" data-id="clubes"><span class="ic">${ic('club')}</span><span><span class="n">${mc.length}</span><br><span class="mute small">Mis clubes</span></span></a></div>
  <div class="cols" style="margin-top:16px"><div><div class="sec-t"><h2>Últimas del muro</h2><button class="btn sm sec" data-act="tab" data-id="muro">Ver muro</button></div>
  <div class="stack">${ultimas.length ? ultimas.map(tarjetaPublicacion).join('') : estadoVacio('wall', 'Tu muro está tranquilo', 'Cuando tú o tus amigos publiquen, lo verás aquí.')}</div></div>
  <div><div class="sec-t"><h2>Personas con tus intereses</h2></div>
  <div class="card">${sugeridos.length ? sugeridos.map(({ u, comunes }) => `<div class="person">${avatar(u.id, u.nombre)}<div class="grow"><div class="nm">${esc(u.nombre)}</div><div class="small mute">Comparten: ${comunes.map(c => esc(c.nombre)).join(', ')}</div></div><button class="btn sm sec" data-act="tab" data-id="amigos">Ver</button></div>`).join('') : estadoVacio('sparkle', 'Aún no hay sugerencias', 'Únete a un club y te mostraremos estudiantes con los mismos intereses.')}</div>
  <div class="sec-t"><h2>Mis clubes</h2></div>
  ${mc.length ? `<div class="card stack">${mc.map(c => `<div class="row"><span class="stat" style="gap:0"><span class="ic">${ic(ICONO_CATEGORIA[c.categoria] || 'other')}</span></span><div class="grow"><b>${esc(c.nombre)}</b><div class="small mute">${c.miembros.length} integrantes</div></div><button class="btn sm ghost" data-act="abrirClub" data-id="${c.id}">Abrir</button></div>`).join('')}</div>`
    : estadoVacio('club', 'No perteneces a ningún club', 'Explora los clubes y únete al que más te guste.', '<button class="btn sm" data-act="tab" data-id="clubes">Explorar clubes</button>')}
  </div></div>`;
}

// ---------- Amigos (S1-4) ----------
function vistaAmigos() {
  const recibidas = solicitudesRecibidas(), amigos = amigosDe(E.yo);
  return `<div class="pagehead"><div><h1>Amigos</h1><p>Busca estudiantes, responde solicitudes y revisa tu lista.</p></div></div>
  <div class="search"><span>${ic('search')}</span><input class="in" id="buscador" type="search" placeholder="Buscar por nombre o usuario" value="${esc(E.q)}" aria-label="Buscar estudiantes"></div>
  <div id="resultados" class="card" style="margin-top:12px">${htmlResultados()}</div>
  <div class="cols" style="margin-top:16px"><div><div class="sec-t"><h2>Solicitudes recibidas ${recibidas.length ? `<span class="pill">${recibidas.length}</span>` : ''}</h2></div>
  <div class="card">${recibidas.length ? recibidas.map(x => `<div class="person">${avatar(x.de, nombreDe(x.de))}<div class="grow"><div class="nm">${esc(nombreDe(x.de))}</div><div class="small mute">@${esc(x.de)} · quiere ser tu amigo</div></div><button class="btn sm" data-act="aceptar" data-id="${esc(x.de)}">${ic('check')}Aceptar</button></div>`).join('') : estadoVacio('users', 'Sin solicitudes pendientes', 'Cuando alguien quiera ser tu amigo, la solicitud aparecerá aquí.')}</div></div>
  <div><div class="sec-t"><h2>Mis amigos <span class="pill">${amigos.length}</span></h2></div>
  <div class="card">${amigos.length ? amigos.map(i => `<div class="person">${avatar(i, nombreDe(i))}<div class="grow"><div class="nm">${esc(nombreDe(i))}</div><div class="small mute">@${esc(i)}</div></div><span class="pill ok">Amigos</span></div>`).join('') : estadoVacio('users', 'Todavía no tienes amigos', 'Busca a tus compañeros por nombre y envíales una solicitud.')}</div></div></div>`;
}
// Búsqueda: el servidor aún no tiene ruta de búsqueda, se filtra sobre /api/estado (pendiente con Cris)
function htmlResultados() {
  const q = E.q.toLowerCase();
  const lista = E.d.usuarios.filter(u => u.id !== E.yo && (!q || (u.nombre + ' ' + u.usuario).toLowerCase().includes(q)));
  if (!q) return `<div class="small mute" style="margin-bottom:6px">Estudiantes de la universidad</div>` + (lista.length ? lista.slice(0, 6).map(filaEstudiante).join('') : estadoVacio('users', 'Aún no hay otros estudiantes', 'Cuando más compañeros se registren, podrás encontrarlos aquí.'));
  return lista.length ? lista.map(filaEstudiante).join('') : estadoVacio('search', 'Sin resultados', `No encontramos estudiantes que coincidan con “${esc(E.q)}”. Revisa la ortografía o prueba con el usuario.`);
}
function filaEstudiante(u) {
  const r = relacion(E.yo, u.id); let accion;
  if (!r) accion = `<button class="btn sm sec" data-act="solicitar" data-id="${esc(u.id)}">${ic('plus')}Agregar</button>`;
  else if (r.estado === 'aceptada') accion = '<span class="pill ok">Amigos</span>';
  else accion = r.de === E.yo ? '<span class="pill wait">Solicitud enviada</span>' : `<button class="btn sm" data-act="aceptar" data-id="${esc(u.id)}">Aceptar</button>`;
  return `<div class="person">${avatar(u.id, u.nombre)}<div class="grow"><div class="nm">${esc(u.nombre)}</div><div class="small mute">@${esc(u.usuario)}</div></div>${accion}</div>`;
}

// ---------- Muro (S2-3) ----------
function tarjetaPublicacion(p) {
  const c = p.clubId ? club(p.clubId) : null;
  return `<article class="card post ${p.autor === E.yo ? 'mine' : ''}">${avatar(p.autor, nombreDe(p.autor))}<div class="grow"><div class="meta"><span class="who">${esc(nombreDe(p.autor))}</span>${p.autor === E.yo ? '<span class="pill">Tú</span>' : ''}${c ? `<span class="clubtag">${esc(c.nombre)}</span>` : ''}<time class="small mute" title="${fechaCompleta(p.fecha)}">${hace(p.fecha)} · ${fechaCompleta(p.fecha)}</time></div><div class="txt">${esc(p.texto)}</div></div></article>`;
}
// zona: 'muro' | 'club' | 'tablon' (identifica dónde se publica)
function cajaPublicar(zona, selectorClub = '') {
  return `<div class="card composer"><div class="row" style="align-items:flex-start">${avatar(E.yo, nombreDe(E.yo))}<div class="grow"><div id="aviso-${zona}"></div>${selectorClub}
  <textarea id="texto-${zona}" maxlength="500" placeholder="¿Qué quieres compartir con tu comunidad?" aria-label="Escribir publicación">${esc(E.borrador)}</textarea></div></div>
  <div class="bar"><span class="small mute"><span id="cuenta-${zona}">${E.borrador.length}</span>/500</span><button class="btn" id="btn-${zona}" data-act="publicar" data-id="${zona}">${ic('send')}Publicar</button></div></div>`;
}
function vistaMuro() {
  const lista = publicacionesDelMuro();
  return `<div class="pagehead"><div><h1>Muro</h1><p>Publicaciones tuyas y de tus amigos, de la más reciente a la más antigua.</p></div></div>
  <div class="stack">${cajaPublicar('muro')}${lista.length ? lista.map(tarjetaPublicacion).join('') : estadoVacio('wall', 'Tu muro está vacío', 'Sé la primera persona en publicar o agrega amigos para ver lo que comparten.', '<button class="btn sm" data-act="tab" data-id="amigos">Buscar amigos</button>')}</div>`;
}

// ---------- Clubes (S2-4) y tablón general de mis clubes (integración S2-5) ----------
function vistaClubes() {
  if (E.club && club(E.club)) return vistaDetalleClub(club(E.club));
  const T = [['explorar', 'Explorar'], ['mis', 'Mis clubes'], ['crear', 'Crear club']];
  return `<div class="pagehead"><div><h1>Clubes</h1><p>Encuentra tu comunidad por interés y participa en su tablón.</p></div></div>
  <div class="subtabs" role="tablist">${T.map(([k, l]) => `<button role="tab" aria-selected="${E.ctab === k}" data-act="ctab" data-id="${k}">${l}${k === 'mis' ? ` <span class="pill">${misClubes().length}</span>` : ''}</button>`).join('')}</div>
  ${E.ctab === 'explorar' ? vistaExplorar() : E.ctab === 'mis' ? vistaTablonGeneral() : vistaCrearClub()}`;
}
function vistaExplorar() {
  const lista = E.d.clubes.filter(c => E.cat === 'Todos' || c.categoria === E.cat);
  return `<div class="chips" role="group" aria-label="Filtrar por categoría">${['Todos', ...CATEGORIAS, 'Otro'].map(c => `<button class="chip" data-act="categoria" data-id="${c}" aria-pressed="${E.cat === c}">${c}</button>`).join('')}</div>
  ${lista.length ? `<div class="cg">${lista.map(tarjetaClub).join('')}</div>` : estadoVacio('club', E.d.clubes.length ? 'No hay clubes en esta categoría' : 'Aún no hay clubes', E.d.clubes.length ? 'Prueba con otra categoría o crea el primero.' : 'Crea el primer club y reúne a tu comunidad.', '<button class="btn sm" data-act="ctab" data-id="crear">Crear un club</button>')}`;
}
function tarjetaClub(c) {
  const miembro = c.miembros.includes(E.yo), k = E.d.clubes.indexOf(c) % 4;
  return `<article class="card club"><div class="cover c${k}"><span class="ci">${ic(ICONO_CATEGORIA[c.categoria] || 'other')}</span></div><div class="body"><div class="row sb"><h3>${esc(c.nombre)}</h3><span class="pill">${esc(c.categoria)}</span></div><p>${esc(c.descripcion || '')}</p><div class="small mute">${c.miembros.length} integrantes</div>
  <div class="row"><button class="btn sm ghost grow" data-act="abrirClub" data-id="${c.id}">Ver tablón</button>${miembro ? `<button class="btn sm sec grow" data-act="unirse" data-id="${c.id}">Abandonar</button>` : `<button class="btn sm grow" data-act="unirse" data-id="${c.id}">Unirme</button>`}</div></div></article>`;
}
function vistaDetalleClub(c) {
  const miembro = c.miembros.includes(E.yo), pubs = E.d.publicaciones.filter(p => p.clubId === c.id).sort((a, b) => b.fecha - a.fecha);
  return `<button class="btn sm ghost" data-act="abrirClub" data-id="">← Todos los clubes</button>
  <div class="card" style="margin:14px 0;padding:0;overflow:hidden"><div class="c0" style="height:70px"></div><div style="padding:18px"><div class="row sb wrap"><div><div class="row wrap"><h1 style="font-size:26px">${esc(c.nombre)}</h1><span class="pill">${esc(c.categoria)}</span></div><p class="mute" style="margin-top:6px;max-width:60ch">${esc(c.descripcion || '')}</p></div>
  <button class="btn ${miembro ? 'sec' : ''}" data-act="unirse" data-id="${c.id}">${miembro ? 'Abandonar club' : 'Unirme al club'}</button></div>
  <h3 style="margin:16px 0 8px">Integrantes (${c.miembros.length})</h3><div class="members">${c.miembros.map(i => `<span>${avatar(i, nombreDe(i), 'xs')}${esc(nombreDe(i))}${i === c.creador ? ' <span class="pill" style="padding:0 7px">Creador</span>' : ''}</span>`).join('')}</div></div></div>
  <div class="stack"><h2>Tablón del club</h2>
  ${miembro ? cajaPublicar('club') : `<div class="locked">${ic('lock')}<div class="grow"><b>Solo los integrantes pueden publicar</b><div class="small mute">Únete al club para escribir en su tablón.</div></div></div>`}
  ${pubs.length ? pubs.map(tarjetaPublicacion).join('') : estadoVacio('wall', 'El tablón está vacío', 'Todavía no hay publicaciones en este club.')}</div>`;
}
function vistaTablonGeneral() {
  const mc = misClubes(), ids = mc.map(c => c.id);
  const pubs = E.d.publicaciones.filter(p => p.clubId && ids.includes(p.clubId)).sort((a, b) => b.fecha - a.fecha);
  if (!mc.length) return estadoVacio('club', 'Aún no perteneces a ningún club', 'Únete a un club para ver aquí sus publicaciones y participar en su tablón.', '<button class="btn sm" data-act="ctab" data-id="explorar">Explorar clubes</button>');
  const selector = `<div class="row" style="margin-bottom:6px"><label class="small mute" for="club-destino">Publicar en:</label><select class="in" id="club-destino" style="width:auto;min-height:34px;padding:4px 10px">${mc.map(c => `<option value="${c.id}">${esc(c.nombre)}</option>`).join('')}</select></div>`;
  return `<div class="stack"><div class="row wrap"><h2>Tablón de mis clubes</h2><span class="small mute">${mc.map(c => esc(c.nombre)).join(' · ')}</span></div>
  ${cajaPublicar('tablon', selector)}
  ${pubs.length ? pubs.map(tarjetaPublicacion).join('') : estadoVacio('wall', 'Sin publicaciones todavía', 'Sé la primera persona en escribir en el tablón de tus clubes.')}</div>`;
}
function vistaCrearClub() {
  return `<div class="card" style="max-width:560px"><h2 style="margin-bottom:14px">Crea tu club</h2><form id="formClub" novalidate><div id="avisoClub"></div>
  ${campo('cn', 'Nombre del club', 'text', 'Ej. Cine Foro UNA', 'off')}
  <div class="field"><label for="cc">Categoría</label><select class="in" id="cc">${[...CATEGORIAS, 'Otro'].map(c => `<option>${c}</option>`).join('')}</select></div>
  <div class="field"><label for="cds">Descripción</label><textarea class="in" id="cds" rows="3" maxlength="140" placeholder="¿De qué trata y a quién invitas?"></textarea><span class="small mute">Máximo 140 caracteres</span></div>
  <button class="btn" id="btnClub">${ic('plus')}Crear club</button></form></div>`;
}

// ---------- Grafo (S3-2) ----------
// Hoy la lista de adyacencia se calcula aquí con /api/estado. En el Sprint 3 se reemplaza
// por la respuesta de la ruta de Cris (S3-1): solo cambiaría la función datosGrafo().
function datosGrafo() {
  const nodos = [], aristas = [];
  E.d.usuarios.forEach(u => nodos.push({ id: 'u:' + u.id, etiqueta: u.nombre.split(' ')[0], tipo: 'u' }));
  E.d.clubes.forEach(c => nodos.push({ id: 'c:' + c.id, etiqueta: c.nombre, tipo: 'c' }));
  E.d.amistades.filter(a => a.estado === 'aceptada').forEach(a => aristas.push({ a: 'u:' + a.de, b: 'u:' + a.a, t: 'f' }));
  E.d.clubes.forEach(c => c.miembros.forEach(m => { if (usuario(m)) aristas.push({ a: 'u:' + m, b: 'c:' + c.id, t: 'm' }); }));
  return { nodos, aristas };
}
function posicionesGrafo(g, W, H) {
  const P = {}, N = g.nodos;
  N.forEach((n, i) => { const a = i / N.length * 6.283; P[n.id] = { x: W / 2 + Math.cos(a) * W * .3, y: H / 2 + Math.sin(a) * H * .3, vx: 0, vy: 0 }; });
  for (let it = 0; it < 260; it++) {
    for (let i = 0; i < N.length; i++) for (let j = i + 1; j < N.length; j++) {
      const a = P[N[i].id], b = P[N[j].id]; const dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy) || 1, f = 26000 / (d * d);
      a.vx += dx / d * f; a.vy += dy / d * f; b.vx -= dx / d * f; b.vy -= dy / d * f;
    }
    g.aristas.forEach(e => { const a = P[e.a], b = P[e.b], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, f = (d - (e.t === 'f' ? 150 : 135)) * .02; a.vx += dx / d * f; a.vy += dy / d * f; b.vx -= dx / d * f; b.vy -= dy / d * f; });
    N.forEach(n => { const p = P[n.id]; p.vx += (W / 2 - p.x) * .003; p.vy += (H / 2 - p.y) * .003; p.x = Math.min(W - 60, Math.max(60, p.x + p.vx * .5)); p.y = Math.min(H - 40, Math.max(36, p.y + p.vy * .5)); p.vx *= .55; p.vy *= .55; });
  }
  return P;
}
function vistaGrafo() {
  const g = datosGrafo(), W = 760, H = 500;
  const cabecera = `<div class="pagehead"><div><h1>Grafo de relaciones</h1><p>Cómo se conectan los estudiantes entre sí y con los clubes.</p></div></div>`;
  if (!g.aristas.length) return cabecera + estadoVacio('graph', 'Aún no hay relaciones para mostrar', 'Cuando haya amistades o integrantes en clubes, aparecerán aquí conectados.', '<button class="btn sm" data-act="tab" data-id="amigos">Buscar amigos</button>');
  const P = posicionesGrafo(g, W, H), activa = e => (e.t === 'f' ? E.gAmistades : E.gClubes), vecinos = new Set();
  if (E.sel) { vecinos.add(E.sel); g.aristas.forEach(e => { if (!activa(e)) return; if (e.a === E.sel) vecinos.add(e.b); if (e.b === E.sel) vecinos.add(e.a); }); }
  const lineas = g.aristas.filter(activa).map(e => `<line class="${e.t === 'f' ? 'ge-f' : 'ge-m'} ${E.sel && !(e.a === E.sel || e.b === E.sel) ? 'dim' : ''}" x1="${P[e.a].x}" y1="${P[e.a].y}" x2="${P[e.b].x}" y2="${P[e.b].y}"/>`).join('');
  const grado = id => g.aristas.filter(e => activa(e) && (e.a === id || e.b === id)).length;
  const nodos = g.nodos.map(n => {
    const p = P[n.id], dim = E.sel && !vecinos.has(n.id) ? 'dim' : '', yo = n.id === 'u:' + E.yo, aislado = !grado(n.id);
    const forma = n.tipo === 'u'
      ? `<circle class="nd nu ${yo ? 'me' : ''} ${aislado ? 'iso' : ''}" cx="${p.x}" cy="${p.y}" r="${yo ? 22 : 17}"/><text x="${p.x}" y="${p.y + 4}" text-anchor="middle" style="fill:${aislado ? 'var(--mute)' : '#fff'};stroke:none;font-size:11px">${esc(n.etiqueta.slice(0, 2).toUpperCase())}</text>`
      : `<rect class="nd nc" x="${p.x - 17}" y="${p.y - 17}" width="34" height="34" rx="9"/><path d="M${p.x} ${p.y - 8}l2.4 4.8 5.3.8-3.8 3.7.9 5.3-4.8-2.5-4.8 2.5.9-5.3-3.8-3.7 5.3-.8z" fill="var(--red-dk)"/>`;
    return `<g class="gn ${dim}" tabindex="0" role="button" aria-label="${esc(n.etiqueta)}" data-act="nodo" data-id="${n.id}">${forma}<text x="${p.x}" y="${p.y + (n.tipo === 'u' ? (yo ? 40 : 34) : 34)}" text-anchor="middle">${esc(n.etiqueta)}</text></g>`;
  }).join('');
  const nombreNodo = id => id[0] === 'u' ? nombreDe(id.slice(2)) : (club(id.slice(2)) || {}).nombre;
  const info = E.sel ? (() => {
    const f = g.aristas.filter(e => e.t === 'f' && (e.a === E.sel || e.b === E.sel)).length, m = g.aristas.filter(e => e.t === 'm' && (e.a === E.sel || e.b === E.sel)).length;
    return E.sel[0] === 'u' ? `<b>${esc(nombreNodo(E.sel))}</b>: ${f} amigos · ${m} clubes` : `<b>${esc(nombreNodo(E.sel))}</b>: ${m} integrantes`;
  })() : 'Toca un nodo para resaltar sus conexiones.';
  const adyacencia = g.nodos.map(n => {
    const vec = g.aristas.filter(e => e.a === n.id || e.b === n.id).map(e => e.a === n.id ? e.b : e.a);
    return `<div class="ar"><span class="k">${esc(n.id)}</span><span class="v">${vec.length ? vec.map(x => `<i class="${x[0] === 'c' ? 'cl' : ''}">${esc(x)}</i>`).join('') : '<span class="small mute">sin conexiones</span>'}</span></div>`;
  }).join('');
  return cabecera + `<div class="gwrap"><div class="card"><div class="row wrap" style="margin-bottom:10px"><label class="row small"><input type="checkbox" id="filtroAmistades" ${E.gAmistades ? 'checked' : ''}> Amistades</label><label class="row small"><input type="checkbox" id="filtroClubes" ${E.gClubes ? 'checked' : ''}> Pertenencia a clubes</label></div>
  <svg class="gsvg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Grafo de estudiantes y clubes">${lineas}${nodos}</svg>
  <p class="small" style="margin-top:8px" aria-live="polite">${info}</p>
  <div class="legend"><span><svg width="22" height="22"><circle cx="11" cy="11" r="8" fill="var(--red)"/></svg>Estudiante</span><span><svg width="22" height="22"><rect x="3" y="3" width="16" height="16" rx="4" fill="var(--soft)" stroke="var(--red-dk)" stroke-width="2"/></svg>Club</span><span><svg width="30" height="10"><line x1="0" y1="5" x2="30" y2="5" class="ge-f"/></svg>Amistad</span><span><svg width="30" height="10"><line x1="0" y1="5" x2="30" y2="5" class="ge-m"/></svg>Pertenece a</span></div></div>
  <div class="card"><h3 style="margin-bottom:4px">Lista de adyacencia</h3><p class="small mute" style="margin-bottom:8px">Cada nodo con los nodos a los que está conectado. <b>u:</b> estudiante, <b>c:</b> club.</p><div class="adj" tabindex="0" aria-label="Lista de adyacencia">${adyacencia}</div></div></div>`;
}