import React, { useState, useMemo, useEffect } from 'react';
import { User, WeeklyTask, TaskCategory, TaskPriority, WeeklyPlanSubmission, LastWeekTaskReview, TaskStatus } from '../types';
import { Plus, X, AlertCircle, History, CheckCircle, Copy, Clock, AlertTriangle, Loader2 } from 'lucide-react';
import { COMPANY_NAME } from '../constants';
import { getPlanningWeekStart, getPreviousWeekStart, getWeekRangeString, toLocalISOString, daysBetweenLocal } from '../utils/dateUtils';
import { Header } from './Header';
import { generateId } from '../utils/uuid';

interface WeeklyPlanProps {
    user: User;
    initialData?: WeeklyPlanSubmission; // If provided, we are in Edit mode
    targetWeekStart?: string; // If provided, we are creating a plan for this specific week
    allPlans?: WeeklyPlanSubmission[]; // For finding previous week's plan
    onSubmit: (plan: WeeklyPlanSubmission) => void;
    onBack: () => void;
}

export const WeeklyPlan: React.FC<WeeklyPlanProps> = ({ user, initialData, targetWeekStart, allPlans = [], onSubmit, onBack }) => {
    // --- Current Week Tasks State ---
    const [tasks, setTasks] = useState<WeeklyTask[]>([
        {
            id: generateId(),
            category: TaskCategory.KEY_RESPONSIBILITY,
            priority: TaskPriority.MEDIUM,
            name: '',
            outcome: '',
            hours: 0,
            progress: 0,
        }
    ]);

    const [showRemarkModal, setShowRemarkModal] = useState(false);
    const [remark, setRemark] = useState('');

    // Loading state
    const [isSaving, setIsSaving] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    // --- Date Logic (Wednesday Based) ---
    const { weekStart, weekRange } = useMemo(() => {
        if (initialData) {
            return { weekStart: initialData.weekStart, weekRange: initialData.weekRange };
        }
        // If targetWeekStart is passed (from dropdown creation or catch-up), use it.
        // Otherwise fall back to getPlanningWeekStart (default logic)
        const ws = targetWeekStart || getPlanningWeekStart();
        const wr = getWeekRangeString(ws);
        return { weekStart: ws, weekRange: wr };
    }, [initialData, targetWeekStart]);

    // --- Initialization Effect (Current Plan) ---
    useEffect(() => {
        if (initialData) {
            const processedTasks = initialData.tasks.map(t => ({
                ...t,
                actualHours: t.actualHours || 0,
                progress: t.progress || 0,
            }));
            setTasks(processedTasks);
            if (initialData.remark) setRemark(initialData.remark);
        }
    }, [initialData]);

    // --- Last Week Review State ---
    // This holds the "Self-Review" data for the PREVIOUS week.
    // If we are editing an existing plan that ALREADY has a review attached, load it.
    // Otherwise, find the previous plan and initialize from it.
    const [reviewTasks, setReviewTasks] = useState<LastWeekTaskReview[]>([]);
    const [lastPlanWeekStart, setLastPlanWeekStart] = useState<string | null>(null);

    const lastPlan = useMemo(() => {
        // Find closest previous plan
        const sortedHistory = [...allPlans]
            .filter(p => p.weekStart < weekStart)
            .sort((a, b) => new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime());
        return sortedHistory[0];
    }, [allPlans, weekStart]);

    useEffect(() => {
        if (initialData && initialData.lastWeekReview) {
            // Case A: Editing a plan that already has review data saved
            setReviewTasks(initialData.lastWeekReview.tasks);
            setLastPlanWeekStart(initialData.lastWeekReview.weekStart);
        } else if (lastPlan) {
            // Case B: Creating new plan or first time editing without saved review
            // Initialize with data from the actual last plan
            const initReviews: LastWeekTaskReview[] = lastPlan.tasks.map(t => ({
                taskId: t.id,
                name: t.name,
                category: t.category,
                outcome: t.outcome,
                hours: t.hours,
                actualHours: t.actualHours || 0,
                progress: t.progress || 0,
                notDoneReason: t.notDoneReason || ''
            }));
            setReviewTasks(initReviews);
            setLastPlanWeekStart(lastPlan.weekStart);
        } else {
            setReviewTasks([]);
            setLastPlanWeekStart(null);
        }
    }, [initialData, lastPlan]);



    // --- Review Handlers ---
    const updateReview = (taskId: string, field: keyof LastWeekTaskReview, value: any) => {
        setReviewTasks(prev => prev.map(t => {
            if (t.taskId === taskId) {
                return { ...t, [field]: value };
            }
            return t;
        }));
    };

    const handleCopyTaskToCurrent = (rTask: LastWeekTaskReview) => {
        setTasks(prev => [
            ...prev,
            {
                id: generateId(),
                category: asTaskCategory(rTask.category),
                priority: TaskPriority.MEDIUM, // Default to medium on copy
                name: rTask.name,
                outcome: rTask.outcome || '',
                hours: 0, // Reset hours for re-estimation
                progress: 0, // Reset progress
            }
        ]);
        // Visual feedback could be added here
    };

    const asTaskCategory = (c?: string): TaskCategory => {
        if (c === TaskCategory.KEY_RESPONSIBILITY) return TaskCategory.KEY_RESPONSIBILITY;
        return TaskCategory.OTHER; // Fallback
    };

    // --- Task Management Functions ---
    const addTask = () => {
        setTasks([
            ...tasks,
            {
                id: generateId(),
                category: TaskCategory.KEY_RESPONSIBILITY,
                priority: TaskPriority.MEDIUM,
                name: '',
                outcome: '',
                hours: 0,
                progress: 0,
            }
        ]);
    };

    const removeTask = (id: string) => {
        if (tasks.length > 1) {
            setTasks(tasks.filter(t => t.id !== id));
        }
    };

    const updateTask = (id: string, field: keyof WeeklyTask, value: any) => {
        setTasks(tasks.map(t => {
            if (t.id === id) {
                return {
                    ...t,
                    [field]: value,
                    // RULE: Update lastTouchedAt whenever modified
                    lastTouchedAt: toLocalISOString(new Date())
                };
            }
            return t;
        }));
    };

    // --- Calculations ---
    const totalHours = useMemo(() => tasks.reduce((sum, t) => sum + (Number(t.hours) || 0), 0), [tasks]);
    const keyHours = useMemo(() => tasks
        .filter(t => t.category === TaskCategory.KEY_RESPONSIBILITY)
        .reduce((sum, t) => sum + (Number(t.hours) || 0), 0), [tasks]);

    const keyRatio = totalHours > 0 ? (keyHours / totalHours) * 100 : 0;
    const isRatioValid = keyRatio >= 50;
    const isTotalValid = totalHours >= 30 && totalHours <= 36;

    // --- Submit Handlers ---
    const [validationError, setValidationError] = useState<string | null>(null);

    const handlePreSubmit = () => {
        setValidationError(null); // Reset previous errors

        if (tasks.some(t => !t.name.trim())) {
            // Replaced alert with inline error
            setValidationError("請確保所有本週任務都有填寫名稱");
            // Scroll to the bottom or top depending on where the error is shown. 
            // Let's assume user is near the submit button, so showing it near there is good.
            return;
        }

        if (!isTotalValid || !isRatioValid) {
            setShowRemarkModal(true);
        } else {
            handleFinalSubmit();
        }
    };

    const handleFinalSubmit = async () => {
        // Prepare Last Week Review Section safely
        const lastWeekReviewSection = (lastPlanWeekStart && reviewTasks.length > 0) ? {
            weekStart: lastPlanWeekStart,
            tasks: reviewTasks
        } : undefined;

        const submission: WeeklyPlanSubmission = {
            id: initialData ? initialData.id : generateId(),
            userId: user.id,
            userName: user.name,
            weekRange: weekRange,
            weekStart: weekStart,
            submittedAt: initialData ? initialData.submittedAt : new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: 'pending',
            reviewComment: initialData ? initialData.reviewComment : undefined,
            totalHours: totalHours,
            keyRatio: parseFloat(keyRatio.toFixed(1)),
            tasks: tasks,
            remark: remark || undefined,
            // Attach the review data
            lastWeekReview: lastWeekReviewSection
        };

        setIsSaving(true);
        try {
            await onSubmit(submission);

            // Success! Set states immediately to reflect the new reality
            setShowRemarkModal(false);
            setIsSuccess(true);
            setIsSaving(false);
            console.log("[WeeklyPlan] Submission successful. Transitioning to success view.");

        } catch (error) {
            console.error("[WeeklyPlan] Submission Failed", error);
            setIsSaving(false);
        }
    };

    const getPageTitle = () => {
        if (!initialData) return '建立週計畫';
        if (initialData.status === 'draft') return '修改週計畫 (草稿)';
        return '修改週計畫';
    };

    const duplicatePlan = useMemo(() => {
        // If we are in edit mode (initialData exists), it's never a "duplicate" of itself.
        // If we just succeeded or are saving, hide the error.
        if (initialData || isSuccess || isSaving) return null;
        return allPlans.find(p => p.weekStart === weekStart);
    }, [initialData, allPlans, weekStart, isSuccess, isSaving]);

    // Auto-redirect on success
    useEffect(() => {
        if (isSuccess) {
            const timer = setTimeout(() => {
                onBack();
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [isSuccess, onBack]);

    if (isSuccess) {
        return (
            <div className="min-h-screen bg-[#eef5ff] p-4 md:p-8 flex items-center justify-center">
                <div className="bg-white p-10 rounded-2xl shadow-2xl max-w-md text-center animate-fadeIn">
                    <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
                        <CheckCircle className="w-12 h-12 text-green-500 animate-pulse" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">提交成功！</h2>
                    <p className="text-gray-500 mb-8 leading-relaxed">您的週計畫已成功儲存。即將自動返回列表...</p>
                    <button onClick={onBack} className="w-full bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition shadow-lg transform hover:scale-105">
                        立即返回
                    </button>
                </div>
            </div>
        );
    }

    if (duplicatePlan) {
        return (
            <div className="min-h-screen bg-[#eef5ff] p-4 md:p-8 flex items-center justify-center">
                <div className="bg-white p-8 rounded-xl shadow-md max-w-md text-center">
                    <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
                        <AlertCircle className="w-8 h-8 text-orange-600" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-800 mb-2">該週計畫已存在</h2>
                    <p className="text-gray-500 mb-6">您選擇的週次 ({weekRange}) 已經建立過計畫，無法重複建立。</p>
                    <button onClick={onBack} className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-blue-700 transition shadow-md">
                        返回列表
                    </button>
                </div>
            </div>
        );
    }

    // --- Constants for Slider Colors ---
    const getSliderColor = (val: number) => {
        if (val >= 100) return 'accent-green-500';
        if (val >= 80) return 'accent-blue-500';
        if (val >= 50) return 'accent-yellow-500';
        return 'accent-orange-500';
    };

    return (
        <div className="min-h-screen bg-[#eef5ff] p-4 md:p-4 font-sans">
            <div className="max-w-6xl mx-auto space-y-6">
                <Header title={getPageTitle()} subtitle={`計畫區間：${weekRange}`} onBack={onBack} />

                {/* --- SECTION 1: LAST WEEK REVIEW (SELF CLICK) --- */}
                {reviewTasks.length > 0 && (
                    <div className="bg-orange-50 rounded-xl shadow-md border border-orange-200 overflow-hidden animate-fadeIn">
                        <div className="p-4 md:p-6 border-b border-orange-200 flex items-center gap-3 bg-gradient-to-r from-orange-50 to-white">
                            <Clock className="w-6 h-6 text-orange-600" />
                            <div>
                                <h2 className="text-lg font-bold text-orange-900">上週計畫自我檢視</h2>
                                <p className="text-sm text-orange-700 opacity-80">請更新上週任務的實際執行狀況，並可將未完成或例行任務複製到本週。</p>
                            </div>
                        </div>
                        <div className="overflow-x-auto -mx-2 md:mx-0">
                            <table className="w-full text-left text-sm min-w-[700px] md:min-w-[800px]">
                                <thead className="bg-orange-100/50 text-orange-900 text-sm">
                                    <tr>
                                        <th className="p-4 w-24">類別</th>
                                        <th className="p-4 w-1/4">任務名稱 / 預期成果</th>
                                        <th className="p-4 w-20 text-center">預估</th>
                                        <th className="p-4 w-24 text-center">實際時數</th>
                                        <th className="p-4 w-1/3">執行進度</th>
                                        <th className="p-4 w-32">操作</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-orange-100 bg-white">
                                    {reviewTasks.map((t) => (
                                        <tr key={t.taskId} className="hover:bg-orange-50/30 transition-colors">
                                            <td className="p-4 align-top">
                                                <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${t.category === '關鍵職責' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-gray-50 text-gray-500 border-gray-100'}`}>
                                                    {t.category || '其他'}
                                                </span>
                                            </td>
                                            <td className="p-4 align-top">
                                                <div className="font-bold text-gray-800 mb-1">{t.name}</div>
                                                <div className="text-xs text-gray-400">{t.outcome || '-'}</div>
                                            </td>
                                            <td className="p-4 text-center align-top text-gray-500 font-medium">
                                                {t.hours}h
                                            </td>
                                            <td className="p-4 align-top">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="168"
                                                    step="0.5"
                                                    className="w-full border border-orange-200 rounded-md p-1.5 text-center text-gray-800 font-bold focus:ring-2 focus:ring-orange-500 outline-none"
                                                    value={t.actualHours || ''}
                                                    onChange={(e) => {
                                                        let val = parseFloat(e.target.value);
                                                        if (isNaN(val)) val = 0;
                                                        if (val < 0) val = 0;
                                                        if (val > 168) val = 168;
                                                        updateReview(t.taskId, 'actualHours', val);
                                                    }}
                                                />
                                            </td>
                                            <td className="p-4 align-top min-w-[300px]">
                                                <div className="flex items-center gap-2 mb-2">
                                                    {[0, 50, 80, 100].map((step) => (
                                                        <button
                                                            key={step}
                                                            onClick={() => updateReview(t.taskId, 'progress', step)}
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
                                                            onChange={(e) => updateReview(t.taskId, 'notDoneReason', e.target.value)}
                                                        />
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-4 align-top text-center">
                                                <button
                                                    onClick={() => handleCopyTaskToCurrent(t)}
                                                    className="flex items-center justify-center px-3 py-2 bg-white border border-gray-200 text-gray-600 text-xs font-bold rounded-lg shadow-sm hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all active:scale-95 group"
                                                    title="複製任務到本週"
                                                >
                                                    <Copy className="w-3.5 h-3.5 mr-1.5 group-hover:scale-110 transition-transform" />
                                                    複製
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}


                {/* --- SECTION 2: THIS WEEK STATS --- */}
                <div className="bg-white rounded-xl shadow-md p-6">
                    <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                        <span className="w-1.5 h-6 bg-blue-600 rounded-full mr-3"></span>
                        本週計畫統計
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className={`rounded-xl p-5 border-l-4 shadow-sm ${isTotalValid ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'}`}>
                            <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">總預估時數</div>
                            <div className="flex items-baseline gap-2">
                                <span className={`text-3xl font-bold ${isTotalValid ? 'text-green-700' : 'text-red-600'}`}>
                                    {totalHours.toFixed(1)}
                                </span>
                                <span className="text-sm text-gray-500">小時</span>
                            </div>
                            <div className="text-xs text-gray-400 mt-1">目標: 30 - 36 小時</div>
                        </div>

                        <div className="bg-blue-50 rounded-xl p-5 border-l-4 border-blue-500 shadow-sm">
                            <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">關鍵職責時數</div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-bold text-blue-700">{keyHours.toFixed(1)}</span>
                                <span className="text-sm text-gray-500">小時</span>
                            </div>
                        </div>

                        <div className={`rounded-xl p-5 border-l-4 shadow-sm ${isRatioValid ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'}`}>
                            <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">關鍵職責佔比</div>
                            <div className="flex items-baseline gap-2">
                                <span className={`text-3xl font-bold ${isRatioValid ? 'text-green-700' : 'text-red-600'}`}>
                                    {keyRatio.toFixed(0)}%
                                </span>
                            </div>
                            <div className="text-xs text-gray-400 mt-1">目標: ≥ 50%</div>
                        </div>
                    </div>
                </div>

                {/* --- SECTION 3: THIS WEEK TASKS --- */}
                <div className="bg-white rounded-xl shadow-md p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg font-bold text-gray-800 flex items-center">
                            <span className="w-1.5 h-6 bg-blue-600 rounded-full mr-3"></span>
                            本週任務清單
                        </h2>
                    </div>

                    <div className="space-y-6">
                        {tasks.map((task, index) => (
                            <div key={task.id} className="relative bg-white border border-gray-100 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow group">
                                <div className="absolute -left-3 top-5 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-sm z-10">
                                    {index + 1}
                                </div>
                                <div className="pl-4">
                                    <div className="flex flex-col md:flex-row gap-4 mb-4">
                                        <div className="w-full md:w-1/4 space-y-4">
                                            <div>
                                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">類別</label>
                                                <select
                                                    value={task.category}
                                                    onChange={(e) => updateTask(task.id, 'category', e.target.value)}
                                                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                                                >
                                                    {Object.values(TaskCategory).map(c => <option key={c} value={c}>{c}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">優先級</label>
                                                <select
                                                    value={task.priority}
                                                    onChange={(e) => updateTask(task.id, 'priority', e.target.value)}
                                                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                                                >
                                                    {Object.values(TaskPriority).map(p => <option key={p} value={p}>{p}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">時數</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="168"
                                                    step="0.5"
                                                    value={task.hours === 0 ? '' : task.hours}
                                                    onChange={(e) => {
                                                        let val = parseFloat(e.target.value);
                                                        if (isNaN(val) || e.target.value === '') val = 0;
                                                        if (val < 0) val = 0;
                                                        if (val > 168) val = 168;
                                                        updateTask(task.id, 'hours', val);
                                                    }}
                                                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                                    placeholder="0.0"
                                                />
                                            </div>
                                        </div>

                                        <div className="flex-1 space-y-4">
                                            <div>
                                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">任務名稱</label>
                                                <input
                                                    type="text"
                                                    value={task.name}
                                                    onChange={(e) => updateTask(task.id, 'name', e.target.value)}
                                                    maxLength={50}
                                                    placeholder="請輸入任務名稱"
                                                    className="w-full border border-gray-200 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 font-medium placeholder-gray-300 transition-colors hover:border-blue-300"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">預期成果</label>
                                                <textarea
                                                    value={task.outcome}
                                                    onChange={(e) => updateTask(task.id, 'outcome', e.target.value)}
                                                    maxLength={100}
                                                    placeholder="具體、可衡量的成果描述..."
                                                    rows={2}
                                                    className="w-full border border-gray-200 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-gray-600 text-sm resize-none placeholder-gray-300 transition-colors hover:border-blue-300"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {tasks.length > 1 && (
                                    <button onClick={() => removeTask(task.id)} className="absolute top-2 right-2 p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors">
                                        <X size={18} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="mt-8">
                        {validationError && (
                            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4 flex items-center gap-2 animate-bounce">
                                <AlertCircle size={20} className="flex-shrink-0" />
                                <span className="font-bold">{validationError}</span>
                            </div>
                        )}
                        <div className="flex flex-col md:flex-row gap-4">
                            <button onClick={addTask} disabled={isSaving} className="flex-1 py-3 border-2 border-dashed border-blue-200 text-blue-500 rounded-xl font-bold hover:bg-blue-50 hover:border-blue-300 transition flex items-center justify-center">
                                <Plus size={20} className="mr-2" /> 新增任務
                            </button>
                            <button onClick={handlePreSubmit} disabled={isSaving} className="flex-[2] py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg hover:shadow-xl transition transform active:scale-95 flex items-center justify-center disabled:opacity-70">
                                {isSaving ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> 處理中...</> : initialData ? '保存並提交' : '提交週計畫'}
                            </button>
                        </div>
                    </div>

                    {/* Validation Modal */}
                    {showRemarkModal && (
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
                            <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border border-gray-100">
                                <div className="flex flex-col items-center text-center mb-6">
                                    <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mb-4">
                                        <AlertTriangle className="w-8 h-8 text-red-500" />
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-800">計畫未達標準</h3>
                                    <div className="mt-3 space-y-2">
                                        {!isTotalValid && (
                                            <div className="text-sm text-red-600 bg-red-50 px-3 py-1.5 rounded-lg border border-red-100">
                                                總時數需介於 30-36 小時
                                            </div>
                                        )}
                                        {!isRatioValid && (
                                            <div className="text-sm text-red-600 bg-red-50 px-3 py-1.5 rounded-lg border border-red-100">
                                                關鍵職責佔比需 ≥ 50%
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="mb-6">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">請說明原因與備註</label>
                                    <textarea
                                        value={remark}
                                        onChange={(e) => setRemark(e.target.value)}
                                        placeholder="例如：本週國定假日、病假、教育訓練..."
                                        rows={4}
                                        className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none text-gray-800"
                                        autoFocus
                                    />
                                </div>
                                <div className="flex gap-3">
                                    <button onClick={() => setShowRemarkModal(false)} className="flex-1 py-2.5 border border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition">
                                        返回修改
                                    </button>
                                    <button onClick={handleFinalSubmit} disabled={!remark.trim() || isSaving} className="flex-1 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition shadow-md">
                                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : '確認提交'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};