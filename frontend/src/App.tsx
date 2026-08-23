import { Navigate, Route, Routes } from 'react-router-dom';

import { AuthBootstrap } from '@/components/auth/AuthBootstrap';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { GuestGuard } from '@/components/auth/GuestGuard';

import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { OAuthCallbackPage } from '@/pages/auth/OAuthCallbackPage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage';
import { VerifyEmailPage } from '@/pages/auth/VerifyEmailPage';
import { InviteLandingPage } from '@/pages/auth/InviteLandingPage';

import { LandingPage } from '@/pages/LandingPage';
import { AccountSettingsPage } from '@/pages/account/AccountSettingsPage';

import { WorkspacePickerPage } from '@/pages/workspaces/WorkspacePickerPage';
import { WorkspaceLayout } from '@/pages/workspaces/WorkspaceLayout';
import { WorkspaceHome } from '@/pages/workspaces/WorkspaceHome';
import { WorkspaceMembersPage } from '@/pages/workspaces/WorkspaceMembersPage';
import { WorkspaceSettingsPage } from '@/pages/workspaces/WorkspaceSettingsPage';
import { WorkspaceActivityPage } from '@/pages/workspaces/WorkspaceActivityPage';

import { ProjectListPage } from '@/pages/projects/ProjectListPage';
import { CreateProjectPage } from '@/pages/projects/CreateProjectPage';
import { ProjectLayout } from '@/pages/projects/ProjectLayout';
import { ProjectMembersPage } from '@/pages/projects/ProjectMembersPage';
import { ProjectSettingsPage } from '@/pages/projects/ProjectSettingsPage';
import { ProjectChannelsPage } from '@/pages/projects/ProjectChannelsPage';
import { ProjectLabelsPage } from '@/pages/projects/ProjectLabelsPage';
import { GitHubIntegration } from '@/pages/projects/GitHubIntegration';
import { BoardPage } from '@/pages/projects/BoardPage';
import { BacklogPage } from '@/pages/projects/BacklogPage';
import { TaskDetailPage } from '@/pages/projects/TaskDetailPage';
import { SprintListPage } from '@/pages/projects/SprintListPage';
import { ActiveSprintBoard } from '@/pages/projects/ActiveSprintBoard';

import { ChannelPage } from '@/pages/channels/ChannelPage';
import { ChannelListPage } from '@/pages/channels/ChannelListPage';
import { NotificationsInbox } from '@/pages/NotificationsInbox';
import { GlobalSearchResults } from '@/pages/GlobalSearchResults';

/**
 * Route table.
 *
 * The `/w/:slug/...` shape is not a free choice — the backend's
 * `GET /notifications/:id/resolve` hands back fully-formed deep links in
 * exactly this form (backend/src/modules/notifications/notifications.controller.ts).
 * Neither are `/reset-password` and `/verify-email`, which the email service
 * hard-codes against `FRONTEND_URL`.
 */
export default function App() {
  return (
    <AuthBootstrap>
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
            <Route path="members" element={<WorkspaceMembersPage />} />
            <Route path="settings" element={<WorkspaceSettingsPage />} />
            <Route path="activity" element={<WorkspaceActivityPage />} />
            <Route path="notifications" element={<NotificationsInbox />} />
            <Route path="search" element={<GlobalSearchResults />} />
            <Route path="channels" element={<ChannelListPage />} />
            <Route path="channels/:channelId" element={<ChannelPage />} />

            <Route path="projects" element={<ProjectListPage />} />
            <Route path="projects/new" element={<CreateProjectPage />} />

            <Route path="projects/:key" element={<ProjectLayout />}>
              <Route index element={<BoardPage />} />
              <Route path="backlog" element={<BacklogPage />} />
              <Route path="tasks/:taskKey" element={<TaskDetailPage />} />
              <Route path="sprints" element={<SprintListPage />} />
              <Route path="sprints/active" element={<ActiveSprintBoard />} />
              <Route path="sprints/:sprintId" element={<ActiveSprintBoard />} />
              <Route path="channels" element={<ProjectChannelsPage />} />
              <Route path="labels" element={<ProjectLabelsPage />} />
              <Route path="members" element={<ProjectMembersPage />} />
              <Route path="settings" element={<ProjectSettingsPage />} />
              <Route path="github" element={<GitHubIntegration />} />
            </Route>
          </Route>
        </Route>

        {/* `/` sorts it out from there: the picker when signed in, the landing
            page when not — so an unknown path never bounces through a guard. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthBootstrap>
  );
}
