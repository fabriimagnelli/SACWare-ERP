import { AlertTriangle, ArrowLeft, Boxes, PackageX, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

export default function InventarioCritico() {
  const [insumos, setInsumos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function cargarCriticos() {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/insumos/criticos');
      setInsumos(Array.isArray(data) ? data : []);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'No se pudo cargar el inventario crítico.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarCriticos();
  }, []);

  const sinStock = insumos.filter((insumo) => Number(insumo.stock_actual) <= 0).length;

  return (
    <div className="page-enter">
      <header className="page-header">
        <div>
          <Link to="/inventario" className="secondary-button" style={{ marginBottom: 16, display: 'inline-flex' }}>
            <ArrowLeft size={15} /> Volver a inventario
          </Link>
          <p className="eyebrow">Alertas de stock</p>
          <h1 className="page-title">Insumos críticos</h1>
          <p className="page-subtitle">Materiales por debajo del stock mínimo.</p>
        </div>
        <button className="secondary-button" type="button" onClick={cargarCriticos} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Actualizar
        </button>
      </header>

      <div className="inventory-toolbar">
        <div className="inventory-summary">
          <div className="metric-icon"><Boxes size={18} /></div>
          <div>
            <span className="text-xs text-slate-400">Insumos críticos</span>
            <strong className="block font-display text-2xl text-white">{insumos.length}</strong>
          </div>
        </div>
        <div className="critical-summary">
          <PackageX size={17} />
          <span><strong>{sinStock}</strong> sin stock disponible</span>
        </div>
      </div>

      {error ? (
        <div className="feedback feedback--error" role="alert"><AlertTriangle size={18} />{error}</div>
      ) : (
        <div className="table-shell">
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Descripción</th>
                <th>Categoría</th>
                <th>Stock actual</th>
                <th>Stock mínimo</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" className="table-message">Cargando insumos críticos...</td></tr>
              ) : insumos.length === 0 ? (
                <tr><td colSpan="6" className="table-message">Sin insumos por debajo del mínimo.</td></tr>
              ) : (
                insumos.map((insumo) => {
                  const agotado = Number(insumo.stock_actual) <= 0;
                  return (
                    <tr key={insumo.id}>
                      <td className="font-mono text-xs text-aqua">{insumo.sku}</td>
                      <td className="font-medium text-white">{insumo.descripcion}</td>
                      <td><span className="category-badge">{insumo.categoria.replace('_', ' ')}</span></td>
                      <td>{Number(insumo.stock_actual).toFixed(2)} {insumo.unidad_medida}</td>
                      <td>{Number(insumo.stock_minimo).toFixed(2)} {insumo.unidad_medida}</td>
                      <td>
                        <span className={agotado ? 'stock-badge stock-badge--critical' : 'stock-badge'}>
                          {agotado ? <PackageX size={13} /> : <AlertTriangle size={13} />}
                          {agotado ? 'Sin stock' : 'Stock bajo'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
