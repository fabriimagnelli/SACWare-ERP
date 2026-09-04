const { randomUUID } = require('crypto');
const pool = require('../config/db');

function validarPedido(body) {
  if (!body || !Number.isInteger(body.cliente_id) || body.cliente_id <= 0) {
    return 'cliente_id debe ser un entero positivo';
  }
  if (!Array.isArray(body.detalles) || body.detalles.length === 0) {
    return 'detalles debe contener al menos un insumo';
  }
  for (const detalle of body.detalles) {
    if (!Number.isInteger(detalle.insumo_id) || detalle.insumo_id <= 0) {
      return 'cada detalle requiere un insumo_id valido';
    }
    if (!Number.isInteger(detalle.cantidad) || detalle.cantidad <= 0) {
      return 'cada detalle requiere una cantidad entera positiva';
    }
    if (!Number.isInteger(detalle.ancho_mm) || detalle.ancho_mm <= 0 ||
        !Number.isInteger(detalle.alto_mm) || detalle.alto_mm <= 0 ||
        typeof detalle.tipologia !== 'string' || !detalle.tipologia.trim()) {
      return 'cada detalle requiere tipologia, ancho_mm y alto_mm validos';
    }
  }
  return null;
}

async function crearPedido(req, res, next) {
  const errorValidacion = validarPedido(req.body);
  if (errorValidacion) {
    return res.status(400).json({ error: errorValidacion });
  }

  const { cliente_id, nro_pedido, fecha_entrega_estimada = null, detalles } = req.body;
  if (nro_pedido !== undefined && (typeof nro_pedido !== 'string' || !nro_pedido.trim())) {
    return res.status(400).json({ error: 'nro_pedido debe ser un texto no vacio' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [cliente] = await connection.query('SELECT id FROM clientes WHERE id = ?', [cliente_id]);
    if (cliente.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    const numeroPedido = nro_pedido ? nro_pedido.trim() : `PED-${randomUUID()}`;
    const [pedido] = await connection.query(
      `INSERT INTO pedidos (nro_pedido, cliente_id, fecha_entrega_estimada)
       VALUES (?, ?, ?)`,
      [numeroPedido, cliente_id, fecha_entrega_estimada]
    );
    let total = 0;

    for (const detalle of detalles) {
      const [insumos] = await connection.query(
        'SELECT id, stock_actual, precio_unitario FROM insumos WHERE id = ? FOR UPDATE',
        [detalle.insumo_id]
      );
      const insumo = insumos[0];
      if (!insumo) {
        await connection.rollback();
        return res.status(404).json({ error: `Insumo ${detalle.insumo_id} no encontrado` });
      }
      if (Number(insumo.stock_actual) < detalle.cantidad) {
        await connection.rollback();
        return res.status(400).json({ error: `Stock insuficiente para el insumo ${detalle.insumo_id}` });
      }

      const subtotal = Number(insumo.precio_unitario) * detalle.cantidad;
      total += subtotal;
      await connection.query(
        `INSERT INTO detalle_pedidos
          (pedido_id, insumo_id, tipologia, ancho_mm, alto_mm, cantidad, subtotal)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [pedido.insertId, detalle.insumo_id, detalle.tipologia.trim(), detalle.ancho_mm,
          detalle.alto_mm, detalle.cantidad, subtotal]
      );
      await connection.query(
        'UPDATE insumos SET stock_actual = stock_actual - ? WHERE id = ?',
        [detalle.cantidad, detalle.insumo_id]
      );
    }

    await connection.query('UPDATE pedidos SET total = ? WHERE id = ?', [total, pedido.insertId]);
    await connection.commit();
    return res.status(201).json({ id: pedido.insertId, nro_pedido: numeroPedido, total, detalles });
  } catch (error) {
    if (connection) await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'El numero de pedido ya existe' });
    }
    return next(error);
  } finally {
    if (connection) connection.release();
  }
}

module.exports = { crearPedido };
