import { Navigate, Route, Routes } from 'react-router-dom';

import { AuthBootstrap } from '@/components/auth/AuthBootstrap';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { GuestGuard } from '@/components/auth/GuestGuard';

import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { OAuthCallbackPage } from '@/pages/auth/OAuthCallbackPage';

import { WorkspacePickerPage } from '@/pages/workspaces/WorkspacePickerPage';
import { WorkspaceLayout } from '@/pages/workspaces/WorkspaceLayout';
import { WorkspaceHome } from '@/pages/workspaces/WorkspaceHome';
import { WorkspaceMembersPage } from '@/pages/workspaces/WorkspaceMembersPage';
import { WorkspaceSettingsPage } from '@/pages/workspaces/WorkspaceSettingsPage';

import { ProjectListPage } from '@/pages/projects/ProjectListPage';
import { CreateProjectPage } from '@/pages/projects/CreateProjectPage';
import { ProjectLayout } from '@/pages/projects/ProjectLayout';
import { ProjectMembersPage } from '@/pages/projects/ProjectMembersPage';
import { ProjectSettingsPage } from '@/pages/projects/ProjectSettingsPage';
import { ProjectChannelsPage } from '@/pages/projects/ProjectChannelsPage';
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

import { Placeholder } from '@/pages/Placeholder';

/**
 * Route table.
 *
 * The `/w/:slug/...` shape is not a free choice — the backend's
 * `GET /notifications/:id/resolve` hands back fully-formed deep links in
 * exactly this form (backend/src/modules/notifications/notifications.controller.ts).
 *
 * Routes rendering `<Placeholder />` are stubs so navigation never dead-ends;
 * each is replaced as its slice lands.
 */
export default function App() {
  return (
    <AuthBootstrap>
      <Routes>
        {/* Guest-only */}
        <Route element={<GuestGuard />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        {/* Public */}
        <Route path="/auth/callback" element={<OAuthCallbackPage />} />

        {/* Authenticated */}
        <Route element={<AuthGuard />}>
          <Route path="/" element={<Navigate to="/workspaces" replace />} />
          <Route path="/workspaces" element={<WorkspacePickerPage />} />
          <Route
            path="/invite/:inviteToken"
            element={<Placeholder title="Accept invitation" slice="a later slice" />}
          />

          <Route path="/w/:slug" element={<WorkspaceLayout />}>
            <Route index element={<WorkspaceHome />} />
            <Route path="members" element={<WorkspaceMembersPage />} />
            <Route path="settings" element={<WorkspaceSettingsPage />} />
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
              <Route path="members" element={<ProjectMembersPage />} />
              <Route path="settings" element={<ProjectSettingsPage />} />
              <Route path="github" element={<GitHubIntegration />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/workspaces" replace />} />
      </Routes>
    </AuthBootstrap>
  );
}
