import { Link, Navigate } from 'react-router-dom';
import {
  ActivityIcon,
  ArrowRightIcon,
  GitBranchIcon,
  KanbanSquareIcon,
  MessagesSquareIcon,
  TimerIcon,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuthStore } from '@/store/auth';

const FEATURES = [
  {
    icon: KanbanSquareIcon,
    title: 'Boards and backlog',
    body: 'Drag tasks across To Do, In Progress, In Review and Done. Ranks persist, so the order you set is the order everyone sees.',
  },
  {
    icon: TimerIcon,
    title: 'Sprints',
    body: 'Plan from the backlog, start a sprint, and watch scope and completed points move as the team works.',
  },
  {
    icon: MessagesSquareIcon,
    title: 'Channels',
    body: 'Workspace and project channels with threads, reactions, mentions and edits — delivered over a live socket.',
  },
  {
    icon: GitBranchIcon,
    title: 'GitHub integration',
    body: 'Connect a repository to see commits, pull requests, issues, branches and CI runs beside the work they belong to.',
  },
  {
    icon: ActivityIcon,
    title: 'Notifications that resolve',
    body: 'Every notification carries a server-computed deep link straight to the task, comment or message that caused it.',
  },
] as const;

/**
 * The signed-out front door at `/`. An authenticated visitor never sees it —
 * they are sent to the picker, which is where `/` used to redirect outright.
 */
export function LandingPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (isAuthenticated) {
    return <Navigate to="/workspaces" replace />;
  }

  return (
    <div className="min-h-svh bg-background">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
        <span className="text-lg font-medium tracking-tight text-foreground">DevSync</span>
        <nav className="flex items-center gap-2">
          <Button variant="ghost" asChild>
            <Link to="/login">Sign in</Link>
          </Button>
          <Button asChild>
            <Link to="/register">Get started</Link>
          </Button>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-5xl px-6 pb-20">
        <section className="py-16 md:py-24">
          <Badge variant="outline" className="mb-5">
            Workspaces · Projects · Sprints
          </Badge>
          <h1 className="max-w-3xl text-4xl leading-tight font-medium tracking-tight text-balance text-foreground md:text-5xl">
            Agile planning and team chat, in one place.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
            DevSync keeps the board, the backlog, the sprint, the conversation and the repository
            side by side — so the work and the talk about the work never drift apart.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button size="lg" asChild>
              <Link to="/register">
                Create your workspace
                <ArrowRightIcon className="size-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/login">Sign in</Link>
            </Button>
          </div>
        </section>

        <section aria-label="Features" className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <Card key={title}>
              <CardContent className="flex flex-col gap-3">
                <span className="flex size-9 items-center justify-center rounded-xl border bg-muted/40">
                  <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                </span>
                <h2 className="font-medium text-foreground">{title}</h2>
                <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="mt-16 rounded-2xl border p-8 text-center">
          <h2 className="text-xl font-medium text-foreground">Ready when your team is</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Invite the people you work with, spin up a project, and start your first sprint.
          </p>
          <Button className="mt-6" asChild>
            <Link to="/register">Get started free</Link>
          </Button>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-sm text-muted-foreground">
          <span>DevSync</span>
          <span>Built for teams that ship.</span>
        </div>
      </footer>
    </div>
  );
}
