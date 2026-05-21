const { Router }   = require('express');
const router        = Router();
const usuarios_model = require('../models/usuarios_model');

// ─── GET /api/usuarios ────────────────────────────────────────────────────────
router.get('/api/usuarios', async (req, res) => {
    try {
        const usuarios = await usuarios_model.obtenerUsuarios();
        res.status(200).json(usuarios);
    } catch (error) {
        console.error('Error al obtener usuarios:', error);
        res.status(500).json({ error: 'Error del servidor al obtener los usuarios' });
    }
});

// ─── GET /api/usuarios/:id ────────────────────────────────────────────────────
router.get('/api/usuarios/:id', async (req, res) => {
    try {
        const usuario = await usuarios_model.obtenerUsuarioPorId(req.params.id);
        if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
        res.status(200).json(usuario);
    } catch (error) {
        console.error('Error al obtener usuario por ID:', error);
        res.status(500).json({ error: 'Error del servidor al obtener usuario' });
    }
});

// ─── POST /api/login ──────────────────────────────────────────────────────────
// Autentica un administrador. Devuelve los datos del usuario (sin password_hash).
router.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Usuario y contraseña son requeridos.' });
        }
        const usuario = await usuarios_model.loginUsuario(username, password);
        res.status(200).json(usuario);
    } catch (error) {
        console.error('Error en login:', error.message);
        res.status(401).json({ error: error.message });
    }
});

// ─── PUT /api/usuarios/:id/cambiar-password ───────────────────────────────────
// Cambia la contraseña de un usuario y marca password_changed = 1.
router.put('/api/usuarios/:id/cambiar-password', async (req, res) => {
    try {
        const { nueva_password } = req.body;
        if (!nueva_password || nueva_password.length < 6) {
            return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
        }
        await usuarios_model.cambiarPassword(req.params.id, nueva_password);
        res.status(200).json({ mensaje: 'Contraseña actualizada correctamente.' });
    } catch (error) {
        console.error('Error al cambiar contraseña:', error);
        res.status(500).json({ error: 'Error del servidor al cambiar contraseña.' });
    }
});

// ─── POST /api/usuarios ───────────────────────────────────────────────────────
router.post('/api/usuarios', async (req, res) => {
    try {
        const { nombre, telefono, email, username, password, rol, conjunto_id } = req.body;
        await usuarios_model.crearUsuario(nombre, telefono, email, username, password, rol, conjunto_id);
        res.status(201).json({ mensaje: 'Usuario creado con éxito' });
    } catch (error) {
        console.error('Error al insertar usuario:', error);
        res.status(500).json({ error: error.message || 'Error del servidor al insertar usuario' });
    }
});

// ─── PUT /api/usuarios/:id ────────────────────────────────────────────────────
router.put('/api/usuarios/:id', async (req, res) => {
    try {
        const { nombre, telefono, email, username, password, rol, conjunto_id } = req.body;
        await usuarios_model.editarUsuario(
            req.params.id, nombre, telefono, email, username, password, rol, conjunto_id
        );
        res.status(200).json({ mensaje: 'Usuario actualizado con éxito' });
    } catch (error) {
        console.error('Error al actualizar usuario:', error);
        res.status(500).json({ error: error.message || 'Error del servidor al actualizar usuario' });
    }
});

// ─── DELETE /api/usuarios/:id ─────────────────────────────────────────────────
router.delete('/api/usuarios/:id', async (req, res) => {
    try {
        await usuarios_model.eliminarUsuario(req.params.id);
        res.status(200).json({ mensaje: 'Usuario eliminado con éxito' });
    } catch (error) {
        console.error('Error al eliminar usuario:', error);
        res.status(500).json({ error: 'Error del servidor al eliminar usuario' });
    }
});

module.exports = router;