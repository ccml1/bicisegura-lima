// HU03 · Registro e inicio de sesión (bcrypt + JWT)
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { firmarToken } = require('../auth');
const { requerido, ErrorValidacion } = require('../validar');

const router = express.Router();

router.post('/auth/registro', async (req, res) => {
  requerido(req.body, ['nombre', 'email', 'password']);
  const { nombre, email, password } = req.body;
  if (String(password).length < 8) throw new ErrorValidacion('La contraseña debe tener al menos 8 caracteres');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ErrorValidacion('Correo inválido');
  const hash = await bcrypt.hash(password, 10);
  const { rows } = await db.query(
    'INSERT INTO usuarios (nombre, email, password_hash) VALUES ($1, lower($2), $3) RETURNING id, nombre, email',
    [String(nombre).trim().slice(0, 80), email, hash],
  );
  res.status(201).json({ token: firmarToken(rows[0]), usuario: rows[0] });
});

router.post('/auth/login', async (req, res) => {
  requerido(req.body, ['email', 'password']);
  const { rows } = await db.query('SELECT id, nombre, email, password_hash FROM usuarios WHERE email = lower($1)', [req.body.email]);
  const usuario = rows[0];
  const ok = usuario && await bcrypt.compare(String(req.body.password), usuario.password_hash);
  if (!ok) return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
  return res.json({ token: firmarToken(usuario), usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email } });
});

module.exports = router;
