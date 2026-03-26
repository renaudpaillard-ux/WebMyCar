import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

interface ToastItem {
  id: number;
  message: string;
  variant: "success" | "info";
}

interface ToastContextValue {
  showToast: (message: string, variant?: ToastItem["variant"]) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextToastIdRef = useRef(0);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((message: string, variant: ToastItem["variant"] = "success") => {
    const id = nextToastIdRef.current++;

    setToasts((current) => [...current, { id, message, variant }]);

    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 2600);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="notice-stack" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`notice notice--${toast.variant}`}
            role="status"
            onClick={() => dismissToast(toast.id)}
          >
            <span className="notice__dot" aria-hidden="true" />
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }

  return context;
}
