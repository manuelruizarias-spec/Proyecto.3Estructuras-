const crypto = require('crypto');

// Genera un hash seguro de la contraseña
function protegerContrasena(contrasena) {

    // Crear una sal aleatoria para cada usuario
    const sal = crypto.randomBytes(16).toString('hex');

    // Generar el hash utilizando scrypt
    const hash = crypto.scryptSync(
        contrasena,
        sal,
        32
    ).toString('hex');

    // Retornar la sal y el hash
    return `${sal}:${hash}`;
}


// Verifica una contraseña contra el valor guardado ("sal:hash")
function verificarContrasena(contrasena, guardado) {

    if (typeof contrasena !== 'string' || typeof guardado !== 'string') {
        return false;
    }

    const [sal, hash] = guardado.split(':');
    if (!sal || !hash) {
        return false;
    }

    const intento = crypto.scryptSync(contrasena, sal, 32);
    const real = Buffer.from(hash, 'hex');

    // Comparación en tiempo constante
    return intento.length === real.length &&
        crypto.timingSafeEqual(intento, real);
}


// Registrar un nuevo usuario en UNA Connect
// "guardar" es opcional: si se recibe, se ejecuta tras registrar para
// escribir usuarios.json en disco (si no, el llamador debe invocarlo).
function registrarUsuario(baseDatos, datos, guardar) {

    // Si el cuerpo de la petición llega vacío, evitar errores
    datos = datos || {};

    // 1. Obtener los datos del formulario
    const nombre = String(datos.nombre || '').trim();
    const usuario = String(datos.usuario || '').trim().toLowerCase();
    const contrasena = datos.pass;

    // 2. Validar el nombre
    if (nombre.length === 0) {
        return {
            error: 'Debe ingresar su nombre completo.',
            codigo: 400
        };
    }

    if (nombre.length > 60) {
        return {
            error: 'El nombre no puede superar los 60 caracteres.',
            codigo: 400
        };
    }

    // 3. Validar el nombre de usuario
    if (usuario.length < 3 || usuario.length > 30) {
        return {
            error: 'El usuario debe tener entre 3 y 30 caracteres.',
            codigo: 400
        };
    }

    // Solo permite letras, números, puntos y guiones
    if (!/^[a-z0-9_.-]+$/.test(usuario)) {
        return {
            error: 'El usuario contiene caracteres no permitidos.',
            codigo: 400
        };
    }

    // 4. Validar la contraseña
    if (typeof contrasena !== 'string' ||
        contrasena.length < 8 ||
        contrasena.length > 128) {

        return {
            error: 'La contraseña debe tener entre 8 y 128 caracteres.',
            codigo: 400
        };
    }

    // 5. Comprobar que el usuario no esté registrado
    const usuarioExistente = baseDatos.usuarios.some(
        estudiante => estudiante.usuario === usuario
    );

    if (usuarioExistente) {
        return {
            error: 'El nombre de usuario ya está registrado.',
            codigo: 409
        };
    }

    // 6. Crear el nuevo usuario
    const nuevoUsuario = {
        id: usuario,
        nombre: nombre,
        usuario: usuario,
        hash: protegerContrasena(contrasena)
    };

    // 7. Agregar el usuario a la lista dinámica
    baseDatos.usuarios.push(nuevoUsuario);

    // 8. Persistir en usuarios.json (si se recibió la función)
    if (typeof guardar === 'function') {
        guardar();
    }

    // 9. Retornar solo los datos públicos (nunca el hash)
    return {
        usuario: {
            id: nuevoUsuario.id,
            nombre: nuevoUsuario.nombre,
            usuario: nuevoUsuario.usuario
        }
    };
}


// Exportar las funciones para utilizarlas en server.js
module.exports = { registrarUsuario, protegerContrasena, verificarContrasena };
