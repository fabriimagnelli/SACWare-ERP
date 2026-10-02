import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import api from '../services/api';
import { listarPedidos } from '../services/pedidosService';

const DashboardContext = createContext(null);

export function DashboardProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [pedidos, setPedidos] = useState([]);
  const [criticos, setCriticos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setPedidos([]);
      setCriticos([]);
      setError('');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [pedidosData, criticosData] = await Promise.all([
        listarPedidos(),
        api.get('/insumos/criticos')
      ]);
      setPedidos(pedidosData);
      setCriticos(criticosData.data || []);
    } catch (requestError) {
      setError(requestError?.response?.data?.error || 'No se pudieron sincronizar los datos del tablero.');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const kpis = useMemo(() => {
    const pedidosActivos = pedidos.filter(
      (pedido) => pedido.estado === 'pendiente' || pedido.estado === 'en_produccion'
    ).length;
    const ventas = pedidos.reduce((acumulado, pedido) => acumulado + Number(pedido.total || 0), 0);
    const criticosActivos = criticos.length;
    const sinStock = criticos.filter((insumo) => Number(insumo.stock_actual) <= 0).length;
    return { pedidosActivos, ventas, criticosActivos, sinStock };
  }, [pedidos, criticos]);

  const value = useMemo(
    () => ({ pedidos, criticos, kpis, loading, error, refresh }),
    [pedidos, criticos, kpis, loading, error, refresh]
  );

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboardData() {
  const context = useContext(DashboardContext);
  if (!context) throw new Error('useDashboardData debe usarse dentro de un DashboardProvider');
  return context;
}