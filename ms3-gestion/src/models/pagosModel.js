const mysql = require('mysql2/promise');

const MS1_URL = 'http://MS1:3000';
const MS2_URL = 'http://MS2:3001';

const connection = mysql.createPool({
    host:     'db_ms3',
    user:     'root',
    password: 'Josue2311$',               // <- ajusta según tu configuración
    database: 'residencias_gestion'
});

function errorNegocio(mensaje) {
    const err = new Error(mensaje);
    err.esErrorDeNegocio = true;
    return err;
}

const MESES = {
    enero: 1, febrero: 2, marzo: 3, abril: 4,
    mayo: 5, junio: 6, julio: 7, agosto: 8,
    septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12
};

// ─── ACTUALIZAR VENCIDOS ──────────────────────────────────────────────────────
async function actualizarVencidos() {
    const ahora      = new Date();
    const anioActual = ahora.getFullYear();
    const mesActual  = ahora.getMonth() + 1;

    const [pendientes] = await connection.query(
        "SELECT id, mes_facturacion, anio_facturacion FROM pago_administracion WHERE estado = 'pendiente'"
    );

    for (const pago of pendientes) {
        const mesPago  = MESES[pago.mes_facturacion];
        const anioPago = pago.anio_facturacion;

        const estaVencido =
            anioPago < anioActual ||
            (anioPago === anioActual && mesPago < mesActual);

        if (estaVencido) {
            await connection.query(
                "UPDATE pago_administracion SET estado = 'vencido' WHERE id = ?",
                [pago.id]
            );
        }
    }
}

// ─── OBTENER TODOS LOS PAGOS ──────────────────────────────────────────────────
// JOIN local con gestion_propiedades que ya tiene los datos de usuario
// y apartamento almacenados — sin llamadas HTTP adicionales.
async function obtenerPagos() {
    await actualizarVencidos();

    const [pagos] = await connection.query(`
        SELECT
            p.id,
            p.monto,
            p.mes_facturacion,
            p.anio_facturacion,
            p.estado,
            p.fecha_pago,
            p.gestion_propiedades_id,
            g.nombre_usuario,
            g.numero_apartamento,
            g.piso_apartamento
        FROM pago_administracion p
        JOIN gestion_propiedades g ON p.gestion_propiedades_id = g.id
        ORDER BY p.anio_facturacion DESC, p.id DESC
    `);

    return pagos;
}

// ─── OBTENER PAGOS POR GESTIÓN ────────────────────────────────────────────────
// JOIN local — sin llamadas HTTP.
async function obtenerPagosPorGestion(id_gestion) {
    await actualizarVencidos();

    const [gestiones] = await connection.query(
        'SELECT id FROM gestion_propiedades WHERE id = ?', [id_gestion]
    );
    if (!gestiones[0]) {
        throw errorNegocio('La gestión especificada no existe.');
    }

    const [pagos] = await connection.query(`
        SELECT
            p.id,
            p.monto,
            p.mes_facturacion,
            p.anio_facturacion,
            p.estado,
            p.fecha_pago,
            p.gestion_propiedades_id,
            g.nombre_usuario,
            g.numero_apartamento,
            g.piso_apartamento
        FROM pago_administracion p
        JOIN gestion_propiedades g ON p.gestion_propiedades_id = g.id
        WHERE p.gestion_propiedades_id = ?
        ORDER BY p.anio_facturacion DESC, p.id DESC
    `, [id_gestion]);

    return pagos;
}

// ─── CREAR PAGO ───────────────────────────────────────────────────────────────
async function crearPago(gestion_propiedades_id, monto, mes_facturacion, anio_facturacion) {
    const [gestiones] = await connection.query(
        'SELECT id FROM gestion_propiedades WHERE id = ?', [gestion_propiedades_id]
    );
    if (!gestiones[0]) {
        throw errorNegocio('La gestión especificada no existe.');
    }

    const [duplicado] = await connection.query(
        `SELECT id FROM pago_administracion
         WHERE gestion_propiedades_id = ? AND mes_facturacion = ? AND anio_facturacion = ?`,
        [gestion_propiedades_id, mes_facturacion, anio_facturacion]
    );
    if (duplicado[0]) {
        throw errorNegocio(`Ya existe un registro de pago para ${mes_facturacion} ${anio_facturacion} en esta gestión.`);
    }

    const [result] = await connection.query(
        `INSERT INTO pago_administracion
            (monto, mes_facturacion, anio_facturacion, estado, fecha_pago, gestion_propiedades_id)
         VALUES (?, ?, ?, 'pendiente', NULL, ?)`,
        [monto, mes_facturacion, anio_facturacion, gestion_propiedades_id]
    );
    return result;
}

// ─── ACTUALIZAR ESTADO ────────────────────────────────────────────────────────
async function actualizarEstado(id, estado, fecha_pago) {
    let fechaFinal = null;
    if (estado === 'pagado') {
        fechaFinal = fecha_pago || new Date().toISOString().split('T')[0];
    }
    await connection.query(
        'UPDATE pago_administracion SET estado = ?, fecha_pago = ? WHERE id = ?',
        [estado, fechaFinal, id]
    );
}

// ─── ELIMINAR PAGO ────────────────────────────────────────────────────────────
async function eliminarPago(id) {
    const [pagos] = await connection.query(
        'SELECT id FROM pago_administracion WHERE id = ?', [id]
    );
    if (!pagos[0]) {
        throw errorNegocio('Registro de pago no encontrado.');
    }
    await connection.query('DELETE FROM pago_administracion WHERE id = ?', [id]);
}

module.exports = {
    actualizarVencidos,
    obtenerPagos,
    obtenerPagosPorGestion,
    crearPago,
    actualizarEstado,
    eliminarPago
};
