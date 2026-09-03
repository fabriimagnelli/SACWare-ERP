const pool = require('../config/db');

const CATEGORIAS = ['perfil', 'vidrio_dvh', 'accesorio'];
const UNIDADES = ['metro', 'm2', 'unidad'];

function validarInsumo(body) {
  const camposRequeridos = ['sku', 'descripcion', 'categoria', 'unidad_medida'];
  const faltantes = camposRequeridos.filter((campo) => {
    return body[campo] === undefined || body[campo] === null || body[campo] === '';
  });

  if (faltantes.length > 0) {
    return `Campos requeridos faltantes: ${faltantes.join(', ')}`;
  }
  if (!CATEGORIAS.includes(body.categoria)) {
    return `categoria debe ser uno de: ${CATEGORIAS.join(', ')}`;
  }
  if (!UNIDADES.includes(body.unidad_medida)) {
    return `unidad_medida debe ser uno de: ${UNIDADES.join(', ')}`;
  }

  for (const campo of ['stock_actual', 'stock_minimo', 'precio_unitario']) {
    if (body[campo] !== undefined && (typeof body[campo] !== 'number' || body[campo] < 0)) {
      return `${campo} debe ser un numero mayor o igual a cero`;
    }
  }
  return null;
}

async function listarInsumos(req, res, next) {
  try {
    const { categoria } = req.query;
    if (categoria && !CATEGORIAS.includes(categoria)) {
      return res.status(400).json({ error: `categoria debe ser uno de: ${CATEGORIAS.join(', ')}` });
    }

    const [filas] = categoria
      ? await pool.query('SELECT * FROM insumos WHERE categoria = ? ORDER BY descripcion ASC', [categoria])
      : await pool.query('SELECT * FROM insumos ORDER BY descripcion ASC');
    return res.json(filas);
  } catch (error) {
    return next(error);
  }
}

async function listarInsumosCriticos(_req, res, next) {
  try {
    const [filas] = await pool.query(
      'SELECT * FROM insumos WHERE stock_actual <= stock_minimo ORDER BY (stock_minimo - stock_actual) DESC, descripcion ASC'
    );
    return res.json(filas);
  } catch (error) {
    return next(error);
  }
}

async function crearInsumo(req, res, next) {
  const errorValidacion = validarInsumo(req.body);
  if (errorValidacion) {
    return res.status(400).json({ error: errorValidacion });
  }

  const {
    sku,
    descripcion,
    categoria,
    unidad_medida,
    stock_actual = 0,
    stock_minimo = 0,
    precio_unitario = 0
  } = req.body;

  try {
    const [resultado] = await pool.query(
      `INSERT INTO insumos
        (sku, descripcion, categoria, unidad_medida, stock_actual, stock_minimo, precio_unitario)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [sku, descripcion, categoria, unidad_medida, stock_actual, stock_minimo, precio_unitario]
    );
    const [filas] = await pool.query('SELECT * FROM insumos WHERE id = ?', [resultado.insertId]);
    return res.status(201).json(filas[0]);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'El SKU ya existe' });
    }
    return next(error);
  }
}

module.exports = { listarInsumos, listarInsumosCriticos, crearInsumo };
