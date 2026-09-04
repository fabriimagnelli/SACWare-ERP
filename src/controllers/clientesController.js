const pool = require('../config/db');

function validarCliente(body) {
  const camposRequeridos = ['razon_social', 'cuit'];
  const faltantes = camposRequeridos.filter((campo) => {
    return body[campo] === undefined || body[campo] === null || body[campo] === '';
  });
  return faltantes.length > 0 ? `Campos requeridos faltantes: ${faltantes.join(', ')}` : null;
}

async function listarClientes(_req, res, next) {
  try {
    const [filas] = await pool.query('SELECT * FROM clientes ORDER BY razon_social ASC');
    return res.json(filas);
  } catch (error) {
    return next(error);
  }
}

async function crearCliente(req, res, next) {
  const errorValidacion = validarCliente(req.body);
  if (errorValidacion) {
    return res.status(400).json({ error: errorValidacion });
  }

  const { razon_social, cuit, telefono = null, email = null, direccion = null } = req.body;
  try {
    const [resultado] = await pool.query(
      `INSERT INTO clientes (razon_social, cuit, telefono, email, direccion)
       VALUES (?, ?, ?, ?, ?)`,
      [razon_social, cuit, telefono, email, direccion]
    );
    const [filas] = await pool.query('SELECT * FROM clientes WHERE id = ?', [resultado.insertId]);
    return res.status(201).json(filas[0]);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'El CUIT ya existe' });
    }
    return next(error);
  }
}

async function obtenerCliente(req, res, next) {
  try {
    const [filas] = await pool.query('SELECT * FROM clientes WHERE id = ?', [req.params.id]);
    if (filas.length === 0) return res.status(404).json({ error: 'Cliente no encontrado' });
    return res.json(filas[0]);
  } catch (error) {
    return next(error);
  }
}

async function actualizarCliente(req, res, next) {
  const errorValidacion = validarCliente(req.body);
  if (errorValidacion) return res.status(400).json({ error: errorValidacion });
  const { razon_social, cuit, telefono = null, email = null, direccion = null } = req.body;
  try {
    const [resultado] = await pool.query(
      `UPDATE clientes SET razon_social = ?, cuit = ?, telefono = ?, email = ?, direccion = ? WHERE id = ?`,
      [razon_social, cuit, telefono, email, direccion, req.params.id]
    );
    if (resultado.affectedRows === 0) return res.status(404).json({ error: 'Cliente no encontrado' });
    return obtenerCliente(req, res, next);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'El CUIT ya existe' });
    return next(error);
  }
}

async function eliminarCliente(req, res, next) {
  try {
    const [resultado] = await pool.query('DELETE FROM clientes WHERE id = ?', [req.params.id]);
    if (resultado.affectedRows === 0) return res.status(404).json({ error: 'Cliente no encontrado' });
    return res.status(204).send();
  } catch (error) {
    if (error.code === 'ER_ROW_IS_REFERENCED_2') return res.status(409).json({ error: 'El cliente tiene pedidos asociados' });
    return next(error);
  }
}

module.exports = { listarClientes, crearCliente, obtenerCliente, actualizarCliente, eliminarCliente };
