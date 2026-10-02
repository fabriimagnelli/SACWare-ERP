const express = require('express');
const { crearPedido, listarPedidos } = require('../controllers/pedidosController');
const { verificarToken, authorize } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(verificarToken, authorize(['admin_ventas']));
router.get('/', listarPedidos);
router.post('/', crearPedido);

module.exports = router;