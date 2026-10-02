import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

const ToastContext = createContext(null);

const DURACION_MS = 5000;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const sequenceRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((actuales) => actuales.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (tipo, mensaje) => {
      sequenceRef.current += 1;
      const id = sequenceRef.current;
      setToasts((actuales) => [...actuales, { id, tipo, mensaje }]);
      setTimeout(() => dismiss(id), DURACION_MS);
      return id;
    },
    [dismiss]
  );

  const success = useCallback((mensaje) => push('success', mensaje), [push]);
  const error = useCallback((mensaje) => push('error', mensaje), [push]);

  const value = useMemo(() => ({ success, error, dismiss }), [success, error, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-viewport" role="status" aria-live="polite">
        {toasts.map(({ id, tipo, mensaje }) => (
          <div key={id} className={`toast toast--${tipo}`}>
            {tipo === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span className="toast-message">{mensaje}</span>
            <button type="button" className="toast-close" onClick={() => dismiss(id)} aria-label="Cerrar notificación">
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast debe usarse dentro de un ToastProvider');
  return context;
}