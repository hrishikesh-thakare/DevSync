# DevSync — Frontend Navigation & Screen Inventory

This document maps out the frontend routing structure, screen-by-screen feature inventory, and the Role-Based Access Control (RBAC) visibility rules implemented in the React application.

---

## 🗺️ URL Routing Structure

The React app uses React Router with nested layouts.

```text
/                                          ├─ LandingPage (Public)
/login                                     ├─ LoginPage (Guest Only)
/register                                  ├─ RegisterPage (Guest Only)
/forgot-password                           ├─ ForgotPasswordPage (Guest Only)
/reset-password                            ├─ ResetPasswordPage (Public)
/verify-email                              ├─ VerifyEmailPage (Public)
/auth/callback                             ├─ OAuthCallbackPage (Public)
/invite/:inviteToken                       ├─ InviteLandingPage (Auth Required)

/workspaces                                ├─ WorkspacePickerPage (Auth Required)
/account                                   ├─ AccountSettingsPage (Auth Required)

/w/:slug                                   ├─ WorkspaceLayout (App Shell Wrapper)
  ├── /                                    ├─ WorkspaceHome
  ├── /my-tasks                            ├─ MyTasksPage
  ├── /members                             ├─ WorkspaceMembersPage
  ├── /settings                            ├─ WorkspaceSettingsPage
  ├── /activity                            ├─ WorkspaceActivityPage
  ├── /notifications                       ├─ NotificationsInbox
  ├── /search                              ├─ GlobalSearchResults
  ├── /analytics                           ├─ AnalyticsPage
  ├── /channels                            ├─ ChannelListPage
  ├── /channels/:channelId                 ├─ ChannelPage (Messaging)
  ├── /projects                            ├─ ProjectListPage
  ├── /projects/new                        ├─ CreateProjectPage
  └── /projects/:key                       ├─ ProjectLayout (Tabs Wrapper)
      ├── /                                ├─ BoardPage (Kanban)
      ├── /backlog                         ├─ BacklogPage
      ├── /tasks/:taskKey                  ├─ TaskDetailPage
      ├── /sprints                         ├─ SprintList
      ├── /sprints/:sprintId               ├─ ActiveSprintBoard (Specific)
      ├── /labels                          ├─ ProjectLabelsPage
      ├── /members                         ├─ ProjectMembersPage
      ├── /settings                        ├─ ProjectSettingsPage
      ├── /github                          ├─ GitHubIntegration
      └── /analytics                       ├─ AnalyticsPage
```

---

## 🏗️ The App Shell (WorkspaceLayout)

The app shell wraps everything under `/w/:slug` and consists of three permanent zones:

1.  **Left Sidebar:**
    *   Workspace name/icon linking to home.
    *   List of Projects (clickable).
    *   List of Channels (clickable).
    *   *RBAC:* The `+ New Project` and `+ New Channel` buttons are only visible to workspace `owner` and `admin`.
2.  **Top Bar:**
    *   Global search input (redirects to `/search`).
    *   Notifications bell with unread count badge.
    *   User avatar dropdown (Profile info, Workspace Settings link for owners, Logout button).
3.  **Main Content Area:** Renders the active route component.

---

## 🖥️ Screen Inventory (21 Screens)

### 1. Auth Screens
1.  **Login (`/login`)**: Email/Password form, "Continue with GitHub/Google" buttons.
2.  **Register (`/register`)**: Name/Email/Password form, OAuth buttons.
3.  **OAuth Callback (`/auth/callback`)**: Invisible processing screen that captures Supabase tokens and redirects.

### 2. Workspace Level
4.  **Workspace Picker (`/workspaces`)**: Grid of workspaces the user belongs to. "Create New Workspace" button.
5.  **Invite Acceptance (`/invite/:token`)**: Standalone page outside the shell to accept email invitations.
6.  **Workspace Home (`/w/:slug`)**: Dashboard showing recent projects, recent notifications, and quick stats.
7.  **Workspace Members (`/w/:slug/members`)**: Table of members.
    *   *RBAC:* `member` role sees read-only list. `admin` sees "Invite Member" and can remove/demote other members. `owner` can change anyone's role.
8.  **Workspace Settings (`/w/:slug/settings`)**: Name/Description/Icon update forms. Danger zone to delete workspace.
    *   *RBAC:* Strictly `owner` only.

### 3. Messaging & Global
9.  **Notifications Inbox (`/w/:slug/notifications`)**: List of unread/all notifications. Clicking a row navigates to the relevant task/sprint/message.
10. **Global Search (`/w/:slug/search`)**: Full-text search results for tasks and messages across the workspace.
11. **Channel View (`/w/:slug/channels/:channelId`)**: Main chat interface. Left side is the message list, right side is a sliding thread panel for replies. Reused for all DMs, public channels, and project channels.
    *   *Missing:* A dedicated "New DM" modal is currently not implemented in the UI, though the backend supports DM creation.

### 4. Projects (Creation & Navigation)
12. **Project List (`/w/:slug/projects`)**: Grid of project cards.
    *   *RBAC:* "New Project" button visible to workspace `admin`+.
13. **Create Project (`/w/:slug/projects/new`)**: Form to set Name, immutable Key, Description, and Lead User.

### 5. Core Project Views (Under `/projects/:key`)
These screens are wrapped in the `ProjectLayout` which provides the top navigation tabs (Board, Backlog, Sprints, etc.).

14. **Kanban Board (`/projects/:key`)**: 4-column drag-and-drop board (Todo, In Progress, In Review, Done), built on the `@reui/c-kanban-1` primitives over dnd-kit. Filterable by Assignee and Priority. See `docs/kanban.md`.
    *   *RBAC:* `viewer` role cannot drag cards or see the "+ Create Task" button.
15. **Backlog (`/projects/:key/backlog`)**: Flat list of tasks without an active sprint. Supports drag-and-drop LexoRank reordering. Bulk actions to assign to sprint.
16. **Task Detail (`/projects/:key/tasks/:taskKey`)**: Deep-linkable overlay containing title, rich-text description, subtasks, linked GitHub commits, and a threaded discussion panel.
    *   *RBAC:* `developer`+ can edit fields inline. `viewer` sees a read-only state.
17. **Sprint List (`/projects/:key/sprints`)**: Cards for Future, Active, and Closed sprints.
    *   *RBAC:* "Start Sprint" and "Close Sprint" buttons restricted to `project_admin`.
18. **Active Sprint Board (`/projects/:key/sprints/active`)**: Status-grouped view of the currently active sprint (read-only, no drag). Displays a progress bar and remaining days.


### 6. Project Management
19. **Project Channels (`/projects/:key/channels`)**: Lists channels strictly scoped to this project.
20. **Project Members (`/projects/:key/members`)**: Table mapping users to project roles (`project_admin`, `developer`, `viewer`).
    *   *RBAC:* `project_admin` can add/remove/modify roles.
21. **Project Settings & GitHub Integration (`/projects/:key/settings` & `/github`)**:
    *   *Settings:* Name/Description updates, Archive project. (`project_admin` only)
    *   *GitHub:* Connect a repo, view recent commits, view CI workflow run statuses. (`project_admin` only to connect)
