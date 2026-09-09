import { describe, it, expect } from 'vitest';
import { completedAtFor, DONE_STATUS } from './task-transitions.js';

/**
 * `tasks.completed_at` is what every cycle-time and throughput chart reads, so
 * the three-way return here matters: a Date stamps completion, `null` clears it
 * on reopen, and `undefined` means "leave the column alone". Collapsing the
 * last two would silently wipe the timestamp on every unrelated status change.
 */
describe('completedAtFor', () => {
  const at = new Date('2026-03-14T10:00:00Z');

  it('stamps the timestamp when a task enters done', () => {
    expect(completedAtFor('in_review', DONE_STATUS, at)).toEqual(at);
    expect(completedAtFor(null, DONE_STATUS, at)).toEqual(at);
  });

  it('clears the timestamp when a task leaves done', () => {
    expect(completedAtFor(DONE_STATUS, 'in_progress', at)).toBeNull();
    expect(completedAtFor(DONE_STATUS, 'todo', at)).toBeNull();
  });

  it('leaves the column untouched for a move that does not cross the boundary', () => {
    expect(completedAtFor('todo', 'in_progress', at)).toBeUndefined();
    expect(completedAtFor('in_progress', 'in_review', at)).toBeUndefined();
    expect(completedAtFor(null, 'todo', at)).toBeUndefined();
  });

  it('leaves the column untouched for a done → done no-op', () => {
    // Re-saving a done task must not move its completion date forward, or every
    // edit would reset the task's measured cycle time.
    expect(completedAtFor(DONE_STATUS, DONE_STATUS, at)).toBeUndefined();
  });

  it('defaults to now when no timestamp is supplied', () => {
    const before = Date.now();
    const result = completedAtFor('todo', DONE_STATUS);
    expect(result).toBeInstanceOf(Date);
    expect((result as Date).getTime()).toBeGreaterThanOrEqual(before);
  });
});
