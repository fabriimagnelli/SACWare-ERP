/**
 * Controlador de Órdenes de Producción y Gestión de Taller.
 * SACWare ERP - Módulo de Producción y Despiece (BOM Lite).
 */

const { randomUUID } = require('crypto');
const pool = require('../config/db');
const { calcularDespieceOrden } = require('../services/bomService');

const ESTADOS_VALIDOS = ['pendiente', 'corte', 'armado', 'vidriado', 'finalizado'];

class ErrorAplicacion extends Error {
  constructor(message, codigo, httpStatus = 400, detalle = null) {
    super(message);
    this.name = 'ErrorAplicacion';
    this.codigo = codigo;
    this.httpStatus = httpStatus;
    this.detalle = detalle;
  }
}

/**
 * Genera un código de orden de producción con reintentos para evitar colisiones.
 */
async function generarCodigoOpUnico(connection) {
  const anio = new Date().getFullYear();
  for (let i = 0; i < 5; i++) {
    const sufijo = randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
    const codigo = `OP-${anio}-${sufijo}`;
    const [existente] = await connection.query('SELECT id FROM ordenes_produccion WHERE nro_op = ?', [codigo]);
    if (existente.length === 0) return codigo;
  }
  return `OP-${anio}-${Date.now()}`;
}

/**
 * POST /api/ordenes-produccion/generar
 * Crea una orden de producción vinculada a un pedido existente.
 */
async function generarOrdenProduccion(req, res) {
  const { pedido_id: pedidoIdRaw, responsable_id: responsableIdRaw } = req.body || {};
  const pedidoId = parseInt(pedidoIdRaw, 10);
  const responsableId = responsableIdRaw ? parseInt(responsableIdRaw, 10) : (req.usuario?.id || null);

  if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
    return res.status(400).json({ error: 'pedido_id debe ser un entero positivo' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 1. Verificar si el pedido existe
    const [pedidos] = await connection.query(
      'SELECT id, nro_pedido, estado FROM pedidos WHERE id = ? FOR UPDATE',
      [pedidoId]
    );

    if (pedidos.length === 0) {
      throw new ErrorAplicacion('El pedido especificado no existe', 'PEDIDO_NO_ENCONTRADO', 404);
    }

    const pedido = pedidos[0];

    // 2. Verificar si ya existe una OP activa para este pedido
    const [opsExistentes] = await connection.query(
      'SELECT id, nro_op, estado, stock_descontado FROM ordenes_produccion WHERE pedido_id = ?',
      [pedidoId]
    );

    if (opsExistentes.length > 0) {
      const opActiva = opsExistentes.find((o) => o.estado !== 'finalizado') || opsExistentes[0];
      await connection.rollback();
      return res.status(409).json({
        error: `El pedido ${pedido.nro_pedido} ya cuenta con una orden de producción vinculada (${opActiva.nro_op})`,
        codigo: 'OP_YA_EXISTE',
        op: opActiva
      });
    }

    // 3. Generar número único de OP e insertarla
    const nroOp = await generarCodigoOpUnico(connection);

    const [resultado] = await connection.query(
      `INSERT INTO ordenes_produccion (nro_op, pedido_id, responsable_id, estado, stock_descontado)
       VALUES (?, ?, ?, 'pendiente', FALSE)`,
      [nroOp, pedidoId, responsableId]
    );

    // 4. Asegurar que el estado del pedido pase a en_produccion
    if (pedido.estado === 'pendiente') {
      await connection.query('UPDATE pedidos SET estado = "en_produccion" WHERE id = ?', [pedidoId]);
    }

    await connection.commit();

    return res.status(201).json({
      mensaje: 'Orden de producción generada correctamente',
      op: {
        id: resultado.insertId,
        nro_op: nroOp,
        pedido_id: pedidoId,
        responsable_id: responsableId,
        estado: 'pendiente',
        stock_descontado: false
      }
    });
  } catch (error) {
    if (connection) await connection.rollback().catch(() => {});
    if (error instanceof ErrorAplicacion) {
      return res.status(error.httpStatus).json({ error: error.message, codigo: error.codigo, detalle: error.detalle });
    }
    console.error('Error al generar OP:', error);
    return res.status(500).json({ error: 'Error interno al generar la orden de producción' });
  } finally {
    if (connection) connection.release();
  }
}

/**
 * GET /api/ordenes-produccion/:id/despiece
 * Retorna el cálculo de materiales paramétrico (BOM Lite) para la OP.
 */
async function obtenerDespieceOP(req, res) {
  const opId = parseInt(req.params.id, 10);
  if (!Number.isInteger(opId) || opId <= 0) {
    return res.status(400).json({ error: 'ID de orden de producción inválido' });
  }

  try {
    // 1. Obtener la OP con datos del pedido y cliente
    const [ops] = await pool.query(
      `SELECT op.id, op.nro_op, op.pedido_id, op.responsable_id, op.estado, op.stock_descontado,
              op.fecha_inicio, op.fecha_fin, op.creado_en,
              p.nro_pedido, p.estado AS estado_pedido, p.fecha_entrega_estimada,
              c.razon_social AS cliente, c.cuit,
              u.nombre AS responsable_nombre
       FROM ordenes_produccion op
       JOIN pedidos p ON p.id = op.pedido_id
       JOIN clientes c ON c.id = p.cliente_id
       LEFT JOIN usuarios u ON u.id = op.responsable_id
       WHERE op.id = ?`,
      [opId]
    );

    if (ops.length === 0) {
      return res.status(404).json({ error: 'Orden de producción no encontrada' });
    }

    const op = ops[0];

    // 2. Obtener los renglones del pedido
    const [items] = await pool.query(
      `SELECT d.id, d.pedido_id, d.insumo_id, d.tipologia, d.ancho_mm, d.alto_mm, d.cantidad, d.subtotal,
              i.sku AS insumo_sku, i.descripcion AS insumo_descripcion
       FROM detalle_pedidos d
       LEFT JOIN insumos i ON i.id = d.insumo_id
       WHERE d.pedido_id = ?`,
      [op.pedido_id]
    );

    // 3. Obtener catálogo completo de insumos para cruce y verificación de stock
    const [insumosCatalogo] = await pool.query(
      'SELECT id, sku, descripcion, categoria, unidad_medida, stock_actual, stock_minimo, precio_unitario FROM insumos'
    );

    // 4. Calcular el despiece mediante el servicio BOM
    const calculo = calcularDespieceOrden(items, insumosCatalogo);

    return res.json({
      op: {
        id: op.id,
        nro_op: op.nro_op,
        estado: op.estado,
        stock_descontado: Boolean(op.stock_descontado),
        fecha_inicio: op.fecha_inicio,
        fecha_fin: op.fecha_fin,
        responsable: op.responsable_nombre || 'Sin asignar'
      },
      pedido: {
        id: op.pedido_id,
        nro_pedido: op.nro_pedido,
        cliente: op.cliente,
        fecha_entrega_estimada: op.fecha_entrega_estimada
      },
      desglose_items: calculo.items_detalle,
      materiales: calculo.materiales_consolidados,
      stock_valido: calculo.stock_valido
    });
  } catch (error) {
    console.error('Error al obtener despiece de OP:', error);
    return res.status(500).json({ error: 'Error interno al calcular el despiece de materiales' });
  }
}

/**
 * PATCH /api/ordenes-produccion/:id/estado
 * Actualiza el estado de la OP ('pendiente', 'corte', 'armado', 'vidriado', 'finalizado').
 */
async function actualizarEstadoOP(req, res) {
  const opId = parseInt(req.params.id, 10);
  const { estado } = req.body || {};

  if (!Number.isInteger(opId) || opId <= 0) {
    return res.status(400).json({ error: 'ID de orden de producción inválido' });
  }

  if (!ESTADOS_VALIDOS.includes(estado)) {
    return res.status(400).json({
      error: `Estado inválido. Los estados permitidos son: ${ESTADOS_VALIDOS.join(', ')}`
    });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [ops] = await connection.query(
      'SELECT id, nro_op, pedido_id, estado, fecha_inicio, fecha_fin, stock_descontado FROM ordenes_produccion WHERE id = ? FOR UPDATE',
      [opId]
    );

    if (ops.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Orden de producción no encontrada' });
    }

    const opActual = ops[0];
    let fechaInicioUpdate = opActual.fecha_inicio;
    let fechaFinUpdate = opActual.fecha_fin;

    // Si comienza el proceso (pasa de pendiente a corte u otro estado posterior), registrar fecha_inicio
    if (opActual.estado === 'pendiente' && estado !== 'pendiente' && !fechaInicioUpdate) {
      fechaInicioUpdate = new Date();
    }

    // Si pasa a finalizado, registrar fecha_fin y marcar pedido como completado
    if (estado === 'finalizado') {
      fechaFinUpdate = new Date();
      await connection.query('UPDATE pedidos SET estado = "completado" WHERE id = ?', [opActual.pedido_id]);
    } else if (opActual.estado === 'finalizado' && estado !== 'finalizado') {
      // Si se retrocede desde finalizado, reactivar pedido a en_produccion
      fechaFinUpdate = null;
      await connection.query('UPDATE pedidos SET estado = "en_produccion" WHERE id = ?', [opActual.pedido_id]);
    }

    await connection.query(
      `UPDATE ordenes_produccion
       SET estado = ?, fecha_inicio = ?, fecha_fin = ?
       WHERE id = ?`,
      [estado, fechaInicioUpdate, fechaFinUpdate, opId]
    );

    await connection.commit();

    return res.json({
      mensaje: `Estado de la orden ${opActual.nro_op} actualizado a "${estado}"`,
      op: {
        id: opId,
        nro_op: opActual.nro_op,
        estado_anterior: opActual.estado,
        estado_nuevo: estado,
        fecha_inicio: fechaInicioUpdate,
        fecha_fin: fechaFinUpdate,
        stock_descontado: Boolean(opActual.stock_descontado)
      }
    });
  } catch (error) {
    if (connection) await connection.rollback().catch(() => {});
    console.error('Error al actualizar estado de OP:', error);
    return res.status(500).json({ error: 'Error interno al actualizar el estado de la orden' });
  } finally {
    if (connection) connection.release();
  }
}

/**
 * POST /api/ordenes-produccion/:id/descontar-stock
 * Transacción atómica en MySQL que descuenta del inventario los materiales calculados por el BOM.
 */
async function descontarStockOP(req, res) {
  const opId = parseInt(req.params.id, 10);
  if (!Number.isInteger(opId) || opId <= 0) {
    return res.status(400).json({ error: 'ID de orden de producción inválido' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 1. Bloquear y verificar la OP
    const [ops] = await connection.query(
      'SELECT id, nro_op, pedido_id, estado, stock_descontado FROM ordenes_produccion WHERE id = ? FOR UPDATE',
      [opId]
    );

    if (ops.length === 0) {
      throw new ErrorAplicacion('Orden de producción no encontrada', 'OP_NO_ENCONTRADA', 404);
    }

    const op = ops[0];

    if (op.stock_descontado) {
      throw new ErrorAplicacion(
        `El stock de insumos ya fue descontado previamente para la orden ${op.nro_op}`,
        'STOCK_YA_DESCONTADO',
        400
      );
    }

    // 2. Obtener los renglones del pedido
    const [items] = await connection.query(
      'SELECT id, insumo_id, tipologia, ancho_mm, alto_mm, cantidad FROM detalle_pedidos WHERE pedido_id = ?',
      [op.pedido_id]
    );

    if (items.length === 0) {
      throw new ErrorAplicacion('El pedido vinculado no posee ítems para despiece', 'PEDIDO_SIN_ITEMS', 400);
    }

    // 3. Bloquear y leer catálogo completo de insumos
    const [insumosCatalogo] = await connection.query(
      'SELECT id, sku, descripcion, categoria, unidad_medida, stock_actual, stock_minimo FROM insumos FOR UPDATE'
    );

    // 4. Calcular los insumos requeridos
    const calculo = calcularDespieceOrden(items, insumosCatalogo);

    // 5. Validar disponibilidad de stock estricta
    const faltantes = calculo.materiales_consolidados.filter((m) => !m.stock_suficiente);
    if (faltantes.length > 0) {
      throw new ErrorAplicacion(
        'Stock insuficiente en uno o más insumos necesarios para la producción',
        'STOCK_INSUFICIENTE',
        400,
        faltantes.map((f) => ({
          sku: f.sku,
          descripcion: f.descripcion,
          requerido: f.cantidad_requerida,
          disponible: f.stock_actual,
          deficit: f.deficit,
          unidad_medida: f.unidad_medida
        }))
      );
    }

    // 6. Aplicar descuento para cada material en la base de datos
    const insumosAfectados = [];
    const alertasCriticas = [];

    for (const material of calculo.materiales_consolidados) {
      if (!material.insumo_id) {
        throw new ErrorAplicacion(
          `No se encontró el insumo registrado con SKU "${material.sku}" en la base de datos`,
          'INSUMO_NO_REGISTRADO',
          400
        );
      }

      await connection.query(
        'UPDATE insumos SET stock_actual = stock_actual - ? WHERE id = ?',
        [material.cantidad_requerida, material.insumo_id]
      );

      const nuevoStock = Number((material.stock_actual - material.cantidad_requerida).toFixed(2));
      const esCritico = nuevoStock <= Number(material.stock_minimo);

      const infoAfectado = {
        insumo_id: material.insumo_id,
        sku: material.sku,
        descripcion: material.descripcion,
        unidad_medida: material.unidad_medida,
        cantidad_descontada: material.cantidad_requerida,
        stock_anterior: material.stock_actual,
        stock_restante: nuevoStock,
        stock_minimo: material.stock_minimo,
        es_critico: esCritico
      };

      insumosAfectados.push(infoAfectado);
      if (esCritico) alertasCriticas.push(infoAfectado);
    }

    // 7. Marcar la orden con stock_descontado = TRUE
    await connection.query(
      'UPDATE ordenes_produccion SET stock_descontado = TRUE WHERE id = ?',
      [opId]
    );

    await connection.commit();

    return res.json({
      mensaje: `Stock descontado exitosamente para la orden ${op.nro_op}`,
      nro_op: op.nro_op,
      stock_descontado: true,
      insumos_descontados: insumosAfectados,
      alertas_criticas: alertasCriticas
    });
  } catch (error) {
    if (connection) await connection.rollback().catch(() => {});
    if (error instanceof ErrorAplicacion) {
      return res.status(error.httpStatus).json({
        error: error.message,
        codigo: error.codigo,
        detalle: error.detalle
      });
    }
    console.error('Error al descontar stock de OP:', error);
    return res.status(500).json({ error: 'Error interno en la transacción de descuento de stock' });
  } finally {
    if (connection) connection.release();
  }
}

/**
 * GET /api/ordenes-produccion
 * Lista todas las órdenes de producción con información de pedido, cliente y responsable.
 */
async function listarOrdenesProduccion(_req, res) {
  try {
    const [filas] = await pool.query(
      `SELECT op.id, op.nro_op, op.pedido_id, op.estado, op.stock_descontado,
              op.fecha_inicio, op.fecha_fin, op.creado_en,
              p.nro_pedido, p.total AS pedido_total, p.fecha_entrega_estimada,
              c.razon_social AS cliente,
              u.nombre AS responsable,
              (SELECT COUNT(*) FROM detalle_pedidos d WHERE d.pedido_id = p.id) AS total_items,
              (SELECT COALESCE(SUM(d.cantidad), 0) FROM detalle_pedidos d WHERE d.pedido_id = p.id) AS total_aberturas
       FROM ordenes_produccion op
       JOIN pedidos p ON p.id = op.pedido_id
       JOIN clientes c ON c.id = p.cliente_id
       LEFT JOIN usuarios u ON u.id = op.responsable_id
       ORDER BY 
         CASE op.estado
           WHEN 'corte' THEN 1
           WHEN 'armado' THEN 2
           WHEN 'vidriado' THEN 3
           WHEN 'pendiente' THEN 4
           WHEN 'finalizado' THEN 5
           ELSE 6
         END,
         op.creado_en DESC`
    );

    return res.json(filas.map((f) => ({
      ...f,
      stock_descontado: Boolean(f.stock_descontado)
    })));
  } catch (error) {
    console.error('Error al listar ordenes de produccion:', error);
    return res.status(500).json({ error: 'Error interno al listar órdenes de producción' });
  }
}

/**
 * GET /api/pedidos-sin-op
 * Lista pedidos confirmados que aún no tienen una orden de producción asignada.
 */
async function listarPedidosSinOP(_req, res) {
  try {
    const [pedidos] = await pool.query(
      `SELECT p.id, p.nro_pedido, p.estado, p.total, p.fecha_entrega_estimada, p.creado_en,
              c.razon_social AS cliente,
              (SELECT COUNT(*) FROM detalle_pedidos d WHERE d.pedido_id = p.id) AS items
       FROM pedidos p
       JOIN clientes c ON c.id = p.cliente_id
       LEFT JOIN ordenes_produccion op ON op.pedido_id = p.id
       WHERE op.id IS NULL
       ORDER BY p.creado_en DESC`
    );
    return res.json(pedidos);
  } catch (error) {
    console.error('Error al listar pedidos sin OP:', error);
    return res.status(500).json({ error: 'Error interno al consultar pedidos disponibles' });
  }
}

module.exports = {
  generarOrdenProduccion,
  obtenerDespieceOP,
  actualizarEstadoOP,
  descontarStockOP,
  listarOrdenesProduccion,
  listarPedidosSinOP
};
