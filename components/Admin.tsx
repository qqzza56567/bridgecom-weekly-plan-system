import React, { useState } from 'react';
import { Plus, Edit, Trash2, Save, X, Shield, Users, Database, AlertTriangle, FileJson, RefreshCw, AlertCircle } from 'lucide-react';
import { useToast } from '../components/Toast';
import { User, WeeklyPlanSubmission } from '../types';
import { Header } from './Header';
import { generateId } from '../utils/uuid';
import { COMPANY_NAME } from '../constants';
import { ConfirmModal } from './ConfirmModal';

interface AdminProps {
  users: User[];
  onSave: (user: User) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onResetData: () => Promise<void>;
  onImportPlans: (plans: WeeklyPlanSubmission[]) => Promise<void>;
  onBack: () => void;
}

export const Admin: React.FC<AdminProps> = ({ users, onSave, onDelete, onResetData, onImportPlans, onBack }) => {
  const toast = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [currentUser, setCurrentUser] = useState<Partial<User>>({});
  const [importJson, setImportJson] = useState('');
  const [isMaintenanceOpen, setIsMaintenanceOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleEdit = (user: User) => {
    setCurrentUser({ ...user });
    setIsEditing(true);
  };

  const handleAdd = () => {
    // Generate a temporary ID that can be replaced or used
    setCurrentUser({ id: generateId(), name: '', isManager: false, isAdmin: false, subordinates: [] });
    setIsEditing(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('確定要刪除此使用者嗎？這將會同步刪除資料庫中的記錄。')) {
      try {
        const promise = onDelete(id);
        toast.info("刪除中...");
        await promise;
        toast.success("使用者已刪除");
      } catch (e) {
        toast.error("刪除失敗");
      }
    }
  };

  const handleSave = async () => {
    if (!currentUser.name) return toast.error('請輸入姓名');

    const userToSave: User = {
      id: currentUser.id!,
      name: currentUser.name,
      email: currentUser.email || '', // Ensure email is passed
      isManager: !!currentUser.isManager,
      isAdmin: !!currentUser.isAdmin,
      subordinates: currentUser.subordinates || []
    };

    try {
      await onSave(userToSave);
      toast.success("儲存成功");
      setIsEditing(false);
      setCurrentUser({});
    } catch (e) {
      toast.error("儲存失敗，請檢查網路或是資料庫連線");
      console.error(e);
    }
  };

  const toggleSubordinate = (subId: string) => {
    const currentSubs = currentUser.subordinates || [];
    if (currentSubs.includes(subId)) {
      setCurrentUser({ ...currentUser, subordinates: currentSubs.filter(id => id !== subId) });
    } else {
      setCurrentUser({ ...currentUser, subordinates: [...currentSubs, subId] });
    }
  };

  // --- Confirm Modal State ---
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleResetClick = () => {
    setShowResetConfirm(true);
  };

  const handleResetConfirm = async () => {
    setIsProcessing(true);
    try {
      await onResetData();
      toast.success('資料已成功清空。');
    } catch (e) {
      toast.error('重置失敗');
    } finally {
      setIsProcessing(false);
      setShowResetConfirm(false);
    }
  };

  const handleImport = async () => {
    if (!importJson.trim()) return toast.error('請貼入 JSON 格式的歷史資料');

    try {
      const data = JSON.parse(importJson);
      if (!Array.isArray(data)) throw new Error('資料格式錯誤（應為陣列）');

      if (window.confirm(`確定要匯入 ${data.length} 筆週計畫資料嗎？`)) {
        setIsProcessing(true);
        await onImportPlans(data);
        toast.success('資料匯入成功！');
        setImportJson('');
        setIsMaintenanceOpen(false);
      }
    } catch (e) {
      toast.error('匯入失敗：資料格式不正確。請確保輸入的是有效的週計畫 JSON 陣列。');
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#eef5ff] p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <Header title="後台管理" subtitle="使用者與權限管理" onBack={onBack} />

        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <div className="bg-gray-200 px-3 py-1 inline-block rounded-sm border border-gray-300">
              <span className="text-blue-700 font-bold tracking-widest text-xs">{COMPANY_NAME}</span>
            </div>
            <button
              onClick={handleAdd}
              className="flex items-center bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition shadow-md font-bold"
            >
              <Plus size={18} className="mr-2" /> 新增使用者
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="p-4 font-bold text-gray-700">姓名</th>
                  <th className="p-4 font-bold text-gray-700">Email</th>
                  <th className="p-4 font-bold text-gray-700">角色權限</th>
                  <th className="p-4 font-bold text-gray-700">管理下屬</th>
                  <th className="p-4 font-bold text-gray-700 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => {
                  // Check if this user (if they are generic staff) has a manager
                  const hasManager = users.some(u => u.subordinates?.includes(user.id));
                  const isGeneralStaff = !user.isManager && !user.isAdmin;

                  return (
                    <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="p-4 text-gray-800 font-medium">{user.name}</td>
                      <td className="p-4 text-gray-600 text-sm">{user.email || '-'}</td>
                      <td className="p-4 flex gap-2 items-center flex-wrap">
                        {user.isAdmin && (
                          <span className="flex items-center bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs font-bold">
                            <Shield className="w-3 h-3 mr-1" /> 管理員
                          </span>
                        )}
                        {user.isManager ? (
                          <span className="flex items-center bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold">
                            <Users className="w-3 h-3 mr-1" /> 主管
                          </span>
                        ) : (
                          isGeneralStaff && (
                            <>
                              <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">一般員工</span>
                              {!hasManager && (
                                <span className="flex items-center text-red-600 bg-red-50 px-2 py-1 rounded text-xs font-bold border border-red-100 animate-pulse">
                                  <AlertCircle className="w-3 h-3 mr-1" /> 未指定主管
                                </span>
                              )}
                            </>
                          )
                        )}
                      </td>
                      <td className="p-4 text-gray-600">
                        {user.isManager ? (
                          <span className="text-sm">{user.subordinates?.length || 0} 人</span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <button onClick={() => handleEdit(user)} className="text-blue-600 hover:text-blue-800 mr-3">
                          <Edit size={18} />
                        </button>
                        <button onClick={() => handleDelete(user.id)} className="text-red-400 hover:text-red-600">
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* --- Data Maintenance Section --- */}
        <div className="mt-8 bg-white rounded-xl shadow-md overflow-hidden border border-red-100 mb-12">
          <button
            onClick={() => setIsMaintenanceOpen(!isMaintenanceOpen)}
            className="w-full px-6 py-4 flex items-center justify-between bg-white hover:bg-red-50 transition"
          >
            <div className="flex items-center text-red-700">
              <Database size={20} className="mr-2" />
              <h2 className="text-lg font-bold">資料進階維護 (資料重置與匯入)</h2>
            </div>
            <div className={`transition-transform duration-300 ${isMaintenanceOpen ? 'rotate-180' : ''}`}>
              <RefreshCw size={18} className="text-red-400" />
            </div>
          </button>

          {isMaintenanceOpen && (
            <div className="p-6 bg-red-50/30 border-t border-red-100 space-y-6">
              <div className="flex flex-col md:flex-row gap-6">
                {/* Reset Left Side */}
                <div className="flex-1 space-y-4">
                  <h3 className="font-bold text-gray-800 flex items-center">
                    <AlertTriangle size={16} className="text-red-500 mr-2" /> 清空目前的資料
                  </h3>
                  <p className="text-sm text-gray-500">
                    如果您希望將目前的週計畫、任務及日報全部清空並重新開始，請使用此按鈕。系統將永久刪除相關紀錄，但保留使用者清單。
                  </p>
                  <button
                    onClick={handleResetClick}
                    disabled={isProcessing}
                    className="bg-red-100 text-red-700 border border-red-200 px-4 py-2 rounded-lg hover:bg-red-600 hover:text-white transition font-bold disabled:opacity-50"
                  >
                    {isProcessing ? '處理中...' : '確認重置所有計畫資料'}
                  </button>
                </div>

                {/* Import Right Side */}
                <div className="flex-[2] space-y-4 border-l border-red-100 pl-6">
                  <h3 className="font-bold text-gray-800 flex items-center">
                    <FileJson size={16} className="text-blue-500 mr-2" /> 匯入舊有的歷史資料
                  </h3>
                  <p className="text-sm text-gray-500">
                    請將歷史週計畫資料（JSON 陣列格式）貼入下方。
                  </p>
                  <textarea
                    value={importJson}
                    onChange={(e) => setImportJson(e.target.value)}
                    placeholder='例如: [ { "userId": "...", "weekStart": "2024-03-27", "tasks": [...] }, ... ]'
                    className="w-full h-32 border border-gray-300 rounded-lg p-3 text-xs font-mono bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={handleImport}
                      disabled={isProcessing || !importJson.trim()}
                      className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition font-bold shadow-sm disabled:opacity-50"
                    >
                      {isProcessing ? '同步至資料庫中...' : '執行批次匯入'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Edit Modal */}
        {isEditing && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            {/* ... Modal Content ... */}
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg">
              {/* ... existing edit modal code ... */}
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-800">
                  {users.find(u => u.id === currentUser.id) ? '編輯使用者' : '新增使用者'}
                </h3>
                <button onClick={() => setIsEditing(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-6">
                {/* ... form fields ... */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">姓名</label>
                  <input
                    type="text"
                    value={currentUser.name || ''}
                    onChange={e => setCurrentUser({ ...currentUser, name: e.target.value })}
                    className="w-full border border-gray-300 bg-white text-gray-900 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="請輸入姓名"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={currentUser.email || ''}
                    onChange={e => setCurrentUser({ ...currentUser, email: e.target.value })}
                    className="w-full border border-gray-300 bg-white text-gray-900 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="請輸入 Email (例如: name@bridgecom.com.tw)"
                  />
                </div>

                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700">角色設定</label>

                  <div className="flex items-center p-3 border border-gray-200 rounded-lg bg-gray-50">
                    <input
                      type="checkbox"
                      id="isAdmin"
                      checked={currentUser.isAdmin || false}
                      onChange={e => setCurrentUser({ ...currentUser, isAdmin: e.target.checked })}
                      className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 bg-white"
                    />
                    <div className="ml-3">
                      <label htmlFor="isAdmin" className="text-sm font-medium text-gray-900 block">系統管理員 (Admin)</label>
                      <span className="text-xs text-gray-500">擁有存取後台管理頁面的權限</span>
                    </div>
                  </div>

                  <div className="flex items-center p-3 border border-gray-200 rounded-lg bg-gray-50">
                    <input
                      type="checkbox"
                      id="isManager"
                      checked={currentUser.isManager || false}
                      onChange={e => setCurrentUser({ ...currentUser, isManager: e.target.checked })}
                      className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 bg-white"
                    />
                    <div className="ml-3">
                      <label htmlFor="isManager" className="text-sm font-medium text-gray-900 block">部門主管 (Manager)</label>
                      <span className="text-xs text-gray-500">擁有審核下屬週計畫的權限</span>
                    </div>
                  </div>
                </div>

                {currentUser.isManager && (
                  <div className="border border-gray-200 rounded-lg p-4 bg-white">
                    <label className="block text-sm font-medium text-gray-700 mb-3">選擇下屬</label>
                    <div className="max-h-48 overflow-y-auto grid grid-cols-2 gap-2 pr-2">
                      {users.filter(u => u.id !== currentUser.id).map(u => {
                        // Check if this user is already assigned to ANOTHER manager
                        const otherManager = users.find(m =>
                          m.isManager &&
                          m.id !== currentUser.id &&
                          m.subordinates?.includes(u.id)
                        );

                        const isAssignedToOther = !!otherManager;
                        const isSelected = currentUser.subordinates?.includes(u.id) || false;

                        return (
                          <label
                            key={u.id}
                            className={`flex items-center space-x-2 p-2 rounded border border-transparent transition-all
                              ${isAssignedToOther
                                ? 'bg-gray-50 border-gray-100 opacity-60 cursor-not-allowed'
                                : 'hover:bg-gray-50 hover:border-gray-100 cursor-pointer'
                              }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={isAssignedToOther}
                              onChange={() => toggleSubordinate(u.id)}
                              className="rounded border-gray-300 text-blue-600 bg-white disabled:bg-gray-100"
                            />
                            <div className="flex flex-col">
                              <span className={`text-sm ${isAssignedToOther ? 'text-gray-400' : 'text-gray-700'}`}>
                                {u.name}
                              </span>
                              {isAssignedToOther && (
                                <span className="text-[10px] text-red-400 font-bold bg-white px-1 rounded border border-red-100 w-fit">
                                  已配屬給: {otherManager?.name}
                                </span>
                              )}
                            </div>
                          </label>
                        );
                      })}
                      {users.length <= 1 && <span className="text-sm text-gray-400 col-span-2">無其他使用者可供選擇</span>}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-8 flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center font-bold shadow-md"
                >
                  <Save size={18} className="mr-2" /> 儲存變更
                </button>
              </div>
            </div>
          </div>
        )}

        <ConfirmModal
          isOpen={showResetConfirm}
          onClose={() => setShowResetConfirm(false)}
          onConfirm={handleResetConfirm}
          title="確認重置所有資料"
          message="警告：這將會永久刪除所有員工的週計畫、任務進度及日報資料！此操作不可復原，确定要执行吗？"
          confirmLabel="確認重置"
          isDanger={true}
        />
      </div>
    </div>
  );
};