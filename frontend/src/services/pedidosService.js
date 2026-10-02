import api from './api';

export async function crearPedido(data) {
  const response = await api.post('/pedidos', data);
  return response.data;
}

export async function listarPedidos() {
  const response = await api.get('/pedidos');
  return response.data;
}

export function obtenerMensajeError(error, fallback = 'No se pudo completar la operación. Revisa la conexión.') {
  const data = error?.response?.data;
  if (!data || typeof data.error !== 'string') return fallback;
  if (data.codigo === 'STOCK_INSUFICIENTE' && data.detalle) {
    return `Stock insuficiente para: ${data.detalle.descripcion} (disponible ${data.detalle.disponible}, requerido ${data.detalle.requerido})`;
  }
  return data.error;
}