import { AlertTriangle, ArrowUpRight, Boxes, ClipboardList, CreditCard, Loader2, PackageX, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
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

function EstadoPedido({ estado }) {
  const config = estadosPedido[estado] || { etiqueta: estado, clase: 'estado' };
  return <span className={config.clase}>{config.etiqueta}</span>;
}

export default function Dashboard() {
  const { usuario } = useAuth();
  const { pedidos, criticos, kpis, loading, error, refresh } = useDashboardData();

  const pedidosRecientes = pedidos.slice(0, 6);

  const metrics = [
    { label: 'Pedidos activos', value: String(kpis.pedidosActivos).padStart(2, '0'), detail: 'Pendientes o en producción', icon: ClipboardList },
    { label: 'Ventas', value: currency.format(kpis.ventas), detail: 'Total sobre los últimos 50 pedidos', icon: CreditCard, currencyValue: true },
    { label: 'Insumos críticos', value: String(kpis.criticosActivos).padStart(2, '0'), detail: kpis.criticosActivos > 0 ? `${kpis.sinStock} sin stock disponible` : 'Nivel de stock saludable', icon: Boxes }
  ];

  return (
    <div className="page-enter">
      <header className="page-header">
        <div>
          <p className="eyebrow">Panel de control</p>
          <h1 className="page-title">Buen día, {usuario?.nombre?.split(' ')[0] || 'equipo'}.</h1>
          <p className="page-subtitle">Este es el pulso operativo de SACWare hoy.</p>
        </div>
        <span className="date-chip">{new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
      </header>

      <section className="metrics-grid">
        {metrics.map(({ label, value, detail, icon: Icon, currencyValue }) => (
          <article className="metric-card" key={label}>
            <div className="metric-icon"><Icon size={20} /></div>
            <p className="metric-label">{label}</p>
            <strong className={`metric-value ${currencyValue ? 'metric-value--currency' : ''}`}>{loading && kpis.pedidosActivos === 0 ? '—' : value}</strong>
            <p className="metric-detail">{detail} <ArrowUpRight size={13} /></p>
          </article>
        ))}
      </section>

      {error && <div className="feedback feedback--error" role="alert" style={{ marginTop: 18 }}><AlertTriangle size={18} />{error}</div>}

      <div className="dashboard-grid">
        <section className="recent-block">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 className="font-display text-lg font-semibold text-white">Pedidos recientes</h2>
            <button type="button" className="secondary-button" onClick={refresh} disabled={loading}>
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Sincronizar
            </button>
          </div>
          <div className="table-shell">
            <table>
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Cliente</th>
                  <th>Estado</th>
                  <th>Ítems</th>
                  <th>Total</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {loading && pedidos.length === 0 ? (
                  <tr><td colSpan="6" className="table-message"><Loader2 size={16} className="animate-spin" style={{ display: 'inline', marginRight: 6 }} />Cargando pedidos...</td></tr>
                ) : pedidosRecientes.length === 0 ? (
                  <tr><td colSpan="6" className="table-message">Todavía no hay pedidos registrados.</td></tr>
                ) : (
                  pedidosRecientes.map((pedido) => (
                    <tr key={pedido.id}>
                      <td className="font-mono text-xs text-aqua">{pedido.nro_pedido}</td>
                      <td className="font-medium text-white">{pedido.cliente}</td>
                      <td><EstadoPedido estado={pedido.estado} /></td>
                      <td>{pedido.items}</td>
                      <td>{currency.format(pedido.total)}</td>
                      <td>{formatearFecha(pedido.creado_en)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="critical-panel">
          <div className="critical-panel-header">
            <div className="metric-icon"><AlertTriangle size={18} /></div>
            <div>
              <h2 className="font-display text-base font-semibold text-white">Inventario crítico</h2>
              <p className="critical-panel-subtitle">Materiales por debajo del mínimo</p>
            </div>
          </div>
          {loading && criticos.length === 0 ? (
            <p className="critical-empty"><Loader2 size={16} className="animate-spin" style={{ marginRight: 8 }} /> Verificando stock...</p>
          ) : criticos.length === 0 ? (
            <p className="critical-empty"><Boxes size={20} /> Sin insumos por debajo del mínimo. Stock saludable.</p>
          ) : (
            <ul className="critical-list">
              {criticos.map((insumo) => {
                const agotado = Number(insumo.stock_actual) <= 0;
                return (
                  <li key={insumo.id} className="critical-item">
                    <div className="critical-item-info">
                      <span className="font-mono text-xs text-aqua">{insumo.sku}</span>
                      <span className="critical-item-name">{insumo.descripcion}</span>
                      <span className="critical-item-stock">Disponible: {Number(insumo.stock_actual)} {insumo.unidad_medida} / mín. {Number(insumo.stock_minimo)}</span>
                    </div>
                    <span className={`stock-badge ${agotado ? 'stock-badge--critical' : ''}`}>
                      {agotado ? <PackageX size={13} /> : <AlertTriangle size={13} />}
                      {agotado ? 'Sin stock' : 'Stock bajo'}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <Link to="/inventario/criticos" className="secondary-button critical-link">Ver listado completo</Link>
        </aside>
      </div>
    </div>
  );
}