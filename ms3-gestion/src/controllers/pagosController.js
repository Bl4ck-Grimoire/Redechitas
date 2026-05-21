const { Router } = require('express');
const router      = Router();
const pagosModel  = require('../models/pagosModel');

// GET /api/pagos — todos los pagos (actualiza automáticamente vencidos antes de responder)
router.get('/api/pagos', async (req, res) => {
    try {
        await pagosModel.actualizarVencidos();
        const pagos = await pagosModel.obtenerPagos();
        res.status(200).json(pagos);
    } catch (error) {
        console.error('Error al obtener pagos:', error);
        res.status(500).json({ error: 'Error del servidor al obtener los pagos' });
    }
});

// GET /api/pagos/gestion/:id_gestion — pagos de una gestión específica
router.get('/api/pagos/gestion/:id_gestion', async (req, res) => {
    try {
        await pagosModel.actualizarVencidos();
        const pagos = await pagosModel.obtenerPagosPorGestion(req.params.id_gestion);
        res.status(200).json(pagos);
    } catch (error) {
        console.error('Error al obtener pagos por gestión:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

// POST /api/pagos — registrar un nuevo pago mensual
// Body: { gestion_propiedades_id, monto, mes_facturacion, anio_facturacion }
// El estado se establece automáticamente como 'pendiente'
router.post('/api/pagos', async (req, res) => {
    try {
        const { gestion_propiedades_id, monto, mes_facturacion, anio_facturacion } = req.body;

        if (!gestion_propiedades_id || !monto || !mes_facturacion || !anio_facturacion) {
            return res.status(400).json({
                error: 'Faltan campos requeridos: gestion_propiedades_id, monto, mes_facturacion, anio_facturacion'
            });
        }

        const result = await pagosModel.crearPago(
            gestion_propiedades_id, monto, mes_facturacion, anio_facturacion
        );

        res.status(201).json({
            mensaje: 'Registro de pago creado con estado pendiente.',
            id: result.insertId
        });
    } catch (error) {
        console.error('Error al crear pago:', error);
        const status = error.esErrorDeNegocio ? 400 : 500;
        res.status(status).json({ error: error.message || 'Error del servidor' });
    }
});

// PATCH /api/pagos/:id/estado — actualizar el estado de un pago
// Body: { estado: "pagado" | "pendiente" | "vencido", fecha_pago? }
router.patch('/api/pagos/:id/estado', async (req, res) => {
    try {
        const { estado, fecha_pago } = req.body;

        if (!['pagado', 'pendiente', 'vencido'].includes(estado)) {
            return res.status(400).json({
                error: "El campo estado debe ser 'pagado', 'pendiente' o 'vencido'"
            });
        }

        await pagosModel.actualizarEstado(req.params.id, estado, fecha_pago);
        res.status(200).json({ mensaje: `Estado de pago actualizado a '${estado}'` });
    } catch (error) {
        console.error('Error al actualizar estado de pago:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

// DELETE /api/pagos/:id — eliminar un registro de pago
router.delete('/api/pagos/:id', async (req, res) => {
    try {
        await pagosModel.eliminarPago(req.params.id);
        res.status(200).json({ mensaje: 'Registro de pago eliminado correctamente' });
    } catch (error) {
        console.error('Error al eliminar pago:', error);
        const status = error.esErrorDeNegocio ? 404 : 500;
        res.status(status).json({ error: error.message || 'Error del servidor' });
    }
});

module.exports = router;