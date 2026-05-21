const { Router } = require('express'); 
const router = Router(); 
const apartamento_model = require('../models/apartamento_model'); 
 
router.get('/api/apartamentos', async (req, res) => {
  try {
    const apartamento = await apartamento_model.obtenerApartamento();
    res.status(200).json(apartamento);
  } catch (error) {
    console.error("Error al obtener apartamentos:", error);
    res.status(500).json({ error: "Error del servidor al obtener los apartamentos" });
  }
});

// Obtener un apartamento por ID
router.get('/api/apartamentos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const apartamento = await apartamento_model.obtenerApartamentoPorId(id);
    if (!apartamento) {
      return res.status(404).json({ error: "Apartamento no encontrado" });
    }
    res.status(200).json(apartamento);
  } catch (error) {
    console.error("Error al obtener apartamento por ID:", error);
    res.status(500).json({ error: "Error del servidor al obtener apartamento" });
  }
});

router.post('/api/apartamentos', async (req, res) => {
  try {
    const { numero, piso, torre_id, estado } = req.body;
    const result = await apartamento_model.crearApartamento(numero, piso, torre_id, estado);
    res.status(201).json({ mensaje: "Apartamento creado con éxito" });
  } catch (error) {
    console.error("Error al insertar apartamento:", error);
    res.status(500).json({ error: "Error del servidor al insertar apartamento" });
  }
});
 
// Editar apartamento
router.put('/api/apartamentos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { numero, piso, torre_id, estado } = req.body;
    await apartamento_model.editarApartamento(id, numero, piso, torre_id, estado);
    res.status(200).json({ mensaje: "Apartamento actualizado con éxito" });
  } catch (error) {
    console.error("Error al actualizar apartamento:", error);
    res.status(500).json({ error: "Error del servidor al actualizar apartamento" });
  }
});

// Eliminar apartamento
router.delete('/api/apartamentos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await apartamento_model.eliminarApartamento(id);
    res.status(200).json({ mensaje: "Apartamento eliminado con éxito" });
  } catch (error) {
    console.error("Error al eliminar apartamento:", error);
    res.status(500).json({ error: "Error del servidor al eliminar apartamento" });
  }
});

module.exports = router; 
 