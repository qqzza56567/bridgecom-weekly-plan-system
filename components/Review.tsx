import React, { useState, useMemo } from 'react';
import { User, WeeklyPlanSubmission, PlanStatus, LastWeekTaskReview } from '../types';
import { COMPANY_NAME } from '../constants';
import { CheckCircle, XCircle, Clock, ChevronDown, ChevronUp, Edit3 } from 'lucide-react';

interface ReviewProps {
    user: User;
    users: User[];
    weeklyPlans: WeeklyPlanSubmission[];
    onUpdatePlan: (plan: WeeklyPlanSubmission) => void;
    onBack: () => void;
}

import { useToast } from '../components/Toast';

export const Review: React.FC<ReviewProps> = ({ user, users, weeklyPlans, onUpdatePlan, onBack }) => {
    const { success } = useToast();
    const subordinateIds = user.subordinates || [];

    // Filter plans relevant to this manager
    const relevantPlans = useMemo(() => {
        return weeklyPlans.filter(p => subordinateIds.includes(p.userId));
    }, [weeklyPlans, subordinateIds]);

    // Group plans by User ID
    const plansByUser = useMemo(() => {
        const groups: Record<string, WeeklyPlanSubmission[]> = {};
        subordinateIds.forEach(id => groups[id] = []);
        relevantPlans.forEach(p => {
            if (groups[p.userId]) groups[p.userId].push(p);
        });
        return groups;
    }, [relevantPlans, subordinateIds]);

    // UI State: Which user is expanded (accordion for users)
    const [expandedUser, setExpandedUser] = useState<string | null>(null);

    // UI State: Which specific plan is manually expanded (for history items)
    const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);

    // Local state for comment editing
    const [editingComment, setEditingComment] = useState<{ [key: string]: string }>({});

    // Local state for validation errors
    const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});

    // Local state for Last Week Review edits
    const [lastWeekEdits, setLastWeekEdits] = useState<{ [planId: string]: LastWeekTaskReview[] }>({});

    const handleStatusChange = async (plan: WeeklyPlanSubmission, newStatus: PlanStatus) => {
        const comment = editingComment[plan.id] !== undefined ? editingComment[plan.id] : (plan.reviewComment || '');

        // Validation
        if (newStatus === 'rejected' && !comment.trim()) {
            setValidationErrors(prev => ({ ...prev, [plan.id]: "退回計畫時，請填寫回覆意見以供員工參考。" }));
            return;
        }

        // Clear error if valid
        if (validationErrors[plan.id]) {
            const nextErrors = { ...validationErrors };
            delete nextErrors[plan.id];
            setValidationErrors(nextErrors);
        }

        // Calculate a stable weekStart for the review if it's missing
        let reviewWeekStart = plan.lastWeekReview?.weekStart;
        if (!reviewWeekStart) {
            const date = new Date(plan.weekStart);
            date.setDate(date.getDate() - 7);
            reviewWeekStart = date.toISOString().split('T')[0];
        }

        const updatedPlan: WeeklyPlanSubmission = {
            ...plan,
            status: newStatus,
            reviewComment: comment,
            updatedAt: new Date().toISOString(),
            lastWeekReview: lastWeekEdits[plan.id] ? {
                weekStart: reviewWeekStart,
                tasks: lastWeekEdits[plan.id]
            } : plan.lastWeekReview
        };

        await onUpdatePlan(updatedPlan);

        // Success Feedback & UI Update
        success("已完成審核");
        setExpandedPlanId(null);
    };

    // Helper to render Status Badge
    const renderStatusBadge = (status: string) => {
        switch (status) {
            case 'pending': return <span className="flex items-center bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs font-bold"><Clock size={12} className="mr-1" /> 待審核</span>;
            case 'approved': return <span className="flex items-center bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-bold"><CheckCircle size={12} className="mr-1" /> 已通過</span>;
            case 'rejected': return <span className="flex items-center bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-bold"><XCircle size={12} className="mr-1" /> 未通過</span>;
            default: return null;
        }
    };

    // 1. Render Full Expanded Card (For Pending or Manually Expanded)
    const renderFullPlanCard = (plan: WeeklyPlanSubmission) => {
        return (
            <div key={plan.id} className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm mb-4 border-l-4 border-l-blue-500">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start mb-4 border-b border-gray-100 pb-3">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <span className="font-bold text-gray-800 text-lg">{plan.weekRange}</span>
                            {renderStatusBadge(plan.status)}
                        </div>
                        <span className="text-xs text-gray-500">提交於 {plan.submittedAt}</span>
                    </div>
                    <div className="text-right text-sm mt-2 md:mt-0 bg-gray-50 p-2 rounded">
                        <div className="inline-block mr-4 text-gray-600">總時數: <b className="text-gray-900">{plan.totalHours}hr</b></div>
                        <div className={`inline-block ${plan.keyRatio < 50 ? 'text-red-500' : 'text-green-600'}`}>
                            關鍵佔比: <b>{plan.keyRatio}%</b>
                        </div>
                    </div>
                </div>

                {/* Remark Section */}
                {plan.remark && (
                    <div className="mb-4 bg-red-50 text-red-700 p-3 rounded text-sm border border-red-100 flex items-start">
                        <span className="font-bold mr-2 whitespace-nowrap">員工備註：</span>
                        <span>{plan.remark}</span>
                    </div>
                )}

                {/* Last Week Review (Editable) */}
                {(() => {
                    // Try to get from edits, then from plan, then try to initialize if missing
                    let edits = lastWeekEdits[plan.id];

                    if (!edits && !plan.lastWeekReview) {
                        // Attempt to find previous week's plan to initialize tracking
                        const prevWs = new Date(plan.weekStart);
                        prevWs.setDate(prevWs.getDate() - 7);
                        const prevWsStr = prevWs.toISOString().split('T')[0];

                        const prevPlan = weeklyPlans.find(p => p.userId === plan.userId && p.weekStart === prevWsStr);
                        if (prevPlan) {
                            edits = prevPlan.tasks.map(t => ({
                                taskId: t.id,
                                name: t.name,
                                category: t.category,
                                outcome: t.outcome,
                                hours: t.hours,
                                actualHours: t.actualHours || t.hours,
                                progress: t.progress || 0,
                                notDoneReason: ''
                            }));
                        }
                    } else if (!edits) {
                        edits = plan.lastWeekReview?.tasks;
                    }

                    if (!edits || edits.length === 0) return null;

                    return (
                        <div className="mb-6 bg-orange-50 rounded-xl border border-orange-200 shadow-sm overflow-hidden">
                            <div className="p-4 border-b border-orange-200 flex items-center gap-2 bg-gradient-to-r from-orange-50 to-white">
                                <Clock className="w-5 h-5 text-orange-600" />
                                <h3 className="font-bold text-orange-900">上週週計畫檢討 (與職員進度追蹤)</h3>
                            </div>
                            <div className="overflow-x-auto -mx-2 md:mx-0">
                                <table className="w-full text-left text-sm min-w-[700px] md:min-w-[800px]">
                                    <thead className="bg-orange-100/50 text-orange-900 border-b border-orange-200">
                                        <tr>
                                            <th className="p-4 w-24">類別</th>
                                            <th className="p-4 w-1/4">任務名稱 / 預期成果</th>
                                            <th className="p-4 w-20 text-center">預估</th>
                                            <th className="p-4 w-24 text-center">實際時數</th>
                                            <th className="p-4 w-1/3">執行進度</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-orange-100 bg-white">
                                        {edits.map((t, idx) => {
                                            const updateItem = (field: keyof LastWeekTaskReview, val: any) => {
                                                const newEdits = edits.map((item, i) =>
                                                    i === idx ? { ...item, [field]: val } : item
                                                );
                                                setLastWeekEdits({ ...lastWeekEdits, [plan.id]: newEdits });
                                            };

                                            return (
                                                <tr key={idx} className="hover:bg-orange-50/30 transition-colors">
                                                    <td className="p-4 align-top">
                                                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${t.category === '關鍵職責' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-gray-50 text-gray-500 border-gray-100'}`}>
                                                            {t.category || '關鍵職責'}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 align-top">
                                                        <div className="font-bold text-gray-800 mb-1.5 text-base">{t.outcome || <span className="text-gray-400 italic font-normal">未填寫預期成果</span>}</div>
                                                        <div className="flex items-center text-xs text-gray-500 bg-gray-50 p-1.5 rounded w-fit border border-gray-100">
                                                            <span className="bg-gray-200 text-gray-600 text-[10px] px-1 rounded mr-2 font-bold whitespace-nowrap">任務</span>
                                                            {t.name}
                                                        </div>
                                                    </td>
                                                    <td className="p-4 text-center align-top text-gray-500 font-medium">
                                                        {t.hours}h
                                                    </td>
                                                    <td className="p-4 align-top">
                                                        <input
                                                            type="number"
                                                            value={t.actualHours}
                                                            onChange={e => updateItem('actualHours', parseFloat(e.target.value) || 0)}
                                                            className="w-full bg-white border border-orange-200 rounded-md p-1.5 text-center font-bold text-gray-800 focus:ring-2 focus:ring-orange-500 outline-none"
                                                        />
                                                    </td>
                                                    <td className="p-4 align-top">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            {[0, 50, 80, 100].map((step) => (
                                                                <button
                                                                    key={step}
                                                                    onClick={() => updateItem('progress', step)}
                                                                    className={`flex-1 py-1 px-2 rounded-md text-xs font-bold transition-all border ${t.progress === step
                                                                        ? step === 100
                                                                            ? 'bg-green-100 text-green-700 border-green-200 shadow-sm'
                                                                            : 'bg-orange-100 text-orange-700 border-orange-200 shadow-sm'
                                                                        : 'bg-white text-gray-400 border-gray-100 hover:bg-gray-50'
                                                                        }`}
                                                                >
                                                                    {step}%
                                                                </button>
                                                            ))}
                                                        </div>

                                                        {/* Progress Bar Visualization */}
                                                        <div className="w-full h-1.5 bg-gray-100 rounded-full mb-3 overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full transition-all duration-500 ${t.progress === 100 ? 'bg-green-500' : 'bg-orange-400'}`}
                                                                style={{ width: `${t.progress}%` }}
                                                            ></div>
                                                        </div>

                                                        {t.progress < 100 && (
                                                            <div className="relative">
                                                                <input
                                                                    type="text"
                                                                    placeholder="說明未完成原因..."
                                                                    className="w-full pl-2 pr-2 py-1.5 text-xs border border-orange-200 rounded-md focus:ring-2 focus:ring-orange-100 focus:border-orange-400 outline-none text-gray-700 placeholder-gray-400 bg-orange-50/30 transition-all"
                                                                    value={t.notDoneReason || ''}
                                                                    onChange={(e) => updateItem('notDoneReason', e.target.value)}
                                                                />
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    );
                })()}

                {/* Task List */}
                <ul className="space-y-3 mb-6">
                    {plan.tasks.map((task, i) => (
                        <li key={i} className="text-sm text-gray-700 p-3 bg-gray-50 rounded border border-gray-100 transition-colors hover:bg-white hover:shadow-sm">
                            <div className="flex justify-between items-start mb-2">
                                <span className="font-bold text-gray-900 text-base leading-tight flex-1 mr-4">{task.outcome}</span>
                                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${(task.progress ?? 0) === 100 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                        進度: {task.progress ?? 0}%
                                    </span>
                                    <span className="text-[10px] bg-white border px-1.5 py-0.5 rounded text-gray-500 font-medium whitespace-nowrap">{task.priority}</span>
                                </div>
                            </div>

                            <div className="flex items-center text-gray-500 text-xs mb-3 bg-white/50 p-1.5 rounded border border-gray-100/50 w-fit">
                                <span className="bg-gray-200 text-gray-600 text-[10px] px-1.5 rounded mr-2 font-bold">任務</span>
                                {task.name}
                            </div>

                            <div className="text-gray-400 text-xs flex justify-between pt-2 border-t border-gray-200/60">
                                <div className="flex gap-4">
                                    <span>預估: {task.hours}hr</span>
                                    <span>實際: {task.actualHours || 0}hr</span>
                                </div>
                                <span className="px-2 py-0.5 bg-gray-100 rounded text-gray-500 text-[10px]">{task.category}</span>
                            </div>
                        </li>
                    ))}
                </ul>

                {/* Review Action Area */}
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                    <label className="block text-sm font-bold text-blue-900 mb-2">主管回覆意見</label>
                    <textarea
                        value={editingComment[plan.id] !== undefined ? editingComment[plan.id] : (plan.reviewComment || '')}
                        onChange={(e) => {
                            setEditingComment({ ...editingComment, [plan.id]: e.target.value });
                            if (validationErrors[plan.id]) {
                                const nextErrors = { ...validationErrors };
                                delete nextErrors[plan.id];
                                setValidationErrors(nextErrors);
                            }
                        }}
                        placeholder="請輸入給予員工的回饋或退回原因..."
                        className={`w-full border rounded p-2 text-sm mb-3 focus:ring-2 outline-none bg-white text-gray-900 
                        ${validationErrors[plan.id] ? 'border-red-300 ring-red-200 focus:ring-red-400' : 'border-blue-200 focus:ring-blue-400'}`}
                        rows={2}
                    />

                    {validationErrors[plan.id] && (
                        <div className="text-red-600 text-xs font-bold mb-3 flex items-center animate-pulse">
                            <XCircle size={14} className="mr-1" />
                            {validationErrors[plan.id]}
                        </div>
                    )}

                    <div className="flex gap-3 justify-end">
                        {/* Collapsible Button (Only if manually expanded) */}
                        {expandedPlanId === plan.id && plan.status !== 'pending' && (
                            <button
                                onClick={() => setExpandedPlanId(null)}
                                className="mr-auto text-gray-400 hover:text-gray-600 text-sm flex items-center"
                            >
                                <ChevronUp size={16} className="mr-1" /> 收合
                            </button>
                        )}

                        <button
                            onClick={() => handleStatusChange(plan, 'rejected')}
                            className={`flex items-center px-4 py-2 border rounded transition text-sm font-bold
                            ${plan.status === 'rejected'
                                    ? 'bg-red-100 border-red-300 text-red-700 ring-2 ring-red-200'
                                    : 'bg-white border-red-200 text-red-600 hover:bg-red-50'}`}
                        >
                            <XCircle size={16} className="mr-1.5" /> 退回重寫
                        </button>
                        <button
                            onClick={() => handleStatusChange(plan, 'approved')}
                            className={`flex items-center px-4 py-2 rounded transition text-sm font-bold shadow-sm
                             ${plan.status === 'approved'
                                    ? 'bg-green-700 text-white ring-2 ring-green-200'
                                    : 'bg-green-600 text-white hover:bg-green-700'}`}
                        >
                            <CheckCircle size={16} className="mr-1.5" /> 通過審核
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // 2. Render Compact Row (For History Items)
    const renderCompactRow = (plan: WeeklyPlanSubmission) => {
        return (
            <div key={plan.id} className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm mb-3 flex items-center justify-between hover:bg-gray-50 transition">
                <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                        <span className="font-bold text-gray-800">{plan.weekRange}</span>
                        <span className="text-xs text-gray-500">提交: {plan.submittedAt}</span>
                    </div>
                    {renderStatusBadge(plan.status)}
                </div>

                <button
                    onClick={() => setExpandedPlanId(plan.id)}
                    className="text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-3 py-1.5 rounded border border-transparent hover:border-blue-100 transition flex items-center"
                >
                    <Edit3 size={14} className="mr-1.5" /> 修改審核結果
                </button>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-[#eef5ff] p-4 md:p-8">
            <div className="max-w-5xl mx-auto">

                <div className="flex justify-between items-center mb-6">
                    <button onClick={onBack} className="flex items-center text-gray-700 font-medium hover:text-blue-600">
                        <span className="mr-1 text-xl">←</span> 返回
                    </button>
                    <div className="flex flex-col items-end">
                        <div className="bg-gray-200 px-3 py-1 inline-block rounded-sm border border-gray-300 mb-1">
                            <span className="text-blue-700 font-bold tracking-widest text-xs">{COMPANY_NAME}</span>
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900">週計畫審核</h1>
                    </div>
                </div>

                {/* Manager Info Card */}
                <div className="bg-white rounded-xl shadow-md p-6 mb-6">
                    <h2 className="text-lg font-bold text-gray-800 mb-2">審核者資訊</h2>
                    <p className="text-gray-600">您好，{user.name}。請審核下屬提交的計畫，通過顯示綠燈，退回顯示紅燈。</p>
                </div>

                {/* Subordinate Lists */}
                <div className="space-y-4">
                    {subordinateIds.map(subId => {
                        const plans = plansByUser[subId] || [];
                        // Sort by date descending
                        plans.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

                        // Split into Pending and History
                        const pendingPlans = plans.filter(p => p.status === 'pending');
                        const historyPlans = plans.filter(p => p.status !== 'pending');

                        const subUser = users.find(u => u.id === subId);
                        const userName = subUser?.name || plans[0]?.userName || `員工 (ID: ${subId.substring(0, 8)}...)`;
                        const latestPlan = plans[0]; // Just for summary in the user header

                        return (
                            <div key={subId} className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100">
                                {/* User Header Accordion */}
                                <button
                                    onClick={() => setExpandedUser(expandedUser === subId ? null : subId)}
                                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-blue-50 transition bg-white"
                                >
                                    <div className="flex items-center gap-4">
                                        <h3 className="text-lg font-bold text-gray-800">{userName}</h3>
                                        {latestPlan && (
                                            <div className="flex items-center gap-2">
                                                {/* Simple summary dots */}
                                                {pendingPlans.length > 0 && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-bold">{pendingPlans.length} 待審</span>}
                                                {pendingPlans.length === 0 && historyPlans.length > 0 && <span className="text-xs text-gray-400">無待審項目</span>}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {expandedUser === subId ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
                                    </div>
                                </button>

                                {/* Expanded User Content */}
                                {expandedUser === subId && (
                                    <div className="px-4 py-6 border-t border-gray-100 bg-gray-50">
                                        {plans.length === 0 ? (
                                            <div className="text-center py-8 text-gray-400">目前沒有提交紀錄</div>
                                        ) : (
                                            <>
                                                {/* SECTION 1: PENDING PLANS (Always Expanded) */}
                                                {pendingPlans.length > 0 && (
                                                    <div className="mb-6">
                                                        <h4 className="text-sm font-bold text-gray-500 mb-3 uppercase tracking-wider pl-1 border-l-4 border-gray-300">待審核項目</h4>
                                                        {pendingPlans.map(plan => renderFullPlanCard(plan))}
                                                    </div>
                                                )}

                                                {/* SECTION 2: HISTORY PLANS (Collapsed by default unless ID matches) */}
                                                {historyPlans.length > 0 && (
                                                    <div>
                                                        <h4 className="text-sm font-bold text-gray-500 mb-3 uppercase tracking-wider pl-1 border-l-4 border-gray-300">歷史紀錄</h4>
                                                        {historyPlans.map(plan => {
                                                            const isExpanded = expandedPlanId === plan.id;
                                                            return isExpanded
                                                                ? renderFullPlanCard(plan)
                                                                : renderCompactRow(plan);
                                                        })}
                                                    </div>
                                                )}

                                                {pendingPlans.length === 0 && historyPlans.length === 0 && (
                                                    <p className="text-gray-400 text-center">無資料</p>
                                                )}
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {subordinateIds.length === 0 && (
                        <div className="text-center text-gray-400 mt-8">
                            您目前沒有設定任何下屬。
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};