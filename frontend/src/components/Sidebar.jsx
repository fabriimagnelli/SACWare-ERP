import { Boxes, ClipboardList, LayoutDashboard, LogOut, PanelLeftClose, PanelLeftOpen, Warehouse } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';

const links = [
  { to: '/dashboard', label: 'Resumen', icon: LayoutDashboard },
  { to: '/pedidos', label: 'Pedidos', icon: ClipboardList },
  { to: '/inventario', label: 'Inventario', icon: Boxes }
];

export default function Sidebar({ collapsed, onToggle }) {
  const navigate = useNavigate();
  const usuario = JSON.parse(localStorage.getItem('sacware_usuario') || '{}');

  function cerrarSesion() {
    localStorage.removeItem('sacware_token');
    localStorage.removeItem('sacware_usuario');
    navigate('/login');
  }

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`}>
      <div className="flex items-center gap-3 px-3 py-2">
        <div className="brand-mark"><Warehouse size={19} strokeWidth={2.5} /></div>
        {!collapsed && <span className="font-display text-lg font-bold tracking-tight">SACWare</span>}
      </div>

      <button className="sidebar-toggle" onClick={onToggle} aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}>
        {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
      </button>

      <nav className="mt-10 flex flex-1 flex-col gap-2">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => `nav-link ${isActive ? 'nav-link--active' : ''}`}>
            <Icon size={19} />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className={`user-block ${collapsed ? 'justify-center px-0' : ''}`}>
        {!collapsed && <div className="min-w-0"><p className="truncate text-sm font-semibold">{usuario.nombre || 'Operador'}</p><p className="truncate text-xs text-slate-400">{usuario.rol || 'SACWare ERP'}</p></div>}
        <button className="icon-button ml-auto" onClick={cerrarSesion} aria-label="Cerrar sesión" title="Cerrar sesión"><LogOut size={17} /></button>
      </div>
    </aside>
  );
}
