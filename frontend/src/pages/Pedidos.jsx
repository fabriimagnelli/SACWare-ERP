import { AlertTriangle, ClipboardList, Loader2, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useDashboardData } from '../context/DashboardContext';

const currency = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

const estadosPedido = {
  pendiente: { etiqueta: 'Pendiente', clase: 'estado estado--pendiente' },
  en_produccion: { etiqueta: 'En producción', clase: 'estado estado--produccion' },
  completado: { etiqueta: 'Completado', clase: 'estado estado--completado' },
  cancelado: { etiqueta: 'Cancelado', clase: 'estado estado--cancelado' }
};

function formatearFecha(iso) {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '—';
  return fecha.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function Pedidos() {
  const { pedidos, loading, error, refresh } = useDashboardData();

  return (
    <div className="page-enter">
      <header className="page-header">
        <div>
          <p className="eyebrow">Operaciones</p>
          <h1 className="page-title">Pedidos</h1>
          <p className="page-subtitle">Seguimiento de pedidos y entregas.</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button type="button" className="secondary-button" onClick={refresh} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Actualizar
          </button>
          <Link to="/pedidos/nuevo" className="primary-button"><ClipboardList size={17} /> Nuevo pedido</Link>
        </div>
      </header>

      {error && <div className="feedback feedback--error" role="alert" style={{ marginBottom: 18 }}><AlertTriangle size={18} />{error}</div>}

      <div className="table-shell">
        <table>
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Cliente</th>
              <th>Estado</th>
              <th>Ítems</th>
              <th>Total</th>
              <th>Entrega estimada</th>
              <th>Fecha de alta</th>
            </tr>
          </thead>
          <tbody>
            {loading && pedidos.length === 0 ? (
              <tr><td colSpan="7" className="table-message"><Loader2 size={16} className="animate-spin" style={{ display: 'inline', marginRight: 6 }} />Cargando pedidos...</td></tr>
            ) : pedidos.length === 0 ? (
              <tr><td colSpan="7" className="table-message">Todavía no hay pedidos registrados.</td></tr>
            ) : (
              pedidos.map((pedido) => {
                const config = estadosPedido[pedido.estado] || { etiqueta: pedido.estado, clase: 'estado' };
                return (
                  <tr key={pedido.id}>
                    <td className="font-mono text-xs text-aqua">{pedido.nro_pedido}</td>
                    <td className="font-medium text-white">{pedido.cliente}</td>
                    <td><span className={config.clase}>{config.etiqueta}</span></td>
                    <td>{pedido.items}</td>
                    <td>{currency.format(pedido.total)}</td>
                    <td>{pedido.fecha_entrega_estimada ? formatearFecha(`${pedido.fecha_entrega_estimada}T12:00:00`) : '—'}</td>
                    <td>{formatearFecha(pedido.creado_en)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}