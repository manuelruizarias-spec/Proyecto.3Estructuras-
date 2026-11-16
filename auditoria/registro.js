/* =====================================================================
   auditoria/registro.js
   Registro de nuevos usuarios con validaciones.
   Responsable: Manuel (Sprint 1 - S1-1)
   ===================================================================== */

const { protegerContrasena } = require('./seguridad');

/**
 * Registra un nuevo usuario en baseDatos.usuarios.
 * @param {object} baseDatos - { usuarios: [], ... } en memoria
 * @param {object} datos     - { identificacion, nombre, usuario, pass }
 * @param {function} guardar - callback opcional para persistir en disco
 * @returns {object} { usuario } | { error, codigo }
 */
function registrarUsuario(baseDatos, datos, guardar) {
    datos = datos || {};

    // 1. Obtener y limpiar datos
    const identificacion = String(datos.identificacion || '').trim();
    const nombre = String(datos.nombre || '').trim();
    const usuario = String(datos.usuario || '').trim().toLowerCase();
    const contrasena = datos.pass;

    // 2. Validar identificación (nueva, exigida por el plan S1-1)
    if (identificacion.length === 0) {
        return { error: 'La identificación es obligatoria.', codigo: 400 };
    }
    if (identificacion.length > 20) {
        return { error: 'La identificación no puede superar los 20 caracteres.', codigo: 400 };
    }
    if (baseDatos.usuarios.some(u => u.identificacion === identificacion)) {
        return { error: 'Esa identificación ya está registrada.', codigo: 409 };
    }

    // 3. Validar nombre
    if (nombre.length === 0) {
        return { error: 'Debe ingresar su nombre completo.', codigo: 400 };
    }
    if (nombre.length > 60) {
        return { error: 'El nombre no puede superar los 60 caracteres.', codigo: 400 };
    }

    // 4. Validar usuario
    if (usuario.length < 3 || usuario.length > 30) {
        return { error: 'El usuario debe tener entre 3 y 30 caracteres.', codigo: 400 };
    }
    if (!/^[a-z0-9_.-]+$/.test(usuario)) {
        return { error: 'El usuario contiene caracteres no permitidos.', codigo: 400 };
    }
    if (baseDatos.usuarios.some(u => u.usuario === usuario)) {
        return { error: 'El nombre de usuario ya está registrado.', codigo: 409 };
    }

    // 5. Validar contraseña
    if (typeof contrasena !== 'string' || contrasena.length < 8 || contrasena.length > 128) {
        return { error: 'La contraseña debe tener entre 8 y 128 caracteres.', codigo: 400 };
    }

    // 6. Crear usuario
    const nuevoUsuario = {
        id: usuario,
        identificacion,
        nombre,
        usuario,
        hash: protegerContrasena(contrasena)
    };
    baseDatos.usuarios.push(nuevoUsuario);

    // 7. Persistir
    if (typeof guardar === 'function') guardar();

    // 8. Devolver datos públicos (sin hash)
    return {
        usuario: {
            id: nuevoUsuario.id,
            identificacion: nuevoUsuario.identificacion,
            nombre: nuevoUsuario.nombre,
            usuario: nuevoUsuario.usuario
        }
    };
}

module.exports = { registrarUsuario };