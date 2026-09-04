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

router.use(verificarToken, authorize(['stock_compras']));
router.get('/criticos', listarInsumosCriticos);
router.get('/', listarInsumos);
router.post('/', crearInsumo);
router.get('/:id', obtenerInsumo);
router.put('/:id', actualizarInsumo);
router.delete('/:id', eliminarInsumo);

module.exports = router;
