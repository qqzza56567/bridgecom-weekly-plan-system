import React, { useState, useMemo, useEffect } from 'react';
import { User, WeeklyTask, TaskCategory, TaskPriority, WeeklyPlanSubmission } from '../types';
import { Plus, X, AlertCircle, CheckCircle, AlertTriangle, Loader2, Sparkles } from 'lucide-react';
import { COMPANY_NAME } from '../constants';
import { getPlanningWeekStart, getPreviousWeekStart, getWeekRangeString, toLocalISOString, daysBetweenLocal } from '../utils/dateUtils';
import { Header } from './Header';
import { generateId } from '../utils/uuid';
import { useToast } from '../components/Toast';
import { validateWeeklyTask, validatePlanContent, WeeklyTaskValidationResult, PlanValidationResult } from '../services/geminiService';

interface WeeklyPlanProps {
    user: User;
    initialData?: WeeklyPlanSubmission; // If provided, we are in Edit mode
    targetWeekStart?: string; // If provided, we are creating a plan for this specific week
    allPlans?: WeeklyPlanSubmission[]; // For finding duplicates
    onSubmit: (plan: WeeklyPlanSubmission) => void;
    onBack: () => void;
}

export const WeeklyPlan: React.FC<WeeklyPlanProps> = ({ user, initialData, targetWeekStart, allPlans = [], onSubmit, onBack }) => {
    const toast = useToast();
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

    // AI Validation State
    const [validatingTaskId, setValidatingTaskId] = useState<string | null>(null);
    const [validationResults, setValidationResults] = useState<Record<string, WeeklyTaskValidationResult>>({});

    // Batch Validation State
    // const [showValidationModal, setShowValidationModal] = useState(false); // Removed for inline style
    const [isValidating, setIsValidating] = useState(false);
    const [batchValidationResults, setBatchValidationResults] = useState<PlanValidationResult | null>(null);

    const handleBatchValidate = async () => {
        setIsValidating(true);
        try {
            const results = await validatePlanContent(tasks.map(t => ({ id: t.id, name: t.name, outcome: t.outcome })));
            setBatchValidationResults(results);

            if (results.isValid) {
                // Keep the results visible so user can see yellow warnings
                const hasWarnings = Object.values(results.results).some(r => r.status === 'warning');

                if (hasWarnings) {
                    toast.success("驗證通過，但有部分優化建議 (黃燈)");
                } else {
                    toast.success("驗證通過 (綠燈)，計畫內容完整！");
                }

                // Determine next step: standard validation or direct submit
                if (!isTotalValid || !isRatioValid) {
                    setShowRemarkModal(true);
                } else {
                    handleFinalSubmit();
                }
            } else {
                toast.error("部分內容未達標 (紅燈)，請修正後提交");

                // Scroll to top or first invalid item to ensure user sees errors
                const firstInvalidId = tasks.find(t => results.results[t.id] && results.results[t.id].status === 'critical')?.id;
                if (firstInvalidId) {
                    const element = document.getElementById(`task-row-${firstInvalidId}`);
                    if (element) {
                        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }
            }
        } catch (error) {
            console.error("Batch validation error", error);
            toast.error("AI 驗證服務連線失敗，請稍後再試");
        } finally {
            setIsValidating(false);
        }
    };

    const applyAiSuggestion = (taskId: string, field: 'name' | 'outcome', suggestion: string) => {
        // Simple regex to extract the suggestion from text like "建議改為'XXX'" if possible, 
        // or just use the full text if it's short. 
        // For now, let's just assume the user will copy/paste or we just replace.
        // Actually, let's try to be smart: remove "建議改為" prefix if present.
        let cleanSuggestion = suggestion.replace(/建議改為['"「](.*?)['"」]/, '$1');
        // If regex didn't match (plain text), uses original.
        if (cleanSuggestion === suggestion) {
            cleanSuggestion = suggestion.replace(/建議改為[:：]?\s*/, '');
        }

        updateTask(taskId, field, cleanSuggestion);

        // Update local validation state to "valid" for this field to give immediate feedback
        if (batchValidationResults) {
            setBatchValidationResults(prev => {
                if (!prev) return null;
                const newResults = { ...prev.results };
                if (newResults[taskId]) {
                    newResults[taskId] = {
                        ...newResults[taskId],
                        [field === 'name' ? 'nameFeedback' : 'outcomeFeedback']: undefined
                    };
                    // Check if task is now fully valid
                    if (!newResults[taskId].nameFeedback && !newResults[taskId].outcomeFeedback) {
                        newResults[taskId].isValid = true;
                    }
                }
                return { ...prev, results: newResults };
            });
        }
    };

    // --- Date Logic (Wednesday Based) ---
    const { weekStart, weekRange } = useMemo(() => {
        if (initialData) {
            return { weekStart: initialData.weekStart, weekRange: initialData.weekRange };
        }
        // If targetWeekStart is passed (from dropdown creation), use it.
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

        // Check for empty names first
        if (tasks.some(t => !t.name.trim())) {
            setValidationError("請確保所有本週任務都有填寫名稱");
            return;
        }

        // Trigger AI Batch Validation
        handleBatchValidate();
    };

    const handleFinalSubmit = async () => {
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
    // --- Constants for Slider Colors ---

    return (
        <div className="min-h-screen bg-[#eef5ff] p-4 md:p-4 font-sans">
            <div className="max-w-6xl mx-auto space-y-6">
                <Header title={getPageTitle()} subtitle={`計畫區間：${weekRange}`} onBack={onBack} />




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
                        {tasks.map((task, index) => {
                            const validationResult = batchValidationResults?.results[task.id];
                            const isCritical = validationResult?.status === 'critical';
                            const isWarning = validationResult?.status === 'warning';

                            let borderClass = 'border-gray-100';
                            if (isCritical) borderClass = 'border-red-300 ring-2 ring-red-100';
                            else if (isWarning) borderClass = 'border-orange-300 ring-2 ring-orange-100';

                            return (
                                <div key={task.id} id={`task-row-${task.id}`} className={`relative bg-white border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow group ${borderClass}`}>
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
                                                        className={`w-full border border-gray-200 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 font-medium placeholder-gray-300 transition-colors hover:border-blue-300 ${isCritical && validationResult?.nameFeedback ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}
                                                    />
                                                    {validationResult?.nameFeedback && (
                                                        <div className={`mt-2 text-sm p-3 rounded-lg border animate-fadeIn ${isCritical ? 'text-red-600 bg-red-50 border-red-100' : 'text-orange-700 bg-orange-50 border-orange-100'}`}>
                                                            <div className="font-bold flex items-center mb-1">
                                                                <AlertCircle className="w-4 h-4 mr-1.5" />
                                                                {isCritical ? '請修正以下問題：' : '優化建議：'}
                                                            </div>
                                                            <p className="mb-2">{validationResult.nameFeedback}</p>
                                                            <button
                                                                onClick={() => applyAiSuggestion(task.id, 'name', validationResult.nameFeedback!)}
                                                                className={`text-xs font-bold px-3 py-1.5 rounded-md transition-colors ${isCritical ? 'bg-red-100 hover:bg-red-200 text-red-700' : 'bg-orange-100 hover:bg-orange-200 text-orange-800'}`}
                                                            >
                                                                套用建議
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">預期成果</label>
                                                    <textarea
                                                        value={task.outcome}
                                                        onChange={(e) => updateTask(task.id, 'outcome', e.target.value)}
                                                        maxLength={100}
                                                        placeholder="具體、可衡量的成果描述..."
                                                        rows={2}
                                                        className={`w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-gray-600 text-sm resize-none placeholder-gray-300 transition-colors hover:border-blue-300 ${isCritical && validationResult?.outcomeFeedback ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}
                                                    />
                                                    {validationResult?.outcomeFeedback && (
                                                        <div className={`mt-2 text-sm p-3 rounded-lg border animate-fadeIn ${isCritical ? 'text-red-600 bg-red-50 border-red-100' : 'text-orange-700 bg-orange-50 border-orange-100'}`}>
                                                            <div className="font-bold flex items-center mb-1">
                                                                <AlertCircle className="w-4 h-4 mr-1.5" />
                                                                {isCritical ? '請修正以下問題：' : '優化建議：'}
                                                            </div>
                                                            <p className="mb-2">{validationResult.outcomeFeedback}</p>
                                                            <button
                                                                onClick={() => applyAiSuggestion(task.id, 'outcome', validationResult.outcomeFeedback!)}
                                                                className={`text-xs font-bold px-3 py-1.5 rounded-md transition-colors ${isCritical ? 'bg-red-100 hover:bg-red-200 text-red-700' : 'bg-orange-100 hover:bg-orange-200 text-orange-800'}`}
                                                            >
                                                                套用建議
                                                            </button>
                                                        </div>
                                                    )}
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
                            );
                        })}
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
                            <button onClick={handlePreSubmit} disabled={isSaving || isValidating} className="flex-[2] py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg hover:shadow-xl transition transform active:scale-95 flex items-center justify-center disabled:opacity-70">
                                {isSaving || isValidating ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> {isValidating ? 'AI 檢查中...' : '處理中...'}</> : initialData ? '保存並提交' : '提交週計畫'}
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

                    {/* AI Batch Validation Modal - REMOVED for Inline Style */}
                </div>
            </div>
        </div>
    );
};