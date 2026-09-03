const express = require('express');
const {
  listarInsumos,
  listarInsumosCriticos,
  crearInsumo
} = require('../controllers/insumosController');

const router = express.Router();

router.get('/criticos', listarInsumosCriticos);
router.get('/', listarInsumos);
router.post('/', crearInsumo);

module.exports = router;
