import React, { useState, useMemo } from 'react';
import { WeeklyPlanSubmission } from '../types';
import { getMonthlyStatsForYear, getQuarterlyStatsForYear, getAnnualStats, getAvailableYears, PeriodStats } from '../utils/statsHelper';
import {
    BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts';
import { Calendar, TrendingUp, Clock, CheckCircle, Target } from 'lucide-react';

interface PlanStatsProps {
    plans: WeeklyPlanSubmission[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; subValue?: string; colorClass?: string }> = ({
    title, value, icon, subValue, colorClass = "bg-blue-50 text-blue-600"
}) => (
    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-start space-x-4">
        <div className={`p-3 rounded-lg ${colorClass}`}>
            {icon}
        </div>
        <div>
            <p className="text-gray-500 text-sm font-medium">{title}</p>
            <h3 className="text-2xl font-bold text-gray-800 mt-0.5">{value}</h3>
            {subValue && <p className="text-xs text-gray-400 mt-1">{subValue}</p>}
        </div>
    </div>
);

export const PlanStats: React.FC<PlanStatsProps> = ({ plans }) => {
    const availableYears = useMemo(() => getAvailableYears(plans), [plans]);
    const [selectedYear, setSelectedYear] = useState<number>(availableYears[0] || new Date().getFullYear());
    const [viewMode, setViewMode] = useState<'monthly' | 'quarterly'>('monthly');

    const data = useMemo(() => {
        if (viewMode === 'monthly') {
            return getMonthlyStatsForYear(plans, selectedYear);
        } else {
            return getQuarterlyStatsForYear(plans, selectedYear);
        }
    }, [plans, selectedYear, viewMode]);

    const annualStats = useMemo(() => getAnnualStats(plans, selectedYear), [plans, selectedYear]);

    // Derived stats for cards
    const totalEfficiency = annualStats.totalActualHours > 0
        ? Math.round((annualStats.totalCompletedTasks / (annualStats.totalActualHours / 8)) * 10) / 10 // rough tasks per day? Maybe confusing.
        : 0;

    // Pie data for Annual Overview
    const pieData = [
        { name: 'Completed', value: annualStats.completedTasks },
        { name: 'Incomplete', value: annualStats.totalTasks - annualStats.completedTasks },
    ];

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Controls */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-gray-400" />
                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="form-select bg-gray-50 border-gray-300 rounded-lg text-sm font-bold text-gray-700 focus:ring-blue-500 focus:border-blue-500 block p-2.5"
                    >
                        {availableYears.map(y => <option key={y} value={y}>{y}年度</option>)}
                        {!availableYears.includes(new Date().getFullYear()) && (
                            <option value={new Date().getFullYear()}>{new Date().getFullYear()}年度</option>
                        )}
                    </select>
                </div>

                <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button
                        onClick={() => setViewMode('monthly')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'monthly' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        月度檢視
                    </button>
                    <button
                        onClick={() => setViewMode('quarterly')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'quarterly' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        季度總結
                    </button>
                </div>
            </div>

            {/* Overview Cards (Annual) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="年度完成度"
                    value={`${annualStats.avgProgress}%`}
                    subValue={`共完成 ${annualStats.completedTasks}/${annualStats.totalTasks} 項任務`}
                    icon={<CheckCircle className="w-6 h-6" />}
                    colorClass="bg-green-50 text-green-600"
                />
                <StatCard
                    title="總投入時數"
                    value={`${annualStats.totalActualHours}h`}
                    subValue={`預估 ${annualStats.totalPlannedHours}h`}
                    icon={<Clock className="w-6 h-6" />}
                    colorClass="bg-blue-50 text-blue-600"
                />
                <StatCard
                    title="關鍵職責佔比"
                    value={`${annualStats.keyResponsibilityRate}%`}
                    subValue="專注於核心目標"
                    icon={<Target className="w-6 h-6" />}
                    colorClass="bg-red-50 text-red-600"
                />
                <StatCard
                    title="計畫提交數"
                    value={annualStats.plansCount}
                    subValue="持續追蹤週數"
                    icon={<TrendingUp className="w-6 h-6" />}
                    colorClass="bg-purple-50 text-purple-600"
                />
            </div>

            {/* Charts Area */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 1. Completion Progress Trend */}
                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                    <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center">
                        <TrendingUp className="w-5 h-5 mr-2 text-blue-500" />
                        任務達成率趨勢
                    </h3>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="periodLabel" tick={{ fontSize: 12 }} />
                                <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 12 }} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Legend />
                                <Line
                                    type="monotone"
                                    dataKey="avgProgress"
                                    name="平均完成度"
                                    stroke="#3B82F6"
                                    strokeWidth={3}
                                    dot={{ r: 4, strokeWidth: 2 }}
                                    activeDot={{ r: 6 }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="keyResponsibilityRate"
                                    name="關鍵職責率"
                                    stroke="#EF4444"
                                    strokeWidth={2}
                                    strokeDasharray="5 5"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 2. Hours Comparison */}
                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                    <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center">
                        <Clock className="w-5 h-5 mr-2 text-orange-500" />
                        工時投入分析 (預估 vs 實際)
                    </h3>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                                <XAxis dataKey="periodLabel" tick={{ fontSize: 12 }} />
                                <YAxis tick={{ fontSize: 12 }} />
                                <Tooltip
                                    cursor={{ fill: '#f9fafb' }}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Legend />
                                <Bar dataKey="totalPlannedHours" name="預估時數" fill="#93C5FD" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="totalActualHours" name="實際時數" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 3. Task Completion Pie (Annual) */}
                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow lg:col-span-1">
                    <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center">
                        <Target className="w-5 h-5 mr-2 text-green-500" />
                        {selectedYear} 年度任務完成概況
                    </h3>
                    <div className="h-64 flex items-center justify-center">
                        {annualStats.totalTasks === 0 ? (
                            <div className="text-gray-400 text-sm">尚無任務數據</div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        fill="#8884d8"
                                        paddingAngle={5}
                                        dataKey="value"
                                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                    >
                                        <Cell fill="#10B981" />
                                        <Cell fill="#E5E7EB" />
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                    <div className="flex justify-center gap-6 mt-4 text-sm">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-green-500"></div>
                            <span className="text-gray-600">已完成 ({annualStats.completedTasks})</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-gray-200"></div>
                            <span className="text-gray-600">未完成 ({annualStats.totalTasks - annualStats.completedTasks})</span>
                        </div>
                    </div>
                </div>

                {/* 4. Task Volume Trend */}
                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow lg:col-span-1">
                    <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center">
                        <CheckCircle className="w-5 h-5 mr-2 text-purple-500" />
                        任務數量趨勢
                    </h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                                <XAxis dataKey="periodLabel" tick={{ fontSize: 12 }} />
                                <YAxis tick={{ fontSize: 12 }} />
                                <Tooltip
                                    cursor={{ fill: '#f9fafb' }}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Legend />
                                <Bar dataKey="totalTasks" name="總任務數" fill="#8B5CF6" radius={[4, 4, 0, 0]} barSize={20} />
                                <Bar dataKey="completedTasks" name="完成數" fill="#10B981" radius={[4, 4, 0, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};
