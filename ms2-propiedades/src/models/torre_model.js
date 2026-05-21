const mysql = require('mysql2/promise'); 
 
const connection = mysql.createPool({ 
    host: 'db_ms2', 
    user: 'root', 
    password: 'Josue2311$', 
    database: 'propiedades_db' 
    //puerto: 3306 // si MySQL no está en el puerto por defecto, descomentar esta línea y ajusta el puerto
}); 
 
async function obtenerTorre() { 
    const result = await connection.query('SELECT * FROM torre'); 
    return result[0]; 
} 

async function obtenerTorrePorId(id) {
    const result = await connection.query(
        'SELECT * FROM torre WHERE id = ?',
        [id]
    );
    return result[0][0]; // devuelve solo el primer producto
}

async function crearTorre(nombre, num_pisos, conjunto_id) { 
    const result = await connection.query('INSERT INTO torre VALUES(null,?,?,?)', [nombre, num_pisos, conjunto_id]); 
    return result; 
} 

async function editarTorre(id, nombre, num_pisos, conjunto_id) {
    const result = await connection.query(
        `UPDATE torre 
         SET nombre = COALESCE(?, nombre),
             num_pisos = COALESCE(?, num_pisos),
             conjunto_id = COALESCE(?, conjunto_id)
         WHERE id = ?`,
        [nombre, num_pisos, conjunto_id, id]
    );

    return result;
}

async function eliminarTorre(id) {
    const result = await connection.query(
        'DELETE FROM torre WHERE id = ?',
        [id]
    );
    return result;
}

module.exports = { 
    obtenerTorre, 
    obtenerTorrePorId,
    crearTorre,
    editarTorre,
    eliminarTorre
}; 
