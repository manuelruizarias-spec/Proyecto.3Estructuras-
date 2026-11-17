/* =====================================================================
   auditoria/login.js
   Inicio de sesión con verificación de contraseña.
   Responsable: Manuel (Sprint 1 - S1-1)
   ===================================================================== */

const { verificarContrasena } = require('./seguridad');

/**
 * Autentica a un usuario.
 * @param {object} baseDatos - { usuarios: [], ... }
 * @param {object} datos     - { usuario, pass }
 * @returns {object} { usuario } | { error, codigo }
 */
function iniciarSesion(baseDatos, datos) {
    datos = datos || {};

    const usuario = String(datos.usuario || '').trim().toLowerCase();
    const contrasena = datos.pass;

    // 1. Validaciones básicas
    if (!usuario || !contrasena) {
        return { error: 'Usuario y contraseña son obligatorios.', codigo: 400 };
    }

    // 2. Buscar usuario
    const encontrado = baseDatos.usuarios.find(u => u.usuario === usuario);
    if (!encontrado) {
        return { error: 'Credenciales incorrectas.', codigo: 401 };
    }

    // 3. Verificar contraseña en tiempo constante
    if (!verificarContrasena(String(contrasena), encontrado.hash)) {
        return { error: 'Credenciales incorrectas.', codigo: 401 };
    }

    // 4. Devolver datos públicos
    return {
        usuario: {
            id: encontrado.id,
            identificacion: encontrado.identificacion,
            nombre: encontrado.nombre,
            usuario: encontrado.usuario
        }
    };
}

module.exports = { iniciarSesion };