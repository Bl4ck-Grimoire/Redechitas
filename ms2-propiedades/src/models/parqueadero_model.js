const mysql = require('mysql2/promise'); 
 
const connection = mysql.createPool({ 
    host: 'db_ms2', 
    user: 'root', 
    password: 'Josue2311$', 
    database: 'propiedades_db' 
    //puerto: 3306 // si MySQL no está en el puerto por defecto, descomentar esta línea y ajusta el puerto
}); 
 
async function obtenerParqueadero() { 
    const result = await connection.query('SELECT * FROM parqueadero'); 
    return result[0]; 
} 

async function obtenerParqueaderoPorId(id) {
    const result = await connection.query(
        'SELECT * FROM parqueadero WHERE id = ?',
        [id]
    );
    return result[0][0]; // devuelve solo el primer producto
}

async function crearParqueadero(numero, tipo, apartamento_id) { 
    const result = await connection.query('INSERT INTO parqueadero VALUES(null, ?, ?, ?)', [numero, tipo, apartamento_id]); 
    return result; 
} 

async function editarParqueadero(id, numero, tipo, apartamento_id) {
    const result = await connection.query(
        `UPDATE parqueadero 
         SET numero = COALESCE(?, numero),
             tipo = COALESCE(?, tipo),
             apartamento_id = COALESCE(?, apartamento_id)
         WHERE id = ?`,
        [numero, tipo, apartamento_id, id]
    );

    return result;
}

async function eliminarParqueadero(id) {
    const result = await connection.query(
        'DELETE FROM parqueadero WHERE id = ?',
        [id]
    );
    return result;
}

module.exports = { 
    obtenerParqueadero, 
    obtenerParqueaderoPorId,
    crearParqueadero,
    editarParqueadero,
    eliminarParqueadero
}; 
