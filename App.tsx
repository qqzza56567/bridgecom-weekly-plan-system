import React, { useState, useEffect, useRef } from 'react';
import { User, WeeklyPlanSubmission, DailyPlanSubmission } from './types';
import { ToastProvider, useToast } from './components/Toast';
import { Login } from './components/Login';
import { BrowserRouter, Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { RefreshCw, LogOut, AlertTriangle } from 'lucide-react';
import { supabase } from './supabaseClient';

// Lazy load components for performance
const Dashboard = React.lazy(() => import('./components/Dashboard').then(m => ({ default: m.Dashboard })));
const WeeklyPlan = React.lazy(() => import('./components/WeeklyPlan').then(m => ({ default: m.WeeklyPlan })));
const WeeklyPlanList = React.lazy(() => import('./components/WeeklyPlanList').then(m => ({ default: m.WeeklyPlanList })));
const DailyPlan = React.lazy(() => import('./components/DailyPlan').then(m => ({ default: m.DailyPlan })));
const Review = React.lazy(() => import('./components/Review').then(m => ({ default: m.Review })));
const Admin = React.lazy(() => import('./components/Admin').then(m => ({ default: m.Admin })));
const Tracking = React.lazy(() => import('./components/Tracking').then(m => ({ default: m.Tracking })));

// Services (Used for data fetching, but Auth is now inlined)
import { UserService } from './services/UserService';
import { PlanService } from './services/PlanService';
import { DailyPlanService } from './services/DailyPlanService';

// --- Shared Small Components ---

const LoadingScreen = ({ message }: { message: string }) => (
  <div className="min-h-screen flex items-center justify-center bg-[#fcfdfe] flex-col gap-6 p-6 text-center">
    <div className="relative">
      <div className="w-16 h-16 border-4 border-gray-100 border-t-blue-500 rounded-full animate-spin"></div>
    </div>
    <div className="animate-pulse">
      <h2 className="text-lg font-bold text-gray-700 mb-1">{message}</h2>
      <p className="text-xs text-gray-400">正在同步雲端資料...</p>
    </div>
  </div>
);

const RequireAuth = ({
  children,
  session,
  currentUser,
  isLoading,
  onLogout
}: {
  children: React.ReactElement,
  session: any,
  currentUser: User | null,
  isLoading: boolean,
  onLogout: () => void
}) => {
  if (isLoading) return <LoadingScreen message="系統準備中" />;

  if (!session) return <Navigate to="/" replace />;

  if (session && !currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#fffafa]">
        <div className="bg-white p-10 rounded-[32px] shadow-2xl shadow-blue-900/5 max-w-md w-full text-center border border-red-50">
          <div className="bg-red-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-10 h-10 text-red-400" />
          </div>
          <h3 className="text-2xl font-black text-gray-900 mb-3">資料庫連線中斷</h3>
          <p className="text-gray-500 mb-8 leading-relaxed font-medium">
            我們已偵測到您的身份，但無法載入您的員工檔案。這可能是暫時性的網路問題。
          </p>

          <div className="bg-gray-50 p-4 rounded-2xl mb-8 text-left border border-gray-100">
            <div className="text-[10px] text-gray-400 uppercase font-black tracking-widest mb-1">User Trace ID</div>
            <div className="font-mono text-[10px] text-gray-400 break-all">{session.user.id}</div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold hover:bg-blue-700 transition-all active:scale-[0.98] shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-5 h-5" /> 立即重試
            </button>
            <button
              onClick={onLogout}
              className="w-full bg-white border border-gray-200 text-gray-400 py-3 rounded-2xl font-bold hover:bg-gray-50 transition-all flex items-center justify-center gap-2 text-sm"
            >
              <LogOut className="w-4 h-4" /> 登出並切換帳號
            </button>
          </div>
        </div>
      </div>
    )
  }
  return children;
};

// --- Main Application ---

const AppContent: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [session, setSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const toast = useToast();
  const bootRef = useRef(false);

  // --- Global Data Store ---
  const [users, setUsers] = useState<User[]>([]);
  const [weeklyPlans, setWeeklyPlans] = useState<WeeklyPlanSubmission[]>([]);
  const [dailyPlans, setDailyPlans] = useState<DailyPlanSubmission[]>([]);
  const [editingPlan, setEditingPlan] = useState<WeeklyPlanSubmission | undefined>(undefined);
  const [targetWeekStart, setTargetWeekStart] = useState<string | undefined>(undefined);

  // --- Inlined Auth Logic to prevent Module Deadlocks ---
  const bootstrapSession = async (s: any) => {
    if (!s?.user) {
      setIsLoading(false);
      return;
    }

    const userId = s.user.id;
    const email = s.user.email || '';
    const name = s.user.user_metadata?.full_name || email.split('@')[0] || '使用者';

    console.log(`[Bootstrap] Starting for user: ${userId}`);

    // --- MOCK DATA MODE FOR DEV LOGIN ---
    if (userId === 'a0000009-0000-0000-0000-000000000009') {
      console.log("[Bootstrap] ⚠️ MOCK DATA MODE ACTIVATED");
      const mockKen: User = {
        id: userId,
        email: 'ken@bridgecom.com.tw',
        name: 'Ken (Dev)',
        isManager: true,
        isAdmin: true,
        subordinates: []
      };

      const mockUsers: User[] = [
        mockKen,
        { id: 'u2', email: 'alice@test.com', name: 'Alice (Sales)', isManager: false, isAdmin: false, subordinates: [] },
        { id: 'u3', email: 'bob@test.com', name: 'Bob (Engineer)', isManager: false, isAdmin: false, subordinates: [] },
      ];

      // Mock Weekly Plans
      const mockWeeklyPlans: WeeklyPlanSubmission[] = [
        {
          id: 'wp1', userId: 'u2', userName: 'Alice', weekRange: '2025-W05', weekStart: '2025-01-29', status: 'approved',
          submittedAt: '2025-01-30T10:00:00Z', totalHours: 40, keyRatio: 80,
          tasks: [
            { id: 't1', category: '關鍵職責' as any, priority: '高' as any, name: 'Client Visit', hours: 20, actualHours: 20, progress: 100, outcome: 'Closed deal' },
            { id: 't2', category: '其他事項' as any, priority: '中' as any, name: 'Report', hours: 20, actualHours: 18, progress: 90, outcome: 'Drafted' }
          ]
        },
        {
          id: 'wp2', userId: 'u2', userName: 'Alice', weekRange: '2025-W04', weekStart: '2025-01-22', status: 'approved',
          submittedAt: '2025-01-23T10:00:00Z', totalHours: 42, keyRatio: 85, tasks: []
        },
        {
          id: 'wp3', userId: 'u3', userName: 'Bob', weekRange: '2025-W05', weekStart: '2025-01-29', status: 'pending',
          submittedAt: '2025-01-31T09:00:00Z', totalHours: 45, keyRatio: 90,
          tasks: [
            { id: 't3', category: '關鍵職責' as any, priority: '高' as any, name: 'Frontend Refactor', hours: 40, actualHours: 30, progress: 75, outcome: 'Ongoing' }
          ]
        }
      ];

      // Mock Daily Plans
      const mockDailyPlans: DailyPlanSubmission[] = [
        { id: 'dp1', userId: 'u2', userName: 'Alice', date: '2025-02-03', status: 'Valid', goals: ['Call client', 'Email boss', 'Meeting'] },
        { id: 'dp2', userId: 'u3', userName: 'Bob', date: '2025-02-03', status: 'Valid', goals: ['Code review', 'Fix bugs', 'Deploy'] }
      ];

      setCurrentUser(mockKen);
      setUsers(mockUsers);
      setWeeklyPlans(mockWeeklyPlans);
      setDailyPlans(mockDailyPlans);
      setIsLoading(false);
      toast.success("已進入本地開發模擬模式 (Mock Data Mode)");
      return;
    }
    // ------------------------------------

    try {
      // 1. Fetch Profile (Manual Direct Query to bypass UserService deadlock)
      const { data: profiles, error: pError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId);

      if (pError) throw pError;

      let activeProfile: User;
      const profile = profiles && profiles.length > 0 ? profiles[0] : null;

      if (profile) {
        // Fetch subordinates
        const { data: relations } = await supabase
          .from('user_relationships')
          .select('subordinate_id')
          .eq('manager_id', userId);

        activeProfile = {
          id: profile.id,
          name: profile.full_name,
          email: profile.email,
          isManager: profile.is_manager,
          isAdmin: profile.is_admin,
          subordinates: relations?.map(r => r.subordinate_id) || []
        };
      } else {
        // Create new profile immediately
        const newP = { id: userId, email, full_name: name, is_manager: false, is_admin: false };
        const { error: iError } = await supabase.from('profiles').insert(newP);
        if (iError) throw iError;
        activeProfile = { id: userId, email, name, isManager: false, isAdmin: false, subordinates: [] };
      }

      setCurrentUser(activeProfile);
      console.log(`[Bootstrap] Profile secure: ${activeProfile.name}`);

      // 2. Fetch Data
      if (activeProfile.isManager || activeProfile.isAdmin) {
        const [allUsers, allPlans, allDaily] = await Promise.all([
          UserService.fetchAllUsers(),
          PlanService.fetchAllPlans(),
          DailyPlanService.fetchAllDailyPlans()
        ]);
        setUsers(allUsers);
        setWeeklyPlans(allPlans);
        setDailyPlans(allDaily);
      } else {
        const [myPlans, myDaily] = await Promise.all([
          PlanService.fetchUserPlans(userId),
          DailyPlanService.fetchDailyPlansByUser(userId)
        ]);
        setWeeklyPlans(myPlans);
        setDailyPlans(myDaily);
      }
    } catch (err: any) {
      console.error("[Bootstrap] Failed:", err);
      toast.error("資料載入異常，請重新整理頁面。");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (bootRef.current) return;
    bootRef.current = true;

    let isMounted = true;

    // Safety Force-Unlock
    const timer = setTimeout(() => {
      if (isMounted && isLoading) {
        console.warn("[System] Safety timeout hit.");
        setIsLoading(false);
      }
    }, 10000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      console.log(`[Event] Auth: ${event}`);
      if (!isMounted) return;
      setSession(newSession);
      if (newSession) bootstrapSession(newSession);
      else setIsLoading(false);
    });

    // Initial check
    (async () => {
      const { data: { session: initSession } } = await supabase.auth.getSession();
      if (isMounted && initSession) {
        setSession(initSession);
        bootstrapSession(initSession);
      } else if (isMounted && !initSession) {
        // Wait for event or stay on login
      }
    })();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  // --- Global State Handlers ---

  const handleAddOrUpdateWeeklyPlan = React.useCallback(async (plan: WeeklyPlanSubmission) => {
    try {
      const finalId = await PlanService.savePlan(plan, true);
      const finalizedPlan: WeeklyPlanSubmission = { ...plan, id: finalId };
      setEditingPlan(finalizedPlan);
      setWeeklyPlans(prev => {
        const index = prev.findIndex(p => p.id === plan.id || p.id === finalId);
        let n = [...prev];
        if (index >= 0) n[index] = finalizedPlan;
        else n = [finalizedPlan, ...prev];
        return n.sort((a, b) => b.weekStart.localeCompare(a.weekStart));
      });
      toast.success("已成功儲存週計畫");
    } catch (e: any) {
      toast.error(`儲存異常: ${e.message}`);
      throw e;
    }
  }, [toast]);

  const handleWithdrawPlan = React.useCallback(async (planId: string) => {
    try {
      await PlanService.updatePlanStatus(planId, 'draft', '');
      const updated = await PlanService.fetchAllPlans();
      setWeeklyPlans(updated);
      toast.success("計畫已重設為草稿");
      return updated.find(p => p.id === planId);
    } catch (e: any) {
      toast.error(`操作失敗: ${e.message}`);
      return null;
    }
  }, [toast]);

  const handleAddDailyPlan = React.useCallback(async () => {
    if (!currentUser) return;
    const updated = await DailyPlanService.fetchDailyPlansByUser(currentUser.id);
    setDailyPlans(updated);
  }, [currentUser]);

  const handleLogout = React.useCallback(async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setSession(null);
  }, []);

  const handleReviewUpdate = React.useCallback(async (plan: WeeklyPlanSubmission) => {
    try {
      await PlanService.updateReviewData(plan.id, plan.status, plan.reviewComment || '', plan.lastWeekReview);
      setWeeklyPlans(prev => {
        const i = prev.findIndex(p => p.id === plan.id);
        if (i >= 0) {
          const n = [...prev];
          n[i] = { ...n[i], status: plan.status, reviewComment: plan.reviewComment, lastWeekReview: plan.lastWeekReview, updatedAt: new Date().toISOString() };
          return n;
        }
        return prev;
      });
      toast.success("審核記錄已更新");
    } catch (e: any) {
      toast.error(`更新異常: ${e.message}`);
      throw e;
    }
  }, [toast]);

  const navigate = useNavigate();

  return (
    <React.Suspense fallback={<LoadingScreen message="模組加載中" />}>
      <Routes>
        <Route path="/" element={session ? <Navigate to="/dashboard" replace /> : <Login onDevLogin={() => {
          const kenId = 'a0000009-0000-0000-0000-000000000009';
          const fakeSession = {
            user: {
              id: kenId,
              email: 'ken@bridgecom.com.tw',
              user_metadata: { full_name: 'Ken' }
            }
          };
          setSession(fakeSession);
          setIsLoading(true);
          bootstrapSession(fakeSession);
        }} />} />
        <Route
          path="/dashboard"
          element={
            <RequireAuth session={session} currentUser={currentUser} isLoading={isLoading} onLogout={handleLogout}>
              <Dashboard user={currentUser!} onNavigate={(path) => navigate(`/${path}`)} onLogout={handleLogout} />
            </RequireAuth>
          }
        />
        <Route
          path="/weekly-plan"
          element={
            <RequireAuth session={session} currentUser={currentUser} isLoading={isLoading} onLogout={handleLogout}>
              <WeeklyPlanList
                user={currentUser!}
                plans={weeklyPlans.filter(p => p.userId === currentUser?.id)}
                onCreate={(ws) => { setEditingPlan(undefined); setTargetWeekStart(ws); navigate('/weekly-plan/form'); }}
                onEdit={(p) => { setEditingPlan(p); setTargetWeekStart(undefined); navigate('/weekly-plan/form'); }}
                onWithdraw={handleWithdrawPlan}
                onBack={() => navigate('/dashboard')}
              />
            </RequireAuth>
          }
        />
        <Route
          path="/weekly-plan/form"
          element={
            <RequireAuth session={session} currentUser={currentUser} isLoading={isLoading} onLogout={handleLogout}>
              <WeeklyPlan
                user={currentUser!}
                initialData={editingPlan}
                targetWeekStart={targetWeekStart}
                allPlans={weeklyPlans.filter(p => p.userId === currentUser?.id)}
                onSubmit={handleAddOrUpdateWeeklyPlan}
                onBack={() => navigate('/weekly-plan')}
              />
            </RequireAuth>
          }
        />
        <Route
          path="/daily-plan"
          element={
            <RequireAuth session={session} currentUser={currentUser} isLoading={isLoading} onLogout={handleLogout}>
              <DailyPlan user={currentUser!} onSubmit={handleAddDailyPlan} onBack={() => navigate('/dashboard')} />
            </RequireAuth>
          }
        />
        <Route
          path="/tracking"
          element={
            <RequireAuth session={session} currentUser={currentUser} isLoading={isLoading} onLogout={handleLogout}>
              <Tracking
                user={currentUser!}
                weeklyPlans={weeklyPlans.filter(p => p.userId === currentUser?.id)}
                dailyPlans={dailyPlans.filter(p => p.userId === currentUser?.id)}
                onBack={() => navigate('/dashboard')}
              />
            </RequireAuth>
          }
        />
        <Route
          path="/review"
          element={
            <RequireAuth session={session} currentUser={currentUser} isLoading={isLoading} onLogout={handleLogout}>
              {currentUser?.isManager || currentUser?.isAdmin ? (
                <Review user={currentUser!} users={users} weeklyPlans={weeklyPlans} onUpdatePlan={handleReviewUpdate} onBack={() => navigate('/dashboard')} />
              ) : <Navigate to="/dashboard" replace />}
            </RequireAuth>
          }
        />
        <Route
          path="/admin"
          element={
            <RequireAuth session={session} currentUser={currentUser} isLoading={isLoading} onLogout={handleLogout}>
              {currentUser?.isAdmin ? (
                <Admin
                  users={users}
                  onSave={async (u) => {
                    if (users.find(ex => ex.id === u.id)) await UserService.updateUser(u);
                    else await UserService.createUser(u);
                    setUsers(await UserService.fetchAllUsers());
                  }}
                  onDelete={async (id) => { await UserService.deleteUser(id); setUsers(await UserService.fetchAllUsers()); }}
                  onResetData={async () => {
                    await PlanService.clearAllPlans(); await DailyPlanService.clearAllDailyPlans();
                    setWeeklyPlans(await PlanService.fetchAllPlans()); setDailyPlans(await DailyPlanService.fetchAllDailyPlans());
                  }}
                  onImportPlans={async (ps) => {
                    for (const p of ps) await PlanService.savePlan(p, true);
                    setWeeklyPlans(await PlanService.fetchAllPlans());
                  }}
                  onBack={() => navigate('/dashboard')}
                  weeklyPlans={weeklyPlans}
                  dailyPlans={dailyPlans}
                />
              ) : <Navigate to="/dashboard" replace />}
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </React.Suspense>
  );
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </BrowserRouter>
  );
};

export default App;