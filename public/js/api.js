/* =====================================================================
   api.js - ÚNICO archivo del Frontend que habla con el servidor.
   Si Manuel o Cris cambian una ruta o un formato, solo se edita aquí.

   Rutas usadas (existen hoy en server.js; confirmar con Manuel y Cris):
     POST /api/registro  { identificacion, nombre, usuario, pass } -> { token, id }
     POST /api/login     { usuario, pass }                         -> { token, id }
     POST /api/estado    {}                                        -> { usuarios, clubes, publicaciones, amistades }
     POST /api/accion    { tipo: 'publicar'|'solicitar'|'aceptar'|'crear-club'|'toggle-club', ... } -> { ok } | { error }
     POST /api/seed      {}   (solo desarrollo: carga datos de ejemplo)
   Autenticación: cabecera  Authorization: Bearer <token>
   Errores: el servidor responde { error: "mensaje" }
   NOTA: "identificacion" todavía no la valida el servidor (pendiente con Manuel).
   ===================================================================== */
const Api = (() => {
  const K_TOKEN = 'una_tok', K_ID = 'una_id';
  const leer = k => { try { return localStorage.getItem(k); } catch { return null; } };
  const guardar = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };

  let token = leer(K_TOKEN);
  const api = {
    yo: leer(K_ID),
    onSesionExpirada: null,
    haySesion: () => !!token && !!api.yo,
    guardarSesion(t, id) { token = t; api.yo = id; guardar(K_TOKEN, t); guardar(K_ID, id); },
    cerrarSesion() { token = null; api.yo = null; guardar(K_TOKEN, null); guardar(K_ID, null); }
  };

  // Devuelve siempre { ok, datos, error }. Nunca lanza excepciones.
  async function llamar(ruta, cuerpo) {
    try {
      const cab = { 'Content-Type': 'application/json' };
      if (token) cab.Authorization = 'Bearer ' + token;
      const r = await fetch(ruta, { method: 'POST', headers: cab, body: JSON.stringify(cuerpo || {}) });
      const datos = await r.json().catch(() => ({ error: 'Respuesta no válida del servidor.' }));
      if (r.status === 401 && token && ruta !== '/api/login') {
        api.cerrarSesion();
        if (api.onSesionExpirada) api.onSesionExpirada();
      }
      return { ok: r.ok && !datos.error, datos, error: datos.error || (r.ok ? null : 'Error del servidor.') };
    } catch {
      return { ok: false, datos: {}, error: 'No se pudo conectar con el servidor.' };
    }
  }

  api.login = (usuario, pass) => llamar('/api/login', { usuario, pass });
  api.registro = (d) => llamar('/api/registro', d);
  api.estado = () => llamar('/api/estado');
  api.accion = (cuerpo) => llamar('/api/accion', cuerpo);
  api.seed = () => llamar('/api/seed');
  return api;
})();