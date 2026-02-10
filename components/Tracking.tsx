import React, { useState, useMemo } from 'react';
import { User, WeeklyPlanSubmission, DailyPlanSubmission } from '../types';
import { Header } from './Header';
import { PlanStats } from './PlanStats'; // Import the new stats component
import * as XLSX from 'xlsx';
import { FileSpreadsheet, BarChart3, List, CalendarCheck } from 'lucide-react';

interface TrackingProps {
    user: User;
    weeklyPlans: WeeklyPlanSubmission[];
    dailyPlans: DailyPlanSubmission[];
    onBack: () => void;
    // Optional props for Admin View (Switching Users)
    allUsers?: User[];
    onSwitchUser?: (user: User) => void;
    hideHeader?: boolean; // New prop to hide header
}

const TaskSummaryCell: React.FC<{ tasks: any[] }> = ({ tasks }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    // Stats
    const keyCount = tasks.filter(t => t.category === '關鍵職責').length;
    const avgProgress = Math.round(tasks.reduce((acc, t) => acc + (t.progress || 0), 0) / (tasks.length || 1));
    const completedCount = tasks.filter(t => (t.progress || 0) === 100).length;

    if (!isExpanded) {
        return (
            <div
                onClick={() => setIsExpanded(true)}
                className="cursor-pointer group hover:bg-blue-50 p-2 rounded-lg transition-colors border border-transparent hover:border-blue-100"
            >
                <div className="flex items-center gap-3 mb-1.5">
                    <span className="font-bold text-gray-700 text-sm">
                        {tasks.length} 項任務
                    </span>
                    <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                        關鍵: {keyCount}
                    </span>
                    <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded ml-auto font-bold group-hover:bg-green-100">
                        {completedCount} 完成
                    </span>
                </div>

                {/* Mini Progress Bar */}
                <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-blue-500 rounded-full"
                            style={{ width: `${avgProgress}%` }}
                        ></div>
                    </div>
                    <span className="text-[10px] text-gray-400 font-bold">{avgProgress}%</span>
                </div>

                <div className="text-center mt-1">
                    <span className="text-[10px] text-blue-400 group-hover:text-blue-600 transition-colors">點擊展開詳情 ▼</span>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white border boundary-blue-200 rounded-xl p-3 shadow-inner bg-gray-50/50">
            <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-200">
                <h4 className="font-bold text-gray-700 text-sm">任務明細 ({tasks.length})</h4>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsExpanded(false);
                    }}
                    className="text-xs bg-white border border-gray-300 px-2 py-1 rounded hover:bg-gray-50 text-gray-600"
                >
                    收起 ▲
                </button>
            </div>

            <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                {tasks.map((t, idx) => (
                    <div key={idx} className="bg-white border border-gray-100 rounded-lg p-3 shadow-sm flex flex-col gap-2 transition hover:shadow-md">
                        <div className="flex justify-between items-start">
                            <div className="flex items-start gap-2 flex-1 mr-2">
                                <span className={`flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded font-bold border mt-0.5 ${t.category === '關鍵職責' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                                    {t.category === '關鍵職責' ? '關鍵' : '其他'}
                                </span>
                                <div>
                                    <div className="font-bold text-gray-800 text-sm mb-1 leading-snug">{t.outcome || <span className="text-gray-400 italic font-normal">未填寫成果</span>}</div>
                                    <div className="flex items-center text-xs text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100 w-fit">
                                        <span className="font-bold text-gray-400 mr-1.5 text-[10px]">任務</span>
                                        {t.name}
                                    </div>
                                </div>
                            </div>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${(t.progress ?? 0) === 100 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-600'}`}>
                                {t.progress ?? 0}%
                            </span>
                        </div>

                        <div className="flex items-center justify-between text-xs text-gray-400 pl-1 mt-1 border-t border-gray-50 pt-2">
                            <div className="flex gap-3">
                                <span className="flex items-center">🕒 預估 {t.hours}h</span>
                                {(t.actualHours > 0) && (
                                    <span className={`flex items-center font-medium ${t.actualHours > t.hours ? 'text-orange-500' : 'text-green-600'}`}>
                                        / 實 {t.actualHours}h
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="text-center mt-2">
                <button
                    onClick={() => setIsExpanded(false)}
                    className="text-xs text-gray-400 hover:text-gray-600 transition"
                >
                    收起列表
                </button>
            </div>
        </div>
    );
};

export const Tracking: React.FC<TrackingProps> = ({ user, weeklyPlans, dailyPlans, onBack, hideHeader = false }) => {
    // Add 'stats' to the activeTab state
    const [activeTab, setActiveTab] = useState<'stats' | 'weekly' | 'daily'>('stats');
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 10;

    // Filter data for current user (This should ideally be done by parent if passing specific plans, but keeping basic check is fine)
    const myWeeklyPlans = useMemo(() => weeklyPlans.filter(p => p.userId === user.id), [weeklyPlans, user.id]);
    const myDailyPlans = useMemo(() => dailyPlans.filter(p => p.userId === user.id), [dailyPlans, user.id]);

    // Pagination Logic
    // Only applies to list views (weekly, daily)
    const currentDataList = activeTab === 'weekly' ? myWeeklyPlans : (activeTab === 'daily' ? myDailyPlans : []);
    const totalPages = Math.ceil(currentDataList.length / pageSize);
    const paginatedData = useMemo(() => {
        if (activeTab === 'stats') return [];
        const start = (currentPage - 1) * pageSize;
        return currentDataList.slice(start, start + pageSize);
    }, [currentDataList, currentPage, activeTab]);

    // Reset page on tab switch
    const handleTabChange = (tab: 'stats' | 'weekly' | 'daily') => {
        setActiveTab(tab);
        setCurrentPage(1);
    };

    const handleExport = () => {
        const wb = XLSX.utils.book_new();

        // 1. Weekly Sheet (Formatting tasks as string for readability in cell)
        const weeklyData = myWeeklyPlans.map(item => {
            const tasksStr = item.tasks.map(t =>
                `[${t.category}] ${t.name} (預估:${t.hours}hr/實際:${t.actualHours || 0}hr) - 執行:${t.progress || 0}% - 成果:${t.outcome}`
            ).join('\n');

            let statusStr = "待審核";
            if (item.status === 'approved') statusStr = "已通過";
            if (item.status === 'rejected') statusStr = "未通過";

            return {
                "週次": item.weekRange,
                "狀態": statusStr,
                "提交日期": item.submittedAt?.substring(0, 10),
                "總時數": item.totalHours,
                "關鍵職責佔比": `${item.keyRatio}%`,
                "任務清單": tasksStr,
                "主管回覆": item.reviewComment || '',
                "備註": item.remark || ''
            };
        });
        const wsWeekly = XLSX.utils.json_to_sheet(weeklyData);
        // Auto-adjust column width slightly
        wsWeekly['!cols'] = [{ wch: 25 }, { wch: 10 }, { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 60 }, { wch: 30 }, { wch: 30 }];
        XLSX.utils.book_append_sheet(wb, wsWeekly, "週計畫");

        // 2. Daily Sheet
        const dailyData = myDailyPlans.map(item => ({
            "日期": item.date,
            "第一件事": item.goals[0] || '',
            "第二件事": item.goals[1] || '',
            "第三件事": item.goals[2] || '',
            "狀態": item.status === 'Valid' ? '符合' : '不符合'
        }));
        const wsDaily = XLSX.utils.json_to_sheet(dailyData);
        wsDaily['!cols'] = [{ wch: 15 }, { wch: 40 }, { wch: 40 }, { wch: 40 }, { wch: 10 }];
        XLSX.utils.book_append_sheet(wb, wsDaily, "曉三計畫");

        // Filename: [User Name]_PlanRecord.xlsx
        XLSX.writeFile(wb, `${user.name}_計畫紀錄.xlsx`);
    };

    return (
        <div className={`min-h-screen bg-[#eef5ff] p-4 md:p-8 ${hideHeader ? '!p-0 !bg-transparent !min-h-0' : ''}`}>
            <div className="max-w-6xl mx-auto">
                {!hideHeader && <Header title="成果追蹤" subtitle="計畫統計與歷史查詢" onBack={onBack} />}
                <div className={`bg-white rounded-xl shadow-md p-6 min-h-[600px] flex flex-col ${hideHeader ? '!shadow-none !border-none' : ''}`}>
                    <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                        <div className="flex space-x-1 bg-gray-100 p-1 rounded-xl self-start md:self-auto border border-gray-200">
                            <button
                                onClick={() => handleTabChange('stats')}
                                className={`flex items-center px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'stats'
                                    ? 'bg-white text-blue-600 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                                    }`}
                            >
                                <BarChart3 className="w-4 h-4 mr-2" />
                                統計分析
                            </button>
                            <button
                                onClick={() => handleTabChange('weekly')}
                                className={`flex items-center px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'weekly'
                                    ? 'bg-white text-blue-600 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                                    }`}
                            >
                                <List className="w-4 h-4 mr-2" />
                                週計畫明細
                            </button>
                            <button
                                onClick={() => handleTabChange('daily')}
                                className={`flex items-center px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'daily'
                                    ? 'bg-white text-blue-600 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                                    }`}
                            >
                                <CalendarCheck className="w-4 h-4 mr-2" />
                                曉三計畫明細
                            </button>
                        </div>

                        {/* Export Button only for List Views? Or always allow export of raw data? Keeping it always visible is fine. */}
                        <button
                            onClick={handleExport}
                            className="flex items-center bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition shadow-sm text-sm font-bold"
                        >
                            <FileSpreadsheet className="w-4 h-4 mr-2" />
                            匯出 Excel
                        </button>
                    </div>

                    <div className="flex-grow">
                        {activeTab === 'stats' && (
                            <PlanStats plans={myWeeklyPlans} />
                        )}

                        {activeTab === 'weekly' && (
                            <div className="overflow-x-auto animate-fade-in">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50 text-gray-700">
                                            <th className="p-3">週次</th>
                                            <th className="p-3">狀態</th>
                                            <th className="p-3">提交日期</th>
                                            <th className="p-3">總時數</th>
                                            <th className="p-3">關鍵佔比</th>
                                            <th className="p-3">任務進度摘要</th>
                                            <th className="p-3">備註</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedData.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="p-8 text-center text-gray-400">尚無提交紀錄</td>
                                            </tr>
                                        ) : (
                                            (paginatedData as WeeklyPlanSubmission[]).map(record => (
                                                <tr key={record.id} className="border-b border-gray-100 hover:bg-gray-50">
                                                    <td className="p-3 text-gray-800 text-sm font-medium">{record.weekRange}</td>
                                                    <td className="p-3">
                                                        {record.status === 'pending' && <span className="text-gray-500 text-sm">待審核</span>}
                                                        {record.status === 'approved' && <span className="text-green-600 text-sm font-bold">已通過</span>}
                                                        {record.status === 'rejected' && <span className="text-red-500 text-sm font-bold">未通過</span>}
                                                        {record.status === 'draft' && <span className="text-gray-400 text-sm">草稿</span>}
                                                    </td>
                                                    <td className="p-3 text-gray-600 text-sm">{record.submittedAt?.substring(0, 10)}</td>
                                                    <td className="p-3 font-bold">{record.totalHours}hr</td>
                                                    <td className={`p-3 font-bold ${record.keyRatio < 50 ? 'text-red-500' : 'text-green-600'}`}>
                                                        {record.keyRatio}%
                                                    </td>
                                                    <td className="p-3 align-top min-w-[280px]">
                                                        <TaskSummaryCell tasks={record.tasks} />
                                                    </td>
                                                    <td className="p-3 text-gray-500 text-sm max-w-xs truncate" title={record.remark}>
                                                        {record.remark || '-'}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {activeTab === 'daily' && (
                            <div className="overflow-x-auto animate-fade-in">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50 text-gray-700">
                                            <th className="p-3 w-32">日期</th>
                                            <th className="p-3">三件事摘要</th>
                                            <th className="p-3 w-24">狀態</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedData.length === 0 ? (
                                            <tr>
                                                <td colSpan={3} className="p-8 text-center text-gray-400">尚無提交紀錄</td>
                                            </tr>
                                        ) : (
                                            (paginatedData as DailyPlanSubmission[]).map(record => (
                                                <tr key={record.id} className="border-b border-gray-100 hover:bg-gray-50">
                                                    <td className="p-3 text-gray-800">{record.date}</td>
                                                    <td className="p-3 align-top">
                                                        <div className="flex flex-col gap-1.5">
                                                            {record.goals.map((g, idx) => (
                                                                <div key={idx} className="flex items-start gap-2 text-sm text-gray-700 bg-white border border-gray-100 p-2 rounded-lg shadow-sm">
                                                                    <span className="flex-shrink-0 w-5 h-5 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold mt-0.5">
                                                                        {idx + 1}
                                                                    </span>
                                                                    <span className="leading-relaxed">{g || <span className="text-gray-300 italic">未填寫</span>}</span>
                                                                </div>
                                                            ))}
                                                            {record.incompleteReason && (
                                                                <div className="text-xs text-orange-600 bg-orange-50 p-2 rounded border border-orange-100 flex items-start mt-1">
                                                                    <span className="font-bold mr-1 flex-shrink-0">⚠️ 原因:</span>
                                                                    {record.incompleteReason}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="p-3">
                                                        <span className={`px-2 py-1 rounded text-xs ${record.status === 'Valid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                            {record.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Pagination Controls - Only show for List Views */}
                    {activeTab !== 'stats' && totalPages > 1 && (
                        <div className="mt-6 flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-200">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-4 py-2 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 text-sm font-medium transition shadow-sm"
                            >
                                上一頁
                            </button>
                            <span className="text-sm font-bold text-gray-700">
                                第 {currentPage} / {totalPages} 頁
                                <span className="text-gray-400 font-normal ml-2">(共 {currentDataList.length} 筆)</span>
                            </span>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="px-4 py-2 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 text-sm font-medium transition shadow-sm"
                            >
                                下一頁
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};