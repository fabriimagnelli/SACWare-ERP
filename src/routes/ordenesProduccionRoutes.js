const express = require('express');
const {
  generarOrdenProduccion,
  obtenerDespieceOP,
  actualizarEstadoOP,
  descontarStockOP,
  listarOrdenesProduccion,
  listarPedidosSinOP
} = require('../controllers/ordenesProduccionController');
const { verificarToken, authorize } = require('../middlewares/authMiddleware');

const router = express.Router();

// Rutas accesibles por producción y administración de ventas
router.use(verificarToken, authorize(['produccion', 'admin_ventas']));

router.get('/', listarOrdenesProduccion);
router.get('/pedidos-pendientes', listarPedidosSinOP);
router.post('/generar', generarOrdenProduccion);
router.get('/:id/despiece', obtenerDespieceOP);
router.patch('/:id/estado', actualizarEstadoOP);
router.post('/:id/descontar-stock', descontarStockOP);

module.exports = router;
