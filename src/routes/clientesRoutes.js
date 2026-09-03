const express = require('express');
const {
  listarClientes,
  crearCliente
} = require('../controllers/clientesController');

const router = express.Router();

router.get('/', listarClientes);
router.post('/', crearCliente);

module.exports = router;
