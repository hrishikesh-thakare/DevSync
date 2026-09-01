# DevSync E2E Test Suite — Complete Test Reference

The DevSync Playwright end-to-end suite contains **297 tests across 33 spec files**. It verifies the full product surface: authentication & sessions (including password recovery, email verification, enforcement of verified emails on sign-in, and rate limiting behind a trusted proxy), workspace/project/channel/task/sprint/label CRUD (including soft-delete isolation of deleted workspaces), messaging (including threads and reactions), XSS sanitization of message HTML, RBAC at workspace and project level, GitHub integration, search, notifications, file storage, WebSocket realtime events, and audit logging.

## Running the Suite

| Command | Purpose |
| :--- | :--- |
| `npx playwright test` | Run the full suite (297 tests) |
| `npx playwright test tests/<dir>` | Run one module (e.g. `tests/rbac`) |
| `npx playwright test tests/<dir>/<file>.spec.ts --workers 1` | Run one spec file serially |
| `npm run test:rbac` / `test:auth` | Run tests tagged `@rbac` / `@auth` |
| `npx playwright test --headed` / `--ui` | Interactive debugging |

The suite runs automatically in CI on every push to `main`/`develop` and on every PR targeting them (`.github/workflows/e2e-tests.yml`): fresh Postgres 16, migrations (all 13 versioned migrations, 0000→0012, applied with the same drizzle-orm migrator the deployed app uses), seed, then the full run.

## Test Infrastructure

- **Seeded users** (password `Password123!`): `alice@demo.com` (owner), `bob@demo.com` (admin), `carol@demo.com` (project_admin), `dave@demo.com` (developer), `eve@demo.com` (viewer), `frank@demo.com` (outsider), `grace@demo.com` (cross-project: developer in `SEC`, no role in `E2E`), `hank@demo.com` (memberNoProject: workspace member, no project roles).
- **Seeded entities**: workspace `e2e-test-workspace`, projects `E2E` and `SEC`.
- Tests are a mix of **UI** (Playwright pages), **API** (REST via `apiRequest`) and **Socket** (Socket.IO client) checks.
- Suites that mutate shared state run serial (`test.describe.configure({ mode: 'serial' })`).

---

## 🔐 Auth — Login & Registration (`tests/auth/login.spec.ts`, `register.spec.ts`)

| Test | Verifies |
| :--- | :--- |
| should display the login form | Email/password inputs + "Sign in" button render |
| should login successfully with valid credentials | Valid login redirects to `/workspaces` and stores the JWT in localStorage |
| should show error for wrong password | 401 stays on login page with an error message |
| should show error for non-existent email | Same generic error for unknown accounts |
| should show OAuth buttons | "Continue with GitHub" / "Continue with Google" present |
| should have link to register page | Link navigates to `/register` |
| should display the registration form | Name/email/password inputs + submit button render |
| should register a new user with valid details | Fresh user registration redirects to `/workspaces` |
| should show error for already-registered email | Duplicate email shows an error |
| should have link to login page | Link navigates to `/login` |

## 🔐 Auth — Sessions & Lockout (`tests/auth/session.spec.ts`, `sessions-api.spec.ts`, `lockout.spec.ts`)

| Test | Verifies |
| :--- | :--- |
| redirect unauthenticated user to login when accessing protected route | `/workspaces` without a token redirects to `/login` |
| redirect unauthenticated user accessing workspace route | `/w/:slug` without a token redirects to `/login` |
| allow authenticated user to access workspace picker | Saved auth state grants access |
| GET /auth/me returns current user | `/auth/me` returns the logged-in user |
| refresh rotates token | `/auth/refresh` issues a new access token (different from the old one) |
| logout revokes refresh token | After logout the refresh cookie is rejected with 401 |
| GET /auth/sessions returns session records with expected fields | Session list has `tokenId`, `issuedAt`, `expiresAt`, `isCurrent` |
| sessions require authentication (401) | `/auth/sessions` without token → 401 |
| revoking a non-existent session returns 404 | Random UUID revoke → 404 |
| cannot revoke another user's session (404) | Cross-user revoke is impossible |
| revoking a session invalidates its refresh token | Revoked session's refresh cookie → 401 |
| revoke-others keeps the current session and revokes the rest | `revoke-others` kills every session except the current one |
| account is locked after 5 failed attempts | 6th attempt with correct password → 423 with lockout message |
| failed attempts report a generic error (no user enumeration) | Unknown email returns identical error to wrong password |
| lockout also rejects the wrong password with 423 | Locked account rejects any attempt with 423 |

### `rate-limit.spec.ts`
> Targets a second production-mode backend (port 3002, `TRUST_PROXY_HOPS=1`) that the playwright config starts alongside the test backend — rate limiting is skipped on the main test backend (`NODE_ENV=test`).

| Test | Verifies |
| :--- | :--- |
| auth limiter keys on the forwarded IP and blocks at the limit | 10 attempts with the same `X-Forwarded-For` → 401s, 11th → 429; a different forwarded IP has its own untouched bucket (401) |

## 🔑 Password Recovery & Email Verification (`tests/auth/password-recovery.spec.ts`)

| Test | Verifies |
| :--- | :--- |
| change-password requires authentication | `POST /auth/change-password` without a token → 401 |
| change-password rejects an incorrect current password | Wrong current password → 400 |
| change-password rejects a weak new password | Zod password-strength validation → 400 |
| change-password changes the password and invalidates the old one | New password logs in, old one → 401 |
| forgot-password does not leak whether an email has an account | Unknown email → 200 with generic message, no `resetUrl` |
| forgot-password issues a reset token for an existing account | Known email → 200 with `resetUrl` (dev/test only; prod sends it by email) |
| reset-password rejects a garbage token | Fake token → 400 |
| reset-password resets the password and signs out every session | Old password → 401, new → 200, pre-reset refresh cookie → 401 |
| reset token is single-use | Second use of the same token → 400 |
| registration issues a verification token | `POST /auth/register` returns a `verificationUrl` (dev/test only) |
| verify-email rejects a garbage token | Fake token → 400 |
| verify-email verifies the email address | Valid token → 200 |
| verification token is single-use | Second use of the same token → 400 |
| login is blocked until the email is verified, then succeeds | Unverified login → 403; after verify → 200 |

## 🔑 Password Recovery — UI Flows (`tests/auth/password-recovery-ui.spec.ts`)

| Test | Verifies |
| :--- | :--- |
| forgot-password shows a generic message and does not leak accounts | UI shows the generic "if an account exists" notice; no user-specific text |
| full reset flow resets the password via the UI | Forgot → reset URL (dev/test) → new password → old password dead, new works |
| account settings can change the password | `/account` → change password → old password dead, new works |

## 🧑 Account Status & Preferences (`tests/account/account-status.spec.ts`)

| Test | Verifies |
| :--- | :--- |
| POST /auth/status updates statusText and presence | `statusText` + `presence` are persisted and returned |
| POST /auth/presence updates presence | Presence alone updates (`away`) |
| PATCH /auth/preferences merges preferences instead of replacing them | Second patch keeps first patch's keys (jsonb merge) |
| status, presence and preferences require authentication (401) | All three endpoints reject missing tokens |

## 🏢 Workspaces (`tests/workspaces/`)

### `workspace-crud.spec.ts`
| Test | Verifies |
| :--- | :--- |
| owner can create a new workspace | "Create workspace" UI is available to owners |
| can create workspace via API and verify it exists | POST returns 201 with slug/id; GET returns the record (workspace deleted in cleanup) |
| duplicate workspace slug is rejected with 409 | Same slug → 409 "already exists" |
| can update workspace name via API | PATCH persists the new name (restored afterwards) |
| can list workspaces the user belongs to | GET `/workspaces` returns an array |
| a deleted workspace becomes inaccessible to owner and members | Soft-delete returns 200; GET by owner and member → 404; both lists drop the slug; second DELETE → 404 |

### `workspace-members.spec.ts`
| Test | Verifies |
| :--- | :--- |
| owner can view members list | Members page renders a seeded member |
| can list workspace members via API | GET members → 200 |
| owner can invite a user via API | Register + invite returns 200/201 |
| admin can remove a member via API | Invite → accept → remove → membership no longer active |

### `leave-workspace.spec.ts`
| Test | Verifies |
| :--- | :--- |
| owner cannot leave the workspace (400) | Owners are blocked ("Owners cannot leave") |
| member can leave, loses access, and a re-invite restores it | Leave → 200; access → 403; re-invite re-activates membership directly |
| non-member cannot leave a workspace (404) | Outsider DELETE → 404 |
| leaving requires authentication (401) | No token → 401 |

### `unfurl.spec.ts`
| Test | Verifies |
| :--- | :--- |
| unfurl requires a url parameter (400) | Missing `url` → 400 |
| unfurl rejects malformed URLs (400) | `not a url` → 400 |
| unfurl rejects non-http(s) protocols (400) | `ftp://` → 400 |
| unfurl fetches page metadata for a valid URL | `example.com` → 200 with `domain` + `title` |
| outsider cannot unfurl (403) | Outsider → 403 |
| unfurl requires authentication (401) | No token → 401 |

## 📁 Projects (`tests/projects/`)

### `project-crud.spec.ts`
| Test | Verifies |
| :--- | :--- |
| can view project list | Projects page renders the seeded project |
| can create project via API and read it back | POST 201 + GET 200 round-trip |
| duplicate project key is rejected with 409 | Same key → 409 |
| can get project details via API | GET by key → 200 with matching key |
| can update project description via API | PATCH persists description |
| archive project succeeds via API | Disposable project archives (`status: archived`) |
| can view project board (UI) | Kanban columns (Todo/In Progress/In Review/Done) render |

### `project-members.spec.ts`
| Test | Verifies |
| :--- | :--- |
| can list project members via API | GET members → 200 |
| project admin can view members page (UI) | Members page loads for project_admin |
| can add member to project via API | Register → invite → accept → add as viewer → 200/201 |
| can change project member role via API | Developer → viewer → back to developer |
| remove project member via API | Full add/remove lifecycle → 200/204 |

## 💬 Channels & Messaging (`tests/channels/`)

### `channel-crud.spec.ts`
| Test | Verifies |
| :--- | :--- |
| can create channel via API | POST 200/201 |
| can list channels via API | GET → 200 |
| member can join a channel via API | Fresh channel join → 200/201 (or already-member code) |
| owner/admin can archive channel via API | PATCH archive → 200 |
| owner/admin can delete channel via API | DELETE → 200/204 |
| leave channel via API | Join then leave → 200/204 |
| rename channel via API | PATCH name/description → 200 |
| can send message in channel via API | POST message → 200/201 |
| can list messages in channel via API | GET → 200 |
| edit own message via API | Author edits; developer editing owner's message → 403 |
| delete message via API | Viewer delete → 403; author delete → 200/204 |
| thread replies via API | Reply endpoint returns 200 |

### `messages.spec.ts` (serial suite, shared channels)
| Test | Verifies |
| :--- | :--- |
| create channel requires workspace owner/admin | Developer/viewer/outsider → 403 |
| channel validation rejects bad type and unknown keys | Invalid `type` or extra keys → 400 |
| public channel: any workspace member can read and post | Viewer GET 200 + POST 201 with body echo |
| private channel: non-member is denied (403) even though workspace member | Viewer GET/POST → 403 |
| private channel: owner (member) can read and post | Owner GET 200 + POST 201 |
| outsider cannot access any channel | List → 403 |
| announcement channels: only workspace admins can post | Developer → 403; owner → 201 |
| join/leave lifecycle on a fresh public channel | Creator auto-member (join → 409), developer join → 201, dup join → 409, leave → 200, leave again → 404 |
| message validation rejects empty and unknown payloads | Empty/oversized/extra-key bodies → 400 |
| send + list messages (oldest first, top-level only) | Order preserved oldest-first |
| thread replies increment replyCount and appear in thread list | Reply sets `threadId`, bumps `replyCount` |
| reactions add, list, and remove | 👍 add → visible in list → removed from list |
| reaction validation rejects empty emoji | Empty emoji → 400 |
| edit: author-only for text, pin by any member | Owner can't edit viewer's text (403); any member can pin |
| delete: author-only unless workspace admin | Viewer deletes own ✓; owner deletes developer's ✓; viewer can't delete owner's |
| message endpoints require authentication (401) | List + post without token → 401 |
| malicious HTML in a message renders inert in the browser | `<img onerror>`/`<script>`/`<svg onload>`/`javascript:` hrefs stored verbatim via API render with no executable element or handler, no dialog, no window flag; plain text still visible (XSS regression test) |

## 🎯 Tasks (`tests/tasks/`)

### `task-crud.spec.ts`
| Test | Verifies |
| :--- | :--- |
| can create task via API | POST → 200/201 with a `taskKey` |
| can list tasks via API | GET → 200 |
| can get single task via API | GET by key → 200 |
| can update task fields via API | PATCH title/priority/status → 200 |
| can delete task via API (project admin) | DELETE → 200/204 |
| board page renders tasks (UI) | Kanban columns render |
| can reorder a task via API | PATCH reorder → 200 |
| reordering between two tied-rank neighbours does not error | PATCH reorder with tied neighbours → 200, not 500 |
| can post comment on task via API | POST comment → 200/201 |
| can list comments on task via API | GET comments → 200 |

### `task-attachments.spec.ts`
| Test | Verifies |
| :--- | :--- |
| add, list, download and delete an attachment | Full lifecycle: 201 add → listed with uploaderName → download URL → delete → gone → delete again 404 |
| attachment requires filename and fileBase64 (400) | Missing field → 400 |
| RBAC: viewer read-only, developer can add/delete, outsider blocked | Viewer list 200/add 403; developer 201/delete 200; outsider 403 |
| adding an attachment to a non-existent task returns 404 | Unknown key → 404 |
| task audit trail logs task.attachment_added | Audit log contains action with `file_id` |

## 🏃 Sprints (`tests/sprints/sprint-lifecycle.spec.ts`) — serial suite

| Test | Verifies |
| :--- | :--- |
| create sprint with capacity via API | 201 with `capacityPoints`, `status: future` |
| start the fresh sprint (closing any previously active ones) | Leftover active sprints closed, then start → `active` |
| cannot start a second sprint while one is active (409) | Second start → 409 |
| story-pointed task added to the sprint updates sprint stats | `taskCount: 1`, `totalPoints: 5`, `completedPoints: 0` |
| changing task story points is reflected in sprint stats | Points 5 → 7 updates `totalPoints` |
| close the active sprint | Close returns stats (1 total, 0 completed, 1 incomplete) |
| closing an already-closed sprint returns 400 | Re-close → 400 |
| starting a non-existent sprint returns 404 | Random UUID → 404 |
| capacity validation rejects out-of-range values | `capacityPoints: 20000` → 400 |
| remove task from sprint via API | Removal zeroes `taskCount`/`totalPoints` |
| can delete a sprint via API | Delete → 200/204 and gone from list |
| sprint list page renders (UI) | Sprint page URL loads |

## 🏷️ Labels (`tests/labels/labels.spec.ts`) — serial suite

| Test | Verifies |
| :--- | :--- |
| create label returns 201 with normalized name and default color | Trims + lowercases name, default `#64748b` |
| create label with custom color keeps it | Custom color preserved |
| duplicate label is rejected with 409 (case-insensitive) | `DuplicateMe` vs `duplicateme` → 409 |
| list labels returns all with usageCount | All labels listed, `usageCount: 0` |
| validation: bad name, bad color, extra keys rejected with 400 | Six invalid payloads → 400 |
| update color only returns 200 and keeps name | Color-only patch keeps name |
| rename conflict returns 409 | Rename onto existing name → 409 |
| update/delete of non-existent label returns 404 | Random UUID → 404 |
| task creation auto-registers labels and increments usageCount | Task with `labels: [auto…]` → label `usageCount: 1` |
| renaming a label propagates to tasks case-insensitively | Task's label array follows the rename |
| deleting a label removes it from tasks and usage count | Task labels empty, label gone |
| unauthenticated requests are rejected with 401 | All endpoints without token |
| viewer can list but not modify labels | List 200; create/patch/delete → 403 |
| developer can create but not delete labels | Create 201; delete → 403 |
| outsider is blocked from all label endpoints | List/create → 403 |

## 🛡️ RBAC (`tests/rbac/`)

### `workspace-rbac.spec.ts` — serial suite
| Test | Verifies |
| :--- | :--- |
| owner CAN access workspace settings page | Settings URL loads |
| admin CAN access workspace settings page | Settings URL loads; admin delete workspace → 403 |
| member CANNOT access workspace settings | Blocked from settings; member PATCH workspace → 403 |
| owner CAN see invite button on members page | UI visibility |
| admin CAN see invite button on members page | UI visibility |
| member CANNOT see invite button on members page | Button absent |
| member CANNOT invite via API (403) | POST invite → 403 |
| owner CAN change member roles (API) | Dave → admin → back to member |
| admin CANNOT change member roles (API 403) | Role change by admin → 403 |
| admin CANNOT delete workspace (API 403) | DELETE → 403 |
| member CANNOT delete workspace (API 403) | DELETE → 403 |
| owner CAN see "New Project" button | UI visibility |
| member CANNOT see "New Project" button | Button absent |
| member CANNOT create project via API (403) | POST project → 403 |
| member CANNOT create channel via API (403) | POST channel → 403 |
| outsider CANNOT access workspace (API 403) | GET workspace → 403 |
| outsider CANNOT list workspace members (API 403) | GET members → 403 |

### `project-rbac.spec.ts`
| Test | Verifies |
| :--- | :--- |
| project_admin CAN create tasks (UI) | Create-task button visible |
| developer CAN create tasks (API) | POST → 200/201 |
| viewer CANNOT create tasks (API 403) | POST → 403 |
| viewer CANNOT see create task button (UI) | Button absent |
| developer CAN update tasks (API) | PATCH → 200/204 |
| viewer CANNOT update tasks (API 403) | PATCH → 403 |
| project_admin CAN delete tasks (API) | DELETE → 200/204 |
| developer CANNOT delete tasks (API 403) | DELETE → 403 |
| project_admin CAN create sprints (API) | POST → 200/201 |
| developer CANNOT create sprints (API 403) | POST → 403 |
| viewer CANNOT create sprints (API 403) | POST → 403 |
| viewer CAN list sprints (read-only API) | GET → 200 |
| project_admin CAN list project members (API) | GET → 200 |
| developer CANNOT add project members (API 403) | POST → 403 |
| viewer CANNOT add project members (API 403) | POST → 403 |
| project_admin CAN access project settings (UI) | Settings URL loads |
| developer CANNOT archive project (API 403) | PATCH archive → 403 |
| viewer CANNOT update project (API 403) | PATCH → 403 |
| viewer CAN list tasks (read-only) | GET → 200 |
| viewer CAN view individual task | GET by key → 200 |
| viewer CANNOT comment on tasks (API 403) | POST comment → 403 |

### `implicit-elevation.spec.ts`
| Test | Verifies |
| :--- | :--- |
| workspace owner CAN create tasks in project (without explicit project membership) | Owner implicitly = project_admin |
| workspace owner CAN manage project members | GET members → 200 |
| workspace owner CAN create sprints | POST → 200/201 |
| workspace owner CAN access project board (UI) | Board loads with create-task ability |
| workspace admin CAN create tasks in project | Admin implicitly = project_admin |
| workspace admin CAN delete tasks in project | Create + delete → 200/204 |
| workspace admin CAN manage project members | GET members → 200 |
| workspace admin CAN create sprints | POST → 200/201 |
| outsider (no workspace access) CANNOT access project tasks (API 403) | No elevation for non-members |
| workspace member with NO project roles (Hank) CANNOT access project tasks (API 403) | Membership alone grants nothing |
| workspace member with explicit role (Dave) does NOT get elevated to admin | Read 200, but sprint creation → 403 |
| Grace CAN access SEC project tasks (developer role) | Cross-project role respected |
| Grace CANNOT access E2E project tasks (no role in E2E) | Isolation enforced |
| Carol is project_admin in E2E but only viewer in SEC | Sprints in E2E 200/201, in SEC 403 |

## 🐙 GitHub Integration (`tests/github/`)

### `github-integration.spec.ts`
| Test | Verifies |
| :--- | :--- |
| can request OAuth URL | OAuth authorize URL is returned |
| connection status is initially empty | `connection: null` before connecting |
| non-admin gets 403 trying to connect or disconnect | Developer → 403 |
| unauthenticated requests are rejected with 401 | 14 endpoints sweep without token |
| viewer is denied all write endpoints with 403 | 7 write endpoints sweep |
| viewer CAN read connection status (200) | Read gate passes |
| read endpoints: viewer reaches controller (200 empty), outsider blocked (403) | commits/ci/issues/PRs/branches: viewer 200 + `[]`; outsider 403 |
| developer write endpoints pass RBAC but 404 without a connection | Role gate passed, no connection → 404 |
| connect requires repo_owner and repo_name | 7 invalid bodies → 400 |
| pull request creation validates title, head, base | 7 invalid bodies → 400 |
| branch creation validates branch names | 5 invalid bodies → 400 |
| issue and PR comments require non-empty body | 3 invalid bodies × 2 endpoints → 400 |
| oauth exchange validates providerToken | 3 invalid bodies → 400 |
| connect fails with 403 when the user has no GitHub token | Fresh user connect → 403 "GitHub account is not connected"; disconnect → 404; cleanup deletes workspace |
| disconnect without a connection returns 404 | Project admin disconnect → 404 |
| task-level endpoints behave deterministically without a connection | Task commits/activity → 200 with empty lists |

### `github-webhook.spec.ts`
| Test | Verifies |
| :--- | :--- |
| ping events return pong without auth or signature | `X-GitHub-Event: ping` → 200 `pong` |
| project with no GitHub connection returns 404 | Push webhook → 404 "no webhook configured" |
| missing x-github-event header falls through to connection lookup (404) | No header → 404 |
| unknown project id returns 404 | Random UUID → 404 |
| malformed JSON without signature is rejected before parsing (404, not 500) | Invalid JSON body doesn't crash |

## 🔍 Search (`tests/search/search.spec.ts`)

| Test | Verifies |
| :--- | :--- |
| search finds a task by its unique title | `type=tasks` matches seeded unique title |
| search finds a message by its unique content | `type=messages` matches seeded unique text |
| search response has structured shape with counts | `tasks`/`messages` arrays + `taskCount`/`messageCount`/`totalCount` consistent |
| query shorter than 2 characters is rejected with 400 | `q=x` → 400 |
| outsider gets 403 on search | Outsider → 403 |
| unauthenticated search is rejected with 401 | No token → 401 |

## 🔔 Notifications (`tests/notifications/notifications.spec.ts`)

| Test | Verifies |
| :--- | :--- |
| assigning a task notifies the assignee | Assign → developer sees `task_assigned` |
| notification records have the expected fields | `notificationId`, `isRead`, `type` present |
| unreadOnly=true returns only unread notifications | All returned items are unread |
| can mark a notification as read | PATCH read → disappears from unread list |
| cannot mark another user's notification as read (404) | Owner patching developer's notification → 404 |
| can mark all notifications as read | `read-all` empties the unread list |
| resolve returns a deep link for own notification, 404 otherwise | Own → 200 with `url`; other user's → 404 |
| unauthenticated requests are rejected with 401 | List + read-all without token |

## 📦 Files & Storage (`tests/storage/files-storage.spec.ts`) — serial suite

| Test | Verifies |
| :--- | :--- |
| upload a file (base64) and get a fileRecord | POST upload → 200 with `fileRecord.fileId` |
| request a download URL for the uploaded file | GET download → 200 with `downloadUrl` |
| raw endpoint serves the file content | Fetching the raw URL returns the exact content |
| raw endpoint rejects requests without a token | No-token raw fetch → 401 |
| upload validates filename and fileBase64 | Missing field → 400 |
| download of a non-existent file returns 404 | Random UUID → 404 |
| outsider cannot upload or download | Both → 403 |
| upload and download require authentication | Both → 401 |
| presigned upload URL endpoint returns a fileRecord (legacy flow) | POST upload-url → 200 with fileRecord (uploadUrl may be null locally) |
| presigned upload URL requires a filename (400) | Empty body → 400 |

## ⚡ Realtime WebSockets (`tests/realtime/realtime.spec.ts`)

| Test | Verifies |
| :--- | :--- |
| socket receives new_message event | Socket joined to `channel:<id>` receives the posted message |
| socket receives message_updated, message_reaction and message_deleted events | Edit/reaction-add/reaction-remove/delete each emit their event with matching ids |
| socket receives user_presence_updated when own status changes | `POST /auth/status` emits presence event with `statusText`/`presence` |
| socket receives new_notification when a task is assigned to me | Assign → `new_notification` with `recipientId`/`entityId` |
| socket connection is rejected with an invalid token | `connect_error` on bad token |
| socket connection is rejected without a token | `connect_error` on missing token |

## 📜 Audit Logs (`tests/audit/audit.spec.ts`)

| Test | Verifies |
| :--- | :--- |
| project update is logged with action and values | `project.description_changed` entry with `newValues.description` |
| task creation is logged under the task entity | `task.created` with `task_key` |
| label creation is logged under the project_label entity | `project_label.created` with name |
| workspace audit log lists workspace-scoped activity | Non-empty log for the workspace |
| only owners and admins can view entity audit logs | Developer/viewer/outsider → 403 |
| user audit logs are private (self-only) | Own → 200; another user's → 403 |
| unresolvable entities are rejected with 403 | Random UUID → 403 "Cannot resolve access" |
| audit requires authentication (401) | No token → 401 |