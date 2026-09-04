const express = require('express');
const cors = require('cors');
const pool = require('./config/db');
const insumosRoutes = require('./routes/insumosRoutes');
const clientesRoutes = require('./routes/clientesRoutes');
const authRoutes = require('./routes/authRoutes');
const pedidosController = require('./controllers/pedidosController');
const { verificarToken, authorize } = require('./middlewares/authMiddleware');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);

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
app.post('/api/pedidos', verificarToken, authorize(['admin_ventas']), pedidosController.crearPedido);

app.use((error, _req, res, _next) => {
  console.error('Error no controlado:', error);
  res.status(500).json({ error: 'Error interno del servidor' });
});

module.exports = app;
