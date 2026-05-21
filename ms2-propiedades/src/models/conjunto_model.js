const mysql = require('mysql2/promise'); 
 
const connection = mysql.createPool({ 
    host: 'db_ms2', 
    user: 'root', 
    password: 'Josue2311$', 
    database: 'propiedades_db' 
    //puerto: 3306 // si MySQL no está en el puerto por defecto, descomentar esta línea y ajusta el puerto
}); 
 
async function obtenerConjunto() { 
    const result = await connection.query('SELECT * FROM conjunto'); 
    return result[0]; 
} 

async function obtenerConjuntoPorId(id) {
    const result = await connection.query(
        'SELECT * FROM conjunto WHERE id = ?',
        [id]
    );
    return result[0][0]; // devuelve solo el primer producto
}

async function crearConjunto(nombre) { 
    const result = await connection.query('INSERT INTO conjunto VALUES(null,?)', [nombre]); 
    return result; 
} 

async function editarConjunto(id, nombre) {
    const result = await connection.query(
        `UPDATE conjunto 
         SET nombre_conjunto = COALESCE(?, nombre_conjunto)
         WHERE id = ?`,
        [nombre, id]
    );

    return result;
}

async function eliminarConjunto(id) {
    const result = await connection.query(
        'DELETE FROM conjunto WHERE id = ?',
        [id]
    );
    return result;
}

module.exports = { 
    obtenerConjunto, 
    obtenerConjuntoPorId,
    crearConjunto,
    editarConjunto,
    eliminarConjunto
}; 
