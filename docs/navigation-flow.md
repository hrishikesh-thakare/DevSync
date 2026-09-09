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
/invite/:inviteToken                       ├─ InviteLandingPage (Public — see note below)

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
      ├── /sprints                         ├─ SprintListPage
      ├── /sprints/:sprintId               ├─ ActiveSprintBoard
      ├── /labels                          ├─ ProjectLabelsPage
      ├── /members                         ├─ ProjectMembersPage
      ├── /settings                        ├─ ProjectSettingsPage
      ├── /github                          ├─ GitHubIntegration
      └── /analytics                       ├─ AnalyticsPage
```

---

## ✉️ How invitations actually route

There are **two separate invite mechanisms**, and which one fires depends on
whether the invitee already has a DevSync account. Getting this wrong is the
single easiest way to misread the auth flow.

**1. Invitee has no account yet** → a row in `workspace_invites` with a token.
The email links to **`/register?inviteToken=…`** — *not* to `/invite/:token`.
`RegisterPage` forwards the token to `POST /auth/register`, which redeems it
inside the same transaction that creates the user, and rejects it if the email
typed does not match the invited address.

**2. Invitee already has an account** → a `workspace_members` row with
`state: 'invited'` and an in-app notification. **No email is sent at all.** The
invitee accepts from the "Pending invitations" section of `/workspaces`, which
calls `POST /workspaces/:slug/invites/accept`. That endpoint takes **no token** —
it flips the caller's own membership row to `active`.

`/invite/:inviteToken` is a compatibility route the backend never actually
mints. It is public, and forwards: signed-out → `/register?inviteToken=…`;
signed-in → `/workspaces`. There is no endpoint to read an invite by token, so
the page cannot name the workspace behind it.

> **Note for anyone updating this file:** earlier revisions described a
> token-based accept endpoint that has never existed. If you are reconciling
> this doc against the code, `InviteLandingPage.tsx`'s header comment is the
> authoritative account.

**OAuth sign-up redeems invites too.** Because the OAuth handshake cannot carry
`inviteToken` through Supabase's redirect, `oauthCallback` instead looks up every
unexpired `workspace_invites` row matching the new account's email and redeems
them all. Without that, anyone who clicked "Continue with Google" on the invite
page landed in an account with no workspaces and an invite left dangling.

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

14. **Kanban Board (`/projects/:key`)**: 4-column drag-and-drop board (Todo, In Progress, In Review, Done), built on the `@reui/c-kanban-1` primitives over dnd-kit. Filterable by Assignee and Priority.
    *   *RBAC:* `viewer` role cannot drag cards or see the "+ Create Task" button.
    *   *Ranking:* card order uses **fractional indexing** — a move generates a key between the two neighbours, so one row is rewritten rather than the whole column renumbered. `useMoveTaskMutation` computes the rank twice on purpose (once optimistically, once authoritatively server-side); if you change one, change both.
15. **Backlog (`/projects/:key/backlog`)**: Flat list of tasks without an active sprint. Same fractional-indexing reorder as the board. Bulk actions to assign to sprint. It is a **separate component from the board** — they share the ranking scheme, not the implementation.
16. **Task Detail (`/projects/:key/tasks/:taskKey`)**: Deep-linkable overlay containing title, rich-text description, subtasks, linked GitHub commits, and a threaded discussion panel.
    *   *RBAC:* `developer`+ can edit fields inline. `viewer` sees a read-only state.
17. **Sprint List (`/projects/:key/sprints`)**: Cards for Future, Active, and Closed sprints.
    *   *RBAC:* "Start Sprint" and "Close Sprint" buttons restricted to `project_admin`.
18. **Sprint Detail (`/projects/:key/sprints/:sprintId`)**: Status-grouped view of one sprint (read-only, no drag). Progress bar and remaining days. Closed sprints may carry an AI retrospective summary.

### 6. Project Management
19. **Project Members (`/projects/:key/members`)**: Table mapping users to project roles (`project_admin`, `developer`, `viewer`).
    *   *RBAC:* `project_admin` can add/remove/modify roles.
20. **Project Labels (`/projects/:key/labels`)**: Create, recolour and delete the label set available to this project's tasks.
21. **Project Settings & GitHub Integration (`/projects/:key/settings` & `/github`)**:
    *   *Settings:* Name/Description updates, Archive project. (`project_admin` only)
    *   *GitHub:* Connect a repo; browse ingested commits, branches, PRs, issues and CI runs across tabs. (`project_admin` only to connect)
    *   *Caveat:* a repo can only be connected to **one project** — `github_commits` is globally unique on `(repo_full_name, commit_sha)`, so a second project connecting the same repo silently ingests nothing.

> **Channels are workspace-scoped, not project-scoped.** They live at
> `/w/:slug/channels/:channelId`. A channel may carry a `project_id` that
> associates it with a project, but there is no `/projects/:key/channels`
> route — earlier revisions of this document listed one that never existed.
