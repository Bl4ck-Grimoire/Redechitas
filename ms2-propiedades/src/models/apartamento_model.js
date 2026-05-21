const mysql = require('mysql2/promise'); 
 
const connection = mysql.createPool({ 
    host: 'db_ms2', 
    user: 'root', 
    password: 'Josue2311$', 
    database: 'propiedades_db' 
    //puerto: 3306 // si MySQL no está en el puerto por defecto, descomentar esta línea y ajusta el puerto
}); 
 
async function obtenerApartamento() { 
    const result = await connection.query('SELECT * FROM apartamento'); 
    return result[0]; 
} 

async function obtenerApartamentoPorId(id) {
    const result = await connection.query(
        'SELECT * FROM apartamento WHERE id = ?',
        [id]
    );
    return result[0][0]; // devuelve solo el primer producto
}

async function crearApartamento(numero, piso, torre_id, estado) { 
    const result = await connection.query('INSERT INTO apartamento VALUES(null, ?, ?, ?, ?)', [numero, piso, torre_id, estado]); 
    return result; 
} 

async function editarApartamento(id, numero, piso, torre_id, estado) {
    const result = await connection.query(
        `UPDATE apartamento 
         SET numero = COALESCE(?, numero),
             piso = COALESCE(?, piso),
             torre_id = COALESCE(?, torre_id),
             estado = COALESCE(?, estado)
         WHERE id = ?`,
        [numero, piso, torre_id, estado, id]
    );

    return result;
}

async function eliminarApartamento(id) {
    const result = await connection.query(
        'DELETE FROM apartamento WHERE id = ?',
        [id]
    );
    return result;
}

module.exports = { 
    obtenerApartamento, 
    obtenerApartamentoPorId,
    crearApartamento,
    editarApartamento,
    eliminarApartamento
}; 
