const express = require('express');
const {
  listarClientes,
  crearCliente,
  obtenerCliente,
  actualizarCliente,
  eliminarCliente
} = require('../controllers/clientesController');
const { verificarToken, authorize } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(verificarToken, authorize(['admin_ventas']));
router.get('/', listarClientes);
router.post('/', crearCliente);
router.get('/:id', obtenerCliente);
router.put('/:id', actualizarCliente);
router.delete('/:id', eliminarCliente);

module.exports = router;
