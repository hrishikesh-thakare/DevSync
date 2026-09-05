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
