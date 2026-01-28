import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

// --- Types ---
type ToastType = 'success' | 'error' | 'info';

interface Toast {
    id: string;
    type: ToastType;
    message: string;
    duration?: number;
}

interface ToastContextType {
    show: (message: string, type?: ToastType, duration?: number) => void;
    success: (message: string, duration?: number) => void;
    error: (message: string, duration?: number) => void;
    info: (message: string, duration?: number) => void;
}

// --- Context ---
const ToastContext = createContext<ToastContextType | undefined>(undefined);

// --- Hook ---
export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

// --- Component ---
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const show = useCallback((message: string, type: ToastType = 'info', duration = 3000) => {
        const id = Math.random().toString(36).substring(2, 9);
        const newToast: Toast = { id, type, message, duration };

        setToasts(prev => [...prev, newToast]);

        if (duration > 0) {
            setTimeout(() => {
                removeToast(id);
            }, duration);
        }
    }, [removeToast]);

    const success = useCallback((msg: string, dur?: number) => show(msg, 'success', dur), [show]);
    const error = useCallback((msg: string, dur?: number) => show(msg, 'error', dur), [show]);
    const info = useCallback((msg: string, dur?: number) => show(msg, 'info', dur), [show]);

    return (
        <ToastContext.Provider value={{ show, success, error, info }}>
            {children}

            {/* Toast Container */}
            <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[9999] flex flex-col gap-2 w-full max-w-sm pointer-events-none px-4">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className={`
                            pointer-events-auto flex items-start gap-3 p-4 rounded-xl shadow-lg border animate-slideDown
                            ${toast.type === 'success' ? 'bg-white border-green-100 text-green-800' : ''}
                            ${toast.type === 'error' ? 'bg-white border-red-100 text-red-800' : ''}
                            ${toast.type === 'info' ? 'bg-white border-blue-100 text-blue-800' : ''}
                        `}
                    >
                        <div className="flex-shrink-0 mt-0.5">
                            {toast.type === 'success' && <CheckCircle className="w-5 h-5 text-green-500" />}
                            {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
                            {toast.type === 'info' && <Info className="w-5 h-5 text-blue-500" />}
                        </div>
                        <p className="text-sm font-medium leading-relaxed flex-1">{toast.message}</p>
                        <button
                            onClick={() => removeToast(toast.id)}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};
