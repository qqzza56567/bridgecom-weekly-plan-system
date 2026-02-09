import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { COMPANY_NAME } from '../constants';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  showBack?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ title, subtitle, onBack, showBack = true }) => {
  return (
    <div className="flex items-center justify-between mb-8">
      <div className="flex items-center gap-4">
        {showBack && onBack && (
          <button
            onClick={onBack}
            className="group flex items-center bg-white border-2 border-slate-200 px-4 py-2 rounded-xl text-slate-600 hover:text-blue-700 hover:border-blue-400 hover:bg-blue-50 hover:shadow-md transition-all font-bold shadow-sm active:scale-95"
          >
            <ArrowLeft className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform" />
            返回
          </button>
        )}
        {!showBack && <div className="w-20"></div>} {/* Spacer */}
      </div>

      {/* Logo Container */}
      <div className="absolute left-1/2 transform -translate-x-1/2 top-4 md:top-8 md:static md:transform-none md:mr-auto md:ml-6 flex items-center">
        <img src="/logo.png" alt={COMPANY_NAME} className="h-8 md:h-12 object-contain" />
      </div>

      <div className="text-right">
        {title && <h1 className="text-3xl font-black text-slate-800 tracking-tight">{title}</h1>}
        {subtitle && <p className="text-sm font-medium text-slate-500 mt-1">{subtitle}</p>}
      </div>
    </div>
  );
};
