require('dotenv').config();
const pool = require('../src/config/db');

async function setupTaller() {
  try {
    const [cols] = await pool.query("SHOW COLUMNS FROM ordenes_produccion LIKE 'stock_descontado'");
    if (cols.length === 0) {
      await pool.query('ALTER TABLE ordenes_produccion ADD COLUMN stock_descontado BOOLEAN NOT NULL DEFAULT FALSE');
      console.log('Columna stock_descontado agregada a ordenes_produccion');
    } else {
      console.log('Columna stock_descontado ya existe');
    }

    const accesorios = [
      ['ACC-ESCUADRA', 'Escuadra de alineación y armado', 'accesorio', 'unidad', 100, 20, 850],
      ['ACC-RODAMIENTO', 'Rodamiento a rulemán regulable', 'accesorio', 'unidad', 80, 16, 1450]
    ];

    for (const [sku, desc, cat, um, stock, min, precio] of accesorios) {
      await pool.query(
        `INSERT INTO insumos (sku, descripcion, categoria, unidad_medida, stock_actual, stock_minimo, precio_unitario)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE descripcion = VALUES(descripcion)`,
        [sku, desc, cat, um, stock, min, precio]
      );
    }

    const [insumos] = await pool.query('SELECT id, sku, descripcion, stock_actual, stock_minimo FROM insumos');
    console.log('Insumos disponibles:', insumos);
  } finally {
    await pool.end();
  }
}

setupTaller().catch(console.error);
