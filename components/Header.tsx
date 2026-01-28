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
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-4">
        {showBack && onBack && (
          <button
            onClick={onBack}
            className="group flex items-center bg-white border border-gray-200 px-3 py-1.5 rounded-lg text-gray-700 hover:text-blue-600 hover:border-blue-300 hover:shadow-sm transition-all font-semibold"
          >
            <ArrowLeft className="w-5 h-5 mr-1.5 group-hover:-translate-x-1 transition-transform" />
            返回
          </button>
        )}
        {!showBack && <div className="w-16"></div>} {/* Spacer */}
      </div>

      {/* Logo Container */}
      <div className="absolute left-1/2 transform -translate-x-1/2 top-4 md:top-8 md:static md:transform-none md:mr-auto md:ml-4 flex items-center">
        <img src="/logo.png" alt={COMPANY_NAME} className="h-8 md:h-10 object-contain" />
      </div>

      <div className="text-right">
        {title && <h1 className="text-2xl font-bold text-gray-800">{title}</h1>}
        {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
      </div>
    </div>
  );
};
