import React, { useMemo, useState } from 'react';
import { User, WeeklyPlanSubmission } from '../types';
import { Header } from './Header';
import { Plus, Clock, CheckCircle, XCircle, ChevronDown, ChevronUp, Edit3, AlertCircle, Calendar, RotateCcw, FileEdit, MessageSquare } from 'lucide-react';
import { useToast } from '../components/Toast';
import { COMPANY_NAME } from '../constants';
import { getCurrentWeekStart, addDays, getWeekRangeString } from '../utils/dateUtils';

interface WeeklyPlanListProps {
    user: User;
    plans: WeeklyPlanSubmission[];
    onCreate: (targetWeekStart?: string) => void;
    onEdit: (plan: WeeklyPlanSubmission) => void;
    onWithdraw: (planId: string) => Promise<WeeklyPlanSubmission | null | undefined>; // Updated to Promise
    onBack: () => void;
}

export const WeeklyPlanList: React.FC<WeeklyPlanListProps> = ({
    user,
    plans,
    onCreate,
    onEdit,
    onWithdraw,
    onBack,
}) => {
    const toast = useToast();
    const [selectedPlanForWithdraw, setSelectedPlanForWithdraw] = useState<WeeklyPlanSubmission | null>(null);
    const [showWithdrawModal, setShowWithdrawModal] = useState(false);
    const [createWeekType, setCreateWeekType] = useState<'current' | 'next'>('current');
    const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);

    const currentWeekStart = getCurrentWeekStart();
    const nextWeekStart = addDays(currentWeekStart, 7);
    const lastWeekStart = addDays(currentWeekStart, -7);

    // Sort plans by weekStart desc
    const sortedPlans = useMemo(() => {
        return [...plans].sort((a, b) => b.weekStart.localeCompare(a.weekStart));
    }, [plans]);

    const currentPlan = sortedPlans.find(p => p.weekStart === currentWeekStart);
    const historyPlans = sortedPlans.filter(p => p.weekStart !== currentWeekStart);

    // Check for missing last week plan
    const lastWeekPlan = plans.find(p => p.weekStart === lastWeekStart);
    const isLastWeekMissing = !lastWeekPlan;

    // Grace period logic (e.g. allow catch-up until Friday)
    const today = new Date();
    const isGracePeriod = today.getDay() <= 5;

    const toggleExpand = (planId: string) => {
        setExpandedPlanId(prev => prev === planId ? null : planId);
    };

    const handleCreateClick = () => {
        const targetDate = createWeekType === 'current' ? currentWeekStart : nextWeekStart;
        onCreate(targetDate);
    };

    const handleCatchUpClick = () => {
        onCreate(lastWeekStart);
    };

    const handleWithdrawClick = (e: React.MouseEvent, plan: WeeklyPlanSubmission) => {
        e.stopPropagation();
        setSelectedPlanForWithdraw(plan);
        setShowWithdrawModal(true);
    };
    const confirmWithdraw = async () => {
        if (!selectedPlanForWithdraw) return;

        try {
            const updatedPlan = await onWithdraw(selectedPlanForWithdraw.id);
            if (updatedPlan) {
                // Navigate to edit using the NEW plan object (status='draft')
                toast.success("已成功撤回計畫");
                onEdit(updatedPlan);
            } else {
                toast.error("撤回失敗：找不到該計畫資料");
            }
        } catch (error) {
            console.error(error);
            toast.error("撤回時發生錯誤");
        }
        setShowWithdrawModal(false);
        setSelectedPlanForWithdraw(null);
    };

    // Tag helper
    const getSubmissionTag = (plan: WeeklyPlanSubmission) => {
        const submitDate = plan.submittedAt.slice(0, 10); // YYYY-MM-DD
        const startDate = plan.weekStart;    // YYYY-MM-DD

        // Early: Submitted before the week started
        if (submitDate < startDate) {
            return <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200 ml-2">提前提交</span>;
        }

        // Late: Adjusted logic - if submitted after Friday (more than 2 days after Wednesday start)
        const diff = (new Date(submitDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24);
        if (diff > 2) {
            return <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded border border-orange-200 ml-2">補交</span>;
        }
        return null;
    };

    const renderStatusBadge = (status: string) => {
        switch (status) {
            case 'pending': return <span className="flex items-center text-gray-500 font-bold text-sm"><Clock size={14} className="mr-1" /> 待審核</span>;
            case 'approved': return <span className="flex items-center text-green-600 font-bold text-sm"><CheckCircle size={14} className="mr-1" /> 已通過</span>;
            case 'rejected': return <span className="flex items-center text-red-500 font-bold text-sm"><XCircle size={14} className="mr-1" /> 未通過</span>;
            case 'draft': return <span className="flex items-center text-gray-500 font-bold text-sm"><FileEdit size={14} className="mr-1" /> 草稿</span>;
            default: return null;
        }
    };


    const renderPlanCard = (plan: WeeklyPlanSubmission) => {
        const isExpanded = expandedPlanId === plan.id;

        return (
            <div key={plan.id} className={`bg-white rounded-xl shadow-sm border transition-all duration-200 ${isExpanded ? 'border-blue-300 ring-1 ring-blue-100' : 'border-gray-200 hover:shadow-md'}`}>
                {/* Summary Header - Click to Toggle */}
                <div
                    onClick={() => toggleExpand(plan.id)}
                    className="p-4 cursor-pointer flex justify-between items-center"
                >
                    <div className="flex items-center gap-3">
                        <div className={`w-1.5 h-12 rounded-full ${plan.status === 'approved' ? 'bg-green-500' : plan.status === 'rejected' ? 'bg-red-500' : plan.status === 'draft' ? 'bg-gray-300' : 'bg-gray-400'}`}></div>
                        <div>
                            <div className="flex items-center">
                                <h3 className="text-lg font-bold text-gray-800">{plan.weekRange}</h3>
                                {getSubmissionTag(plan)}
                                {plan.reviewComment && !isExpanded && (
                                    <div className="ml-3 flex items-center text-blue-600 animate-pulse-slow">
                                        <MessageSquare size={14} className="mr-1" />
                                        <span className="text-[10px] font-bold bg-blue-100 px-1.5 py-0.5 rounded">主管有回覆</span>
                                    </div>
                                )}
                            </div>
                            <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                                <span>提交: {new Date(plan.submittedAt).toLocaleString('zh-TW', { hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                                <span>•</span>
                                <span>時數: <span className={plan.totalHours < 30 || plan.totalHours > 36 ? 'text-red-500 font-bold' : ''}>{plan.totalHours}hr</span></span>
                                <span>•</span>
                                <span>關鍵: <span className={plan.keyRatio < 50 ? 'text-red-500 font-bold' : ''}>{plan.keyRatio}%</span></span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        {renderStatusBadge(plan.status)}
                        {isExpanded ? <ChevronUp className="text-gray-400" /> : <ChevronDown className="text-gray-400" />}
                    </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                    <div className="border-t border-gray-100 bg-gray-50 p-4 rounded-b-xl animate-fadeIn">
                        {/* Review Comment (if any) */}
                        {plan.reviewComment && (
                            <div className="mb-4 bg-blue-50 border border-blue-200 p-3 rounded-lg">
                                <h4 className="text-sm font-bold text-blue-800 mb-1 flex items-center">
                                    <div className="w-5 h-5 rounded-full bg-blue-200 flex items-center justify-center mr-2 text-xs">主</div>
                                    主管回覆意見
                                </h4>
                                <p className="text-sm text-blue-900 ml-7">{plan.reviewComment}</p>
                            </div>
                        )}

                        {/* Tasks Table */}
                        <div className="overflow-x-auto rounded-lg border border-gray-200 -mx-2 md:mx-0">
                            <table className="w-full text-left text-sm bg-white min-w-[600px] md:min-w-full">
                                <thead className="bg-gray-100 text-gray-600 font-medium">
                                    <tr>
                                        <th className="p-2 w-20">類別</th>
                                        <th className="p-2">任務名稱 / 預期成果</th>
                                        <th className="p-2 w-20 text-center">預估時數</th>
                                        <th className="p-2 w-20 text-center">實際時數</th>
                                        <th className="p-2 w-24 text-center">執行進度</th>
                                        <th className="p-2">未完成原因</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {plan.tasks.map((t, idx) => (
                                        <tr key={idx}>
                                            <td className="p-2 text-gray-500 text-xs align-top">{t.category}</td>
                                            <td className="p-2 align-top">
                                                <div className="font-bold text-gray-800">{t.name}</div>
                                                <div className="text-gray-500 text-xs mt-0.5">{t.outcome}</div>
                                            </td>
                                            <td className="p-2 text-center text-gray-600 align-top">{t.hours}</td>
                                            <td className="p-2 text-center text-gray-600 align-top">{t.actualHours || 0}</td>
                                            <td className="p-2 align-top text-center">
                                                <div className="flex flex-col items-center gap-1 min-w-[100px]">
                                                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${(t.progress ?? 0) < 80 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                                                        進度: {t.progress ?? 0}%
                                                    </span>
                                                    <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full transition-all duration-500 ${t.progress === 100 ? 'bg-green-500' : 'bg-blue-400'}`}
                                                            style={{ width: `${t.progress}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-2 text-gray-500 text-xs italic align-top max-w-[150px] truncate" title={t.notDoneReason}>
                                                {t.notDoneReason || '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Action Buttons */}
                        <div className="mt-4 flex justify-end gap-3">
                            {/* Pending -> Withdraw */}
                            {plan.status === 'pending' && (
                                <button
                                    onClick={(e) => handleWithdrawClick(e, plan)}
                                    className="flex items-center bg-white text-gray-600 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition shadow-sm font-medium text-sm"
                                >
                                    <RotateCcw size={16} className="mr-2" /> 撤回修改
                                </button>
                            )}

                            {/* Draft -> Continue Editing */}
                            {plan.status === 'draft' && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onEdit(plan);
                                    }}
                                    className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition shadow-sm font-medium text-sm"
                                >
                                    <Edit3 size={16} className="mr-2" /> 繼續編輯
                                </button>
                            )}

                            {/* Rejected -> Modify */}
                            {plan.status === 'rejected' && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onEdit(plan);
                                    }}
                                    className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition shadow-sm font-medium text-sm"
                                >
                                    <Edit3 size={16} className="mr-2" /> 修改並重新提交
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-[#eef5ff] p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
                <Header title="週計畫管理" subtitle="檢視狀態與歷史紀錄" onBack={onBack} />

                {/* --- Create Area --- */}
                <div className="bg-white rounded-xl shadow-md p-6 mb-8 border border-gray-100">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h2 className="text-xl font-bold text-gray-800">計畫管理</h2>
                            <p className="text-sm text-gray-500 mt-1">請選擇要建立的週次（本週/下週）</p>
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <select
                                    value={createWeekType}
                                    onChange={(e) => setCreateWeekType(e.target.value as 'current' | 'next')}
                                    className="appearance-none bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-40 p-2.5 pr-8 font-medium cursor-pointer"
                                >
                                    <option value="current">本週 ({getWeekRangeString(currentWeekStart)})</option>
                                    <option value="next">下週 ({getWeekRangeString(nextWeekStart)})</option>
                                </select>
                                <ChevronDown className="absolute right-2 top-3 w-4 h-4 text-gray-500 pointer-events-none" />
                            </div>
                            <button
                                onClick={handleCreateClick}
                                disabled={plans.some(p => p.weekStart === (createWeekType === 'current' ? currentWeekStart : nextWeekStart))}
                                className={`px-4 py-2.5 rounded-lg transition shadow font-bold flex items-center whitespace-nowrap ${plans.some(p => p.weekStart === (createWeekType === 'current' ? currentWeekStart : nextWeekStart))
                                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                    : 'bg-blue-600 text-white hover:bg-blue-700'
                                    }`}
                            >
                                <Plus size={18} className="mr-2" />
                                {plans.some(p => p.weekStart === (createWeekType === 'current' ? currentWeekStart : nextWeekStart)) ? '該週已建立' : '新建週計畫'}
                            </button>
                        </div>
                    </div>

                    {/* Catch-up Logic */}
                    {!currentPlan && isLastWeekMissing && isGracePeriod && (
                        <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-3 animate-pulse-slow">
                            <div className="flex items-center text-orange-800 text-sm font-medium">
                                <AlertCircle size={18} className="mr-2 text-orange-600" />
                                偵測到上週尚未填寫，可在週五前補交。
                            </div>
                            <button
                                onClick={handleCatchUpClick}
                                className="text-sm bg-orange-100 text-orange-700 border border-orange-300 px-3 py-1.5 rounded hover:bg-orange-200 transition font-bold whitespace-nowrap"
                            >
                                補交上週週計畫
                            </button>
                        </div>
                    )}
                </div>

                {/* --- Current Week Status --- */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-gray-700 flex items-center">
                            <Calendar className="w-5 h-5 mr-2 text-blue-500" />
                            本週計畫 ({getWeekRangeString(currentWeekStart)})
                        </h2>
                        <div className="bg-gray-200 px-3 py-1 inline-block rounded-sm border border-gray-300">
                            <span className="text-blue-700 font-bold tracking-widest text-xs">{COMPANY_NAME}</span>
                        </div>
                    </div>

                    {currentPlan ? (
                        renderPlanCard(currentPlan)
                    ) : (
                        <div className="bg-white rounded-xl shadow-sm p-8 text-center border border-dashed border-gray-300">
                            <div className="mx-auto w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                                <Clock className="w-6 h-6 text-gray-400" />
                            </div>
                            <h3 className="text-base font-bold text-gray-600 mb-1">本週尚未提交計畫</h3>
                            <p className="text-sm text-gray-400">請使用上方工具列建立。</p>
                        </div>
                    )}
                </div>

                <div className="space-y-4">
                    <h2 className="text-lg font-bold text-gray-700 pl-1 border-l-4 border-blue-500">歷史紀錄</h2>
                    {historyPlans.length === 0 ? (
                        <p className="text-gray-400 text-center py-8 bg-white rounded-xl border border-gray-100">尚無歷史紀錄</p>
                    ) : (
                        <div className="space-y-3">
                            {historyPlans.map(plan => renderPlanCard(plan))}
                        </div>
                    )}
                </div>
            </div>

            {/* Withdraw Confirmation Modal */}
            {showWithdrawModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm">
                        <div className="text-center mb-6">
                            <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                                <RotateCcw className="text-blue-600 w-6 h-6" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900">確認撤回計畫？</h3>
                            <p className="text-sm text-gray-500 mt-2">
                                撤回後計畫將變為「草稿」狀態，您原本填寫的內容都會保留，可修改後重新提交。
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowWithdrawModal(false)}
                                className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                            >
                                取消
                            </button>
                            <button
                                onClick={confirmWithdraw}
                                className="flex-1 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition"
                            >
                                確認撤回
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};