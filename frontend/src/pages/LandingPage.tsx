import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  ArrowRightIcon,
  CheckIcon,
  GitBranchIcon,
  GitPullRequestIcon,
  HashIcon,
  MinusIcon,
  PlusIcon,
  ShieldCheckIcon,
  SparklesIcon,
  XIcon,
  ZapIcon,
} from 'lucide-react';

import { LogoMark } from '@/components/Logo';
import { useAuthStore } from '@/store/auth';
import { cn } from '@/lib/utils';

/**
 * The signed-out front door at `/`.
 *
 * Deliberately built from plain markup rather than the app's shadcn primitives.
 * Those components are tuned for dense product surfaces — compact paddings,
 * restrained type, muted borders — which is exactly wrong for a page whose job
 * is to sell. Marketing type wants to be bigger, looser and louder than product
 * type, and fighting a design system into that shape produces something that
 * looks like neither.
 *
 * Layout runs edge to edge: sections are full-bleed and set their own inner
 * width, so the hero and the section bands can span the viewport while running
 * text stays at a readable measure.
 *
 * The testimonials and company names are fictional, at the project owner's
 * direction. They are invented outfits — no real company is quoted or implied.
 */

const COMPANIES = ['Northwind Labs', 'Meridian Systems', 'Kestrel Robotics', 'Halcyon Data', 'Arbor Health', 'Vantive'];

const STATS = [
  { value: '298', label: 'automated tests' },
  { value: '40%', label: 'less context switching' },
  { value: '<50ms', label: 'message delivery' },
  { value: '2 min', label: 'to first sprint' },
];

const TESTIMONIALS = [
  {
    quote:
      'We had Jira open in one tab and Slack in another, and the two never agreed. Moving to DevSync collapsed that into one screen. Standups got shorter because nobody had to reconstruct what happened.',
    name: 'Priya Raghunathan',
    role: 'Engineering Manager',
    company: 'Northwind Labs',
    initials: 'PR',
  },
  {
    quote:
      'The GitHub linking is the part I did not expect to care about. A branch named for a task moves the card on its own, so the board is accurate without anyone maintaining it.',
    name: 'Tomas Lindqvist',
    role: 'Staff Engineer',
    company: 'Kestrel Robotics',
    initials: 'TL',
  },
  {
    quote:
      'Our contractors can read the project and touch nothing. Setting that up elsewhere took a permissions matrix and a support ticket. Here it was one dropdown.',
    name: 'Adaeze Okonkwo',
    role: 'Head of Product',
    company: 'Meridian Systems',
    initials: 'AO',
  },
];

const FAQS = [
  {
    q: 'How is this different from using Jira and Slack together?',
    a: 'Those are two products with two databases, and the seam between them is where context goes missing. DevSync stores the task and the conversation in one schema, so a message can reference a card and a card can show the discussion that produced it. There is no integration to configure and nothing to keep in sync, because there is only one system.',
  },
  {
    q: 'Can I import my existing board?',
    a: 'Not yet. Today you create projects and tasks in DevSync directly, or open them from GitHub issues once a repository is connected. A CSV importer is the most requested addition and is the next thing on the roadmap.',
  },
  {
    q: 'How do permissions actually work?',
    a: 'Two independent layers. Workspace roles (owner, admin, member) decide who can create projects, invite people and change settings. Project roles (project admin, developer, viewer) decide who can move a card. A workspace owner is implicitly an admin on every project; a project viewer is read-only regardless of seniority elsewhere. Every rule is enforced on the server for both HTTP requests and socket subscriptions.',
  },
  {
    q: 'Is my data private?',
    a: 'Workspaces are private by default and invisible to anyone you have not invited. Passwords are hashed with bcrypt, sessions use short-lived tokens with revocable refresh tokens, and connected GitHub credentials are encrypted at rest with AES-256-GCM.',
  },
  {
    q: 'Does it work for non-engineers?',
    a: 'Yes. Designers, PMs and stakeholders live in the channels and the roadmap view without touching a board. The GitHub surfaces only appear on projects with a repository connected, so they never clutter the view for people who do not need them.',
  },
  {
    q: 'What does it cost?',
    a: 'Free while in development, with no card required and no seat limit. There is no trial to expire — create a workspace and keep it.',
  },
];

export function LandingPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (isAuthenticated) {
    return <Navigate to="/workspaces" replace />;
  }

  return (
    <div className="min-h-svh overflow-x-hidden bg-[#08080A] text-zinc-100 antialiased">
      <Nav />
      <Hero />
      <TrustBar />
      <Stats />
      <Features />
      <WhySwitch />
      <Testimonials />
      <Faq />
      <FinalCta />
      <Footer />
    </div>
  );
}

/* ── Navigation ──────────────────────────────────────────────────────────── */

function Nav() {
  return (
    <header className="fixed inset-x-0 top-4 z-50 flex justify-center px-4 md:px-12 md:top-6">
      <div className="flex w-full max-w-[1500px] items-center justify-between rounded-full border border-white/[0.08] bg-[#08080A] px-4 py-2.5 shadow-2xl md:px-6">
        
        {/* Left: Logo */}
        <div className="flex flex-1 items-center">
          <Link to="/" className="flex items-center gap-2 pl-2">
            <LogoMark className="size-6 text-primary" />
            <span className="text-[16px] font-semibold tracking-[-0.02em]">DevSync</span>
          </Link>
        </div>

        {/* Center: Nav Links */}
        <nav className="hidden items-center justify-center gap-9 md:flex">
          {[
            ['Features', '#features'],
            ['Why switch', '#why'],
            ['Customers', '#customers'],
            ['FAQ', '#faq'],
          ].map(([label, href]) => (
            <a
              key={label}
              href={href}
              className="text-[15px] font-bold text-zinc-300 transition-colors hover:text-white"
            >
              {label}
            </a>
          ))}
        </nav>

        {/* Right: Actions */}
        <div className="flex flex-1 items-center justify-end gap-2">
          <Link
            to="/login"
            className="rounded-full px-4 py-2 text-[13.5px] font-medium text-zinc-300 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            Sign in
          </Link>
          <Link
            to="/register"
            className="rounded-full bg-primary px-5 py-2 text-[13.5px] font-semibold text-white transition-all hover:bg-primary/90 hover:shadow-[0_0_15px_-3px_var(--color-primary)]"
          >
            Get started
          </Link>
        </div>

      </div>
    </header>
  );
}

/* ── Hero ────────────────────────────────────────────────────────────────── */

function Hero() {
  return (
    <section className="relative isolate overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.05]"
        style={{
          backgroundImage:
            'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(70% 60% at 50% 0%, black, transparent)',
        }}
      />

      <div className="mx-auto w-full max-w-[1500px] px-6 pt-24 pb-16 lg:px-12 lg:pt-32">
        <div className="mx-auto max-w-5xl text-center">
          <a
            href="#features"
            className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 py-1.5 pr-4 pl-1.5 text-[13px] text-zinc-200 backdrop-blur-md transition-colors hover:border-primary/50 hover:bg-primary/20"
          >
            <span className="flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-white uppercase shadow-[0_0_12px_var(--color-primary)]">
              <SparklesIcon className="size-3" aria-hidden="true" />
              New
            </span>
            Sprint analytics and GitHub CI, now built in
            <ArrowRightIcon className="size-3.5" aria-hidden="true" />
          </a>

          <h1 className="mx-auto mt-10 max-w-[min(100%,68rem)] text-[clamp(2.5rem,6.5vw,5.5rem)] leading-[1.05] font-bold tracking-[-0.04em]">
            Your board and your team,
            <br />
            <span className="text-white">
              finally in one place.
            </span>
          </h1>

          <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-zinc-400 sm:text-xl">
            Your issue tracker says a task moved. Your chat app says why. DevSync puts the board,
            the sprint, the conversation and the repository in a single workspace — so the work and
            the talk about the work never drift apart.
          </p>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/register"
              className="group relative inline-flex items-center gap-2 rounded-xl bg-primary px-7 py-4 text-[16px] font-semibold text-white transition-all hover:scale-[1.02] hover:bg-primary/90 hover:shadow-[0_0_30px_-5px_var(--color-primary)]"
            >
              Start free — no card
              <ArrowRightIcon
                className="size-4 transition-transform group-hover:translate-x-1"
                aria-hidden="true"
              />
            </Link>
            <a
              href="#features"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-7 py-4 text-[16px] font-medium text-zinc-200 backdrop-blur-md transition-all hover:bg-white/10 hover:border-white/20"
            >
              See how it works
            </a>
          </div>

          <p className="mt-6 flex items-center justify-center gap-2 text-[13.5px] font-medium text-zinc-500">
            <ShieldCheckIcon className="size-4 text-emerald-500/80" aria-hidden="true" />
            <span className="text-balance">
              Private by default · Free while in development · Set up in under two minutes
            </span>
          </p>
        </div>

        <div className="relative mt-20 lg:mt-24">
          <div className="absolute inset-0 -top-8 -bottom-8 -z-10 scale-[0.95] bg-primary/20 blur-[100px] rounded-[3rem] opacity-50"></div>
          <BoardPreview />
        </div>
      </div>
    </section>
  );
}

/* ── Trust bar ───────────────────────────────────────────────────────────── */

function TrustBar() {
  return (
    <section className="border-y border-white/[0.06] bg-white/[0.015]">
      <div className="mx-auto w-full max-w-[1500px] px-6 py-10 lg:px-12">
        <p className="text-center text-[12px] font-medium tracking-[0.18em] text-zinc-500 uppercase">
          Teams shipping with DevSync
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
          {COMPANIES.map((name) => (
            <span
              key={name}
              className="text-[17px] font-semibold tracking-tight text-zinc-500/80 transition-colors hover:text-zinc-300"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Stats ───────────────────────────────────────────────────────────────── */

function Stats() {
  return (
    <section className="mx-auto w-full max-w-[1500px] px-6 py-20 lg:px-12">
      <div className="grid grid-cols-2 gap-x-8 gap-y-12 lg:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.label} className="text-center">
            <div className="text-5xl font-semibold tracking-tight tabular-nums text-white lg:text-6xl">
              {s.value}
            </div>
            <div className="mt-2 text-sm text-zinc-500">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── Features ────────────────────────────────────────────────────────────── */

const FEATURES = [
  {
    eyebrow: 'Plan',
    title: 'A backlog that keeps its order',
    body: 'Drag a card and the rank persists — the order you set is the order everyone sees, computed with fractional indexing so two people reordering at once never fight. Plan from the backlog, start the sprint, and watch scope and completed points move in real time.',
    points: ['Board, backlog, roadmap, calendar and epics over one ranked list', 'Sprints with velocity, story points and burndown', 'Subtasks, labels, priorities, due dates and attachments'],
    visual: <SprintPreview />,
  },
  {
    eyebrow: 'Discuss',
    title: 'The conversation, next to the work',
    body: 'Workspace rooms and project channels with threads, reactions, mentions, edits and files. Messages arrive over a live socket, so a reply lands while you are still reading the card it is about — and every message can point straight at a task.',
    points: ['Threaded replies, reactions and read state', 'Markdown, code blocks and rich link previews', 'Direct messages, private channels and voice notes'],
    visual: <ChatPreview />,
    flip: true,
  },
  {
    eyebrow: 'Ship',
    title: 'Commits that find their own task',
    body: 'Connect a repository and DevSync links commits, pull requests, issues and branches to the tasks they mention. Push to a branch named for a task and it moves to In Progress on its own. CI status appears beside the card it belongs to, not in a separate tab.',
    points: ['Smart-commit linking by task key', 'Live GitHub Actions runs, with re-run from the board', 'Open branches and pull requests without leaving the task'],
    visual: <GitHubPreview />,
  },
];

function Features() {
  return (
    <section id="features" className="scroll-mt-20 border-t border-white/[0.06]">
      <div className="mx-auto w-full max-w-[1500px] px-6 py-24 lg:px-12">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-[12px] font-semibold tracking-[0.18em] text-primary uppercase">
            Everything in one workspace
          </p>
          <h2 className="mt-4 text-[clamp(2rem,4vw,3.25rem)] leading-[1.05] font-semibold tracking-[-0.03em] text-balance">
            Three jobs that usually need three tools.
          </h2>
          <p className="mt-5 text-lg text-zinc-400">
            Not integrations bolted together — one product, one database, one set of permissions.
          </p>
        </div>

        <div className="mt-20 space-y-28">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20"
            >
              <div className={cn(f.flip && 'lg:order-2')}>
                <p className="text-[12px] font-semibold tracking-[0.18em] text-primary uppercase">
                  {f.eyebrow}
                </p>
                <h3 className="mt-4 text-[clamp(1.6rem,3vw,2.4rem)] leading-tight font-semibold tracking-[-0.025em] text-balance">
                  {f.title}
                </h3>
                <p className="mt-5 text-[17px] leading-relaxed text-zinc-400">{f.body}</p>
                <ul className="mt-8 space-y-3.5">
                  {f.points.map((p) => (
                    <li key={p} className="flex items-start gap-3 text-[15px] text-zinc-300">
                      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15">
                        <CheckIcon className="size-3 text-primary" aria-hidden="true" />
                      </span>
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
              <div className={cn(f.flip && 'lg:order-1')}>{f.visual}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Why switch ──────────────────────────────────────────────────────────── */

const COMPARISON = [
  ['One place for the task and the discussion about it', true, false],
  ['Board updates without anyone maintaining it', true, false],
  ['Permissions that follow the person across both', true, false],
  ['Two subscriptions, two logins, two bills', false, true],
  ['Context lost in the gap between tools', false, true],
  ['An integration to configure and babysit', false, true],
];

function WhySwitch() {
  return (
    <section id="why" className="scroll-mt-20 border-t border-white/[0.06] bg-white/[0.015]">
      <div className="mx-auto w-full max-w-[1500px] px-6 py-24 lg:px-12">
        <div className="grid items-center gap-16 lg:grid-cols-2 lg:gap-24">
          <div>
            <p className="text-[12px] font-semibold tracking-[0.18em] text-primary uppercase">
              Why teams switch
            </p>
            <h2 className="mt-4 text-[clamp(2rem,4vw,3.25rem)] leading-[1.05] font-semibold tracking-[-0.03em] text-balance">
              The tab you keep switching to is the problem.
            </h2>
            <p className="mt-6 text-[17px] leading-relaxed text-zinc-400">
              A tracker records that something changed. A chat app records why. Keeping them apart
              means every decision lives in one tool and every task in another, and the person who
              needs both has to reconstruct the story from scratch.
            </p>
            <p className="mt-4 text-[17px] leading-relaxed text-zinc-400">
              DevSync is not an integration between the two. It is one product where a message can
              reference a card, a card shows the discussion that produced it, and a commit moves
              both — with a single permission model deciding who sees what.
            </p>

            <Link
              to="/register"
              className="group mt-9 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-primary/90"
            >
              Move your team over
              <ArrowRightIcon
                className="size-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0D0D10]">
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 border-b border-white/10 px-6 py-4 text-[12px] font-semibold tracking-[0.1em] text-zinc-500 uppercase">
              <span />
              <span className="w-20 text-center text-primary">DevSync</span>
              <span className="w-20 text-center">Two tools</span>
            </div>
            {COMPARISON.map(([label, devsync, other]) => (
              <div
                key={label as string}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 border-b border-white/[0.06] px-6 py-4 last:border-0"
              >
                <span className="text-[14.5px] text-zinc-300">{label as string}</span>
                <span className="flex w-20 justify-center">
                  {devsync ? (
                    <CheckIcon className="size-4 text-emerald-400" aria-hidden="true" />
                  ) : (
                    <XIcon className="size-4 text-zinc-700" aria-hidden="true" />
                  )}
                </span>
                <span className="flex w-20 justify-center">
                  {other ? (
                    <CheckIcon className="size-4 text-zinc-600" aria-hidden="true" />
                  ) : (
                    <XIcon className="size-4 text-zinc-700" aria-hidden="true" />
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Testimonials ────────────────────────────────────────────────────────── */

function Testimonials() {
  return (
    <section id="customers" className="scroll-mt-20 border-t border-white/[0.06]">
      <div className="mx-auto w-full max-w-[1500px] px-6 py-24 lg:px-12">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-[12px] font-semibold tracking-[0.18em] text-primary uppercase">
            Customers
          </p>
          <h2 className="mt-4 text-[clamp(2rem,4vw,3.25rem)] leading-[1.05] font-semibold tracking-[-0.03em] text-balance">
            Fewer tabs. Shorter standups.
          </h2>
        </div>

        <div className="mt-16 grid gap-6 lg:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <figure
              key={t.name}
              className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-8"
            >
              <blockquote className="flex-1 text-[16px] leading-relaxed text-zinc-200">
                “{t.quote}”
              </blockquote>
              <figcaption className="mt-8 flex items-center gap-3.5 border-t border-white/[0.08] pt-6">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[13px] font-semibold text-primary">
                  {t.initials}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[14.5px] font-medium text-white">
                    {t.name}
                  </span>
                  <span className="block truncate text-[13px] text-zinc-500">
                    {t.role}, {t.company}
                  </span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── FAQ ─────────────────────────────────────────────────────────────────── */

function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="scroll-mt-20 border-t border-white/[0.06] bg-white/[0.015]">
      <div className="mx-auto w-full max-w-[1500px] px-6 py-24 lg:px-12">
        <div className="grid gap-14 lg:grid-cols-[minmax(0,22rem)_1fr] lg:gap-24">
          <div>
            <p className="text-[12px] font-semibold tracking-[0.18em] text-primary uppercase">
              FAQ
            </p>
            <h2 className="mt-4 text-[clamp(2rem,3.5vw,2.75rem)] leading-[1.05] font-semibold tracking-[-0.03em] text-balance">
              Questions, answered.
            </h2>
            <p className="mt-5 text-[15px] leading-relaxed text-zinc-400">
              Still unsure about something? Create a workspace and look around — nothing is behind a
              sales call.
            </p>
          </div>

          <div className="divide-y divide-white/[0.08] border-y border-white/[0.08]">
            {FAQS.map((item, i) => {
              const isOpen = open === i;
              return (
                <div key={item.q}>
                  <h3>
                    <button
                      type="button"
                      onClick={() => setOpen(isOpen ? null : i)}
                      aria-expanded={isOpen}
                      className="flex w-full items-start gap-6 py-6 text-left transition-colors hover:text-white"
                    >
                      <span className="flex-1 text-[17px] font-medium text-zinc-100">{item.q}</span>
                      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-white/15 text-zinc-400">
                        {isOpen ? (
                          <MinusIcon className="size-3.5" aria-hidden="true" />
                        ) : (
                          <PlusIcon className="size-3.5" aria-hidden="true" />
                        )}
                      </span>
                    </button>
                  </h3>
                  {/* Grid-rows trick animates to the content's natural height,
                      which `max-height` guesswork never does correctly. */}
                  <div
                    className={cn(
                      'grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none',
                      isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
                    )}
                  >
                    <div className="overflow-hidden">
                      <p className="max-w-2xl pb-7 text-[15.5px] leading-relaxed text-zinc-400">
                        {item.a}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Final CTA ───────────────────────────────────────────────────────────── */

function FinalCta() {
  return (
    <section className="relative isolate overflow-hidden border-t border-white/[0.06]">
      <div className="mx-auto w-full max-w-[1500px] px-6 py-32 text-center lg:px-12">
        <h2 className="mx-auto max-w-3xl text-[clamp(2.5rem,5vw,4.5rem)] leading-[1.05] font-bold tracking-[-0.04em] text-balance">
          Start with one project and a channel.
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-lg text-zinc-400">
          Create a workspace, invite the people you work with, and run your first sprint. It takes
          about two minutes.
        </p>
        <div className="mt-12 flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/register"
            className="group relative inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-4 text-[16px] font-semibold text-white transition-all hover:scale-[1.02] hover:bg-primary/90 hover:shadow-[0_0_30px_-5px_var(--color-primary)]"
          >
            Create your workspace
            <ArrowRightIcon
              className="size-4 transition-transform group-hover:translate-x-1"
              aria-hidden="true"
            />
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center rounded-xl border border-white/10 bg-white/5 px-8 py-4 text-[16px] font-medium text-zinc-200 backdrop-blur-md transition-all hover:bg-white/10 hover:border-white/20"
          >
            Sign in
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ── Footer ──────────────────────────────────────────────────────────────── */

function Footer() {
  const columns = [
    { title: 'Product', links: ['Features', 'Why switch', 'Customers', 'FAQ'] },
    { title: 'Workspace', links: ['Boards', 'Sprints', 'Channels', 'Analytics'] },
    { title: 'Company', links: ['About', 'Changelog', 'Careers', 'Contact'] },
    { title: 'Legal', links: ['Privacy', 'Terms', 'Security', 'Status'] },
  ];

  return (
    <footer className="border-t border-white/[0.06]">
      <div className="mx-auto w-full max-w-[1500px] px-6 py-16 lg:px-12">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div>
            <span className="flex items-center gap-2.5">
              <LogoMark className="size-7 text-primary" />
              <span className="text-[17px] font-semibold tracking-[-0.02em]">DevSync</span>
            </span>
            <p className="mt-4 max-w-xs text-[14px] leading-relaxed text-zinc-500">
              Agile planning and team chat in one workspace, for teams that would rather ship than
              switch tabs.
            </p>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="text-[13px] font-semibold text-zinc-200">{col.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l}>
                    <span className="text-[14px] text-zinc-500 transition-colors hover:text-zinc-300">
                      {l}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-white/[0.06] pt-8 sm:flex-row sm:items-center">
          <p className="text-[13px] text-zinc-600">
            © {new Date().getFullYear()} DevSync. All rights reserved.
          </p>
          <p className="text-[13px] text-zinc-600 sm:ml-auto">Built for teams that ship.</p>
        </div>
      </div>
    </footer>
  );
}

/* ── Product previews ────────────────────────────────────────────────────────
   Static renderings of real surfaces. `aria-hidden` throughout: they are
   pictures of an interface, and a screen reader walking a fake Kanban board
   would be noise rather than content.
   ─────────────────────────────────────────────────────────────────────────── */

const COLUMNS = [
  {
    status: 'To Do',
    dot: 'bg-zinc-500',
    cards: [
      { key: 'PLAT-142', title: 'Rate-limit the invite endpoint', priority: 'High', tone: 'text-amber-400', who: 'AC' },
      { key: 'PLAT-138', title: 'Backfill completed_at for analytics', priority: 'Low', tone: 'text-zinc-500', who: 'DP' },
    ],
  },
  {
    status: 'In Progress',
    dot: 'bg-blue-400',
    cards: [
      { key: 'PLAT-131', title: 'Socket reconnect drops room membership', priority: 'Critical', tone: 'text-primary', who: 'BS' },
    ],
  },
  {
    status: 'In Review',
    dot: 'bg-amber-400',
    cards: [
      { key: 'PLAT-127', title: 'Fractional ranks collide on tie', priority: 'Medium', tone: 'text-zinc-400', who: 'CN' },
    ],
  },
  {
    status: 'Done',
    dot: 'bg-emerald-400',
    cards: [
      { key: 'PLAT-119', title: 'Persist board filters per user', priority: 'Medium', tone: 'text-zinc-400', who: 'ER' },
    ],
  },
];

function Frame({ url, children }: { url: string; children: React.ReactNode }) {
  return (
    <div
      aria-hidden="true"
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0D0D10]/80 backdrop-blur-sm shadow-2xl shadow-black ring-1 ring-white/5 transition-transform duration-500 hover:scale-[1.01]"
    >
      <div className="flex items-center gap-2 border-b border-white/[0.07] bg-white/[0.02] px-4 py-3">
        <span className="size-2.5 rounded-full bg-white/10" />
        <span className="size-2.5 rounded-full bg-white/10" />
        <span className="size-2.5 rounded-full bg-white/10" />
        <span className="ml-3 truncate font-mono text-[11.5px] text-zinc-500">{url}</span>
      </div>
      {children}
    </div>
  );
}

function BoardPreview() {
  return (
    <Frame url="devsync.app/w/acme/projects/PLAT">
      <div className="flex gap-4 overflow-x-auto p-5">
        {COLUMNS.map((col) => (
          <div key={col.status} className="w-[250px] shrink-0 lg:w-auto lg:flex-1">
            <div className="mb-3 flex items-center gap-2">
              <span className={cn('size-2 rounded-full', col.dot)} />
              <span className="text-[13.5px] font-medium text-zinc-200">{col.status}</span>
              <span className="text-[12px] text-zinc-600">{col.cards.length}</span>
            </div>
            <div className="space-y-2.5">
              {col.cards.map((card) => (
                <div
                  key={card.key}
                  className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3.5"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-zinc-600">{card.key}</span>
                    <span className={cn('ml-auto text-[10px] font-semibold uppercase', card.tone)}>
                      {card.priority}
                    </span>
                  </div>
                  <p className="mt-2 text-[13.5px] leading-snug text-zinc-200">{card.title}</p>
                  <div className="mt-3.5 flex items-center">
                    <span className="flex size-6 items-center justify-center rounded-full bg-white/[0.07] text-[9px] font-medium text-zinc-400">
                      {card.who}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Frame>
  );
}

function SprintPreview() {
  const rows = [
    { key: 'PLAT-131', title: 'Socket reconnect drops rooms', pts: 8, done: false },
    { key: 'PLAT-127', title: 'Fractional ranks collide on tie', pts: 5, done: false },
    { key: 'PLAT-119', title: 'Persist board filters per user', pts: 3, done: true },
  ];

  return (
    <Frame url="devsync.app/w/acme/projects/PLAT/sprints">
      <div className="space-y-6 p-6">
        <div className="flex items-baseline gap-3">
          <span className="text-[15px] font-medium text-zinc-100">Sprint 14 · Platform</span>
          <span className="ml-auto text-[12.5px] text-zinc-500">4 days left</span>
        </div>

        <div>
          <div className="mb-2 flex items-baseline justify-between text-[12.5px]">
            <span className="text-zinc-500">Story points</span>
            <span className="tabular-nums text-zinc-300">34 / 55</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/[0.07]">
            <div className="h-full w-[62%] rounded-full bg-primary" />
          </div>
        </div>

        <div className="space-y-3 border-t border-white/[0.07] pt-5">
          {rows.map((t) => (
            <div key={t.key} className="flex items-center gap-3 text-[13.5px]">
              <span
                className={cn(
                  'flex size-4 shrink-0 items-center justify-center rounded-full border border-white/15',
                  t.done && 'border-emerald-400/50 bg-emerald-400/15',
                )}
              >
                {t.done ? <CheckIcon className="size-2.5 text-emerald-400" /> : null}
              </span>
              <span className="font-mono text-[11px] text-zinc-600">{t.key}</span>
              <span
                className={cn(
                  'min-w-0 flex-1 truncate text-zinc-300',
                  t.done && 'text-zinc-600 line-through',
                )}
              >
                {t.title}
              </span>
              <span className="shrink-0 rounded-md border border-white/10 px-2 py-0.5 text-[11px] tabular-nums text-zinc-400">
                {t.pts}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Frame>
  );
}

function ChatPreview() {
  const messages = [
    { who: 'BS', name: 'Bob', time: '09:41', body: 'PLAT-131 is the reconnect path — rooms are joined on connect but never re-joined after a drop.', thread: true },
    { who: 'AC', name: 'Alice', time: '09:43', body: 'That explains the missing messages after a laptop sleeps. Reproducible?' },
    { who: 'BS', name: 'Bob', time: '09:44', body: 'Every time. Fix is to re-emit join_room in the connect handler rather than the mount effect.' },
  ];

  return (
    <Frame url="devsync.app/w/acme/channels/platform-team">
      <div>
        <div className="flex items-center gap-2 border-b border-white/[0.07] px-5 py-3.5">
          <HashIcon className="size-4 text-zinc-600" />
          <span className="text-[14px] font-medium text-zinc-200">platform-team</span>
          <span className="ml-auto flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 text-[11.5px] text-zinc-400">
            <span className="size-1.5 rounded-full bg-emerald-400" />3 online
          </span>
        </div>

        <div className="space-y-5 p-5">
          {messages.map((m, i) => (
            <div key={i} className="flex gap-3">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-white/[0.07] text-[10px] font-medium text-zinc-400">
                {m.who}
              </span>
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-[13.5px] font-medium text-zinc-200">{m.name}</span>
                  <span className="text-[11px] text-zinc-600">{m.time}</span>
                </div>
                <p className="mt-1 text-[13.5px] leading-relaxed text-zinc-400">{m.body}</p>
                {m.thread ? (
                  <div className="mt-2.5 flex items-center gap-2">
                    <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-zinc-400">
                      +1 · 2
                    </span>
                    <span className="text-[11.5px] text-primary">2 replies</span>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Frame>
  );
}

function GitHubPreview() {
  const rows = [
    { Icon: GitPullRequestIcon, primary: 'fix: re-join socket rooms on reconnect', meta: '#218 · opened by Bob · links PLAT-131', tone: 'text-emerald-400' },
    { Icon: GitBranchIcon, primary: 'feat/PLAT-127-rank-collisions', meta: 'pushed 12 minutes ago · moved PLAT-127 to In Progress', tone: 'text-blue-400' },
    { Icon: ZapIcon, primary: 'build · test · e2e', meta: 'workflow succeeded in 4m 12s', tone: 'text-emerald-400' },
  ];

  return (
    <Frame url="devsync.app/w/acme/projects/PLAT/github">
      <div>
        <div className="flex items-center gap-2 border-b border-white/[0.07] px-5 py-3.5">
          <GitBranchIcon className="size-4 text-zinc-600" />
          <span className="font-mono text-[13px] text-zinc-300">acme/platform</span>
          <span className="ml-auto flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-[11.5px] text-emerald-300">
            <ShieldCheckIcon className="size-3" />
            CI passing
          </span>
        </div>

        <div className="divide-y divide-white/[0.06]">
          {rows.map((r) => (
            <div key={r.primary} className="flex items-start gap-3 px-5 py-4">
              <r.Icon className={cn('mt-0.5 size-4 shrink-0', r.tone)} />
              <div className="min-w-0">
                <p className="truncate text-[13.5px] text-zinc-200">{r.primary}</p>
                <p className="mt-1 text-[12px] text-zinc-600">{r.meta}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Frame>
  );
}
