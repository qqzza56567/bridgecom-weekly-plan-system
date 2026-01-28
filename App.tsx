import React, { useState, useEffect, useRef } from 'react';
import { User, WeeklyPlanSubmission, DailyPlanSubmission } from './types';
import { ToastProvider, useToast } from './components/Toast';
import { Login } from './components/Login';
import { BrowserRouter, Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { Loader2, RefreshCw, LogOut, AlertTriangle } from 'lucide-react';
import { supabase } from './supabaseClient';

// Lazy load components
const Dashboard = React.lazy(() => import('./components/Dashboard').then(m => ({ default: m.Dashboard })));
const WeeklyPlan = React.lazy(() => import('./components/WeeklyPlan').then(m => ({ default: m.WeeklyPlan })));
const WeeklyPlanList = React.lazy(() => import('./components/WeeklyPlanList').then(m => ({ default: m.WeeklyPlanList })));
const DailyPlan = React.lazy(() => import('./components/DailyPlan').then(m => ({ default: m.DailyPlan })));
const Review = React.lazy(() => import('./components/Review').then(m => ({ default: m.Review })));
const Admin = React.lazy(() => import('./components/Admin').then(m => ({ default: m.Admin })));
const Tracking = React.lazy(() => import('./components/Tracking').then(m => ({ default: m.Tracking })));

// Services
import { UserService } from './services/UserService';
import { PlanService } from './services/PlanService';
import { DailyPlanService } from './services/DailyPlanService';

// --- Components ---

const LoadingScreen = ({ message }: { message: string }) => (
  <div className="min-h-screen flex items-center justify-center bg-[#f8faff] flex-col gap-6 p-6 text-center">
    <div className="relative">
      <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-2 h-2 bg-blue-600 rounded-full animate-ping"></div>
      </div>
    </div>
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-2">{message}</h2>
      <p className="text-sm text-gray-400">正在與安全伺服器建立連線，請稍候...</p>
    </div>
    <div className="mt-8">
      <button
        onClick={() => window.location.reload()}
        className="text-xs text-blue-500 hover:text-blue-700 font-medium flex items-center gap-1"
      >
        <RefreshCw className="w-3 h-3" /> 如果長時間卡住，請點此重新整理
      </button>
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
  if (isLoading) return <LoadingScreen message="系統初始化..." />;

  if (!session) return <Navigate to="/" replace />;

  if (session && !currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#fff5f5]">
        <div className="bg-white p-10 rounded-[32px] shadow-2xl shadow-red-100 max-w-md w-full text-center border border-red-50">
          <div className="bg-red-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-10 h-10 text-red-500" />
          </div>
          <h3 className="text-2xl font-black text-gray-900 mb-3">員工資料載入失敗</h3>
          <p className="text-gray-500 mb-8 leading-relaxed font-medium">
            您的 Google 帳號雖然已登入，但資料庫連線逾時或尚未建立員工檔案。
          </p>

          <div className="bg-gray-50 p-4 rounded-2xl mb-8 text-left">
            <div className="text-[10px] text-gray-400 uppercase font-black tracking-widest mb-1">User ID</div>
            <div className="font-mono text-xs text-gray-600 break-all">{session.user.id}</div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-5 h-5" /> 重新整理頁面
            </button>
            <button
              onClick={onLogout}
              className="w-full bg-white border-2 border-gray-100 text-gray-500 py-4 rounded-2xl font-bold hover:bg-gray-50 hover:border-gray-200 transition flex items-center justify-center gap-2"
            >
              <LogOut className="w-5 h-5" /> 退出登入
            </button>
          </div>
        </div>
      </div>
    )
  }
  return children;
};

const AppContent: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [session, setSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const toast = useToast();
  const initInvoked = useRef(false);

  // --- Data States ---
  const [users, setUsers] = useState<User[]>([]);
  const [weeklyPlans, setWeeklyPlans] = useState<WeeklyPlanSubmission[]>([]);
  const [dailyPlans, setDailyPlans] = useState<DailyPlanSubmission[]>([]);
  const [editingPlan, setEditingPlan] = useState<WeeklyPlanSubmission | undefined>(undefined);
  const [targetWeekStart, setTargetWeekStart] = useState<string | undefined>(undefined);

  // --- Core Sync Logic (Inlined for reliability) ---
  const syncAppData = async (userId: string, email: string, name: string) => {
    console.log(`[Core] Starting sync for ${userId}`);
    try {
      // 1. Get or Create Profile with 5-second timeout
      const profilePromise = UserService.getOrCreateProfile(userId, email, name);
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Database Timeout")), 5000));

      const userProfile = await Promise.race([profilePromise, timeoutPromise]) as User;
      setCurrentUser(userProfile);
      console.log(`[Core] Profile loaded: ${userProfile.name}`);

      // 2. Load App Data
      if (userProfile.isManager || userProfile.isAdmin) {
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
    } catch (e: any) {
      console.error("[Core] Sync Failed:", e);
      toast.error(e.message === "Database Timeout" ? "連線逾時，請檢查網路或是重新整理" : "資料載入失敗");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (initInvoked.current) return;
    initInvoked.current = true;

    let isMounted = true;
    console.log("[Auth] Bootstrap initialized.");

    // Absolute fallback: If still loading after 8 seconds, just show whatever we have
    const emergencyUnlock = setTimeout(() => {
      if (isMounted && isLoading) {
        console.warn("[Auth] Emergency Unlock! Initializing timed out.");
        setIsLoading(false);
      }
    }, 8000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log(`[Auth] Event: ${event}`);
      if (!isMounted) return;

      setSession(newSession);

      if (newSession?.user) {
        const email = newSession.user.email || '';
        const name = newSession.user.user_metadata?.full_name || email.split('@')[0] || '使用者';
        await syncAppData(newSession.user.id, email, name);
      } else {
        setIsLoading(false);
      }
    });

    // Immediate check
    (async () => {
      const { data: { session: initialSession } } = await supabase.auth.getSession();
      if (isMounted && initialSession && !currentUser) {
        setSession(initialSession);
        const email = initialSession.user.email || '';
        const name = initialSession.user.user_metadata?.full_name || email.split('@')[0] || '使用者';
        await syncAppData(initialSession.user.id, email, name);
      } else if (isMounted && !initialSession) {
        // Just let it be, the listener will catch it or it stays in Login
      }
    })();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      clearTimeout(emergencyUnlock);
    };
  }, []);

  // --- Handlers ---
  const handleAddOrUpdateWeeklyPlan = React.useCallback(async (plan: WeeklyPlanSubmission) => {
    try {
      const finalId = await PlanService.savePlan(plan, true);
      const finalizedPlan: WeeklyPlanSubmission = { ...plan, id: finalId };
      setEditingPlan(finalizedPlan);
      setWeeklyPlans(prev => {
        const index = prev.findIndex(p => p.id === plan.id || p.id === finalId);
        let newPlans = [...prev];
        if (index >= 0) newPlans[index] = finalizedPlan;
        else newPlans = [finalizedPlan, ...prev];
        return newPlans.sort((a, b) => b.weekStart.localeCompare(a.weekStart));
      });
      toast.success("週計畫已儲存");
    } catch (e: any) {
      toast.error(`儲存失敗: ${e.message}`);
      throw e;
    }
  }, [toast]);

  const handleWithdrawPlan = React.useCallback(async (planId: string) => {
    try {
      await PlanService.updatePlanStatus(planId, 'draft', '');
      const updatedPlans = await PlanService.fetchAllPlans();
      setWeeklyPlans(updatedPlans);
      toast.success("計畫已撤回至草稿");
      return updatedPlans.find(p => p.id === planId);
    } catch (e: any) {
      toast.error(`撤回失敗: ${e.message}`);
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
        const index = prev.findIndex(p => p.id === plan.id);
        if (index >= 0) {
          const newPlans = [...prev];
          newPlans[index] = { ...newPlans[index], status: plan.status, reviewComment: plan.reviewComment, lastWeekReview: plan.lastWeekReview, updatedAt: new Date().toISOString() };
          return newPlans;
        }
        return prev;
      });
      toast.success("審核已更新");
    } catch (e: any) {
      toast.error(`更新失敗: ${e.message}`);
      throw e;
    }
  }, [toast]);

  const navigate = useNavigate();

  return (
    <React.Suspense fallback={<LoadingScreen message="載入頁面模組..." />}>
      <Routes>
        <Route path="/" element={session ? <Navigate to="/dashboard" replace /> : <Login />} />
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
                onCreate={(weekStart) => { setEditingPlan(undefined); setTargetWeekStart(weekStart); navigate('/weekly-plan/form'); }}
                onEdit={(plan) => { setEditingPlan(plan); setTargetWeekStart(undefined); navigate('/weekly-plan/form'); }}
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
          path="/review"
          element={
            <RequireAuth session={session} currentUser={currentUser} isLoading={isLoading} onLogout={handleLogout}>
              {currentUser?.isManager || currentUser?.isAdmin ? (
                <Review user={currentUser!} users={users} weeklyPlans={weeklyPlans} onUpdatePlan={handleReviewUpdate} onBack={() => navigate('/dashboard')} />
              ) : (
                <Navigate to="/dashboard" replace />
              )}
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
                  onSave={async (user) => {
                    if (users.find(u => u.id === user.id)) await UserService.updateUser(user);
                    else await UserService.createUser(user);
                    setUsers(await UserService.fetchAllUsers());
                  }}
                  onDelete={async (id) => { await UserService.deleteUser(id); setUsers(await UserService.fetchAllUsers()); }}
                  onResetData={async () => {
                    await PlanService.clearAllPlans(); await DailyPlanService.clearAllDailyPlans();
                    setWeeklyPlans(await PlanService.fetchAllPlans()); setDailyPlans(await DailyPlanService.fetchAllDailyPlans());
                  }}
                  onImportPlans={async (plans) => {
                    for (const plan of plans) await PlanService.savePlan(plan, true);
                    setWeeklyPlans(await PlanService.fetchAllPlans());
                  }}
                  onBack={() => navigate('/dashboard')}
                />
              ) : <Navigate to="/dashboard" replace />}
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