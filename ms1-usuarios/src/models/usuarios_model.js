const mysql  = require('mysql2/promise');
const bcrypt = require('bcrypt');

const connection = mysql.createPool({
    host:     'db_ms1',
    user:     'root',
    password: 'Josue2311$',           
    database: 'usuarios_db'
});

const SALT_ROUNDS = 10;

// ─── OBTENER TODOS ────────────────────────────────────────────────────────────
// Nunca devuelve password_hash al cliente
async function obtenerUsuarios() {
    const [rows] = await connection.query(
        'SELECT id, nombre, telefono, email, username, rol, conjunto_id, password_changed FROM usuario'
    );
    return rows;
}

// ─── OBTENER POR ID ───────────────────────────────────────────────────────────
async function obtenerUsuarioPorId(id) {
    const [rows] = await connection.query(
        'SELECT id, nombre, telefono, email, username, rol, conjunto_id, password_changed FROM usuario WHERE id = ?',
        [id]
    );
    return rows[0] || null;
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
// Solo administradores pueden hacer login. Compara la contraseña con bcrypt.
async function loginUsuario(username, password) {
    const [rows] = await connection.query(
        "SELECT * FROM usuario WHERE username = ? AND rol = 'administrador'",
        [username]
    );
    if (!rows[0]) throw new Error('Usuario no encontrado o no tiene permisos de acceso.');

    const valido = await bcrypt.compare(password, rows[0].password_hash);
    if (!valido) throw new Error('Contraseña incorrecta.');

    // No devolver el hash al cliente
    const { password_hash, ...usuario } = rows[0];
    return usuario;
}

// ─── CREAR USUARIO ────────────────────────────────────────────────────────────
// conjunto_id solo aplica cuando rol = administrador
async function crearUsuario(nombre, telefono, email, username, password, rol, conjunto_id) {
    let passwordHash = null;

    if (rol === 'administrador') {
        if (!password) throw new Error('El administrador debe tener contraseña.');
        passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    }

    const [result] = await connection.query(
        `INSERT INTO usuario
            (nombre, telefono, email, username, password_hash, rol, conjunto_id, password_changed)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
        [nombre, telefono, email, username || null, passwordHash,
         rol, (rol === 'administrador' ? conjunto_id || null : null)]
    );
    return result;
}

// ─── EDITAR USUARIO ───────────────────────────────────────────────────────────
async function editarUsuario(id, nombre, telefono, email, username, password, rol, conjunto_id) {
    const campos  = [];
    const valores = [];

    if (nombre)    { campos.push('nombre = ?');    valores.push(nombre); }
    if (telefono)  { campos.push('telefono = ?');  valores.push(telefono); }
    if (email)     { campos.push('email = ?');     valores.push(email); }
    if (username !== undefined) { campos.push('username = ?'); valores.push(username || null); }
    if (rol)       { campos.push('rol = ?');       valores.push(rol); }
    if (conjunto_id !== undefined) {
        campos.push('conjunto_id = ?');
        valores.push(rol === 'administrador' ? (conjunto_id || null) : null);
    }

    if (password) {
        const hash = await bcrypt.hash(password, SALT_ROUNDS);
        campos.push('password_hash = ?');
        valores.push(hash);
    }

    if (campos.length === 0) return;

    valores.push(id);
    return connection.query(
        `UPDATE usuario SET ${campos.join(', ')} WHERE id = ?`, valores
    );
}

// ─── CAMBIAR CONTRASEÑA ───────────────────────────────────────────────────────
// Usada en el flujo de primer login forzado.
async function cambiarPassword(id, nuevaPassword) {
    const hash = await bcrypt.hash(nuevaPassword, SALT_ROUNDS);
    await connection.query(
        'UPDATE usuario SET password_hash = ?, password_changed = 1 WHERE id = ?',
        [hash, id]
    );
}

// ─── ELIMINAR ─────────────────────────────────────────────────────────────────
async function eliminarUsuario(id) {
    return connection.query('DELETE FROM usuario WHERE id = ?', [id]);
}

module.exports = {
    obtenerUsuarios,
    obtenerUsuarioPorId,
    loginUsuario,
    crearUsuario,
    editarUsuario,
    cambiarPassword,
    eliminarUsuario
};