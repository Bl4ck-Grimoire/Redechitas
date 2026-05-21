const { Router }   = require('express');
const router        = Router();
const gestionModel  = require('../models/gestionModel');

// GET /api/gestiones
router.get('/api/gestiones', async (req, res) => {
    try {
        const gestiones = await gestionModel.obtenerGestiones();
        res.status(200).json(gestiones);
    } catch (error) {
        console.error('Error al obtener gestiones:', error);
        res.status(500).json({ error: 'Error del servidor al obtener las gestiones' });
    }
});

// GET /api/gestiones/:id
router.get('/api/gestiones/:id', async (req, res) => {
    try {
        const gestion = await gestionModel.obtenerGestionPorId(req.params.id);
        if (!gestion) {
            return res.status(404).json({ error: 'Gestión no encontrada' });
        }
        res.status(200).json(gestion);
    } catch (error) {
        console.error('Error al obtener gestión:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

// POST /api/gestiones
// Body: { id_usuario, id_apartamento, fecha_inicio, fecha_fin? }
router.post('/api/gestiones', async (req, res) => {
    try {
        const { id_usuario, id_apartamento, fecha_inicio, fecha_fin } = req.body;

        if (!id_usuario || !id_apartamento || !fecha_inicio) {
            return res.status(400).json({
                error: 'Faltan campos requeridos: id_usuario, id_apartamento, fecha_inicio'
            });
        }

        const result = await gestionModel.crearGestion(
            id_usuario, id_apartamento, fecha_inicio, fecha_fin
        );

        res.status(201).json({
            mensaje: 'Gestión creada con éxito. Apartamento marcado como ocupado.',
            id: result.insertId
        });
    } catch (error) {
        console.error('Error al crear gestión:', error);
        const status = error.esErrorDeNegocio ? 400 : 500;
        res.status(status).json({ error: error.message || 'Error del servidor' });
    }
});

// PUT /api/gestiones/:id
// Body: { fecha_inicio?, fecha_fin?, id_usuario?, id_apartamento? }
// Permite actualizar las fechas y/o reasignar usuario o apartamento.
router.put('/api/gestiones/:id', async (req, res) => {
    try {
        const { fecha_inicio, fecha_fin, id_usuario, id_apartamento } = req.body;

        await gestionModel.editarGestion(
            req.params.id,
            fecha_inicio,
            fecha_fin,
            id_usuario   ? parseInt(id_usuario)   : null,
            id_apartamento ? parseInt(id_apartamento) : null
        );

        res.status(200).json({ mensaje: 'Gestión actualizada correctamente.' });
    } catch (error) {
        console.error('Error al editar gestión:', error);
        const status = error.esErrorDeNegocio ? 400 : 500;
        res.status(status).json({ error: error.message || 'Error del servidor' });
    }
});

// DELETE /api/gestiones/:id
router.delete('/api/gestiones/:id', async (req, res) => {
    try {
        await gestionModel.eliminarGestion(req.params.id);
        res.status(200).json({ mensaje: 'Gestión eliminada correctamente' });
    } catch (error) {
        console.error('Error al eliminar gestión:', error);
        const status = error.esErrorDeNegocio ? 404 : 500;
        res.status(status).json({ error: error.message || 'Error del servidor' });
    }
});

module.exports = router;
