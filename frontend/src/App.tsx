import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthGuard, GuestGuard } from './components/auth/AuthGuard.js';
import { ToastProvider } from './components/providers/ToastProvider.js';
import {
  LandingPage,
  LoginPage,
  RegisterPage,
  OAuthCallbackPage,
  GithubCallbackPage,
  WorkspaceList,
  InviteAcceptancePage,
  ForgotPasswordPage,
  ResetPasswordPage,
  VerifyEmailPage,
  AccountSettingsPage,
  WorkspaceLayout,
  WorkspaceHome,
  WorkspaceMembers,
  WorkspaceSettings,
  WorkspaceAuditLogs,
  ChannelPage,
  ProjectList,
  CreateProjectPage,
  ProjectLayout,
  BoardPage,
  BacklogPage,
  TaskDetailPage,
  SprintList,
  ActiveSprintBoard,
  ProjectMembers,
  ProjectChannels,
  ProjectSettings,
  GitHubIntegration,
  NotificationsInbox,
  GlobalSearchResults
} from './pages/index.js';

function App() {
  return (
    <BrowserRouter>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-(--z-tooltip) focus:px-4 focus:py-2 focus:rounded-md focus:bg-primary focus:text-primary-foreground focus:font-semibold"
      >
        Skip to main content
      </a>
      <ToastProvider />
      <main id="main-content" tabIndex={-1} className="outline-none">
        <Routes>
        {/* --- Auth & Public Screens (3 + Landing) --- */}
        <Route path="/" element={<LandingPage />} />
        
        <Route path="/login" element={<GuestGuard><LoginPage /></GuestGuard>} />
        <Route path="/register" element={<GuestGuard><RegisterPage /></GuestGuard>} />
        <Route path="/forgot-password" element={<GuestGuard><ForgotPasswordPage /></GuestGuard>} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />

        {/* --- Account (outside the workspace shell) --- */}
        <Route path="/account" element={<AuthGuard><AccountSettingsPage /></AuthGuard>} />
        
        {/* --- OAuth Callback --- */}
        <Route path="/auth/callback" element={<OAuthCallbackPage />} />
        <Route path="/github/callback" element={<AuthGuard><GithubCallbackPage /></AuthGuard>} />

        {/* --- Invite Acceptance (Standalone outside shell) --- */}
        <Route path="/invite/:inviteToken" element={<AuthGuard><InviteAcceptancePage /></AuthGuard>} />

        {/* --- Workspace Picker (Hub) --- */}
        <Route path="/workspaces" element={<AuthGuard><WorkspaceList /></AuthGuard>} />

        {/* --- Main App Shell (1 Persistent Layout) --- */}
        <Route path="/w/:slug" element={<AuthGuard><WorkspaceLayout /></AuthGuard>}>
          
          {/* Workspace Level Screens (3) */}
          <Route index element={<WorkspaceHome />} />
          <Route path="members" element={<WorkspaceMembers />} />
          <Route path="settings" element={<WorkspaceSettings />} />
          <Route path="audit-logs" element={<WorkspaceAuditLogs />} />

          {/* Global Features (2) */}
          <Route path="notifications" element={<NotificationsInbox />} />
          <Route path="search" element={<GlobalSearchResults />} />

          {/* Messaging Screens (1 + Modal for New DM) */}
          <Route path="channels/:channelId" element={<ChannelPage />} />

          {/* Project Screens (2) */}
          <Route path="projects" element={<ProjectList />} />
          <Route path="projects/new" element={<CreateProjectPage />} />

          {/* Core Project Views (5) & Management (3) */}
          <Route path="projects/:key" element={<ProjectLayout />}>
            {/* The ProjectLayout maps the header/tabs. The nested routes form the content */}
            
            <Route index element={<BoardPage />} /> {/* 1. Kanban Board */}
            <Route path="backlog" element={<BacklogPage />} /> {/* 2. Backlog */}
            <Route path="tasks/:taskKey" element={<TaskDetailPage />} /> {/* 3. Task Detail (Can be overlay, mapped here for deep linking) */}
            
            <Route path="sprints" element={<SprintList />} /> {/* 4. Sprint List */}
            <Route path="sprints/active" element={<ActiveSprintBoard />} /> {/* 5. Active Sprint Board */}
            <Route path="sprints/:sprintId" element={<ActiveSprintBoard />} /> {/* Specific Sprint Board */}
            
            <Route path="channels" element={<ProjectChannels />} /> {/* 6. Project Channels */}
            <Route path="members" element={<ProjectMembers />} /> {/* 7. Project Members */}
            <Route path="settings" element={<ProjectSettings />} /> {/* 8. Project Settings */}
            <Route path="github" element={<GitHubIntegration />} /> {/* 9. GitHub Integration */}
          </Route>
        </Route>

        {/* Catch-all 404 */}
        <Route path="*" element={<Navigate to="/workspaces" replace />} />
      </Routes>
      </main>
    </BrowserRouter>
  );
}

export default App;
