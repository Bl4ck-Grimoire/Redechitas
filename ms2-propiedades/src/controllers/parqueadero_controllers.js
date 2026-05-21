const { Router } = require('express'); 
const router = Router(); 
const parqueadero_model = require('../models/parqueadero_model'); 
 
router.get('/api/parqueaderos', async (req, res) => {
  try {
    const parqueadero = await parqueadero_model.obtenerParqueadero();
    res.status(200).json(parqueadero);
  } catch (error) {
    console.error("Error al obtener parqueaderos:", error);
    res.status(500).json({ error: "Error del servidor al obtener los parqueaderos" });
  }
});

// Obtener un parqueadero por ID
router.get('/api/parqueaderos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const parqueadero = await parqueadero_model.obtenerParqueaderoPorId(id);
    if (!parqueadero) {
      return res.status(404).json({ error: "Parqueadero no encontrado" });
    }
    res.status(200).json(parqueadero);
  } catch (error) {
    console.error("Error al obtener parqueadero por ID:", error);
    res.status(500).json({ error: "Error del servidor al obtener parqueadero" });
  }
});

router.post('/api/parqueaderos', async (req, res) => {
  try {
    const { numero, tipo, apartamento_id } = req.body;
    const result = await parqueadero_model.crearParqueadero(numero, tipo, apartamento_id);
    res.status(201).json({ mensaje: "Parqueadero creado con éxito" });
  } catch (error) {
    console.error("Error al insertar parqueadero:", error);
    res.status(500).json({ error: "Error del servidor al insertar parqueadero" });
  }
});
 
// Editar parqueadero
router.put('/api/parqueaderos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { numero, tipo, apartamento_id } = req.body;
    await parqueadero_model.editarParqueadero(id, numero, tipo, apartamento_id);
    res.status(200).json({ mensaje: "Parqueadero actualizado con éxito" });
  } catch (error) {
    console.error("Error al actualizar parqueadero:", error);
    res.status(500).json({ error: "Error del servidor al actualizar parqueadero" });
  }
});

// Eliminar parqueadero
router.delete('/api/parqueaderos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await parqueadero_model.eliminarParqueadero(id);
    res.status(200).json({ mensaje: "Parqueadero eliminado con éxito" });
  } catch (error) {
    console.error("Error al eliminar parqueadero:", error);
    res.status(500).json({ error: "Error del servidor al eliminar parqueadero" });
  }
});

module.exports = router; 
