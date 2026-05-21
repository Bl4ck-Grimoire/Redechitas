const { Router } = require('express'); 
const router = Router(); 
const conjunto_model = require('../models/conjunto_model'); 
 
router.get('/api/conjuntos', async (req, res) => {
  try {
    const conjunto = await conjunto_model.obtenerConjunto();
    res.status(200).json(conjunto);
  } catch (error) {
    console.error("Error al obtener conjuntos:", error);
    res.status(500).json({ error: "Error del servidor al obtener los conjuntos" });
  }
});

// Obtener un conjunto por ID
router.get('/api/conjuntos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const conjunto = await conjunto_model.obtenerConjuntoPorId(id);
    if (!conjunto) {
      return res.status(404).json({ error: "Conjunto no encontrado" });
    }
    res.status(200).json(conjunto);
  } catch (error) {
    console.error("Error al obtener conjunto por ID:", error);
    res.status(500).json({ error: "Error del servidor al obtener conjunto" });
  }
});

router.post('/api/conjuntos', async (req, res) => {
  try {
    const { nombre_conjunto } = req.body;
    const result = await conjunto_model.crearConjunto(nombre_conjunto);
    res.status(201).json({ mensaje: "Conjunto creado con éxito" });
  } catch (error) {
    console.error("Error al insertar conjunto:", error);
    res.status(500).json({ error: "Error del servidor al insertar conjunto" });
  }
});
 
// Editar conjunto
router.put('/api/conjuntos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre_conjunto } = req.body;
    await conjunto_model.editarConjunto(id, nombre_conjunto);
    res.status(200).json({ mensaje: "Conjunto actualizado con éxito" });
  } catch (error) {
    console.error("Error al actualizar conjunto:", error);
    res.status(500).json({ error: "Error del servidor al actualizar conjunto" });
  }
});

// Eliminar conjunto
router.delete('/api/conjuntos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await conjunto_model.eliminarConjunto(id);
    res.status(200).json({ mensaje: "Conjunto eliminado con éxito" });
  } catch (error) {
    console.error("Error al eliminar conjunto:", error);
    res.status(500).json({ error: "Error del servidor al eliminar conjunto" });
  }
});

module.exports = router; 
 