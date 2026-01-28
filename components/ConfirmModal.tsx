import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    isDanger?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmLabel = '確認',
    cancelLabel = '取消',
    isDanger = false,
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999]">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md animate-scaleUp">
                <div className="flex items-center gap-3 mb-4">
                    {isDanger && <AlertTriangle className="text-red-500 w-6 h-6" />}
                    <h3 className="text-xl font-bold text-gray-800">{title}</h3>
                    <button
                        onClick={onClose}
                        className="ml-auto text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                <p className="text-gray-600 mb-8 leading-relaxed">
                    {message}
                </p>

                <div className="flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                        className={`px-5 py-2.5 text-white rounded-lg transition font-bold shadow-md flex items-center
              ${isDanger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};
