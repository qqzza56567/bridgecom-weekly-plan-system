import React, { useState, useEffect, useRef } from 'react';
import { User, WeeklyPlanSubmission, DailyPlanSubmission } from './types';
import { ToastProvider, useToast } from './components/Toast';
import { MOCK_USERS } from './constants';
import { Login } from './components/Login';
import { BrowserRouter, Routes, Route, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
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

// Moved outside to prevent remounting on App re-renders
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
  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center text-gray-400 bg-gray-50 flex-col gap-4">
      <Loader2 className="animate-spin text-blue-500 w-10 h-10" />
      <span className="font-bold tracking-widest text-sm">系統載入中...</span>
    </div>
  );

  if (!session) return <Navigate to="/" replace />;

  if (session && !currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-red-50">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md text-center border border-red-100">
          <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600 font-bold text-2xl">!</div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">權限未啟用</h3>
          <div className="text-gray-500 mb-6 leading-relaxed">
            您的 Google 帳號雖然已登位，但系統中尚未建立對應的員工資料或載入失敗。
            <br />
            請重新整理或聯繫管理員協助設定。
          </div>
          <div className="text-xs bg-gray-50 p-3 rounded mb-6 text-left font-mono break-all text-gray-400">UID: {session.user.id}</div>
          <div className="flex flex-col gap-2">
            <button onClick={() => window.location.reload()} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition">重新整理</button>
            <button onClick={onLogout} className="w-full bg-gray-100 text-gray-600 py-3 rounded-xl font-bold hover:bg-gray-200 transition">退出登入</button>
          </div>
        </div>
      </div>
    )
  }
  return children;
};

const RequireAdmin = ({
  children,
  currentUser,
  isLoading
}: {
  children: React.ReactElement,
  currentUser: User | null,
  isLoading: boolean
}) => {
  if (isLoading) return null;
  if (!currentUser?.isAdmin) return <Navigate to="/dashboard" replace />;
  return children;
};

const AppContent: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [session, setSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const toast = useToast();
  const initRef = useRef(false);

  // --- Data State ---
  const [users, setUsers] = useState<User[]>([]);
  const [weeklyPlans, setWeeklyPlans] = useState<WeeklyPlanSubmission[]>([]);
  const [dailyPlans, setDailyPlans] = useState<DailyPlanSubmission[]>([]);

  // States for flow control
  const [editingPlan, setEditingPlan] = useState<WeeklyPlanSubmission | undefined>(undefined);
  const [targetWeekStart, setTargetWeekStart] = useState<string | undefined>(undefined);

  const refreshUserData = async (userId: string, email: string, name: string) => {
    try {
      const userProfile = await UserService.getOrCreateProfile(userId, email, name);
      setCurrentUser(userProfile);

      console.log(`[Auth] User data loaded: ${userId} (${userProfile.isManager ? 'Manager' : 'User'})`);

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
    } catch (e) {
      console.error("[Auth] Data refresh failed:", e);
      toast.error("資料載入失敗，請重新整理頁面。");
    } finally {
      setIsLoading(false);
    }
  };

  // --- Auth & Initialization ---
  useEffect(() => {
    let isMounted = true;

    // Handle initial session check and listener in one go
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log(`[Auth] Event: ${event}`);

      if (!isMounted) return;
      setSession(newSession);

      if (newSession?.user) {
        // Only refresh if we don't have a user or session changed
        const email = newSession.user.email || '';
        const name = newSession.user.user_metadata?.full_name || email.split('@')[0] || '使用者';
        await refreshUserData(newSession.user.id, email, name);
      } else {
        // No session
        if (event === 'SIGNED_OUT' || !newSession) {
          setCurrentUser(null);
          setIsLoading(false);
        }
      }
      initRef.current = true;
    });

    // Fallback: If no event fires for 3 seconds, check manually
    const timer = setTimeout(async () => {
      if (!initRef.current && isMounted) {
        console.log("[Auth] Fallback session check triggered");
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (isMounted && currentSession) {
          setSession(currentSession);
          const email = currentSession.user.email || '';
          const name = currentSession.user.user_metadata?.full_name || email.split('@')[0] || '使用者';
          await refreshUserData(currentSession.user.id, email, name);
        } else if (isMounted) {
          setIsLoading(false);
        }
      }
    }, 2500);

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  const handleAddOrUpdateWeeklyPlan = React.useCallback(async (plan: WeeklyPlanSubmission) => {
    try {
      const finalId = await PlanService.savePlan(plan, true);
      const finalizedPlan: WeeklyPlanSubmission = { ...plan, id: finalId };
      setEditingPlan(finalizedPlan);

      setWeeklyPlans(prev => {
        const index = prev.findIndex(p => p.id === plan.id || p.id === finalId);
        let newPlans: WeeklyPlanSubmission[];
        if (index >= 0) {
          newPlans = [...prev];
          newPlans[index] = finalizedPlan;
        } else {
          newPlans = [finalizedPlan, ...prev];
        }
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
      await PlanService.updateReviewData(
        plan.id,
        plan.status,
        plan.reviewComment || '',
        plan.lastWeekReview
      );

      setWeeklyPlans(prev => {
        const index = prev.findIndex(p => p.id === plan.id);
        if (index >= 0) {
          const newPlans = [...prev];
          newPlans[index] = {
            ...newPlans[index],
            status: plan.status,
            reviewComment: plan.reviewComment,
            lastWeekReview: plan.lastWeekReview,
            updatedAt: new Date().toISOString()
          };
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
    <React.Suspense fallback={
      <div className="min-h-screen flex items-center justify-center text-gray-400 bg-gray-50 flex-col gap-4">
        <Loader2 className="animate-spin text-blue-500 w-10 h-10" />
        <span className="font-bold tracking-widest text-sm">載入模組中...</span>
      </div>
    }>
      <Routes>
        <Route path="/" element={session ? <Navigate to="/dashboard" replace /> : <Login />} />
        <Route
          path="/dashboard"
          element={
            <RequireAuth
              session={session}
              currentUser={currentUser}
              isLoading={isLoading}
              onLogout={handleLogout}
            >
              <Dashboard
                user={currentUser!}
                onNavigate={(path) => navigate(`/${path}`)}
                onLogout={handleLogout}
              />
            </RequireAuth>
          }
        />
        <Route
          path="/weekly-plan"
          element={
            <RequireAuth
              session={session}
              currentUser={currentUser}
              isLoading={isLoading}
              onLogout={handleLogout}
            >
              <WeeklyPlanList
                user={currentUser!}
                plans={weeklyPlans.filter(p => p.userId === currentUser?.id)}
                onCreate={(weekStart) => {
                  setEditingPlan(undefined);
                  setTargetWeekStart(weekStart);
                  navigate('/weekly-plan/form');
                }}
                onEdit={(plan) => {
                  setEditingPlan(plan);
                  setTargetWeekStart(undefined);
                  navigate('/weekly-plan/form');
                }}
                onWithdraw={handleWithdrawPlan}
                onBack={() => navigate('/dashboard')}
              />
            </RequireAuth>
          }
        />
        <Route
          path="/weekly-plan/form"
          element={
            <RequireAuth
              session={session}
              currentUser={currentUser}
              isLoading={isLoading}
              onLogout={handleLogout}
            >
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
            <RequireAuth
              session={session}
              currentUser={currentUser}
              isLoading={isLoading}
              onLogout={handleLogout}
            >
              <DailyPlan
                user={currentUser!}
                onSubmit={handleAddDailyPlan}
                onBack={() => navigate('/dashboard')}
              />
            </RequireAuth>
          }
        />
        <Route
          path="/review"
          element={
            <RequireAuth
              session={session}
              currentUser={currentUser}
              isLoading={isLoading}
              onLogout={handleLogout}
            >
              {currentUser?.isManager || currentUser?.isAdmin ? (
                <Review
                  user={currentUser!}
                  users={users}
                  weeklyPlans={weeklyPlans}
                  onUpdatePlan={handleReviewUpdate}
                  onBack={() => navigate('/dashboard')}
                />
              ) : (
                <Navigate to="/dashboard" replace />
              )}
            </RequireAuth>
          }
        />
        <Route
          path="/admin"
          element={
            <RequireAuth
              session={session}
              currentUser={currentUser}
              isLoading={isLoading}
              onLogout={handleLogout}
            >
              <RequireAdmin currentUser={currentUser} isLoading={isLoading}>
                <Admin
                  users={users}
                  onSave={async (user) => {
                    const exists = users.find(u => u.id === user.id);
                    if (exists) {
                      await UserService.updateUser(user);
                    } else {
                      await UserService.createUser(user);
                    }
                    const updated = await UserService.fetchAllUsers();
                    setUsers(updated);
                  }}
                  onDelete={async (id) => {
                    await UserService.deleteUser(id);
                    const updated = await UserService.fetchAllUsers();
                    setUsers(updated);
                  }}
                  onResetData={async () => {
                    await PlanService.clearAllPlans();
                    await DailyPlanService.clearAllDailyPlans();
                    const updatedPlans = await PlanService.fetchAllPlans();
                    const updatedDaily = await DailyPlanService.fetchAllDailyPlans();
                    setWeeklyPlans(updatedPlans);
                    setDailyPlans(updatedDaily);
                  }}
                  onImportPlans={async (plans) => {
                    for (const plan of plans) {
                      await PlanService.savePlan(plan, true);
                    }
                    const updated = await PlanService.fetchAllPlans();
                    setWeeklyPlans(updated);
                  }}
                  onBack={() => navigate('/dashboard')}
                />
              </RequireAdmin>
            </RequireAuth>
          }
        />
        <Route
          path="/tracking"
          element={
            <RequireAuth
              session={session}
              currentUser={currentUser}
              isLoading={isLoading}
              onLogout={handleLogout}
            >
              <Tracking
                user={currentUser!}
                weeklyPlans={weeklyPlans.filter(p => p.userId === currentUser?.id)}
                dailyPlans={dailyPlans.filter(p => p.userId === currentUser?.id)}
                onBack={() => navigate('/dashboard')}
              />
            </RequireAuth>
          }
        />
        {/* Catch-all route to redirect back to dashboard */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </React.Suspense>
  );
};

const WrappedAppContent = () => {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <WrappedAppContent />
    </BrowserRouter>
  );
};

export default App;