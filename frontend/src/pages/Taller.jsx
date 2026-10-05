import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  ChevronRight,
  Clock,
  Compass,
  Eye,
  Factory,
  FileSpreadsheet,
  Hammer,
  HelpCircle,
  Layers,
  Package,
  PackageCheck,
  PackageMinus,
  Plus,
  RefreshCw,
  Scissors,
  Search,
  ShieldAlert,
  Sparkles,
  Wrench,
  X
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import {
  actualizarEstadoOP,
  descontarStockOP,
  generarOrdenProduccion,
  listarOrdenesProduccion,
  listarPedidosPendientesOP,
  obtenerDespieceOP
} from '../services/tallerService';

const ETAPAS = [
  { clave: 'pendiente', nombre: 'Pendiente', icon: Clock, orden: 0 },
  { clave: 'corte', nombre: 'Corte', icon: Scissors, orden: 1 },
  { clave: 'armado', nombre: 'Armado', icon: Hammer, orden: 2 },
  { clave: 'vidriado', nombre: 'Vidriado', icon: Layers, orden: 3 },
  { clave: 'finalizado', nombre: 'Finalizado', icon: CheckCircle2, orden: 4 }
];

const SIGUIENTE_ETAPA = {
  pendiente: 'corte',
  corte: 'armado',
  armado: 'vidriado',
  vidriado: 'finalizado'
};

export default function Taller() {
  const { success, error: toastError } = useToast();

  const [ordenes, setOrdenes] = useState([]);
  const [pedidosSinOp, setPedidosSinOp] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState('todas');
  const [busqueda, setBusqueda] = useState('');

  // Modales
  const [modalBOM, setModalBOM] = useState(null); // { opId, datos, cargando, pestaña: 'consolidados' | 'renglones' }
  const [modalAvanzar, setModalAvanzar] = useState(null); // { op, siguienteEstado, procesando }
  const [modalGenerar, setModalGenerar] = useState(false); // boolean
  const [alertasCriticas, setAlertasCriticas] = useState(null); // { nro_op, items: [] }

  // Carga inicial y refresco
  const cargarDatos = useCallback(async () => {
    setCargando(true);
    try {
      const [opsData, pedidosData] = await Promise.all([
        listarOrdenesProduccion(),
        listarPedidosPendientesOP().catch(() => [])
      ]);
      setOrdenes(Array.isArray(opsData) ? opsData : []);
      setPedidosSinOp(Array.isArray(pedidosData) ? pedidosData : []);
    } catch (err) {
      toastError(err.response?.data?.error || 'No se pudieron sincronizar las órdenes de producción.');
    } finally {
      setCargando(false);
    }
  }, [toastError]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // Filtrado de órdenes
  const ordenesFiltradas = useMemo(() => {
    return ordenes.filter((op) => {
      const coincideEstado = filtroEstado === 'todas' || op.estado === filtroEstado;
      const busq = busqueda.toLowerCase().trim();
      const coincideBusqueda =
        !busq ||
        op.nro_op.toLowerCase().includes(busq) ||
        op.nro_pedido.toLowerCase().includes(busq) ||
        (op.cliente && op.cliente.toLowerCase().includes(busq));
      return coincideEstado && coincideBusqueda;
    });
  }, [ordenes, filtroEstado, busqueda]);

  // Contadores de métricas
  const metricas = useMemo(() => {
    const total = ordenes.length;
    const enCorte = ordenes.filter((o) => o.estado === 'corte').length;
    const enArmado = ordenes.filter((o) => o.estado === 'armado').length;
    const enVidriado = ordenes.filter((o) => o.estado === 'vidriado').length;
    const finalizadas = ordenes.filter((o) => o.estado === 'finalizado').length;
    const pendientes = ordenes.filter((o) => o.estado === 'pendiente').length;
    const stockPendiente = ordenes.filter((o) => !o.stock_descontado && o.estado !== 'finalizado').length;
    return { total, enCorte, enArmado, enVidriado, finalizadas, pendientes, stockPendiente };
  }, [ordenes]);

  // Acción: Abrir modal de Despiece (BOM Lite)
  async function abrirBOM(op) {
    setModalBOM({ opId: op.id, datos: null, cargando: true, pestaña: 'consolidados' });
    try {
      const data = await obtenerDespieceOP(op.id);
      setModalBOM((prev) => (prev ? { ...prev, datos: data, cargando: false } : null));
    } catch (err) {
      toastError(err.response?.data?.error || 'No se pudo obtener el despiece de la orden.');
      setModalBOM(null);
    }
  }

  // Acción: Descontar Stock
  async function ejecutarDescuentoStock(opId) {
    try {
      const res = await descontarStockOP(opId);
      success(res.mensaje || 'Stock de insumos descontado exitosamente en almacén.');

      // Si cayeron en nivel crítico, abrir modal de alerta visual destacada
      if (res.alertas_criticas && res.alertas_criticas.length > 0) {
        setAlertasCriticas({
          nro_op: res.nro_op,
          items: res.alertas_criticas
        });
      }

      // Actualizar estado en memoria
      setOrdenes((actuales) =>
        actuales.map((op) => (op.id === opId ? { ...op, stock_descontado: true } : op))
      );

      // Si el modal de BOM estaba abierto para esta orden, refrescarlo
      if (modalBOM && modalBOM.opId === opId) {
        const data = await obtenerDespieceOP(opId);
        setModalBOM((prev) => (prev ? { ...prev, datos: data } : null));
      }
    } catch (err) {
      toastError(err.response?.data?.error || 'Error al descontar el stock de insumos.');
    }
  }

  // Acción: Confirmar avance de etapa
  async function confirmarAvanzarEtapa() {
    if (!modalAvanzar) return;
    const { op, siguienteEstado } = modalAvanzar;
    setModalAvanzar((prev) => ({ ...prev, procesando: true }));

    try {
      const res = await actualizarEstadoOP(op.id, siguienteEstado);
      success(res.mensaje || `Orden avanzada a etapa ${siguienteEstado}.`);
      setOrdenes((actuales) =>
        actuales.map((o) =>
          o.id === op.id
            ? { ...o, estado: siguienteEstado, stock_descontado: res.op?.stock_descontado ?? o.stock_descontado }
            : o
        )
      );
      setModalAvanzar(null);
    } catch (err) {
      toastError(err.response?.data?.error || 'No se pudo actualizar el estado de la orden.');
      setModalAvanzar((prev) => ({ ...prev, procesando: false }));
    }
  }

  // Acción: Generar OP para un pedido
  async function handleGenerarOP(pedidoId) {
    try {
      const res = await generarOrdenProduccion(pedidoId);
      success(res.mensaje || 'Orden de producción generada correctamente.');
      setModalGenerar(false);
      cargarDatos();
    } catch (err) {
      toastError(err.response?.data?.error || 'Error al generar la orden de producción.');
    }
  }

  return (
    <div className="page-enter">
      {/* Encabezado */}
      <header className="page-header">
        <div>
          <p className="eyebrow">Gestión de Fábrica</p>
          <h1 className="page-title">Control de Taller</h1>
          <p className="page-subtitle">
            Seguimiento de etapas de producción, trazabilidad de aberturas y cálculo paramétrico BOM.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="secondary-button" type="button" onClick={cargarDatos} disabled={cargando}>
            <RefreshCw size={16} className={cargando ? 'animate-spin' : ''} /> Actualizar
          </button>
          <button className="primary-button" type="button" onClick={() => setModalGenerar(true)}>
            <Plus size={16} /> Generar OP desde Pedido
          </button>
        </div>
      </header>

      {/* Tarjetas de Métricas de Taller */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="metric-card" style={{ minHeight: 'auto', padding: '16px 20px' }}>
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">En Taller</span>
            <div className="metric-icon" style={{ height: 32, width: 32 }}><Factory size={16} /></div>
          </div>
          <p className="metric-value text-2xl mt-2">{metricas.enCorte + metricas.enArmado + metricas.enVidriado}</p>
          <span className="text-xs text-teal-300">Corte ({metricas.enCorte}) • Armado ({metricas.enArmado}) • Vidriado ({metricas.enVidriado})</span>
        </div>

        <div className="metric-card" style={{ minHeight: 'auto', padding: '16px 20px' }}>
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Pendientes Inicio</span>
            <div className="metric-icon" style={{ height: 32, width: 32 }}><Clock size={16} /></div>
          </div>
          <p className="metric-value text-2xl mt-2">{metricas.pendientes}</p>
          <span className="text-xs text-amber-300">Listas para comenzar corte</span>
        </div>

        <div className="metric-card" style={{ minHeight: 'auto', padding: '16px 20px' }}>
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Finalizadas</span>
            <div className="metric-icon" style={{ height: 32, width: 32 }}><CheckCircle2 size={16} /></div>
          </div>
          <p className="metric-value text-2xl mt-2">{metricas.finalizadas}</p>
          <span className="text-xs text-emerald-300">Producción completada</span>
        </div>

        <div className="metric-card" style={{ minHeight: 'auto', padding: '16px 20px' }}>
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Stock por Descontar</span>
            <div className="metric-icon" style={{ height: 32, width: 32 }}><PackageMinus size={16} /></div>
          </div>
          <p className="metric-value text-2xl mt-2">{metricas.stockPendiente}</p>
          <span className="text-xs text-orange-300">Órdenes sin descarga de insumos</span>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="inventory-toolbar">
        <div className="flex items-center gap-2 overflow-x-auto py-1">
          {[
            { id: 'todas', label: 'Todas', cant: metricas.total },
            { id: 'pendiente', label: 'Pendientes', cant: metricas.pendientes },
            { id: 'corte', label: 'En Corte', cant: metricas.enCorte },
            { id: 'armado', label: 'En Armado', cant: metricas.enArmado },
            { id: 'vidriado', label: 'En Vidriado', cant: metricas.enVidriado },
            { id: 'finalizado', label: 'Finalizadas', cant: metricas.finalizadas }
          ].map(({ id, label, cant }) => (
            <button
              key={id}
              type="button"
              onClick={() => setFiltroEstado(id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                filtroEstado === id
                  ? 'bg-teal-400/20 text-teal-200 border border-teal-400/30 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <span>{label}</span>
              <span className="px-1.5 py-0.5 rounded-full bg-slate-900/60 text-[10px] text-slate-300">{cant}</span>
            </button>
          ))}
        </div>

        <label className="search-field">
          <Search size={17} />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por OP, pedido o cliente..."
          />
        </label>
      </div>

      {/* Lista de Órdenes de Producción */}
      {cargando ? (
        <div className="empty-state">
          <RefreshCw size={36} className="animate-spin text-teal-400 mb-3" />
          <p className="text-slate-300 font-medium">Cargando órdenes de producción...</p>
        </div>
      ) : ordenesFiltradas.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Factory size={28} /></div>
          <h3 className="text-lg font-semibold text-white">No se encontraron órdenes de producción</h3>
          <p className="text-sm text-slate-400 max-w-md mt-1">
            {busqueda || filtroEstado !== 'todas'
              ? 'Prueba modificando los filtros o término de búsqueda.'
              : 'Puedes generar una nueva orden de producción vinculada a un pedido existente.'}
          </p>
          {pedidosSinOp.length > 0 && (
            <button className="primary-button mt-4" type="button" onClick={() => setModalGenerar(true)}>
              <Plus size={16} /> Generar OP ({pedidosSinOp.length} pedidos disponibles)
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5">
          {ordenesFiltradas.map((op) => {
            const etapaActual = ETAPAS.find((e) => e.clave === op.estado) || ETAPAS[0];
            const siguiente = SIGUIENTE_ETAPA[op.estado];
            const porcentaje = Math.round((etapaActual.orden / 4) * 100);

            return (
              <div
                key={op.id}
                className="bg-slate-900/80 border border-slate-700/50 rounded-2xl p-6 shadow-xl backdrop-blur-md transition-all hover:border-teal-500/40"
              >
                {/* Cabecera de la tarjeta */}
                <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-300">
                      <Factory size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-base font-bold text-white tracking-wide">{op.nro_op}</span>
                        <span className={`estado estado--${op.estado}`}>
                          {etapaActual.nombre}
                        </span>
                        {op.stock_descontado ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/15 border border-emerald-500/25 text-emerald-300">
                            <PackageCheck size={13} /> Stock Descontado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/15 border border-amber-500/25 text-amber-300">
                            <AlertCircle size={13} /> Stock Pendiente
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Pedido <strong className="text-slate-200">{op.nro_pedido}</strong> • Cliente: <strong className="text-teal-300">{op.cliente}</strong>
                      </p>
                    </div>
                  </div>

                  {/* Metadatos rápidos */}
                  <div className="flex items-center gap-6 text-xs text-slate-400">
                    <div>
                      <span className="block text-[10px] uppercase text-slate-500 font-bold">Aberturas</span>
                      <span className="font-semibold text-white text-sm">{op.total_aberturas || 1} un.</span>
                    </div>
                    {op.fecha_entrega_estimada && (
                      <div>
                        <span className="block text-[10px] uppercase text-slate-500 font-bold">Entrega Estimada</span>
                        <span className="font-semibold text-slate-200">
                          {new Date(op.fecha_entrega_estimada).toLocaleDateString('es-AR')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Barra de Progreso de Etapas (Stepper de Taller) */}
                <div className="py-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Avance de Producción: <span className="text-teal-300">{porcentaje}%</span>
                    </span>
                    <span className="text-xs text-slate-500">
                      {op.estado === 'finalizado' ? 'Etapas completadas' : `Etapa actual: ${etapaActual.nombre}`}
                    </span>
                  </div>

                  <div className="relative flex items-center justify-between w-full mt-3">
                    {/* Línea de fondo del progreso */}
                    <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-1 bg-slate-800 z-0">
                      <div
                        className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all duration-500"
                        style={{ width: `${porcentaje}%` }}
                      />
                    </div>

                    {/* Pasos */}
                    {ETAPAS.map((etapa, idx) => {
                      const IconComponent = etapa.icon;
                      const esPasado = idx < etapaActual.orden;
                      const esActual = idx === etapaActual.orden;
                      const esFuturo = idx > etapaActual.orden;

                      return (
                        <div key={etapa.clave} className="relative z-10 flex flex-col items-center group">
                          <div
                            className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all ${
                              esActual
                                ? 'bg-teal-400 text-slate-950 border-teal-200 ring-4 ring-teal-400/20 shadow-lg scale-110'
                                : esPasado
                                ? 'bg-teal-900 border-teal-500 text-teal-300'
                                : 'bg-slate-900 border-slate-700 text-slate-500'
                            }`}
                          >
                            <IconComponent size={16} />
                          </div>
                          <span
                            className={`text-xs mt-2 font-medium transition-colors ${
                              esActual
                                ? 'text-teal-300 font-bold'
                                : esPasado
                                ? 'text-slate-300'
                                : 'text-slate-500'
                            }`}
                          >
                            {etapa.nombre}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Barra de Acciones */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => abrirBOM(op)}
                      className="secondary-button"
                      title="Ver desglose y lista de materiales requerida"
                    >
                      <FileSpreadsheet size={16} /> Ver Despiece (BOM)
                    </button>

                    {!op.stock_descontado && (
                      <button
                        type="button"
                        onClick={() => ejecutarDescuentoStock(op.id)}
                        className="secondary-button text-amber-300 border-amber-500/30 hover:bg-amber-500/10"
                        title="Descontar materiales requeridos del inventario de forma segura"
                      >
                        <PackageMinus size={16} /> Descontar Stock
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {siguiente ? (
                      <button
                        type="button"
                        onClick={() => setModalAvanzar({ op, siguienteEstado: siguiente, procesando: false })}
                        className="primary-button"
                      >
                        <span>Avanzar a {ETAPAS.find((e) => e.clave === siguiente)?.nombre}</span>
                        <ArrowRight size={16} />
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-300 text-xs font-semibold">
                        <CheckCircle2 size={16} /> Orden Finalizada
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: Despiece de Materiales (BOM Lite) */}
      {modalBOM && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Header del modal */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-300">
                  <FileSpreadsheet size={22} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white font-display">
                    Despiece de Materiales (BOM Lite)
                  </h2>
                  <p className="text-xs text-slate-400">
                    Cálculo paramétrico para orden <strong className="text-teal-300">{modalBOM.datos?.op?.nro_op}</strong> • Pedido {modalBOM.datos?.pedido?.nro_pedido}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                onClick={() => setModalBOM(null)}
              >
                <X size={20} />
              </button>
            </div>

            {/* Contenido del modal */}
            <div className="p-6 overflow-y-auto flex-1">
              {modalBOM.cargando ? (
                <div className="py-16 text-center text-slate-400">
                  <RefreshCw size={32} className="animate-spin text-teal-400 mx-auto mb-3" />
                  <p>Calculando fórmulas paramétricas y consultando stock en almacén...</p>
                </div>
              ) : !modalBOM.datos ? (
                <p className="text-rose-400">No se pudo cargar la información de materiales.</p>
              ) : (
                <div className="space-y-6">
                  {/* Selector de pestañas */}
                  <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
                    <button
                      type="button"
                      onClick={() => setModalBOM((prev) => ({ ...prev, pestaña: 'consolidados' }))}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        modalBOM.pestaña === 'consolidados'
                          ? 'bg-teal-500/20 text-teal-200 border border-teal-500/30'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Boxes size={15} className="inline mr-1.5" />
                      Materiales Consolidados a Descontar
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalBOM((prev) => ({ ...prev, pestaña: 'renglones' }))}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        modalBOM.pestaña === 'renglones'
                          ? 'bg-teal-500/20 text-teal-200 border border-teal-500/30'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Compass size={15} className="inline mr-1.5" />
                      Fórmulas Paramétricas por Abertura
                    </button>
                  </div>

                  {/* Vista 1: Materiales Consolidados */}
                  {modalBOM.pestaña === 'consolidados' && (
                    <div>
                      <div className="table-shell">
                        <table>
                          <thead>
                            <tr>
                              <th>SKU</th>
                              <th>Insumo</th>
                              <th>Categoría</th>
                              <th>Cantidad Requerida</th>
                              <th>Stock en Almacén</th>
                              <th>Stock Mínimo</th>
                              <th>Diagnóstico</th>
                            </tr>
                          </thead>
                          <tbody>
                            {modalBOM.datos.materiales.map((mat) => (
                              <tr key={mat.sku}>
                                <td className="font-mono text-xs text-aqua">{mat.sku}</td>
                                <td className="font-medium text-white">{mat.descripcion}</td>
                                <td>
                                  <span className="category-badge">{mat.categoria.replace('_', ' ')}</span>
                                </td>
                                <td className="font-bold text-white">
                                  {mat.cantidad_requerida} {mat.unidad_medida}
                                </td>
                                <td>
                                  {mat.stock_actual} {mat.unidad_medida}
                                </td>
                                <td>
                                  {mat.stock_minimo} {mat.unidad_medida}
                                </td>
                                <td>
                                  {!mat.stock_suficiente ? (
                                    <span className="stock-badge stock-badge--critical">
                                      <AlertTriangle size={13} /> Faltante ({mat.deficit} {mat.unidad_medida})
                                    </span>
                                  ) : mat.quedaria_critico ? (
                                    <span className="stock-badge bg-amber-500/10 text-amber-300 border-amber-500/20">
                                      <AlertCircle size={13} /> Quedaría crítico
                                    </span>
                                  ) : (
                                    <span className="stock-badge">
                                      <CheckCircle2 size={13} /> Suficiente
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Vista 2: Fórmulas Paramétricas por Abertura */}
                  {modalBOM.pestaña === 'renglones' && (
                    <div className="space-y-4">
                      {modalBOM.datos.desglose_items.map((item, idx) => (
                        <div
                          key={item.item_id || idx}
                          className="bg-slate-950/60 border border-slate-800 rounded-xl p-4"
                        >
                          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                            <div>
                              <h4 className="text-white font-semibold text-sm">{item.tipologia}</h4>
                              <p className="text-xs text-slate-400">
                                Dimensiones: <strong className="text-teal-300">{item.ancho_mm} x {item.alto_mm} mm</strong> • Cantidad: <strong className="text-white">{item.cantidad} un.</strong>
                              </p>
                            </div>
                            <span className="px-2 py-1 rounded bg-teal-500/10 text-teal-300 text-[11px] font-mono">
                              Renglón #{idx + 1}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                            {item.materiales.map((m) => (
                              <div
                                key={m.clave}
                                className="bg-slate-900/80 p-3 rounded-lg border border-slate-800/80 flex flex-col justify-between"
                              >
                                <div className="flex items-center justify-between text-xs mb-1">
                                  <span className="font-semibold text-slate-200">{m.concepto}</span>
                                  <span className="font-mono text-teal-300 font-bold">
                                    {m.cantidad_total} {m.unidad_medida}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-400 font-mono bg-slate-950/40 px-2 py-1 rounded">
                                  Fórmula: {m.formula}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer del modal */}
            <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                {modalBOM.datos?.op?.stock_descontado ? (
                  <span className="text-emerald-300 flex items-center gap-1">
                    <CheckCircle2 size={15} /> Los insumos de esta orden ya han sido descargados en almacén.
                  </span>
                ) : (
                  <span className="text-amber-300 flex items-center gap-1">
                    <AlertCircle size={15} /> El stock aún no ha sido descargado de inventario.
                  </span>
                )}
              </span>

              <div className="flex items-center gap-3">
                {!modalBOM.datos?.op?.stock_descontado && (
                  <button
                    type="button"
                    onClick={() => ejecutarDescuentoStock(modalBOM.opId)}
                    className="primary-button"
                  >
                    <PackageMinus size={16} /> Descontar Insumos Ahora
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setModalBOM(null)}
                  className="secondary-button"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Confirmar Avance de Etapa */}
      {modalAvanzar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-teal-300 mb-4">
              <div className="p-3 rounded-full bg-teal-500/10 border border-teal-500/20">
                <Hammer size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white font-display">Avanzar Etapa de Producción</h3>
                <p className="text-xs text-slate-400">Orden {modalAvanzar.op.nro_op}</p>
              </div>
            </div>

            <p className="text-sm text-slate-300 mb-6 leading-relaxed">
              ¿Confirmas la transición de la orden desde{' '}
              <strong className="text-white capitalize">"{modalAvanzar.op.estado}"</strong> a{' '}
              <strong className="text-teal-300 capitalize">"{modalAvanzar.siguienteEstado}"</strong>?
            </p>

            {modalAvanzar.siguienteEstado === 'finalizado' && (
              <div className="p-3 mb-5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 size={16} />
                <span>Esta acción marcará la orden como finalizada y el pedido como completado.</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={modalAvanzar.procesando}
                onClick={() => setModalAvanzar(null)}
                className="secondary-button"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={modalAvanzar.procesando}
                onClick={confirmarAvanzarEtapa}
                className="primary-button"
              >
                {modalAvanzar.procesando ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <ArrowRight size={16} />
                )}
                Confirmar Avance
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Alerta Visual Destacada de Stock Crítico */}
      {alertasCriticas && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-36 h-36 bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-center gap-3 text-rose-400 mb-4">
              <div className="p-3 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400">
                <ShieldAlert size={26} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white font-display">Alerta de Stock Crítico</h3>
                <p className="text-xs text-rose-300">
                  Descuento completado para orden {alertasCriticas.nro_op}
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-300 mb-4">
              La descarga de materiales provocó que los siguientes insumos alcanzaran o cayeran por debajo de su stock mínimo:
            </p>

            <div className="space-y-2 mb-6">
              {alertasCriticas.items.map((item) => (
                <div
                  key={item.sku}
                  className="p-3 rounded-xl bg-slate-950 border border-rose-500/30 flex items-center justify-between"
                >
                  <div>
                    <span className="font-mono text-xs text-rose-300 block">{item.sku}</span>
                    <strong className="text-sm text-white">{item.descripcion}</strong>
                  </div>
                  <div className="text-right">
                    <span className="block text-xs text-rose-400 font-bold">
                      Restante: {item.stock_restante} {item.unidad_medida}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Mínimo: {item.stock_minimo} {item.unidad_medida}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <Link
                to="/inventario/criticos"
                className="secondary-button text-xs text-rose-300 border-rose-500/30"
              >
                Ver Insumos Críticos
              </Link>
              <button
                type="button"
                onClick={() => setAlertasCriticas(null)}
                className="primary-button"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Generar OP desde Pedidos Disponibles */}
      {modalGenerar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-300">
                  <Plus size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white font-display">Generar Orden de Producción</h3>
                  <p className="text-xs text-slate-400">Selecciona un pedido confirmado para iniciar fabricación</p>
                </div>
              </div>
              <button
                type="button"
                className="p-1 rounded-lg text-slate-400 hover:text-white"
                onClick={() => setModalGenerar(false)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {pedidosSinOp.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <CheckCircle2 size={36} className="text-emerald-400 mx-auto mb-2" />
                  <p className="text-white font-semibold">No hay pedidos pendientes de OP</p>
                  <p className="text-xs text-slate-500 mt-1">Todos los pedidos confirmados ya tienen una orden de producción activa.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pedidosSinOp.map((p) => (
                    <div
                      key={p.id}
                      className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between hover:border-teal-500/40 transition-all"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-white text-sm font-mono">{p.nro_pedido}</strong>
                          <span className="estado estado--produccion">{p.estado}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          Cliente: <strong className="text-slate-200">{p.cliente}</strong> • {p.items} ítem(s)
                        </p>
                        {p.fecha_entrega_estimada && (
                          <span className="text-[11px] text-teal-300 mt-1 block">
                            Entrega estimada: {new Date(p.fecha_entrega_estimada).toLocaleDateString('es-AR')}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleGenerarOP(p.id)}
                        className="primary-button text-xs py-2 px-3"
                      >
                        Generar OP
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setModalGenerar(false)}
                className="secondary-button"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
