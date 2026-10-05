// Context thông báo (toast) — thay cho alert trình duyệt, tự ẩn, không chặn tương tác.
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { IconCheck, IconClose } from './icons';

export type ToastKind = 'success' | 'error' | 'info';
export type ToastItem = { id: number; kind: ToastKind; message: string };

type ToastApi = {
  push: (message: string, kind?: ToastKind) => void;
  success: (message: string) => void;
  error: (message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast phải dùng trong <ToastProvider>.');
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const push = useCallback((message: string, kind: ToastKind = 'info') => {
    seq.current += 1;
    const id = seq.current;
    setItems((prev) => [...prev, { id, kind, message }]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 5200);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      push,
      success: (message: string) => push(message, 'success'),
      error: (message: string) => push(message, 'error'),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast toast--${t.kind}`}>
            <span className="toast__icon">
              {t.kind === 'error' ? <IconClose size={18} /> : <IconCheck size={18} />}
            </span>
            <span className="toast__text">{t.message}</span>
            <button
              type="button"
              className="toast__close"
              aria-label="Đóng thông báo"
              onClick={() => setItems((prev) => prev.filter((x) => x.id !== t.id))}
            >
              <IconClose size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
