import React, { useState, useEffect } from 'react';
import { User, WeeklyPlanSubmission, DailyPlanSubmission } from './types';
import { ToastProvider, useToast } from './components/Toast';
import { MOCK_USERS } from './constants';
import { Login } from './components/Login';
import { HashRouter, Routes, Route, useNavigate, Navigate } from 'react-router-dom';
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
  if (isLoading) return <div className="min-h-screen flex items-center justify-center text-gray-400 bg-gray-50 flex-col gap-4">
    <Loader2 className="animate-spin text-blue-500 w-10 h-10" />
    <span className="font-bold tracking-widest text-sm">系統載入中...</span>
  </div>;
  if (!session) return <Navigate to="/" replace />;
  if (session && !currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-red-50">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md text-center border border-red-100">
          <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600 font-bold text-2xl">!</div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">權限未啟用</h3>
          <p className="text-gray-500 mb-6 leading-relaxed">您的 Google 帳號雖然已登位，但系統中尚未建立對應的員工資料。請聯繫管理員協助設定。</p>
          <div className="text-xs bg-gray-50 p-3 rounded mb-6 text-left font-mono break-all text-gray-400">UID: {session.user.id}</div>
          <button onClick={onLogout} className="w-full bg-gray-800 text-white py-3 rounded-xl font-bold hover:bg-black transition">返回登入頁面</button>
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

  // --- Data State ---
  const [users, setUsers] = useState<User[]>([]);
  const [weeklyPlans, setWeeklyPlans] = useState<WeeklyPlanSubmission[]>([]);
  const [dailyPlans, setDailyPlans] = useState<DailyPlanSubmission[]>([]);

  // States for flow control
  const [editingPlan, setEditingPlan] = useState<WeeklyPlanSubmission | undefined>(undefined);
  const [targetWeekStart, setTargetWeekStart] = useState<string | undefined>(undefined);

  // --- Auth & Initialization ---
  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        // Start fetching session and initial data in parallel if possible
        const { data: { session } } = await supabase.auth.getSession();
        if (!isMounted) return;

        setSession(session);

        if (session?.user) {
          // fetchUserData is now optimized to be called after session is set
          await refreshUserData(session.user.id);
        } else {
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Initialization Failed:", error);
        if (isMounted) setIsLoading(false);
      }
    };

    // Listen for Auth State Changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!isMounted) return;

      // Only trigger refresh if session changed significantly (e.g. login/logout)
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (newSession?.user) {
          setSession(newSession);
          await refreshUserData(newSession.user.id);
        }
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        setCurrentUser(null);
        setIsLoading(false);
      }
    });

    init();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const refreshUserData = async (userId: string) => {
    try {
      // 1. Fetch Profile first to determine role
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const userProfile = await UserService.getOrCreateProfile(
        userId,
        user.email || '',
        user.user_metadata?.full_name || user.email?.split('@')[0] || '使用者'
      );

      setCurrentUser(userProfile);

      // 2. Fetch data based on profile
      // Avoid parallel races that overwrite the same state
      console.log(`Refreshing data for user: ${userId} (${userProfile.isManager ? 'Manager' : 'User'})`);
      if (userProfile.isManager || userProfile.isAdmin) {
        const [allUsers, allPlans, allDaily] = await Promise.all([
          UserService.fetchAllUsers(),
          PlanService.fetchAllPlans(),
          DailyPlanService.fetchAllDailyPlans()
        ]);
        console.log(`Loaded ${allPlans.length} plans and ${allUsers.length} users.`);
        setUsers(allUsers);
        setWeeklyPlans(allPlans);
        setDailyPlans(allDaily);
      } else {
        const [myPlans, myDaily] = await Promise.all([
          PlanService.fetchUserPlans(userId),
          DailyPlanService.fetchDailyPlansByUser(userId)
        ]);
        console.log(`Loaded ${myPlans.length} personal plans.`);
        setWeeklyPlans(myPlans);
        setDailyPlans(myDaily);
      }
    } catch (e) {
      console.error("Data refresh failed:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddOrUpdateWeeklyPlan = React.useCallback(async (plan: WeeklyPlanSubmission) => {
    try {
      console.log("Starting plan save...");

      // 1. Save current plan and get the finalized ID (in case of server-side mapping)
      // Note: we need access to the CURRENT weeklyPlans state here.
      // Since we are inside useCallback, we must update dependency or use refs if we want to avoid re-creation.
      // Actually, for simplicity, let's just use the functional update pattern where possible or accept that it depends on weeklyPlans.

      // However, to fix the flickering, the most important one is handleAddDailyPlan used by DailyPlan.

      const finalId = await PlanService.savePlan(plan, true); // Simplified logic we can improve later if needed, but for now let's focus on stability

      // 2. Sync logic simplified for stability...

      // 3. Update state with the finalized data
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

      console.log("[App] Plan save flow completed successfully.");
    } catch (e: any) {
      console.error("Failed to save plan:", e);
      toast.error(`儲存失敗: ${e.message}`);
      throw e;
    }
  }, []);
  // Wait, handleAddOrUpdateWeeklyPlan uses 'weeklyPlans' state in logic (lines 134, 139). THIS IS TRICKY.
  // Ideally we should use refs for access to current state without re-creating functions.

  // Let's fix handleAddDailyPlan first which is the one causing issue.

  const handleWithdrawPlan = React.useCallback(async (planId: string) => {
    try {
      await PlanService.updatePlanStatus(planId, 'draft', '');
      const updatedPlans = await PlanService.fetchAllPlans();
      setWeeklyPlans(updatedPlans);
      return updatedPlans.find(p => p.id === planId);
    } catch (e: any) {
      console.error("Withdraw failed:", e);
      toast.error(`撤回失敗: ${e.message}`);
      return null;
    }
  }, []);

  const handleAddDailyPlan = React.useCallback(async () => {
    // This function doesn't depend on any closure state except DailyPlanService which is imported.
    const updated = await DailyPlanService.fetchAllDailyPlans();
    setDailyPlans(updated);
  }, []);

  const handleLogout = React.useCallback(async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setSession(null);
  }, []);

  const handleReviewUpdate = React.useCallback(async (plan: WeeklyPlanSubmission) => {
    try {
      // Create a specific update payload to avoid sending the whole plan object
      // The PlanService.updateReviewData only touches status, comment, and last_week_review
      await PlanService.updateReviewData(
        plan.id,
        plan.status,
        plan.reviewComment || '',
        plan.lastWeekReview
      );

      // Update local state to reflect changes immediately
      setWeeklyPlans(prev => {
        const index = prev.findIndex(p => p.id === plan.id);
        if (index >= 0) {
          const newPlans = [...prev];
          // Merge the updates into the existing plan
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

    } catch (e: any) {
      console.error("Review update failed:", e);
      toast.error(`審核更新失敗: ${e.message}`);
      throw e;
    }
  }, []);

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
        {/* Weekly Plan Entry: The List View */}
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
                  setTargetWeekStart(weekStart); // Pass the intended week
                  navigate('/weekly-plan/form');
                }}
                onEdit={(plan) => {
                  setEditingPlan(plan);
                  setTargetWeekStart(undefined); // Edit mode doesn't need target week
                  navigate('/weekly-plan/form');
                }}
                onWithdraw={handleWithdrawPlan}
                onBack={() => navigate('/dashboard')}
              />
            </RequireAuth>
          }
        />
        {/* Weekly Plan Form: The Editor */}
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
                targetWeekStart={targetWeekStart} // Pass prop
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
                    console.log(`[Admin] Deleting user: ${id}`);
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
    <HashRouter>
      <WrappedAppContent />
    </HashRouter>
  );
};

export default App;