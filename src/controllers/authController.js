const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

async function login(req, res, next) {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password) {
    return res.status(400).json({ error: 'email y password son requeridos' });
  }
  if (!process.env.JWT_SECRET) {
    return next(new Error('JWT_SECRET no esta configurado'));
  }

  try {
    const [filas] = await pool.query(
      'SELECT id, nombre, email, password_hash, rol FROM usuarios WHERE email = ? AND activo = TRUE',
      [email.trim().toLowerCase()]
    );
    const usuario = filas[0];
    if (!usuario || !(await bcrypt.compare(password, usuario.password_hash))) {
      return res.status(401).json({ error: 'Credenciales invalidas' });
    }

    const payload = {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '8h'
    });

    return res.json({ token, usuario: payload });
  } catch (error) {
    return next(error);
  }
}

module.exports = { login };
