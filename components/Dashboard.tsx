import React from 'react';
import { User } from '../types';
import { APP_NAME, COMPANY_NAME } from '../constants';
import { Settings, BarChart2 } from 'lucide-react';

interface DashboardProps {
  user: User;
  onNavigate: (path: string) => void;
  onLogout: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, onNavigate, onLogout }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-[#eef5ff]">
      {/* Admin Button - Only visible if user.isAdmin is true */}
      {user.isAdmin && (
        <div className="absolute top-4 right-4">
          <button
            onClick={() => onNavigate('admin')}
            className="flex items-center text-gray-500 hover:text-blue-600 transition p-2 bg-white rounded-full shadow-sm border border-gray-200"
            title="後台管理"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      )}

      <div className="mb-8 text-center">
        <div className="flex justify-center mb-6">
          <img src="/logo.png" alt={COMPANY_NAME} className="h-16 object-contain" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{APP_NAME}</h1>
        <p className="text-gray-500">歡迎回來，{user.name}</p>
      </div>

      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-5xl w-full">
        <h2 className="text-xl font-bold text-gray-800 mb-8">請選擇功能</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
          <button
            onClick={() => onNavigate('weekly-plan')}
            className="h-24 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-bold text-lg shadow-md hover:shadow-lg"
          >
            週計畫
          </button>
          <button
            onClick={() => onNavigate('daily-plan')}
            className="h-24 bg-white border border-gray-200 text-gray-800 rounded-lg hover:border-blue-500 hover:text-blue-600 transition font-medium text-lg shadow-sm hover:shadow-md"
          >
            填寫曉三計畫
          </button>
          <button
            onClick={() => onNavigate('review')}
            disabled={!user.isManager}
            className={`h-24 border rounded-lg transition font-medium text-lg shadow-sm ${user.isManager
                ? 'bg-white border-gray-200 text-gray-800 hover:border-blue-500 hover:text-blue-600 hover:shadow-md'
                : 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'
              }`}
          >
            審核週計畫
          </button>
          <button
            onClick={() => onNavigate('tracking')}
            className="h-24 bg-white border border-gray-200 text-gray-800 rounded-lg hover:border-blue-500 hover:text-blue-600 transition font-medium text-lg shadow-sm hover:shadow-md flex flex-col items-center justify-center gap-1"
          >
            <span>成果追蹤</span>
            {/* <BarChart2 size={16} className="text-gray-400" /> */}
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-100 flex justify-end">
          <button onClick={onLogout} className="text-gray-400 hover:text-red-500 text-sm">
            切換使用者 (登出)
          </button>
        </div>
      </div>
    </div>
  );
};