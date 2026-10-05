import api from './api';

export async function listarOrdenesProduccion() {
  const { data } = await api.get('/ordenes-produccion');
  return data;
}

export async function listarPedidosPendientesOP() {
  const { data } = await api.get('/ordenes-produccion/pedidos-pendientes');
  return data;
}

export async function generarOrdenProduccion(pedidoId) {
  const { data } = await api.post('/ordenes-produccion/generar', { pedido_id: pedidoId });
  return data;
}

export async function obtenerDespieceOP(opId) {
  const { data } = await api.get(`/ordenes-produccion/${opId}/despiece`);
  return data;
}

export async function actualizarEstadoOP(opId, estado) {
  const { data } = await api.patch(`/ordenes-produccion/${opId}/estado`, { estado });
  return data;
}

export async function descontarStockOP(opId) {
  const { data } = await api.post(`/ordenes-produccion/${opId}/descontar-stock`);
  return data;
}
