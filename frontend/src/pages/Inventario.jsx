import { AlertTriangle, Boxes, RefreshCw, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import api from '../api/axios';

const currency = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

export default function Inventario() {
  const [insumos, setInsumos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function cargarInsumos() {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/insumos');
      setInsumos(Array.isArray(data) ? data : []);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'No se pudo cargar el inventario.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarInsumos();
  }, []);

  const insumosFiltrados = useMemo(() => insumos.filter((insumo) => `${insumo.sku} ${insumo.descripcion}`.toLowerCase().includes(busqueda.toLowerCase())), [insumos, busqueda]);
  const criticos = insumos.filter((insumo) => Number(insumo.stock_actual) <= Number(insumo.stock_minimo)).length;

  return <div className="page-enter"><header className="page-header"><div><p className="eyebrow">Control de materiales</p><h1 className="page-title">Inventario</h1><p className="page-subtitle">Disponibilidad de insumos en planta.</p></div><button className="secondary-button" type="button" onClick={cargarInsumos} disabled={loading}><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Actualizar</button></header><div className="inventory-toolbar"><div className="inventory-summary"><div className="metric-icon"><Boxes size={18} /></div><div><span className="text-xs text-slate-400">Insumos registrados</span><strong className="block font-display text-2xl text-white">{insumos.length}</strong></div></div><div className="critical-summary"><AlertTriangle size={17} /><span><strong>{criticos}</strong> niveles críticos</span></div><label className="search-field"><Search size={17} /><input value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Buscar por SKU o descripción" /></label></div>{error ? <div className="feedback feedback--error" role="alert"><AlertTriangle size={18} />{error}</div> : <div className="table-shell"><table><thead><tr><th>SKU</th><th>Descripción</th><th>Categoría</th><th>Unidad</th><th>Stock actual</th><th>Stock mínimo</th><th>Precio unitario</th></tr></thead><tbody>{loading ? <tr><td colSpan="7" className="table-message">Cargando inventario...</td></tr> : insumosFiltrados.length === 0 ? <tr><td colSpan="7" className="table-message">No se encontraron insumos.</td></tr> : insumosFiltrados.map((insumo) => { const stockCritico = Number(insumo.stock_actual) <= Number(insumo.stock_minimo); return <tr key={insumo.id}><td className="font-mono text-xs text-aqua">{insumo.sku}</td><td className="font-medium text-white">{insumo.descripcion}</td><td><span className="category-badge">{insumo.categoria.replace('_', ' ')}</span></td><td>{insumo.unidad_medida}</td><td><span className={stockCritico ? 'stock-badge stock-badge--critical' : 'stock-badge'}>{stockCritico && <AlertTriangle size={13} />}{Number(insumo.stock_actual).toLocaleString('es-AR')}</span></td><td>{Number(insumo.stock_minimo).toLocaleString('es-AR')}</td><td>{currency.format(Number(insumo.precio_unitario))}</td></tr>; })}</tbody></table></div>}</div>;
}
