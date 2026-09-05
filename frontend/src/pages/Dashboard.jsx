import { ArrowUpRight, Boxes, ClipboardList, TrendingUp } from 'lucide-react';

const metrics = [
  { label: 'Pedidos activos', value: '24', detail: '+12% esta semana', icon: ClipboardList },
  { label: 'Insumos críticos', value: '05', detail: 'Requieren atención', icon: Boxes },
  { label: 'Entrega a tiempo', value: '94%', detail: '+4.8% vs. mes anterior', icon: TrendingUp }
];

export default function Dashboard() {
  const usuario = JSON.parse(localStorage.getItem('sacware_usuario') || '{}');
  return <div className="page-enter"><header className="page-header"><div><p className="eyebrow">Panel de control</p><h1 className="page-title">Buen día, {usuario.nombre?.split(' ')[0] || 'equipo'}.</h1><p className="page-subtitle">Este es el pulso operativo de SACWare hoy.</p></div><span className="date-chip">04 SEP 2026</span></header><section className="metrics-grid">{metrics.map(({ label, value, detail, icon: Icon }) => <article className="metric-card" key={label}><div className="metric-icon"><Icon size={20} /></div><p className="metric-label">{label}</p><strong className="metric-value">{value}</strong><p className="metric-detail">{detail} <ArrowUpRight size={13} /></p></article>)}</section><section className="empty-state"><div className="empty-state-icon"><TrendingUp size={24} /></div><h2 className="font-display text-xl font-semibold text-white">Resumen de producción</h2><p className="mt-2 max-w-md text-sm leading-6 text-slate-400">Conecta los módulos de pedidos e inventario para ver el flujo operativo en tiempo real.</p></section></div>;
}
