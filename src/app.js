const express = require('express');
const cors = require('cors');
const pool = require('./config/db');
const insumosRoutes = require('./routes/insumosRoutes');
const clientesRoutes = require('./routes/clientesRoutes');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', api: 'ok', database: 'ok' });
  } catch (error) {
    console.error('Error de conectividad con MySQL:', error.message);
    res.status(503).json({ status: 'degraded', api: 'ok', database: 'unavailable' });
  }
});

app.use('/api/insumos', insumosRoutes);
app.use('/api/clientes', clientesRoutes);

app.use((error, _req, res, _next) => {
  console.error('Error no controlado:', error);
  res.status(500).json({ error: 'Error interno del servidor' });
});

module.exports = app;
