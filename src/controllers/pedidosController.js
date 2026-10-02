const { randomUUID } = require('crypto');
const pool = require('../config/db');

class ErrorAplicacion extends Error {
  constructor(message, codigo, httpStatus, detalle) {
    super(message);
    this.name = 'ErrorAplicacion';
    this.codigo = codigo;
    this.httpStatus = httpStatus || 500;
    this.detalle = detalle || null;
  }
}

function validarItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return 'el pedido debe incluir una lista de items con al menos un renglon';
  }
  for (const item of items) {
    if (!item || !Number.isInteger(item.insumo_id) || item.insumo_id <= 0) {
      return 'cada item requiere un insumo_id entero positivo';
    }
    if (!Number.isInteger(item.cantidad) || item.cantidad <= 0) {
      return 'cada item requiere una cantidad entera positiva';
    }
    if (typeof item.tipologia !== 'string' || !item.tipologia.trim()) {
      return 'cada item requiere una tipologia no vacia';
    }
    if (!Number.isInteger(item.ancho_mm) || item.ancho_mm <= 0 ||
        !Number.isInteger(item.alto_mm) || item.alto_mm <= 0) {
      return 'cada item requiere ancho_mm y alto_mm enteros positivos';
    }
  }
  return null;
}

async function insertarConCodigoUnico(connection, sql, prefijo, construirParams) {
  const candidatos = [
    `${prefijo}-${Date.now()}`,
    `${prefijo}-${Date.now()}-${randomUUID().slice(0, 4)}`,
    `${prefijo}-${Date.now()}-${randomUUID().slice(0, 8)}`
  ];
  let ultimoError = null;
  for (const codigo of candidatos) {
    try {
      const [resultado] = await connection.query(sql, construirParams(codigo));
      return { codigo, resultado };
    } catch (error) {
      if (error.code !== 'ER_DUP_ENTRY') throw error;
      ultimoError = error;
    }
  }
  throw ultimoError;
}

async function crearPedido(req, res) {
  const body = req.body || {};
  const items = Array.isArray(body.items)
    ? body.items
    : (Array.isArray(body.detalles) ? body.detalles : null);

  if (!Number.isInteger(body.cliente_id) || body.cliente_id <= 0) {
    return res.status(400).json({ error: 'cliente_id debe ser un entero positivo' });
  }
  const errorValidacion = validarItems(items);
  if (errorValidacion) {
    return res.status(400).json({ error: errorValidacion });
  }
  if (body.fecha_entrega_estimada !== undefined && body.fecha_entrega_estimada !== null &&
      typeof body.fecha_entrega_estimada !== 'string') {
    return res.status(400).json({ error: 'fecha_entrega_estimada debe ser una fecha en formato de texto' });
  }

  const { cliente_id, fecha_entrega_estimada: fechaEntregaEstimada = null } = body;

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [clientes] = await connection.query('SELECT id FROM clientes WHERE id = ?', [cliente_id]);
    if (clientes.length === 0) {
      throw new ErrorAplicacion('Cliente no encontrado', 'CLIENTE_NO_ENCONTRADO', 404);
    }

    const { codigo: nroPedido, resultado: pedido } = await insertarConCodigoUnico(
      connection,
      `INSERT INTO pedidos (nro_pedido, cliente_id, estado, fecha_entrega_estimada)
       VALUES (?, ?, 'en_produccion', ?)`,
      'PED',
      (codigo) => [codigo, cliente_id, fechaEntregaEstimada]
    );

    let total = 0;
    const insumosDescontados = [];

    for (const item of items) {
      const [insumos] = await connection.query(
        'SELECT id, descripcion, stock_actual, precio_unitario FROM insumos WHERE id = ? FOR UPDATE',
        [item.insumo_id]
      );
      const insumo = insumos[0];
      if (!insumo) {
        throw new ErrorAplicacion(`Insumo ${item.insumo_id} no encontrado`, 'INSUMO_NO_ENCONTRADO', 404);
      }

      const stockActual = Number(insumo.stock_actual);
      if (stockActual < item.cantidad) {
        throw new ErrorAplicacion(
          `Stock insuficiente del insumo "${insumo.descripcion}"`,
          'STOCK_INSUFICIENTE',
          400,
          {
            insumo_id: insumo.id,
            descripcion: insumo.descripcion,
            disponible: stockActual,
            requerido: item.cantidad
          }
        );
      }

      const subtotal = Number(insumo.precio_unitario) * item.cantidad;
      total += subtotal;

      await connection.query(
        `INSERT INTO detalle_pedidos (pedido_id, insumo_id, tipologia, ancho_mm, alto_mm, cantidad, subtotal)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [pedido.insertId, item.insumo_id, item.tipologia.trim(), item.ancho_mm, item.alto_mm, item.cantidad, subtotal]
      );

      await connection.query(
        'UPDATE insumos SET stock_actual = stock_actual - ? WHERE id = ?',
        [item.cantidad, item.insumo_id]
      );

      insumosDescontados.push({
        insumo_id: insumo.id,
        descripcion: insumo.descripcion,
        cantidad: item.cantidad,
        stock_restante: stockActual - item.cantidad
      });
    }

    await connection.query('UPDATE pedidos SET total = ? WHERE id = ?', [total, pedido.insertId]);

    const { codigo: nroOp } = await insertarConCodigoUnico(
      connection,
      `INSERT INTO ordenes_produccion (nro_op, pedido_id, estado)
       VALUES (?, ?, 'pendiente')`,
      'OP',
      (codigo) => [codigo, pedido.insertId]
    );

    await connection.commit();
    return res.status(201).json({
      pedido_id: pedido.insertId,
      nro_pedido: nroPedido,
      nro_op: nroOp,
      mensaje: 'Pedido confirmado y orden de produccion emitida',
      insumos_descontados: insumosDescontados
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (_error) {
      }
    }
    if (error instanceof ErrorAplicacion) {
      const cuerpo = { error: error.message, codigo: error.codigo };
      if (error.detalle) cuerpo.detalle = error.detalle;
      return res.status(error.httpStatus).json(cuerpo);
    }
    console.error('Error al crear pedido:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  } finally {
    if (connection) connection.release();
  }
}

async function listarPedidos(_req, res) {
  try {
    const [filas] = await pool.query(
      `SELECT p.id, p.nro_pedido, p.estado, p.total, p.fecha_entrega_estimada, p.creado_en,
              c.razon_social AS cliente,
              (SELECT COUNT(*) FROM detalle_pedidos d WHERE d.pedido_id = p.id) AS items
       FROM pedidos p
       JOIN clientes c ON c.id = p.cliente_id
       ORDER BY p.creado_en DESC, p.id DESC
       LIMIT 50`
    );
    return res.json(filas);
  } catch (error) {
    console.error('Error al listar pedidos:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { crearPedido, listarPedidos };