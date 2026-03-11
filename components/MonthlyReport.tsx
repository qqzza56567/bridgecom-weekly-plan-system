import React, { useState } from 'react';
import { User, MonthlyReportData } from '../types';
import { PlanService } from '../services/PlanService';
import { generateMonthlyExecutiveReport } from '../services/geminiService';
import { BarChart, Clock, Award, AlertTriangle, TrendingUp, Sparkles, Loader2, Calendar, User as UserIcon, RefreshCw } from 'lucide-react';

interface MonthlyReportProps {
    users: User[];
}

export const MonthlyReport: React.FC<MonthlyReportProps> = ({ users }) => {
    const [selectedUserId, setSelectedUserId] = useState<string>('');

    // Default to current month YYYY-MM
    const [selectedMonth, setSelectedMonth] = useState<string>(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });

    const [isGenerating, setIsGenerating] = useState<boolean>(false);
    const [report, setReport] = useState<MonthlyReportData | null>(null);
    const [isLoadedFromDb, setIsLoadedFromDb] = useState<boolean>(false);
    const [errorMsg, setErrorMsg] = useState<string>('');

    const handleGenerate = async (forceGenerate: boolean = false) => {
        if (!selectedUserId || !selectedMonth) return;

        setIsGenerating(true);
        setErrorMsg('');
        setReport(null);

        try {
            const user = users.find(u => u.id === selectedUserId);
            if (!user) throw new Error("找不到使用者");

            // Check DB first if not forcing generation
            if (!forceGenerate) {
                const existingReport = await PlanService.getMonthlyReport(selectedUserId, selectedMonth);
                if (existingReport) {
                    setReport(existingReport);
                    setIsLoadedFromDb(true);
                    return;
                }
            }

            // Fetch plans for this user and month
            const plans = await PlanService.fetchMonthlyPlans(selectedUserId, selectedMonth);

            if (plans.length === 0) {
                setErrorMsg('該名員工在此月份沒有任何計畫紀錄。');
                setIsGenerating(false);
                return;
            }

            const role = user.isAdmin ? '高階主管' : (user.isManager ? '部門主管' : '一般員工');
            const aiReport = await generateMonthlyExecutiveReport(user.name, role, selectedMonth, plans);

            if (!aiReport) {
                throw new Error("AI 報告生成失敗，可能由於網路問題");
            }

            setReport(aiReport);
            setIsLoadedFromDb(false);

            // Save the newly generated report to DB
            await PlanService.saveMonthlyReport(selectedUserId, selectedMonth, aiReport);

        } catch (e: any) {
            console.error(e);
            setErrorMsg(e.message || '發生未知錯誤');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* 搜尋列 */}
            <div className="bg-white rounded-xl shadow-md p-6 border-t-4 border-indigo-600">
                <div className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1">
                        <label className="block text-xs font-bold text-gray-500 mb-2 flex items-center">
                            <Calendar className="w-4 h-4 mr-1" /> 選擇分析月份
                        </label>
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                    </div>
                    <div className="flex-1">
                        <label className="block text-xs font-bold text-gray-500 mb-2 flex items-center">
                            <UserIcon className="w-4 h-4 mr-1" /> 選擇目標員工
                        </label>
                        <select
                            value={selectedUserId}
                            onChange={(e) => setSelectedUserId(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                        >
                            <option value="">-- 請選擇員工 --</option>
                            {users.map(u => (
                                <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex-none flex items-center md:items-end gap-2">
                        <button
                            onClick={() => handleGenerate(false)}
                            disabled={isGenerating || !selectedUserId || !selectedMonth}
                            className="flex-1 md:flex-none md:w-auto bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition font-bold disabled:opacity-50 flex items-center justify-center h-[42px]"
                        >
                            {isGenerating ? (
                                <><Loader2 className="w-5 h-5 animate-spin mr-2" /> 深入分析中...</>
                            ) : (
                                <><Sparkles className="w-5 h-5 mr-2" /> 生成 AI 洞察</>
                            )}
                        </button>
                    </div>
                </div>
                {errorMsg && (
                    <div className="mt-4 p-3 bg-red-50 text-red-600 rounded text-sm font-bold border border-red-100 flex items-center">
                        <AlertTriangle className="w-4 h-4 mr-2" /> {errorMsg}
                    </div>
                )}
            </div>

            {/* 報告呈現 */}
            {report && (
                <div className="bg-white rounded-xl shadow-xl overflow-hidden animate-fadeIn">
                    {/* 頁首 */}
                    <div className="bg-gradient-to-r from-indigo-900 to-slate-800 p-8 text-white">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div>
                                <span className="bg-indigo-500/30 text-indigo-200 px-3 py-1 rounded-full text-xs font-bold tracking-wider mb-4 inline-block uppercase border border-indigo-400/30">
                                    {isLoadedFromDb ? '歷史快取報告 (Cached)' : '最新即時洞察 (Live)'}
                                </span>
                                <h2 className="text-3xl font-black mb-2">{users.find(u => u.id === selectedUserId)?.name} · 執行力洞察</h2>
                                <div className="text-indigo-200">{selectedMonth} 區間 AI 總結分析</div>
                            </div>
                            <div className="flex items-center gap-4">
                                {isLoadedFromDb && (
                                    <button
                                        onClick={() => handleGenerate(true)}
                                        disabled={isGenerating}
                                        className="text-sm font-bold text-indigo-200 border border-indigo-500 hover:bg-indigo-800 hover:text-white px-4 py-2 rounded transition flex items-center disabled:opacity-50"
                                    >
                                        <RefreshCw size={14} className={`mr-2 ${isGenerating ? 'animate-spin' : ''}`} /> 重新分析本月
                                    </button>
                                )}
                                <Sparkles className="w-12 h-12 text-indigo-400 opacity-50 hidden md:block" />
                            </div>
                        </div>
                    </div>

                    <div className="p-8 space-y-8">
                        {/* 核心兩大指標 Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* 戰略對齊度 */}
                            <div className="bg-slate-50 rounded-xl p-6 border border-slate-200 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-5"><TrendingUp className="w-24 h-24" /></div>
                                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
                                    <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mr-3"><TrendingUp size={16} /></span>
                                    戰略專注與對齊度
                                </h3>

                                {/* Data Quality Warning */}
                                {(report.dataQuality !== undefined && report.dataQuality < 100) && (
                                    <div className={`mb-4 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 border ${
                                        report.dataQuality === 0
                                            ? 'bg-gray-100 border-gray-200 text-gray-500'
                                            : 'bg-yellow-50 border-yellow-200 text-yellow-700'
                                    }`}>
                                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                                        {report.dataQuality === 0
                                            ? '本月所有週次均缺乏每日計畫比對數據，插單率無法計算。請先由主管為各週生成 AI 執行報告。'
                                            : `數據警告：僅 ${report.dataQuality}% 的週次有完整每日執行分析，插單率數據可能低估。`
                                        }
                                    </div>
                                )}

                                {/* Strategic Focus Stats — hide if no data at all */}
                                {(report.dataQuality === undefined || report.dataQuality > 0) ? (
                                    <>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm text-slate-500 font-medium">月度平均插單率</span>
                                            <span className={`text-2xl font-black ${report.strategicFocus.averageUnplannedRatio > 50 ? 'text-red-600' : (report.strategicFocus.averageUnplannedRatio > 20 ? 'text-yellow-600' : 'text-green-600')}`}>
                                                {report.strategicFocus.averageUnplannedRatio}%
                                            </span>
                                        </div>
                                        <div className="w-full bg-slate-200 rounded-full h-2 mb-6">
                                            <div className={`h-2 rounded-full ${report.strategicFocus.averageUnplannedRatio > 50 ? 'bg-red-500' : (report.strategicFocus.averageUnplannedRatio > 20 ? 'bg-yellow-500' : 'bg-green-500')}`} style={{ width: `${Math.min(100, report.strategicFocus.averageUnplannedRatio)}%` }}></div>
                                        </div>

                                        <div className="flex gap-4">
                                            <div className="flex-1 p-3 bg-white rounded-lg border border-slate-100 shadow-sm">
                                                <div className="text-xs text-slate-400 mb-1">對齊原定計畫</div>
                                                <div className="font-bold text-slate-700">{report.strategicFocus.alignedTasks} 項</div>
                                            </div>
                                            <div className="flex-1 p-3 bg-white rounded-lg border border-slate-100 shadow-sm">
                                                <div className="text-xs text-slate-400 mb-1">臨時插單任務</div>
                                                <div className="font-bold text-slate-700">{report.strategicFocus.unplannedTasks} 項</div>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="py-6 text-center text-gray-400 text-sm">
                                        — 無插單率數據 —
                                    </div>
                                )}
                            </div>


                            {/* 執行可靠度 */}
                            <div className="bg-slate-50 rounded-xl p-6 border border-slate-200 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-5"><BarChart className="w-24 h-24" /></div>
                                <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center">
                                    <span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mr-3"><BarChart size={16} /></span>
                                    產出與預估可靠度
                                </h3>

                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm text-slate-500 font-medium">任務高達成率 (進度≥80%)</span>
                                    <span className="text-2xl font-black text-slate-800">{report.executionReliability.completionRate}%</span>
                                </div>
                                <div className="w-full bg-slate-200 rounded-full h-2 mb-6">
                                    <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${report.executionReliability.completionRate}%` }}></div>
                                </div>

                                <div className="p-4 bg-white rounded-lg border border-slate-100 shadow-sm flex items-start">
                                    <Clock className="w-5 h-5 text-indigo-400 mr-3 mt-0.5" />
                                    <div>
                                        <div className="text-xs text-slate-400 font-medium mb-1">整體工時預估偏差</div>
                                        <div className="font-bold text-slate-700">
                                            {report.executionReliability.estimationDeviation > 0 ? (
                                                <span className="text-yellow-600">普遍高估工時 (約 +{report.executionReliability.estimationDeviation}%)</span>
                                            ) : report.executionReliability.estimationDeviation < 0 ? (
                                                <span className="text-red-500">普遍低估工時 (約 {report.executionReliability.estimationDeviation}%)</span>
                                            ) : (
                                                <span className="text-green-600">預估時間相當精準 (0%)</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* AI 深度文字分析 Grid */}
                        <div className="space-y-6">
                            {/* 高光成就 */}
                            <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-6">
                                <h3 className="font-bold text-emerald-800 mb-4 flex items-center text-lg">
                                    <Award className="w-5 h-5 mr-2 text-emerald-500" /> 本月高光成就 (Top Achievements)
                                </h3>
                                <ul className="space-y-3">
                                    {report.topAchievements.map((achw, idx) => (
                                        <li key={idx} className="flex items-start">
                                            <span className="bg-emerald-200 text-emerald-700 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mr-3 flex-shrink-0 mt-0.5">{idx + 1}</span>
                                            <span className="text-emerald-900 font-medium leading-relaxed">{achw}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* 系統摩擦與風險 */}
                                <div className="bg-rose-50/50 border border-rose-100 rounded-xl p-6">
                                    <h3 className="font-bold text-rose-800 mb-4 flex items-center text-lg">
                                        <AlertTriangle className="w-5 h-5 mr-2 text-rose-500" /> 系統摩擦與風險 (Options & Risks)
                                    </h3>
                                    <p className="text-rose-900 leading-relaxed font-medium">
                                        {report.systemicObstacles || "本月任務執行順暢，無明顯之系統性阻力或過度疲勞警訊。"}
                                    </p>
                                </div>

                                {/* 行動建議 */}
                                <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-6">
                                    <h3 className="font-bold text-indigo-900 mb-4 flex items-center text-lg">
                                        <Sparkles className="w-5 h-5 mr-2 text-indigo-500" /> 高層行動建議 (Management Action)
                                    </h3>
                                    <div className="p-4 bg-white/60 rounded-lg shadow-sm border border-indigo-100">
                                        <p className="text-indigo-900 font-bold leading-relaxed text-lg">
                                            "{report.managementAction}"
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div >
            )}
        </div >
    );
};
