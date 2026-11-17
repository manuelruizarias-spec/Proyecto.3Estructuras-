/* =====================================================================
   ui.js - Utilidades visuales reutilizables (no hablan con el servidor)
   Iconos, escape de HTML, avatares, fechas, avisos, estados vacíos y
   ayudas para formularios.
   ===================================================================== */

const CATEGORIAS = ['Fotografía', 'Lectura', 'Manualidades', 'Videojuegos', 'Deportes']; // + 'Otro' (lo acepta el servidor)

const ICONOS = {
  home: '<path d="M3 11l9-8 9 8v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 010 6.8M18 14.8c2 .6 3.3 2.3 3.6 5.2"/>',
  wall: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M7 9h10M7 13h10M7 17h6"/>',
  club: '<path d="M12 3l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.4 6.8 19.2l1-5.9L3.5 9.2l5.9-.8z"/>',
  graph: '<circle cx="6" cy="6" r="2.6"/><circle cx="18" cy="8" r="2.6"/><circle cx="12" cy="18" r="2.6"/><path d="M8.3 7l7.4.7M7 8.4l4 7.3M16.7 10.3l-3.6 5.6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.1"/>',
  send: '<path d="M21 3L10 14M21 3l-7 18-4-7-7-4z"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
  book: '<path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2zM4 19V5M8 7h7"/>',
  cam: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  craft: '<path d="M12 3c4 4 6 6 6 9a6 6 0 01-12 0c0-3 2-5 6-9z"/>',
  game: '<rect x="2.5" y="7" width="19" height="10" rx="5"/><path d="M7 10v4M5 12h4M16 11.5v.1M18 13v.1"/>',
  sport: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18"/>',
  other: '<circle cx="12" cy="12" r="9"/><path d="M8 12h8"/>'
};
const ICONO_CATEGORIA = { 'Fotografía': 'cam', 'Lectura': 'book', 'Manualidades': 'craft', 'Videojuegos': 'game', 'Deportes': 'sport', 'Otro': 'other' };

const ic = n => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICONOS[n] || ''}</svg>`;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Fechas: "hace 5 min" + fecha completa. El servidor guarda la fecha en milisegundos (campo "fecha").
function hace(t) {
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? 'ahora' : m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} d`;
}
const fechaCompleta = t => new Date(t).toLocaleString('es-CR', { dateStyle: 'medium', timeStyle: 'short' });

// Avatar con iniciales; el color depende del id para que sea estable.
function avatar(id, nombre, extra = '') {
  const tono = [...String(id)].reduce((s, ch) => s + ch.charCodeAt(0), 0) % 4;
  const ini = String(nombre || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  return `<span class="av t${tono} ${extra}" aria-hidden="true">${esc(ini)}</span>`;
}

// Aviso emergente (confirmaciones y errores cortos)
let _toastTimer;
function toast(msg) {
  const e = document.getElementById('toast');
  e.textContent = msg; e.hidden = false;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { e.hidden = true; }, 2800);
}

// Estado vacío amigable
const estadoVacio = (icono, titulo, texto, boton = '') =>
  `<div class="empty"><div class="ico">${ic(icono)}</div><h3>${titulo}</h3><p>${texto}</p>${boton}</div>`;

const bannerError = msg => `<div class="banner bad">${ic('alert')}<span>${esc(msg)}</span></div>`;

// Formularios: campo con etiqueta y espacio para su mensaje de error
const campo = (id, etiqueta, tipo, placeholder, autocomplete) =>
  `<div class="field"><label for="${id}">${etiqueta}</label><input class="in" id="${id}" name="${id}" type="${tipo}" placeholder="${placeholder}" autocomplete="${autocomplete}"><div class="err" id="e_${id}" hidden></div></div>`;

function errorCampo(id, msg) {
  const i = document.getElementById(id), e = document.getElementById('e_' + id);
  if (!i || !e) return;
  i.classList.toggle('bad', !!msg);
  e.hidden = !msg;
  e.innerHTML = msg ? ic('alert') + esc(msg) : '';
}
const valorCampo = id => document.getElementById(id).value.trim();

// Botón con indicador de carga mientras se espera al servidor
async function conCarga(boton, texto, promesa) {
  const original = boton.innerHTML;
  boton.disabled = true; boton.innerHTML = '<span class="spin"></span>' + texto;
  try { return await promesa(); }
  finally { boton.disabled = false; boton.innerHTML = original; }
}