import { AlertTriangle, ArrowLeft, ArrowRight, ClipboardList, Loader2, PackageSearch, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { crearPedido, obtenerMensajeError } from '../services/pedidosService';
import { useDashboardData } from '../context/DashboardContext';
import { useToast } from '../context/ToastContext';

const currency = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

const detalleVacio = { insumo_id: '', tipologia: '', ancho_mm: '', alto_mm: '', cantidad: '' };

export default function NuevoPedido() {
  const navigate = useNavigate();
  const { success: mostrarExito } = useToast();
  const { refresh: refrescarTablero } = useDashboardData();
  const [clientes, setClientes] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [cargandoCatalogo, setCargandoCatalogo] = useState(true);
  const [clienteId, setClienteId] = useState('');
  const [fechaEntrega, setFechaEntrega] = useState('');
  const [detalles, setDetalles] = useState([{ ...detalleVacio }]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setCargandoCatalogo(true);
    Promise.all([api.get('/clientes'), api.get('/insumos')])
      .then(([clientesRes, insumosRes]) => {
        setClientes(Array.isArray(clientesRes.data) ? clientesRes.data : []);
        setInsumos(Array.isArray(insumosRes.data) ? insumosRes.data : []);
      })
      .catch(() => setError('No se pudo cargar clientes o insumos disponibles.'))
      .finally(() => setCargandoCatalogo(false));
  }, []);

  const insumosPorId = useMemo(() => new Map(insumos.map((insumo) => [String(insumo.id), insumo])), [insumos]);

  function actualizarDetalle(index, campo, valor) {
    setDetalles((actuales) => actuales.map((detalle, i) => (i === index ? { ...detalle, [campo]: valor } : detalle)));
  }

  function agregarDetalle() {
    setDetalles((actuales) => [...actuales, { ...detalleVacio }]);
  }

  function quitarDetalle(index) {
    setDetalles((actuales) => (actuales.length > 1 ? actuales.filter((_, i) => i !== index) : actuales));
  }

  function limpiarFormulario() {
    setClienteId('');
    setFechaEntrega('');
    setDetalles([{ ...detalleVacio }]);
    setError('');
  }

  const itemsConSubtotal = detalles.map((detalle) => {
    const insumo = insumosPorId.get(String(detalle.insumo_id));
    const cantidad = Number(detalle.cantidad) || 0;
    const subtotal = insumo ? Number(insumo.precio_unitario) * cantidad : 0;
    const excedeStock = insumo ? cantidad > Number(insumo.stock_actual) : false;
    return { insumo, subtotal, excedeStock };
  });
  const totalEstimado = itemsConSubtotal.reduce((acumulado, item) => acumulado + item.subtotal, 0);
  const hayStockInsuficiente = itemsConSubtotal.some((item) => item.excedeStock);

  async function enviarPedido(event) {
    event.preventDefault();
    setError('');

    if (!clienteId) {
      setError('Selecciona un cliente.');
      return;
    }
    if (detalles.some((detalle) => !detalle.insumo_id)) {
      setError('Selecciona un insumo para cada ítem del pedido.');
      return;
    }
    if (hayStockInsuficiente) {
      setError('Hay ítems que superan el stock disponible del insumo seleccionado.');
      return;
    }

    const payload = {
      cliente_id: Number(clienteId),
      fecha_entrega_estimada: fechaEntrega || null,
      detalles: detalles.map((detalle) => ({
        insumo_id: Number(detalle.insumo_id),
        tipologia: detalle.tipologia.trim(),
        ancho_mm: Number(detalle.ancho_mm),
        alto_mm: Number(detalle.alto_mm),
        cantidad: Number(detalle.cantidad)
      }))
    };

    setEnviando(true);
    try {
      const pedido = await crearPedido(payload);
      mostrarExito(`Pedido ${pedido.nro_pedido} confirmado — Orden de producción ${pedido.nro_op} emitida.`);
      limpiarFormulario();
      refrescarTablero();
      setTimeout(() => navigate('/pedidos'), 1200);
    } catch (requestError) {
      setError(obtenerMensajeError(requestError, 'No se pudo crear el pedido. Revisa la conexión.'));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="page-enter">
      <header className="page-header">
        <div>
          <Link to="/pedidos" className="secondary-button" style={{ marginBottom: 16, display: 'inline-flex' }}>
            <ArrowLeft size={15} /> Volver a pedidos
          </Link>
          <p className="eyebrow">Operaciones</p>
          <h1 className="page-title">Nuevo pedido</h1>
          <p className="page-subtitle">Completa los datos del pedido y sus ítems de producción.</p>
        </div>
      </header>

      <form onSubmit={enviarPedido} className="table-shell" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 22 }}>
        <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <label className="field-label">Cliente
            <div className="input-wrap">
              <select value={clienteId} onChange={(event) => setClienteId(event.target.value)} required disabled={cargandoCatalogo || enviando} style={{ background: 'transparent', border: 0, color: '#edf9f7', outline: 0, width: '100%' }}>
                <option value="">{cargandoCatalogo ? 'Cargando clientes...' : 'Selecciona un cliente'}</option>
                {clientes.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>{cliente.razon_social}</option>
                ))}
              </select>
            </div>
          </label>
          <label className="field-label">Fecha de entrega estimada
            <div className="input-wrap">
              <input type="date" value={fechaEntrega} onChange={(event) => setFechaEntrega(event.target.value)} disabled={enviando} />
            </div>
          </label>
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 className="font-display text-lg font-semibold text-white">Ítems del pedido</h2>
            <button type="button" className="secondary-button" onClick={agregarDetalle} disabled={enviando}><Plus size={15} /> Agregar ítem</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {detalles.map((detalle, index) => {
              const { insumo, subtotal, excedeStock } = itemsConSubtotal[index];
              return (
                <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'minmax(200px, 1.6fr) repeat(4, minmax(110px, 1fr)) auto', alignItems: 'end' }}>
                    <label className="field-label">Insumo
                      <div className="input-wrap">
                        <PackageSearch size={16} />
                        <select
                          value={detalle.insumo_id}
                          onChange={(event) => actualizarDetalle(index, 'insumo_id', event.target.value)}
                          required
                          disabled={cargandoCatalogo || enviando}
                          style={{ background: 'transparent', border: 0, color: '#edf9f7', outline: 0, width: '100%' }}
                        >
                          <option value="">{cargandoCatalogo ? 'Cargando insumos...' : 'Selecciona un insumo'}</option>
                          {insumos.map((opcion) => (
                            <option key={opcion.id} value={opcion.id}>
                              {opcion.sku} - {opcion.descripcion} (stock: {Number(opcion.stock_actual)} {opcion.unidad_medida})
                            </option>
                          ))}
                        </select>
                      </div>
                    </label>
                    <label className="field-label">Tipología
                      <div className="input-wrap"><input type="text" value={detalle.tipologia} onChange={(event) => actualizarDetalle(index, 'tipologia', event.target.value)} placeholder="Corrediza 2 hojas" required disabled={enviando} /></div>
                    </label>
                    <label className="field-label">Ancho (mm)
                      <div className="input-wrap"><input type="number" min="1" value={detalle.ancho_mm} onChange={(event) => actualizarDetalle(index, 'ancho_mm', event.target.value)} required disabled={enviando} /></div>
                    </label>
                    <label className="field-label">Alto (mm)
                      <div className="input-wrap"><input type="number" min="1" value={detalle.alto_mm} onChange={(event) => actualizarDetalle(index, 'alto_mm', event.target.value)} required disabled={enviando} /></div>
                    </label>
                    <label className="field-label">Cantidad
                      <div className="input-wrap"><input type="number" min="1" value={detalle.cantidad} onChange={(event) => actualizarDetalle(index, 'cantidad', event.target.value)} required disabled={enviando} /></div>
                    </label>
                    <button type="button" className="icon-button" onClick={() => quitarDetalle(index)} disabled={detalles.length === 1 || enviando} aria-label="Quitar ítem"><Trash2 size={17} /></button>
                  </div>
                  {insumo && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: excedeStock ? '#ffaaa0' : '#7cc6b7', paddingLeft: 4 }}>
                      <ArrowRight size={13} />
                      <span>Subtotal: {currency.format(subtotal)}</span>
                      {excedeStock && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><AlertTriangle size={13} /> Supera el stock disponible ({Number(insumo.stock_actual)} {insumo.unidad_medida})</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: 14, color: '#e7f4f3', fontWeight: 600 }}>
          Total estimado: {currency.format(totalEstimado)}
        </div>

        {error && <p className="form-error" role="alert"><AlertTriangle size={14} style={{ display: 'inline', marginRight: 6 }} />{error}</p>}

        <button className="primary-button" type="submit" disabled={enviando || cargandoCatalogo} style={{ alignSelf: 'flex-start' }}>
          {enviando ? <Loader2 size={17} className="animate-spin" /> : <ClipboardList size={17} />}
          {enviando ? 'Enviando...' : 'Crear pedido'}
        </button>
      </form>
    </div>
  );
}