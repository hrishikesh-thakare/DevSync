import { test, expect } from '../../fixtures/test-fixtures.js';
import { ROUTES, TEST_WORKSPACE, TEST_USERS } from '../../helpers/constants.js';
import { apiLogin, apiRequest } from '../../helpers/api-helpers.js';

/**
 * A genuine drag gesture on the Kanban board.
 *
 * `task-crud.spec.ts` tests `PATCH .../reorder` directly, and
 * `bulk-operations.spec.ts` moves cards through the bulk status select — but
 * nothing before this actually picked a card up and dropped it, so the
 * `Kanban` root's dnd-kit wiring (`PointerSensor` with a 10px activation
 * distance, `onValueCommit`'s neighbour resolution in `BoardPage`) had zero
 * coverage of its own. A throwaway project again, for the same reason
 * `bulk-operations.spec.ts` uses one: a fresh, empty board is a much smaller
 * target to hit reliably than the shared `E2E` project's Todo column, which
 * accumulates cards from the rest of the suite.
 */

const SLUG = TEST_WORKSPACE.slug;

async function createProject(token: string) {
  const key = `KB${Date.now().toString().slice(-6)}`;
  const { status, data } = await apiRequest(`/workspaces/${SLUG}/projects`, token, {
    method: 'POST',
    body: JSON.stringify({ name: `Kanban drag ${key}`, key }),
  });
  expect(status).toBe(201);
  return data.project.key as string;
}

test('dragging a card to another column persists the new status', async ({ ownerPage }) => {
  const owner = await apiLogin(TEST_USERS.owner.email);
  const key = await createProject(owner.accessToken);

  const { status, data } = await apiRequest(`/workspaces/${SLUG}/projects/${key}/tasks`, owner.accessToken, {
    method: 'POST',
    body: JSON.stringify({ title: 'Drag me', status: 'todo', issueType: 'task', priority: 'medium' }),
  });
  expect(status).toBe(201);
  const task = data.task;

  try {
    await ownerPage.goto(ROUTES.projectBoard(SLUG, key));
    const card = ownerPage.locator(`[data-slot="kanban-item"][data-value="${task.taskId}"]`);
    const targetColumn = ownerPage.locator('[data-slot="kanban-column"][data-value="in_progress"]');
    await expect(card).toBeVisible({ timeout: 10_000 });

    const source = await card.boundingBox();
    const target = await targetColumn.boundingBox();
    if (!source || !target) throw new Error('Could not measure drag source/target');

    // dnd-kit's PointerSensor needs a real move sequence past its activation
    // distance (10px, see `kanban.tsx`'s MOUSE_SENSOR_OPTIONS) before it
    // starts tracking a drag at all — a single jump straight to the target
    // reads as a click, not a drag.
    await ownerPage.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
    await ownerPage.mouse.down();
    await ownerPage.mouse.move(source.x + source.width / 2 + 30, source.y + source.height / 2, { steps: 5 });
    await ownerPage.mouse.move(target.x + target.width / 2, target.y + 60, { steps: 10 });

    const [reorderResponse] = await Promise.all([
      ownerPage.waitForResponse(
        (r) => r.url().includes(`/tasks/${task.taskId}/reorder`) && r.request().method() === 'PATCH',
      ),
      ownerPage.mouse.up(),
    ]);
    expect(reorderResponse.ok()).toBeTruthy();

    const { data: after } = await apiRequest(`/workspaces/${SLUG}/projects/${key}/tasks/${task.taskKey}`, owner.accessToken);
    expect(after.task.status).toBe('in_progress');
  } finally {
    await apiRequest(`/workspaces/${SLUG}/projects/${key}`, owner.accessToken, { method: 'DELETE' });
  }
});

/**
 * Regression test for a real "Maximum update depth exceeded" crash: a fast,
 * successive sequence of drags on a *large* column reliably threw inside
 * dnd-kit's `DndContext` and took down the whole board behind the route's
 * error boundary.
 *
 * Root cause was two unstable function props passed to the vendored `Kanban`
 * root every render — `getItemValue` (`BoardPage` passed a fresh
 * `(t) => t.taskId` arrow) and `onValueCommit` (`onBoardCommit`, an
 * unmemoized function). Both sit in the dependency arrays of several of
 * `kanban.tsx`'s *own* internal `useCallback`s (`commitChange`,
 * `handleDragStart`, `handleDragOver`, `handleDragEnd`) — so a fresh
 * identity on every render silently rebuilt dnd-kit's own drag handlers,
 * which cascades into the crash once drags come fast enough. `getItemValue`
 * alone was not sufficient; only fixing both closed it. A single deliberate
 * drag (the test above) never hit this — it needs several drags in quick
 * succession, and a source column large enough that dnd-kit's per-move
 * remeasuring has real work to do.
 *
 * A fresh project again, seeded with 20 tasks directly via the API so the
 * "done" column starts large without 20 rounds of UI creation.
 */
test('rapid successive drags on a large column do not crash the board', async ({ ownerPage }) => {
  const owner = await apiLogin(TEST_USERS.owner.email);
  const key = await createProject(owner.accessToken);

  try {
    for (let i = 0; i < 20; i++) {
      const { status } = await apiRequest(`/workspaces/${SLUG}/projects/${key}/tasks`, owner.accessToken, {
        method: 'POST',
        body: JSON.stringify({ title: `Bulk task ${i}`, status: 'done', issueType: 'task', priority: 'medium' }),
      });
      expect(status).toBe(201);
    }

    const pageErrors: string[] = [];
    ownerPage.on('pageerror', (err) => pageErrors.push(err.message));

    await ownerPage.goto(ROUTES.projectBoard(SLUG, key));
    const doneColumn = ownerPage.locator('[data-slot="kanban-column"][data-value="done"]');
    const otherStatuses = ['todo', 'in_progress', 'in_review'] as const;
    await expect(doneColumn.locator('[data-slot="kanban-item"]')).toHaveCount(20, { timeout: 10_000 });

    // Always drags *from* the large "done" column (which starts with 20 and
    // only loses a handful over this loop) rather than chaining off where the
    // previous drag landed — what this test cares about is firing many fast
    // drags in succession without a crash, not that each one lands exactly
    // where aimed. `to` is re-measured fresh every call since prior drags
    // change every column's height.
    async function fastDrag(toStatus: string) {
      const card = doneColumn.locator('[data-slot="kanban-item"]').first();
      const to = ownerPage.locator(`[data-slot="kanban-column"][data-value="${toStatus}"]`);
      const source = await card.boundingBox();
      const target = await to.boundingBox();
      if (!source || !target) return;
      await ownerPage.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
      await ownerPage.mouse.down();
      // Deliberately few steps and almost no settle time between drags —
      // the slow, deliberate pattern above never reproduced the crash; only
      // a fast, successive sequence did.
      await ownerPage.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 3 });
      await ownerPage.mouse.up();
      await ownerPage.waitForTimeout(80);
    }

    for (let i = 0; i < 8; i++) {
      await fastDrag(otherStatuses[i % otherStatuses.length]);
    }

    expect(pageErrors).toEqual([]);
    // The board must still be interactive, not stuck behind the error boundary.
    await expect(ownerPage.locator('[data-slot="kanban-column"]').first()).toBeVisible();
  } finally {
    await apiRequest(`/workspaces/${SLUG}/projects/${key}`, owner.accessToken, { method: 'DELETE' });
  }
});
