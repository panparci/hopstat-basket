/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AdminLayout } from './widgets/admin-layout/AdminLayout';
import { AppShellLayout } from './widgets/app-shell/AppShell';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { PermissionsProvider, usePermissions } from './core/contexts/PermissionsContext';
import { RequirePermission } from './components/auth/RequirePermission';
import { useTheme } from './core/hooks/useTheme';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { authService } from './services/authService';
import { lazy, Suspense, useEffect } from 'react';

const LoginPage = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
const SignUpPage = lazy(() => import('./pages/SignUpPage').then(m => ({ default: m.SignUpPage })));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage').then(m => ({ default: m.ForgotPasswordPage })));
const LandingPage = lazy(() => import('./pages/LandingPage').then(m => ({ default: m.LandingPage })));
const RoleBasedDashboard = lazy(() => import('./components/RoleBasedDashboard').then(m => ({ default: m.RoleBasedDashboard })));
const GamesPage = lazy(() => import('./pages/GamesPage').then(m => ({ default: m.GamesPage })));
const StatsPage = lazy(() => import('./pages/StatsPage').then(m => ({ default: m.StatsPage })));
const TrackingPage = lazy(() => import('./pages/TrackingPage').then(m => ({ default: m.TrackingPage })));
const MatchDetailsPage = lazy(() => import('./pages/MatchDetailsPage').then(m => ({ default: m.MatchDetailsPage })));
const ProfilesPage = lazy(() => import('./pages/ProfilesPage').then(m => ({ default: m.ProfilesPage })));
const GalleryPage = lazy(() => import('./pages/GalleryPage').then(m => ({ default: m.GalleryPage })));
const PlayerProfilePage = lazy(() => import('./pages/PlayerProfilePage').then(m => ({ default: m.PlayerProfilePage })));
const AdminDashboard = lazy(() => import('./modules/admin/pages/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const PromptFlowEditor = lazy(() => import('./modules/admin/pages/PromptFlowEditor').then(m => ({ default: m.PromptFlowEditor })));
const CrmPage = lazy(() => import('./pages/admin/CrmPage').then(m => ({ default: m.CrmPage })));
const CmsPage = lazy(() => import('./pages/admin/CmsPage').then(m => ({ default: m.CmsPage })));
const RolePermissionsPage = lazy(() => import('./pages/admin/RolePermissionsPage').then(m => ({ default: m.RolePermissionsPage })));
const UserManagementPage = lazy(() => import('./pages/admin/UserManagementPage').then(m => ({ default: m.UserManagementPage })));
const ApplicationsPage = lazy(() => import('./pages/admin/ApplicationsPage').then(m => ({ default: m.ApplicationsPage })));
const ClaimReviewPage = lazy(() => import('./pages/admin/ClaimReviewPage').then(m => ({ default: m.ClaimReviewPage })));
const AthletesPage = lazy(() => import('./pages/admin/AthletesPage').then(m => ({ default: m.AthletesPage })));
const AdminGamesPage = lazy(() => import('./pages/admin/GamesPage').then(m => ({ default: m.AdminGamesPage })));
const CurationsPage = lazy(() => import('./pages/admin/CurationsPage').then(m => ({ default: m.CurationsPage })));
const RequestStatsPage = lazy(() => import('./pages/services/RequestStatsPage').then(m => ({ default: m.RequestStatsPage })));
const AdminStatRequestsPage = lazy(() => import('./pages/services/AdminStatRequestsPage').then(m => ({ default: m.AdminStatRequestsPage })));
const StatTasksPage = lazy(() => import('./pages/services/StatTasksPage').then(m => ({ default: m.StatTasksPage })));
const QAReviewPage = lazy(() => import('./pages/QAReviewPage').then(m => ({ default: m.QAReviewPage })));
const CoachAnalysisPage = lazy(() => import('./pages/CoachAnalysisPage').then(m => ({ default: m.CoachAnalysisPage })));
const MatchStoryPage = lazy(() => import('./pages/MatchStoryPage').then(m => ({ default: m.MatchStoryPage })));
const ApplyRolePage = lazy(() => import('./pages/ApplyRolePage').then(m => ({ default: m.ApplyRolePage })));
const WorkspacePage = lazy(() => import('./pages/WorkspacePage').then(m => ({ default: m.WorkspacePage })));
const FundamentalsPage = lazy(() => import('./pages/FundamentalsPage').then(m => ({ default: m.FundamentalsPage })));

const PageSpinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
    <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
  </div>
);
import { ToastProvider, useToast } from './core/contexts/ToastContext';
import { claimService } from './services/claimService';

const AdaptiveAppShellLayout = () => {
  const { can } = usePermissions();
  if (can('manage_users')) {
    return <AdminLayout />;
  }
  return <AppShellLayout />;
};

const GuestOrShell = () => {
  const loc = useLocation();
  const { user: session, loading } = usePermissions();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!session) {
    if (loc.pathname !== '/') return <Navigate to="/" replace />;
    return <LandingPage />;
  }

  if (session.status === 'suspended') {
    void authService.logout();
    return <Navigate to="/login?error=suspended" replace />;
  }

  return <AdaptiveAppShellLayout />;
};

const AppContent = () => {

  useTheme(); // Initialize theme globally
  const { showToast } = useToast();
  
  useEffect(() => {
    const checkClaimNotifications = async () => {
      try {
        const activeUser = await authService.getCurrentUser();
        if (!activeUser) return;

        const userClaims = await claimService.getClaims();
        const myClaims = userClaims.filter(c => c.claimantAccountId === activeUser.id);
        
        myClaims.forEach(claim => {
          const lastSeenStr = localStorage.getItem(`claim_seen_${claim.id}`);
          if (lastSeenStr) {
            const lastSeen = parseInt(lastSeenStr, 10);
            if (claim.updatedAt > lastSeen) {
              if (claim.status !== 'pending') {
                const statusLabel = claim.status === 'approved' ? 'disetujui' : 'ditolak';
                
                // In production, sending real emails/push notifications requires backend (e.g. Supabase triggers or OneSignal)
                showToast(`Klaim untuk ${claim.childData.name} telah ${statusLabel}`, claim.status === 'approved' ? 'success' : 'error');
                
                // Update local seen state so we don't spam on every page/route change
                localStorage.setItem(`claim_seen_${claim.id}`, claim.updatedAt.toString());
              }
            }
          } else {
            // First time loading - register the state so we only notify future transitions
            localStorage.setItem(`claim_seen_${claim.id}`, claim.updatedAt.toString());
          }
        });
      } catch (err) {
        console.error('Error checking claim notifications:', err);
      }
    };

    checkClaimNotifications();
  }, [showToast]);

  return (
    <Suspense fallback={<PageSpinner />}>
    <Routes>
      <Route path="/welcome" element={<Navigate to="/" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignUpPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />

      {/* `/` is landing for guests, dashboard for signed-in users */}
      <Route element={<GuestOrShell />}>
        <Route path="/" element={
          <RequirePermission permission="view_home">
            <RoleBasedDashboard />
          </RequirePermission>
        } />
        <Route path="/games" element={
          <RequirePermission permission="view_matches">
            <GamesPage />
          </RequirePermission>
        } />
        <Route path="/players" element={<Navigate to="/profiles" replace />} />
        <Route path="/teams" element={<Navigate to="/profiles?tab=teams" replace />} />
        <Route path="/stats" element={
          <RequirePermission permission="view_own_stats">
            <StatsPage />
          </RequirePermission>
        } />
        <Route path="/profiles" element={
          <RequirePermission permission="manage_profiles">
            <ProfilesPage />
          </RequirePermission>
        } />
        <Route path="/gallery" element={
          <RequirePermission permission="view_gallery">
            <GalleryPage />
          </RequirePermission>
        } />
        <Route path="/gallery/:profileId" element={
          <RequirePermission permission="view_gallery">
            <PlayerProfilePage />
          </RequirePermission>
        } />
        <Route path="/match/:gameId" element={
          <RequirePermission permission="view_matches">
            <MatchDetailsPage />
          </RequirePermission>
        } />
        <Route path="/story/:matchId" element={
          <RequirePermission permission="view_published_story">
            <MatchStoryPage />
          </RequirePermission>
        } />
        <Route path="/qa/:matchId" element={
          <RequirePermission permission="do_qa_review">
            <QAReviewPage />
          </RequirePermission>
        } />
        <Route path="/coach-analysis/:matchId" element={
          <RequirePermission permission="do_coach_analysis">
            <CoachAnalysisPage />
          </RequirePermission>
        } />
        <Route path="/coach" element={<Navigate to="/stats?tab=aicoach" replace />} />
        <Route path="/services" element={
          <RequirePermission permission="request_stats">
            <RequestStatsPage />
          </RequirePermission>
        } />
        <Route path="/claim" element={<Navigate to="/profiles?tab=claim" replace />} />
        <Route path="/claim/status" element={<Navigate to="/profiles?tab=claim" replace />} />
        <Route path="/account/apply" element={
          <RequirePermission permission="view_home">
            <ApplyRolePage />
          </RequirePermission>
        } />
        <Route path="/workspace" element={
          <WorkspacePage />
        } />
        <Route path="/fundamentals" element={
          <FundamentalsPage />
        } />
      </Route>

      {/* Admin and Services Layout Wrap */}
      <Route element={
        <ProtectedRoute>
          <AdminLayout />
        </ProtectedRoute>
      }>
        <Route path="/admin" element={
          <RequirePermission permission="manage_users">
            <AdminDashboard />
          </RequirePermission>
        } />
        <Route path="/admin/crm" element={
          <RequirePermission permission="manage_crm">
            <CrmPage />
          </RequirePermission>
        } />
        <Route path="/admin/cms" element={
          <RequirePermission permission="manage_cms">
            <CmsPage />
          </RequirePermission>
        } />
        <Route path="/admin/prompt-editor" element={
          <RequirePermission permission="manage_roles_config">
            <PromptFlowEditor />
          </RequirePermission>
        } />
        <Route path="/admin/rbac" element={
          <RequirePermission permission="manage_roles_config">
            <Navigate to="/admin/roles" replace />
          </RequirePermission>
        } />
        <Route path="/admin/roles" element={
          <RequirePermission permission="manage_roles_config">
            <RolePermissionsPage />
          </RequirePermission>
        } />
        <Route path="/admin/users" element={
          <RequirePermission permission="manage_users">
            <UserManagementPage />
          </RequirePermission>
        } />
        <Route path="/admin/applications" element={
          <RequirePermission permission="approve_applications">
            <ApplicationsPage />
          </RequirePermission>
        } />
        <Route path="/admin/claims" element={
          <RequirePermission permission="approve_applications">
            <ClaimReviewPage />
          </RequirePermission>
        } />
        <Route path="/admin/athletes" element={
          <RequirePermission permission="manage_athletes">
            <AthletesPage />
          </RequirePermission>
        } />
        <Route path="/admin/games" element={
          <RequirePermission permission="manage_athletes">
            <AdminGamesPage />
          </RequirePermission>
        } />
        <Route path="/admin/curations" element={
          <RequirePermission permission="approve_applications">
            <CurationsPage />
          </RequirePermission>
        } />
        <Route path="/services/admin" element={
          <RequirePermission permission="approve_applications">
            <AdminStatRequestsPage />
          </RequirePermission>
        } />
        <Route path="/services/tasks" element={
          <RequirePermission permission="do_stat_tasks">
            <StatTasksPage />
          </RequirePermission>
        } />
      </Route>

      {/* Special Tracking Route (Full-Screen) */}
      <Route path="/track/:gameId" element={
        <ProtectedRoute>
          <RequirePermission permission="track_match">
            <TrackingPage />
          </RequirePermission>
        </ProtectedRoute>
      } />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <PermissionsProvider>
          <BrowserRouter>
            <AppContent />
          </BrowserRouter>
        </PermissionsProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
