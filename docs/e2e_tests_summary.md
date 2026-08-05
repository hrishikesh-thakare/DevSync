# DevSync E2E Test Suite Summary

The DevSync Playwright E2E test suite comprises 103 tests spanning authentication, entity CRUD (Create, Read, Update, Delete) operations, sprint lifecycles, and a rigorous Role-Based Access Control (RBAC) matrix.

Below is a detailed breakdown of all the test modules and what they verify.

## 🔐 Authentication & Sessions (`/tests/auth`)
Verifies user onboarding, identity verification, and secure session handling.

| File | Scope | What it Tests |
| :--- | :--- | :--- |
| `login.spec.ts` | **Login Flow** | Tests UI rendering of the login form, successful login redirects, invalid credential errors (wrong password/non-existent email), OAuth button visibility, and links to registration. |
| `register.spec.ts` | **Registration Flow** | Validates the sign-up UI, end-to-end user creation, duplicate email rejection, and links to the login page. |
| `session.spec.ts` | **Session Management** | Ensures unauthenticated users attempting to access protected routes (e.g., `/workspaces`) are forcibly redirected to the login page. |

## 🏢 Workspaces (`/tests/workspaces`)
Tests the top-level container structure of DevSync.

| File | Scope | What it Tests |
| :--- | :--- | :--- |
| `workspace-crud.spec.ts` | **Workspace CRUD** | Validates that owners can create new workspaces via UI and API, update workspace names, and fetch lists of workspaces they belong to. |
| `workspace-members.spec.ts`| **Workspace Members**| Verifies listing members via API, UI rendering of the members list, and the ability to invite/remove members via API. |

## 📁 Projects & Channels (`/tests/projects` & `/tests/channels`)
Tests the structural entities inside a workspace.

| File | Scope | What it Tests |
| :--- | :--- | :--- |
| `project-crud.spec.ts` | **Project CRUD** | Verifies creating projects, updating project details, and listing projects within a workspace. |
| `project-members.spec.ts`| **Project Members** | Tests project-specific member assignments and access isolation. |
| `channel-crud.spec.ts` | **Channels & Messaging** | Ensures text channels can be created, updated, and deleted. Also tests real-time messaging capabilities (sending messages via API). |

## 🎯 Sprints & Tasks (`/tests/sprints` & `/tests/tasks`)
Verifies the core agile/project management workflows.

| File | Scope | What it Tests |
| :--- | :--- | :--- |
| `sprint-lifecycle.spec.ts` | **Sprint Lifecycle** | Tests the agile process: creating a sprint, listing sprints, starting a sprint, adding tasks to an active sprint, closing the sprint, and UI rendering of the sprint list. |
| `task-crud.spec.ts` | **Task CRUD & Comments**| Verifies creating, listing, getting, updating, and deleting tasks. It also ensures the Kanban Board UI renders tasks properly. Finally, it tests adding and listing comments on tasks. |

## 🛡️ Role-Based Access Control (RBAC) (`/tests/rbac`)
This is the most exhaustive part of the suite. It asserts that actions are strictly constrained by the user's role (`owner`, `admin`, `project_admin`, `developer`, `viewer`, `outsider`).

| File | Scope | What it Tests |
| :--- | :--- | :--- |
| `workspace-rbac.spec.ts` | **Workspace Roles** | Validates access to workspace settings, member invitations, role management, and deletion. Asserts that `owners` and `admins` have correct access, while `members` and `outsiders` receive 403 API denials and UI restrictions (e.g., hiding the "New Project" button). |
| `project-rbac.spec.ts` | **Project Roles** | Enforces granular permissions on tasks, sprints, and project settings. Ensures `project_admins` and `developers` can manipulate tasks, while `viewers` are strictly read-only. Tests that unauthorized roles receive 403 API errors and missing UI action buttons. |
| `implicit-elevation.spec.ts` | **Cross-Project Isolation** | Verifies complex authorization logic: ensuring Workspace Owners/Admins implicitly inherit Project Admin rights, while ensuring members without explicit project roles cannot breach isolated projects. |
