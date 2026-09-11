import { ArrowRight, LockKeyhole, Mail, Warehouse } from 'lucide-react';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const { login, isAuthenticated, loading, error } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  function actualizarCampo(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function iniciarSesion(event) {
    event.preventDefault();
    const exito = await login(form.email, form.password);
    if (exito) navigate('/dashboard', { replace: true });
  }

  return (
    <main className="login-page">
      <section className="login-visual">
        <div className="login-orbit login-orbit--one" />
        <div className="login-orbit login-orbit--two" />
        <div className="relative z-10 max-w-md">
          <div className="brand-mark mb-8"><Warehouse size={24} /></div>
          <p className="eyebrow">Gestión operativa industrial</p>
          <h1 className="mt-4 font-display text-5xl font-semibold leading-tight text-white">Todo el taller,<br /><span className="text-aqua">en una sola vista.</span></h1>
          <p className="mt-6 max-w-sm text-base leading-7 text-slate-300">Decisiones más claras para pedidos, materiales y producción.</p>
        </div>
      </section>

      <section className="login-panel">
        <div className="w-full max-w-sm">
          <div className="mb-10 lg:hidden"><span className="font-display text-xl font-bold text-white">SACWare</span></div>
          <p className="eyebrow">Acceso seguro</p>
          <h2 className="mt-3 font-display text-3xl font-semibold text-white">Bienvenido de nuevo</h2>
          <p className="mt-2 text-sm text-slate-400">Ingresa tus credenciales para continuar.</p>
          <form onSubmit={iniciarSesion} className="mt-8 space-y-5">
            <label className="field-label">Correo electrónico<div className="input-wrap"><Mail size={18} /><input name="email" type="email" value={form.email} onChange={actualizarCampo} placeholder="nombre@empresa.com" required /></div></label>
            <label className="field-label">Contraseña<div className="input-wrap"><LockKeyhole size={18} /><input name="password" type="password" value={form.password} onChange={actualizarCampo} placeholder="••••••••" required /></div></label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="primary-button w-full" type="submit" disabled={loading}>{loading ? 'Validando...' : 'Ingresar'} {!loading && <ArrowRight size={18} />}</button>
          </form>
        </div>
      </section>
    </main>
  );
}
