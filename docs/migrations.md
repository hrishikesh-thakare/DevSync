# Migrations

Migrations live in `backend/src/db/migrations/`, with `meta/_journal.json`
listing them in order and `meta/NNNN_snapshot.json` recording the schema as of
each one.

| Command | When |
| :--- | :--- |
| `npm run db:generate` | Author a migration from a schema change (local) |
| `npm run db:migrate` | Apply migrations locally (drizzle-kit) |
| `npm run db:deploy` | Apply migrations in production (drizzle-orm's migrator) |

`db:deploy` exists because drizzle-kit is a devDependency and is not installed
on a deployed host. Both read the same journal and the same `.sql` files.

> **Keep `meta/` free of anything that is not JSON.** drizzle-kit parses every
> file in that directory as a snapshot; a stray `README.md` makes it exit with
> `SyntaxError: Unexpected token '#'`, which is why this document lives here.

---

## The snapshot drift, and how it was closed

**Symptom.** `_journal.json` listed 13 migrations (0000→0012) but `meta/` held
snapshots only through `0008`. Migrations 0009–0012 were hand-written and
appended to the journal without generating one.

**Why it mattered.** `drizzle-kit generate` produces a migration by diffing the
TypeScript schema against the *latest snapshot*. With that stuck at 0008, it
could not see that 0012 had run, and re-emitted 0012's table, column, foreign
keys and indexes as though they were new work. Anyone who trusted its output
would have committed a migration that tried to re-create objects that already
existed.

**The fix.** `0013_resync_snapshot` — a migration whose only real payload is
`meta/0013_snapshot.json`, generated from the current schema. `generate` now
diffs against reality and reports *"No schema changes, nothing to migrate"*.

The `.sql` file is deliberately a `SELECT 1;`. Everything the snapshot describes
is already created by 0012, which sits earlier in the journal and so runs first
on a fresh database, and which carries its own `IF NOT EXISTS` guards for an
existing one.

Restating that DDL in 0013 would have been actively harmful, which is worth
recording because it is not obvious. 0012 declares its foreign keys **inline**
in `CREATE TABLE`, so Postgres names them:

```
task_status_transitions_task_id_fkey
```

A drizzle-generated migration names the identical constraints:

```
task_status_transitions_task_id_tasks_task_id_fk
```

So a guard of the form `IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname
= '<drizzle name>')` finds no match on a database that already ran 0012, and
adds a **second, duplicate** foreign key enforcing the same rule on every write.
Verified against the live schema: the three constraints exist under the `_fkey`
names, and 0013 leaves the count at three.

---

## What snapshots still cannot describe

`0010_custom_pg_features` creates things Drizzle has no declarative form for:

- `tsvector` generated columns for full-text search
- GIN indexes over them
- circular and self-referencing foreign keys

These are absent from `schema/*.ts`, therefore absent from every snapshot, and
must stay hand-written. **A future `generate` that omits them is correct — do
not "fix" it.**

---

## Authoring a migration

1. Edit `backend/src/db/schema/*.ts`.
2. `npm run db:generate`.
3. **Read the generated SQL before committing it.** It is a diff against the
   snapshot, not against your database.
4. If the change needs Postgres features Drizzle cannot express, write the
   migration by hand instead, following the style of 0010 and 0012: guard every
   statement with `IF NOT EXISTS` or a `DO $$ ... $$` catalogue check, so
   re-application is a no-op. Then append it to `_journal.json` — and be aware
   that doing so reopens exactly the drift described above, so run
   `db:generate` afterwards to bring the snapshot back in step.

## Current state

As of migration `0019_minor_king_bedlam`, the journal holds **20 migrations
(0000–0019)** and the database records 19 applied. The 12-vs-13 drift described
in older revisions of this document resolved itself on a subsequent deploy
exactly as predicted — both migrations involved were idempotent — and needs no
further action.

Migrations added after the 0013 resync, for orientation:

| Migration | What it does |
| :--- | :--- |
| `0014_integrity_and_indexes` | Partial unique indexes on `users.email` and `users.github_id` scoped to live (non-soft-deleted) rows, so a deleted address can be re-registered; a `(project, run)` unique on `github_ci_status`; plus assignee/reporter/due-date indexes on `tasks` |
| `0015_resync_snapshot` | A **second** snapshot resync, same mechanism as 0013 — hand-written migrations had again moved ahead of `meta/` |
| `0016_refresh_token_family` | `refresh_tokens.family_id` + index — enables reuse detection across a whole rotation chain |
| `0017_project_soft_delete` | `projects.deleted_at` and a `(workspace, key)` unique index |
| `0018` | **Drops `sprints.ai_contribution_report`** — the per-person AI judgement feature, removed as an anti-pattern |
| `0019` | `github_ci_status.ai_failure_summary` — cached AI explanation of a failed CI run |

That 0015 is a *second* resync is the point worth taking from this table: the
drift described above is not a one-off historical incident, it recurs whenever
a hand-written migration lands without a follow-up `db:generate`.

The rule from the resync still stands: **anything hand-written must be followed
by `db:generate`** so the snapshot stays in step, or the drift reopens.
