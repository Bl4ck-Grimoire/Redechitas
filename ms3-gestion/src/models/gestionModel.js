const mysql = require('mysql2/promise');

// Cambiar por las IPs reales de producción
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

async function fetchServicio(url) {
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

// ─── LIBERAR APARTAMENTOS VENCIDOS ────────────────────────────────────────────
// Se dispara en segundo plano (fire-and-forget) para no bloquear los GET.
// Si una gestión tiene fecha_fin pasada y el apartamento en MS2 sigue ocupado,
// lo libera automáticamente.
function liberarAptoVencidos() {
    const hoy = new Date().toISOString().split('T')[0];

    connection.query(
        `SELECT id, apartamento_id
         FROM gestion_propiedades
         WHERE fecha_fin IS NOT NULL AND fecha_fin < ?`,
        [hoy]
    )
    .then(([vencidas]) => {
        for (const g of vencidas) {
            fetchServicio(`${MS2_URL}/api/apartamentos/${g.apartamento_id}`)
                .then(apartamento => {
                    if (apartamento && apartamento.estado === 'ocupado') {
                        fetch(`${MS2_URL}/api/apartamentos/${g.apartamento_id}`, {
                            method:  'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body:    JSON.stringify({ estado: 'disponible' })
                        }).catch(() => {
                            console.warn(`ADVERTENCIA: No se pudo liberar apto ${g.apartamento_id} (gestión ${g.id} vencida).`);
                        });
                    }
                })
                .catch(() => {});
        }
    })
    .catch(err => console.warn('ADVERTENCIA: Error al consultar gestiones vencidas:', err.message));
}

// ─── VALIDAR SOLAPAMIENTO DE FECHAS ───────────────────────────────────────────
async function validarSolapamiento(id_apartamento, fecha_inicio, fecha_fin, idExcluir = null) {
    const finNuevo = fecha_fin || '9999-12-31';

    const [solapadas] = await connection.query(
        `SELECT id, fecha_inicio, fecha_fin
         FROM gestion_propiedades
         WHERE apartamento_id = ?
           AND (? IS NULL OR id <> ?)
           AND fecha_inicio <= ?
           AND COALESCE(fecha_fin, '9999-12-31') >= ?`,
        [id_apartamento, idExcluir, idExcluir, finNuevo, fecha_inicio]
    );

    if (solapadas.length > 0) {
        const g = solapadas[0];
        const finTexto = g.fecha_fin ?? 'sin fecha fin (activa)';
        throw errorNegocio(
            `El apartamento ya tiene una gestión en ese rango de fechas ` +
            `(gestión ID ${g.id}: ${g.fecha_inicio} — ${finTexto}).`
        );
    }
}

// ─── OBTENER TODAS LAS GESTIONES ─────────────────────────────────────────────
// liberarAptoVencidos corre en segundo plano — no bloquea la respuesta
async function obtenerGestiones() {
    liberarAptoVencidos(); // fire-and-forget, sin await
    const [rows] = await connection.query(
        'SELECT * FROM gestion_propiedades ORDER BY created_at DESC'
    );
    return rows;
}

// ─── OBTENER GESTIÓN POR ID ───────────────────────────────────────────────────
async function obtenerGestionPorId(id) {
    liberarAptoVencidos(); // fire-and-forget, sin await
    const [rows] = await connection.query(
        'SELECT * FROM gestion_propiedades WHERE id = ?', [id]
    );
    return rows[0] || null;
}

// ─── CREAR GESTIÓN ────────────────────────────────────────────────────────────
async function crearGestion(id_usuario, id_apartamento, fecha_inicio, fecha_fin) {

    const usuario = await fetchServicio(`${MS1_URL}/api/usuarios/${id_usuario}`);
    if (!usuario) {
        throw errorNegocio(`El usuario con ID ${id_usuario} no existe en el sistema.`);
    }

    const apartamento = await fetchServicio(`${MS2_URL}/api/apartamentos/${id_apartamento}`);
    if (!apartamento) {
        throw errorNegocio(`El apartamento con ID ${id_apartamento} no existe en el sistema.`);
    }

    if (apartamento.estado === 'ocupado') {
        throw errorNegocio(`El apartamento ${apartamento.numero} ya está ocupado.`);
    }

    await validarSolapamiento(id_apartamento, fecha_inicio, fecha_fin || null);

    try {
        const [result] = await connection.query(
            `INSERT INTO gestion_propiedades
                (usuario_id, apartamento_id, fecha_inicio, fecha_fin,
                 nombre_usuario, email_usuario, rol_usuario,
                 numero_apartamento, piso_apartamento, estado_apartamento)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id_usuario,        id_apartamento,    fecha_inicio, fecha_fin || null,
                usuario.nombre,    usuario.email,     usuario.rol,
                apartamento.numero, apartamento.piso, apartamento.estado
            ]
        );

        // Marcar apartamento como ocupado en MS2 (segundo plano)
        fetch(`${MS2_URL}/api/apartamentos/${id_apartamento}`, {
            method:  'PUT',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ estado: 'ocupado' })
        }).catch(() => {
            console.warn(`ADVERTENCIA: No se pudo actualizar estado del apartamento ${id_apartamento} en MS2.`);
        });

        return result;

    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            throw errorNegocio('Este apartamento ya tiene una gestión registrada. Elimine la actual antes de crear una nueva.');
        }
        throw error;
    }
}

// ─── EDITAR GESTIÓN ───────────────────────────────────────────────────────────
async function editarGestion(id, fecha_inicio, fecha_fin, id_usuario, id_apartamento) {

    const [gestiones] = await connection.query(
        'SELECT * FROM gestion_propiedades WHERE id = ?', [id]
    );
    if (!gestiones[0]) throw errorNegocio('Gestión no encontrada.');

    const gestionActual = gestiones[0];
    const campos  = [];
    const valores = [];

    if (fecha_inicio) { campos.push('fecha_inicio = ?'); valores.push(fecha_inicio); }
    if (fecha_fin !== undefined) { campos.push('fecha_fin = ?'); valores.push(fecha_fin || null); }

    const inicioFinal = fecha_inicio || gestionActual.fecha_inicio;
    const finFinal    = fecha_fin !== undefined ? (fecha_fin || null) : gestionActual.fecha_fin;
    const aptoFinal   = id_apartamento || gestionActual.apartamento_id;

    await validarSolapamiento(aptoFinal, inicioFinal, finFinal, id);

    if (id_usuario && id_usuario !== gestionActual.usuario_id) {
        const usuario = await fetchServicio(`${MS1_URL}/api/usuarios/${id_usuario}`);
        if (!usuario) throw errorNegocio(`El usuario con ID ${id_usuario} no existe en el sistema.`);
        campos.push('usuario_id = ?', 'nombre_usuario = ?', 'email_usuario = ?', 'rol_usuario = ?');
        valores.push(id_usuario, usuario.nombre, usuario.email, usuario.rol);
    }

    if (id_apartamento && id_apartamento !== gestionActual.apartamento_id) {
        const apartamento = await fetchServicio(`${MS2_URL}/api/apartamentos/${id_apartamento}`);
        if (!apartamento) throw errorNegocio(`El apartamento con ID ${id_apartamento} no existe en el sistema.`);
        if (apartamento.estado === 'ocupado') throw errorNegocio(`El apartamento ${apartamento.numero} ya está ocupado.`);

        campos.push('apartamento_id = ?', 'numero_apartamento = ?', 'piso_apartamento = ?', 'estado_apartamento = ?');
        valores.push(id_apartamento, apartamento.numero, apartamento.piso, apartamento.estado);

        fetch(`${MS2_URL}/api/apartamentos/${gestionActual.apartamento_id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estado: 'disponible' })
        }).catch(() => console.warn('ADVERTENCIA: No se pudo liberar el apartamento anterior en MS2.'));

        fetch(`${MS2_URL}/api/apartamentos/${id_apartamento}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estado: 'ocupado' })
        }).catch(() => console.warn('ADVERTENCIA: No se pudo ocupar el nuevo apartamento en MS2.'));
    }

    if (campos.length === 0) return;
    valores.push(id);
    await connection.query(`UPDATE gestion_propiedades SET ${campos.join(', ')} WHERE id = ?`, valores);
}

// ─── ELIMINAR GESTIÓN ─────────────────────────────────────────────────────────
async function eliminarGestion(id) {
    const [gestiones] = await connection.query(
        'SELECT * FROM gestion_propiedades WHERE id = ?', [id]
    );
    if (!gestiones[0]) throw errorNegocio('Gestión no encontrada.');

    const { apartamento_id } = gestiones[0];
    await connection.query('DELETE FROM gestion_propiedades WHERE id = ?', [id]);

    fetch(`${MS2_URL}/api/apartamentos/${apartamento_id}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ estado: 'disponible' })
    }).catch(() => {
        console.warn(`ADVERTENCIA: No se pudo liberar el apartamento ${apartamento_id} en MS2.`);
    });
}

module.exports = {
    obtenerGestiones,
    obtenerGestionPorId,
    crearGestion,
    editarGestion,
    eliminarGestion
};