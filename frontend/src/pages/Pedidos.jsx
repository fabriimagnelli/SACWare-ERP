import { ClipboardList } from 'lucide-react';

export default function Pedidos() {
  return <div className="page-enter"><header className="page-header"><div><p className="eyebrow">Operaciones</p><h1 className="page-title">Pedidos</h1><p className="page-subtitle">Seguimiento de pedidos y entregas.</p></div><button className="primary-button" type="button"><ClipboardList size={17} /> Nuevo pedido</button></header><section className="empty-state"><div className="empty-state-icon"><ClipboardList size={24} /></div><h2 className="font-display text-xl font-semibold text-white">Módulo de pedidos</h2><p className="mt-2 max-w-md text-sm leading-6 text-slate-400">La vista de gestión de pedidos está lista para conectarse al flujo de ventas.</p></section></div>;
}
