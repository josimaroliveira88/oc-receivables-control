import React, { useState, useCallback, createContext, useContext } from 'react';

const ToastContext = createContext(null);

// Accepts plain strings as well as non-string payloads (e.g. an array of Zod
// validation issues coming straight from the API) and renders them as text.
const formatToastMessage = (message) => {
  if (typeof message === 'string') return message;
  if (Array.isArray(message)) {
    return message
      .map((issue) => (typeof issue === 'string' ? issue : issue?.message))
      .filter(Boolean)
      .join(' ');
  }
  if (message == null) return '';
  return String(message);
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed top-4 right-4 z-[90] space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center px-4 py-3 rounded-md shadow-lg text-sm font-medium transition-all transform translate-x-0 opacity-100 ${
              toast.type === 'success'
                ? 'bg-green-700 text-white'
                : 'bg-red-700 text-white'
            }`}
          >
            <span className="flex-1">{formatToastMessage(toast.message)}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="ml-3 text-white/80 hover:text-white text-lg leading-none"
            >
              &times;
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export default ToastProvider;
