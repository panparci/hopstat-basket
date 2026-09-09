/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { SignUpPage } from './pages/SignUpPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { LandingPage } from './pages/LandingPage';
import { HomePage } from './pages/HomePage';
import { RoleBasedDashboard } from './components/RoleBasedDashboard';
import { GamesPage } from './pages/GamesPage';
import { PlayersPage } from './pages/PlayersPage';
import { StatsPage } from './pages/StatsPage';
import { TeamsPage } from './pages/TeamsPage';
import { TrackingPage } from './pages/TrackingPage';
import { MatchDetailsPage } from './pages/MatchDetailsPage';
import { ProfilesPage } from './pages/ProfilesPage';
import { GalleryPage } from './pages/GalleryPage';
import { PlayerProfilePage } from './pages/PlayerProfilePage';
import { AdminDashboard } from './modules/admin/pages/AdminDashboard';
import { PromptFlowEditor } from './modules/admin/pages/PromptFlowEditor';
import { CrmPage } from './pages/admin/CrmPage';
import { CmsPage } from './pages/admin/CmsPage';
import { AdminLayout } from './widgets/admin-layout/AdminLayout';
import { AppShellLayout } from './widgets/app-shell/AppShell';
import { RolePermissionsPage } from './pages/admin/RolePermissionsPage';
import { UserManagementPage } from './pages/admin/UserManagementPage';
import { ApplicationsPage } from './pages/admin/ApplicationsPage';
import { ClaimReviewPage } from './pages/admin/ClaimReviewPage';
import { AthletesPage } from './pages/admin/AthletesPage';
import { AdminGamesPage } from './pages/admin/GamesPage';
import { CurationsPage } from './pages/admin/CurationsPage';
import AICoachPage from './pages/AICoachPage';
import { RequestStatsPage } from './pages/services/RequestStatsPage';
import { AdminStatRequestsPage } from './pages/services/AdminStatRequestsPage';
import { StatTasksPage } from './pages/services/StatTasksPage';
import { ClaimAthletePage } from './pages/ClaimAthletePage';
import { ClaimStatusPage } from './pages/ClaimStatusPage';
import { QAReviewPage } from './pages/QAReviewPage';
import { CoachAnalysisPage } from './pages/CoachAnalysisPage';
import { MatchStoryPage } from './pages/MatchStoryPage';
import { ApplyRolePage } from './pages/ApplyRolePage';
import { WorkspacePage } from './pages/WorkspacePage';
import { FundamentalsPage } from './pages/FundamentalsPage';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { PermissionsProvider, usePermissions } from './core/contexts/PermissionsContext';
import { RequirePermission } from './components/auth/RequirePermission';
import { useTheme } from './core/hooks/useTheme';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { authService } from './services/authService';
import { useEffect } from 'react';
import { ToastProvider, useToast } from './core/contexts/ToastContext';
import { claimService } from './services/claimService';

const AdaptiveAppShellLayout = () => {
  const { can } = usePermissions();
  if (can('manage_users')) {
    return <AdminLayout />;
  }
  return <AppShellLayout />;
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
    <Routes>
      <Route path="/welcome" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignUpPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />

      {/* Consumer Protected Routes with Centralized Adaptive AppShell */}
      <Route element={
        <ProtectedRoute>
          <AdaptiveAppShellLayout />
        </ProtectedRoute>
      }>
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
