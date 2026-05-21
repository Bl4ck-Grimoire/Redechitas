const { Router } = require('express'); 
const router = Router(); 
const torre_model = require('../models/torre_model'); 
 
router.get('/api/torres', async (req, res) => {
  try {
    const torre = await torre_model.obtenerTorre();
    res.status(200).json(torre);
  } catch (error) {
    console.error("Error al obtener torres:", error);
    res.status(500).json({ error: "Error del servidor al obtener las torres" });
  }
});

// Obtener una torre por ID
router.get('/api/torres/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const torre = await torre_model.obtenerTorrePorId(id);
    if (!torre) {
      return res.status(404).json({ error: "Torre no encontrada" });
    }
    res.status(200).json(torre);
  } catch (error) {
    console.error("Error al obtener torre por ID:", error);
    res.status(500).json({ error: "Error del servidor al obtener torre" });
  }
});

router.post('/api/torres', async (req, res) => {
  try {
    const { nombre, num_pisos, conjunto_id } = req.body;
    const result = await torre_model.crearTorre(nombre, num_pisos, conjunto_id);
    res.status(201).json({ mensaje: "Torre creada con éxito" });
  } catch (error) {
    console.error("Error al insertar torre:", error);
    res.status(500).json({ error: "Error del servidor al insertar torre" });
  }
});
 
// Editar torre
router.put('/api/torres/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombret, num_pisos, conjunto_id } = req.body;
    await torre_model.editarTorre(id, nombret, num_pisos, conjunto_id);
    res.status(200).json({ mensaje: "Torre actualizada con éxito" });
  } catch (error) {
    console.error("Error al actualizar torre:", error);
    res.status(500).json({ error: "Error del servidor al actualizar torre" });
  }
});

// Eliminar torre
router.delete('/api/torres/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await torre_model.eliminarTorre(id);
    res.status(200).json({ mensaje: "Torre eliminada con éxito" });
  } catch (error) {
    console.error("Error al eliminar torre:", error);
    res.status(500).json({ error: "Error del servidor al eliminar torre" });
  }
});

module.exports = router; 
 