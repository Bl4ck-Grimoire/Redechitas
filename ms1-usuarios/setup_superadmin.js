// setup_superadmin.js
// Ejecutar UNA SOLA VEZ con: node setup_superadmin.js
// Crea el superadmin con contraseña inicial Admin123! que deberá cambiar al primer login.

const bcrypt = require('bcrypt');
const mysql  = require('mysql2/promise');

async function main() {
    const conn = await mysql.createConnection({
        host:     'db_ms1',
        user:     'root',
        password: 'Josue2311$',           // <- pon tu contraseña de MySQL aquí
        database: 'usuarios_db'
    });

    // Verificar si ya existe
    const [existing] = await conn.execute(
        "SELECT id FROM usuario WHERE username = 'superadmin'"
    );
    if (existing.length > 0) {
        console.log('El superadmin ya existe. No se creó uno nuevo.');
        await conn.end();
        return;
    }

    const hash = await bcrypt.hash('Admin123!', 10);

    await conn.execute(
        `INSERT INTO usuario
            (nombre, telefono, email, username, password_hash, rol, conjunto_id, password_changed)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ['Super Administrador', '0000000000', 'superadmin@sistema.com',
         'superadmin', hash, 'administrador', null, 0]
    );

    console.log('─────────────────────────────────────────');
    console.log('Superadmin creado exitosamente.');
    console.log('Usuario:           superadmin');
    console.log('Contraseña inicial: Admin123!');
    console.log('Al iniciar sesión deberás cambiar la contraseña.');
    console.log('─────────────────────────────────────────');

    await conn.end();
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });