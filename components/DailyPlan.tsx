import React, { useState, useEffect, useMemo } from 'react';
import { User, DailyPlanSubmission } from '../types';
import { COMPANY_NAME } from '../constants';
import { validateSmartGoals } from '../services/geminiService';
import { AlertCircle, CheckCircle, Loader2, Info, ChevronLeft, ChevronRight, RotateCcw, Save } from 'lucide-react';
import { useToast } from '../components/Toast';
import { Header } from './Header';
import { generateId } from '../utils/uuid';
import { DailyPlanService } from '../services/DailyPlanService';
import { toLocalISOString, addDays, parseLocalString } from '../utils/dateUtils';
import { isHolidayOrWeekend } from '../utils/holidayUtils';

interface DailyPlanProps {
    user: User;
    onSubmit: (plan: DailyPlanSubmission) => void;
    onBack: () => void;
}

export const DailyPlan: React.FC<DailyPlanProps> = ({ user, onSubmit, onBack }) => {
    const toast = useToast();
    // Current date for the app session
    const todayStr = useMemo(() => toLocalISOString(new Date()), []);

    // The date currently being viewed/edited
    const [selectedDate, setSelectedDate] = useState(todayStr);

    const [goals, setGoals] = useState<string[]>(['', '', '']);
    const [status, setStatus] = useState<'Valid' | 'Invalid'>('Valid');
    const [existingPlan, setExistingPlan] = useState<DailyPlanSubmission | null>(null);
    const [isWithdrawn, setIsWithdrawn] = useState(false);
    const [incompleteReason, setIncompleteReason] = useState<string>('');
    const [showIncompleteReasonField, setShowIncompleteReasonField] = useState(false);

    const [isValidating, setIsValidating] = useState(false);
    const [validationResults, setValidationResults] = useState<{ index: number, isValid: boolean, feedback: string }[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [allPlans, setAllPlans] = useState<DailyPlanSubmission[]>([]);

    // Fetch all plans once to mark the date strip
    const fetchAllPlans = async () => {
        try {
            const plans = await DailyPlanService.fetchAllDailyPlans();
            setAllPlans(plans.filter(p => p.userId === user.id));
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        fetchAllPlans();
    }, [user.id]);

    // Fetch existing plan when selectedDate changes
    useEffect(() => {
        let isMounted = true;
        const loadExisting = async () => {
            // CRITICAL: Reset goals immediately when date changes (but avoid full reset if we are just re-verifying same date due to external prop change which shouldn't happen often)

            // Only show loader if we don't have a plan for this date yet (or if we really want to refresh)
            // But since we are mounting, let's just show loader.
            setIsLoading(true);

            // Reset local state for the new date
            setExistingPlan(null);
            setGoals(['', '', '']);
            setIsWithdrawn(false);
            setValidationResults(null);
            setIncompleteReason('');
            setShowIncompleteReasonField(false);

            try {
                const plan = await DailyPlanService.fetchDailyPlanByDate(user.id, selectedDate);
                if (!isMounted) return;

                if (plan) {
                    setExistingPlan(plan);
                    setGoals(plan.goals);
                    setStatus(plan.status);
                    setIncompleteReason(plan.incompleteReason || '');
                }
            } catch (error) {
                console.error("Failed to load daily plan:", error);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        loadExisting();

        return () => {
            isMounted = false;
        };
    }, [selectedDate, user.id]); // Keep these deps. If parent re-renders and these don't change, effect won't run.

    const handleGoalChange = (index: number, value: string) => {
        const newGoals = [...goals];
        newGoals[index] = value;
        setGoals(newGoals);

        // Removed setValidationResults(null) to keep feedback visible while editing

        // Auto-hide incomplete reason if now we have 3 filled
        const filledCount = newGoals.filter(g => g.trim()).length;
        if (filledCount >= 3) {
            setShowIncompleteReasonField(false);
        }
    };

    const isPast = useMemo(() => selectedDate < todayStr, [selectedDate, todayStr]);

    const handleSubmit = async () => {
        const filledGoals = goals.filter(g => g.trim());
        const hasIncompleteGoals = filledGoals.length < 3;

        // Check if incomplete and no reason provided
        // Check if incomplete and no reason provided
        if (hasIncompleteGoals && !incompleteReason.trim()) {
            setShowIncompleteReasonField(true);
            toast.error("未填滿三件事項時，請填寫原因說明");
            return;
        }

        // Only validate filled goals
        if (filledGoals.length === 0) {
            toast.error("請至少填寫一件事項");
            return;
        }

        setIsValidating(true);
        const results = await validateSmartGoals(filledGoals);
        const allValid = results.every(r => r.isValid);

        // Map results back to original indices
        const fullResults = goals.map((goal, index) => {
            if (!goal.trim()) {
                return { index, isValid: true, feedback: "未填寫" };
            }
            const filledIndex = goals.slice(0, index).filter(g => g.trim()).length;
            return { ...results[filledIndex], index };
        });

        setValidationResults(fullResults);
        setIsValidating(false);

        if (!allValid) {
            toast.error("部分內容不符合 SMART 原則，請根據紅字提示修正後再提交。");
            return;
        }

        const submission: DailyPlanSubmission = {
            id: existingPlan ? existingPlan.id : generateId(),
            userId: user.id,
            userName: user.name,
            date: selectedDate,
            goals: goals,
            status: 'Valid',
            incompleteReason: hasIncompleteGoals ? incompleteReason : undefined
        };

        try {
            await DailyPlanService.saveDailyPlan(submission);
            // Update local state IMMEDIATELY for snappy UI response
            // Update local state IMMEDIATELY for snappy UI response
            setExistingPlan(submission);
            setIsWithdrawn(false);
            setShowIncompleteReasonField(false);

            // Notify parent
            onSubmit(submission);

            // Refresh date strip
            // Refresh date strip
            fetchAllPlans();

            toast.success("曉三計畫已成功提交");

        } catch (e: any) {
            toast.error("儲存失敗: " + e.message);
        }
    };



    const handleWithdraw = () => {
        setIsWithdrawn(true);
    };

    const holidayInfo = useMemo(() => isHolidayOrWeekend(selectedDate), [selectedDate]);

    const dateStrip = useMemo(() => {
        const items = [];
        for (let i = -7; i <= 7; i++) {
            const dStr = addDays(todayStr, i);
            const d = parseLocalString(dStr);
            const info = isHolidayOrWeekend(dStr);
            const hasPlan = allPlans.some(p => p.date === dStr);

            items.push({
                dateStr: dStr,
                dayNum: d.getDate(),
                weekday: ['日', '一', '二', '三', '四', '五', '六'][d.getDay()],
                isToday: dStr === todayStr,
                isHoliday: info.isRestDay,
                holidayLabel: info.label,
                isSelectable: dStr <= addDays(todayStr, 7),
                hasPlan: hasPlan
            });
        }
        return items;
    }, [todayStr, allPlans]);

    return (
        <div className="min-h-screen bg-[#eef5ff] p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
                <Header title="曉三計畫" subtitle={`${user.name} - 今日最重要的三件事`} onBack={onBack} />

                {/* Modern Date Strip UI */}
                <div className="bg-white rounded-2xl shadow-sm border border-blue-100 p-6 mb-8 mt-4">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-black text-gray-800 tracking-tight">
                                {selectedDate === todayStr ? '今天' : selectedDate}
                            </h2>
                            {holidayInfo.isRestDay && (
                                <span className="bg-orange-100 text-orange-600 px-3 py-1 rounded-full text-xs font-bold">
                                    {holidayInfo.label}
                                </span>
                            )}
                        </div>
                        {selectedDate !== todayStr && (
                            <button
                                onClick={() => setSelectedDate(todayStr)}
                                className="text-blue-600 text-sm font-bold hover:underline flex items-center gap-1"
                            >
                                <RotateCcw size={14} /> 回到今天
                            </button>
                        )}
                    </div>

                    <div className="flex justify-between gap-2 overflow-x-auto pb-2 scrollbar-hide no-scrollbar">
                        {dateStrip.map((item) => {
                            const isSelected = item.dateStr === selectedDate;
                            return (
                                <button
                                    key={item.dateStr}
                                    disabled={!item.isSelectable}
                                    onClick={() => setSelectedDate(item.dateStr)}
                                    className={`flex flex-col items-center min-w-[50px] py-3 rounded-2xl transition-all duration-200 
                                        ${isSelected
                                            ? 'bg-blue-600 text-white shadow-lg scale-110 -translate-y-1'
                                            : 'hover:bg-blue-50 text-gray-500'
                                        }
                                        ${!item.isSelectable ? 'opacity-20 cursor-not-allowed' : ''}
                                    `}
                                >
                                    <span className={`text-[10px] uppercase font-bold mb-1 ${item.isHoliday && !isSelected ? 'text-red-400' : ''}`}>
                                        週{item.weekday}
                                    </span>
                                    <span className="text-lg font-black leading-none">
                                        {item.dayNum}
                                    </span>
                                    <div className="h-1.5 mt-1">
                                        {item.hasPlan && (
                                            <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-blue-600'}`}></div>
                                        )}
                                        {item.isToday && !isSelected && !item.hasPlan && (
                                            <div className="w-1 h-1 bg-blue-200 rounded-full"></div>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="bg-white rounded-3xl shadow-2xl p-8 relative overflow-hidden border border-white min-h-[400px]">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <Loader2 className="w-10 h-10 text-blue-200 animate-spin mb-4" />
                            <p className="text-gray-400 text-sm">載入計畫中...</p>
                        </div>
                    ) : (
                        <>
                            {/* Status Badge */}
                            {existingPlan && !isWithdrawn && (
                                <div className="absolute top-0 right-0 p-6">
                                    <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1">
                                        <CheckCircle size={14} /> 符合 SMART
                                    </span>
                                </div>
                            )}

                            <div className="flex items-start gap-4 mb-6">
                                <div className="flex items-center">
                                    <img src="/logo.png" alt={COMPANY_NAME} className="h-8 object-contain" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-gray-500 text-sm">請專注於今日最有價值的工作項目</p>
                                    {isPast && <p className="text-blue-600 text-xs font-bold mt-1">歷史紀錄僅供檢視，不可修改。</p>}
                                </div>
                            </div>



                            {/* Determine whether to show edit mode or view mode */}
                            {!isPast && (!existingPlan || isWithdrawn) ? (
                                <>
                                    {/* Instruction Box */}
                                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-5 mb-8 shadow-sm flex items-start gap-4">
                                        <Info className="w-6 h-6 text-blue-500 mt-0.5 flex-shrink-0" />
                                        <div className="text-sm leading-relaxed text-blue-900">
                                            <p className="font-bold mb-2 text-base">SMART 原則填寫指南：</p>
                                            <ul className="list-disc list-inside space-y-1 text-blue-800">
                                                <li><span className="font-bold">S (具體)</span>: 明確說明你要做什麼。</li>
                                                <li><span className="font-bold">M (可衡量)</span>: 有數字或可驗證的結果。</li>
                                                <li><span className="font-bold">A (可達成)</span>: 在當日時間內可以完成。</li>
                                                <li><span className="font-bold">R (相關)</span>: 與你的職責或週計畫相關。</li>
                                                <li><span className="font-bold">T (時限)</span>: 在當日前完成。</li>
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Error Alert Box */}
                                    {validationResults && validationResults.some(r => !r.isValid) && (
                                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8 flex items-start gap-3 animate-shake">
                                            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                            <div>
                                                <p className="text-red-800 font-bold text-sm">提交失敗：內容未達 SMART 標準</p>
                                                <p className="text-red-600 text-xs mt-1">請查看下方各項目的紅字建議並進行修正。</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Inputs */}
                                    <div className="space-y-8">
                                        {[0, 1, 2].map((index) => {
                                            const validation = validationResults?.find(r => r.index === index);
                                            const isInvalid = validation && !validation.isValid;

                                            return (
                                                <div key={index}>
                                                    <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
                                                        <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">
                                                            {index + 1}
                                                        </span>
                                                        {index === 0 ? '第一件事' : index === 1 ? '第二件事' : '第三件事'}
                                                    </h3>
                                                    <textarea
                                                        value={goals[index]}
                                                        onChange={(e) => handleGoalChange(index, e.target.value)}
                                                        maxLength={100}
                                                        placeholder={`例如：${index === 0 ? '完成產品需求文檔初稿...' : '與團隊進行專案進度同步...'}`}
                                                        rows={3}
                                                        className={`w-full border rounded-xl p-4 text-gray-900 bg-white focus:outline-none focus:ring-2 transition-all resize-none shadow-sm
                                                        ${isInvalid
                                                                ? 'border-red-300 focus:ring-red-100 bg-red-50/50'
                                                                : 'border-gray-200 focus:ring-blue-50 focus:border-blue-300 hover:border-blue-200'
                                                            }`}
                                                    />

                                                    {validation && (
                                                        <div className={`mt-2 p-2 rounded-lg text-sm flex items-start gap-2 animate-fadeIn ${validation.isValid ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                                            {validation.isValid ? <CheckCircle className="w-4 h-4 mt-0.5" /> : <AlertCircle className="w-4 h-4 mt-0.5" />}
                                                            <span className="font-medium">{validation.isValid ? "符合 SMART 原則" : validation.feedback}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Incomplete Reason Field */}
                                    {showIncompleteReasonField && (
                                        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                            <label className="block text-sm font-bold text-yellow-900 mb-2">
                                                ⚠️ 未填滿三件事項的原因說明 <span className="text-red-600">*</span>
                                            </label>
                                            <textarea
                                                value={incompleteReason}
                                                onChange={(e) => setIncompleteReason(e.target.value)}
                                                maxLength={200}
                                                placeholder="例如：今日工作量較少、部分工作已提前完成..."
                                                rows={2}
                                                className="w-full border border-yellow-300 rounded-lg p-3 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all resize-none"
                                                autoFocus
                                            />
                                            <p className="text-xs text-yellow-700 mt-1">請說明為何今日無法填滿三件事項</p>
                                        </div>
                                    )}

                                    <div className="mt-8 flex gap-4">
                                        <button
                                            onClick={handleSubmit}
                                            disabled={isValidating || isPast}
                                            className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition shadow-md flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {isValidating ? (
                                                <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> AI 檢查中...</>
                                            ) : (
                                                <><Save size={20} className="mr-2" /> 提交曉三計畫</>
                                            )}
                                        </button>
                                        {existingPlan && isWithdrawn && (
                                            <button
                                                onClick={() => setIsWithdrawn(false)}
                                                className="px-6 py-3 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition"
                                            >
                                                取消修改
                                            </button>
                                        )}
                                    </div>
                                </>
                            ) : (
                                /* View Mode */
                                <div className="space-y-8 animate-fadeIn">
                                    {/* Notice for past dates with no plan */}
                                    {isPast && goals.every(g => !g.trim()) ? (
                                        <div className="p-12 bg-gray-100 border border-gray-300 rounded-lg text-center">
                                            <p className="text-gray-500 text-xl font-medium">📅 當日未填寫計畫</p>
                                        </div>
                                    ) : (
                                        <>
                                            {[0, 1, 2].map((index) => (
                                                <div key={index} className="bg-gray-50 rounded-xl p-6 border border-gray-100">
                                                    <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">
                                                        {index === 0 ? '第一件事' : index === 1 ? '第二件事' : '第三件事'}
                                                    </h3>
                                                    <p className="text-gray-800 text-lg leading-relaxed whitespace-pre-wrap">
                                                        {goals[index] || <span className="text-gray-400 italic">未填寫</span>}
                                                    </p>
                                                </div>
                                            ))}

                                            {/* Show incomplete reason if applicable */}
                                            {goals.filter(g => g.trim()).length < 3 && incompleteReason && (
                                                <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                                    <h3 className="text-yellow-900 text-sm font-bold mb-2">
                                                        ⚠️ 未填滿三件事項的原因
                                                    </h3>
                                                    <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">
                                                        {incompleteReason}
                                                    </p>
                                                </div>
                                            )}

                                            {!isPast && (
                                                <div className="mt-8 pt-6 border-t border-gray-100">
                                                    <button
                                                        onClick={handleWithdraw}
                                                        className="flex items-center text-blue-600 hover:text-blue-800 font-bold transition gap-2"
                                                    >
                                                        <RotateCcw size={18} />
                                                        <span>撤回計畫以重新修改</span>
                                                    </button>
                                                    <p className="text-gray-400 text-xs mt-2">您可以隨時撤回並更新今日或未來的計畫。</p>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};