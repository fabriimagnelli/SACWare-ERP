const express = require('express');
const {
  listarInsumos,
  listarInsumosCriticos,
  crearInsumo,
  obtenerInsumo,
  actualizarInsumo,
  eliminarInsumo
} = require('../controllers/insumosController');
const { verificarToken, authorize } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(verificarToken);
router.get('/criticos', authorize(['stock_compras', 'admin_ventas', 'produccion']), listarInsumosCriticos);
router.get('/', authorize(['stock_compras', 'admin_ventas', 'produccion']), listarInsumos);
router.post('/', authorize(['stock_compras']), crearInsumo);
router.get('/:id', authorize(['stock_compras']), obtenerInsumo);
router.put('/:id', authorize(['stock_compras']), actualizarInsumo);
router.delete('/:id', authorize(['stock_compras']), eliminarInsumo);

module.exports = router;
