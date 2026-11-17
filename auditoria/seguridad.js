/* =====================================================================
   auditoria/seguridad.js
   Funciones de seguridad compartidas por registro y login.
   Responsable: Manuel (Sprint 1 - S1-1)
   ===================================================================== */

const crypto = require('crypto');

/**
 * Genera un hash seguro de la contraseña con sal aleatoria.
 * Formato devuelto: "sal:hash" (ambos en hexadecimal).
 */
function protegerContrasena(contrasena) {
    const sal = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(contrasena, sal, 32).toString('hex');
    return `${sal}:${hash}`;
}

/**
 * Verifica una contraseña contra el valor guardado ("sal:hash").
 * Comparación en tiempo constante para evitar ataques de timing.
 */
function verificarContrasena(contrasena, guardado) {
    if (typeof contrasena !== 'string' || typeof guardado !== 'string') {
        return false;
    }
    const [sal, hash] = guardado.split(':');
    if (!sal || !hash) return false;

    const intento = crypto.scryptSync(contrasena, sal, 32);
    const real = Buffer.from(hash, 'hex');

    return intento.length === real.length &&
        crypto.timingSafeEqual(intento, real);
}

module.exports = { protegerContrasena, verificarContrasena };