import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { useToastStore } from '../../store/toastStore.js';
import clsx from 'clsx';

export const ToastProvider: React.FC = () => {
  const { toasts, removeToast, confirmState, resolveConfirm } = useToastStore();

  return (
    <>
      {/* Toast Container */}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
              layout
              className={clsx(
                'pointer-events-auto flex items-start p-4 rounded-xl shadow-lg border w-80',
                'bg-gray-900',
                toast.type === 'success' && 'border-green-500/50',
                toast.type === 'error' && 'border-red-500/50',
                toast.type === 'info' && 'border-blue-500/50'
              )}
            >
              <div className="flex-shrink-0 mr-3">
                {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
                {toast.type === 'info' && <Info className="w-5 h-5 text-blue-500" />}
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <p className="text-sm text-gray-200">{toast.message}</p>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="flex-shrink-0 ml-4 text-gray-500 hover:text-gray-300 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmState?.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => resolveConfirm(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl overflow-hidden"
            >
              <h3 className="text-lg font-bold text-white mb-2">{confirmState.title}</h3>
              <p className="text-sm text-gray-400 mb-6">{confirmState.message}</p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => resolveConfirm(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
                >
                  {confirmState.cancelText}
                </button>
                <button
                  onClick={() => resolveConfirm(true)}
                  className={clsx(
                    'px-4 py-2 text-sm font-bold rounded-lg transition-colors',
                    confirmState.isDestructive
                      ? 'bg-red-500 hover:bg-red-600 text-white'
                      : 'bg-white hover:bg-gray-200 text-gray-950'
                  )}
                >
                  {confirmState.confirmText}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
