import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { AuthBootstrap } from '@/components/auth/AuthBootstrap';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { GuestGuard } from '@/components/auth/GuestGuard';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { RouteFallback } from '@/components/RouteFallback';

// Eager: the three entry points. Route-splitting these would only add a network
// round trip to the very first paint, which is the one that has no cache to
// draw on.
import { LandingPage } from '@/pages/LandingPage';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';

/**
 * Every page below is code-split.
 *
 * The whole app used to compile to a single 2.7 MB chunk, so a first-time
 * visitor downloaded the Kanban board, the gantt chart, the Tiptap editor, the
 * calendar and Recharts before the login form could paint. These are named
 * exports, and `React.lazy` resolves a module's `default`, hence the unwrap.
 */
const page = <T extends Record<string, unknown>, K extends keyof T>(
  loader: () => Promise<T>,
  name: K
) => lazy(() => loader().then((m) => ({ default: m[name] as React.ComponentType })));

const OAuthCallbackPage = page(() => import('@/pages/auth/OAuthCallbackPage'), 'OAuthCallbackPage');
const ForgotPasswordPage = page(() => import('@/pages/auth/ForgotPasswordPage'), 'ForgotPasswordPage');
const ResetPasswordPage = page(() => import('@/pages/auth/ResetPasswordPage'), 'ResetPasswordPage');
const VerifyEmailPage = page(() => import('@/pages/auth/VerifyEmailPage'), 'VerifyEmailPage');
const InviteLandingPage = page(() => import('@/pages/auth/InviteLandingPage'), 'InviteLandingPage');

const AccountSettingsPage = page(() => import('@/pages/account/AccountSettingsPage'), 'AccountSettingsPage');

const WorkspacePickerPage = page(() => import('@/pages/workspaces/WorkspacePickerPage'), 'WorkspacePickerPage');
const WorkspaceLayout = page(() => import('@/pages/workspaces/WorkspaceLayout'), 'WorkspaceLayout');
const WorkspaceHome = page(() => import('@/pages/workspaces/WorkspaceHome'), 'WorkspaceHome');
const WorkspaceMembersPage = page(() => import('@/pages/workspaces/WorkspaceMembersPage'), 'WorkspaceMembersPage');
const WorkspaceSettingsPage = page(() => import('@/pages/workspaces/WorkspaceSettingsPage'), 'WorkspaceSettingsPage');
const MyTasksPage = page(() => import('@/pages/workspaces/MyTasksPage'), 'MyTasksPage');
const WorkspaceActivityPage = page(() => import('@/pages/workspaces/WorkspaceActivityPage'), 'WorkspaceActivityPage');

const ProjectListPage = page(() => import('@/pages/projects/ProjectListPage'), 'ProjectListPage');
const CreateProjectPage = page(() => import('@/pages/projects/CreateProjectPage'), 'CreateProjectPage');
const ProjectLayout = page(() => import('@/pages/projects/ProjectLayout'), 'ProjectLayout');
const ProjectMembersPage = page(() => import('@/pages/projects/ProjectMembersPage'), 'ProjectMembersPage');
const ProjectSettingsPage = page(() => import('@/pages/projects/ProjectSettingsPage'), 'ProjectSettingsPage');
const ProjectLabelsPage = page(() => import('@/pages/projects/ProjectLabelsPage'), 'ProjectLabelsPage');
const GitHubIntegration = page(() => import('@/pages/projects/GitHubIntegration'), 'GitHubIntegration');
const BoardPage = page(() => import('@/pages/projects/BoardPage'), 'BoardPage');
const BacklogPage = page(() => import('@/pages/projects/BacklogPage'), 'BacklogPage');
const TaskDetailPage = page(() => import('@/pages/projects/TaskDetailPage'), 'TaskDetailPage');
const SprintListPage = page(() => import('@/pages/projects/SprintListPage'), 'SprintListPage');
const ActiveSprintBoard = page(() => import('@/pages/projects/ActiveSprintBoard'), 'ActiveSprintBoard');

const ChannelPage = page(() => import('@/pages/channels/ChannelPage'), 'ChannelPage');
const ChannelListPage = page(() => import('@/pages/channels/ChannelListPage'), 'ChannelListPage');
const NotificationsInbox = page(() => import('@/pages/NotificationsInbox'), 'NotificationsInbox');
const GlobalSearchResults = page(() => import('@/pages/GlobalSearchResults'), 'GlobalSearchResults');
const AnalyticsPage = page(() => import('@/pages/AnalyticsPage'), 'AnalyticsPage');

/**
 * Route table.
 *
 * The `/w/:slug/...` shape is not a free choice — the backend's
 * `GET /notifications/:id/resolve` hands back fully-formed deep links in
 * exactly this form (backend/src/modules/notifications/notifications.controller.ts).
 * Neither are `/reset-password` and `/verify-email`, which the email service
 * hard-codes against `FRONTEND_URL`.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthBootstrap>
        {/*
          One boundary inside the router rather than around it, so the fallback
          renders in place and the URL survives — the user can still navigate away
          from a page that failed instead of being stranded on a blank document.
        */}
        <ErrorBoundary label="route">
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            {/* Guest-only */}
            <Route element={<GuestGuard />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            </Route>

            {/*
              Public. `/reset-password` and `/verify-email` are the exact paths the
              backend's email service builds (`${FRONTEND_URL}/reset-password?token=…`),
              and both must stay reachable while signed in: a reset revokes every
              session, and a verification link is commonly opened in the same browser
              that just registered.
            */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/auth/callback" element={<OAuthCallbackPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/invite/:inviteToken" element={<InviteLandingPage />} />

            {/* Authenticated */}
            <Route element={<AuthGuard />}>
              <Route path="/workspaces" element={<WorkspacePickerPage />} />
              <Route path="/account" element={<AccountSettingsPage />} />

              <Route path="/w/:slug" element={<WorkspaceLayout />}>
                <Route index element={<WorkspaceHome />} />
                <Route path="my-tasks" element={<MyTasksPage />} />
                <Route path="members" element={<WorkspaceMembersPage />} />
                <Route path="settings" element={<WorkspaceSettingsPage />} />
                <Route path="activity" element={<WorkspaceActivityPage />} />
                <Route path="notifications" element={<NotificationsInbox />} />
                <Route path="search" element={<GlobalSearchResults />} />
                <Route path="analytics" element={<AnalyticsPage />} />
                <Route path="channels" element={<ChannelListPage />} />
                <Route path="channels/:channelId" element={<ChannelPage />} />

                <Route path="projects" element={<ProjectListPage />} />
                <Route path="projects/new" element={<CreateProjectPage />} />

                <Route path="projects/:key" element={<ProjectLayout />}>
                  <Route index element={<BoardPage />} />
                  <Route path="backlog" element={<BacklogPage />} />
                  <Route path="tasks/:taskKey" element={<TaskDetailPage />} />
                  <Route path="sprints" element={<SprintListPage />} />
                  <Route path="sprints/:sprintId" element={<ActiveSprintBoard />} />
                  <Route path="labels" element={<ProjectLabelsPage />} />
                  <Route path="members" element={<ProjectMembersPage />} />
                  <Route path="settings" element={<ProjectSettingsPage />} />
                  <Route path="github" element={<GitHubIntegration />} />
                  <Route path="analytics" element={<AnalyticsPage />} />
                </Route>
              </Route>
            </Route>

            {/* `/` sorts it out from there: the picker when signed in, the landing
                page when not — so an unknown path never bounces through a guard. */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </AuthBootstrap>
    </QueryClientProvider>
  );
}
