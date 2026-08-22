
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';


import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import {
  ArrowRight,
  GitBranch,
  Layout,
  MessageSquare,
  Zap,
  Shield,
  Search,
  ChevronDown,
  Target
} from 'lucide-react';
import dashboardImg from '../assets/dashboard-preview.png';
import chatImg from '../assets/chat-preview.png';

/* ─── Fade-in wrapper ─── */
const FadeIn = ({
  children,
  className = '',
  
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) => {
  
  
  return (
    <div
      
      
      
      
      className={className}
    >
      {children}
    </div>
  );
};

/* ─── FAQ Item ─── */
const FAQItem = ({ question, answer }: { question: string; answer: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border">
      <Button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-6 text-left group cursor-pointer"
        variant="ghost" size="default"
      >
        <span className="text-heading font-[590] text-foreground group-hover:text-muted-foreground transition-colors pr-8">
          {question}
        </span>
        <ChevronDown
          className={`w-5 h-5 text-muted-foreground shrink-0 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} strokeWidth={1.75}
        />
      </Button>
      <div
        
        className={cn("overflow-hidden transition-colors duration-300", open ? "h-auto opacity-100" : "h-0 opacity-0")}
        
        
      >
        <p className="pb-6 text-muted-foreground leading-relaxed">{answer}</p>
      </div>
    </div>
  );
};

/* ─── Features data ─── */
const features = [
  {
    icon: <Layout className="w-6 h-6" strokeWidth={1.5} />,
    title: 'Agile Kanban Boards',
    desc: 'Drag-and-drop tasks with zero latency. Assign points, priorities, and labels across custom columns.',
  },
  {
    icon: <MessageSquare className="w-6 h-6" strokeWidth={1.5} />,
    title: 'Real-Time Messaging',
    desc: 'Socket.io-powered channels with threaded replies, rich text editing, code snippets, and @mentions.',
  },
  {
    icon: <GitBranch className="w-6 h-6" strokeWidth={1.5} />,
    title: 'GitHub Integration',
    desc: 'Connect repos to auto-link commits to tasks. Monitor CI/CD workflows directly from the board.',
  },
  {
    icon: <Shield className="w-6 h-6" strokeWidth={1.5} />,
    title: 'Role-Based Access',
    desc: 'Two-layered RBAC secures Workspace and Project boundaries with Owner, Admin, Member, and Viewer roles.',
  },
  {
    icon: <Target className="w-6 h-6" strokeWidth={1.5} />,
    title: 'Sprint Planning',
    desc: 'Time-boxed iterations with velocity tracking, backlog prioritization, and LexoRank ordering.',
  },
  {
    icon: <Search className="w-6 h-6" strokeWidth={1.5} />,
    title: 'Full-Text Search',
    desc: 'Find anything instantly with PostgreSQL-powered full-text search across tasks, messages, and projects.',
  },
];

/* ─── Steps data ─── */
const steps = [
  {
    num: '01',
    title: 'Create a Workspace',
    desc: 'Sign up in seconds, name your workspace, and invite your team with a single link.',
  },
  {
    num: '02',
    title: 'Set Up Projects',
    desc: 'Create projects with Kanban boards, channels, and sprints — all pre-configured and ready to go.',
  },
  {
    num: '03',
    title: 'Ship Faster',
    desc: 'Connect GitHub, start chatting, and track every issue to done — all without leaving DevSync.',
  },
];

/* ─── FAQ data ─── */
const faqs = [
  {
    q: 'Is DevSync free to use?',
    a: 'DevSync is an open-source project built for a final-year submission. You can clone the repo and self-host it for free with your own Supabase project.',
  },
  {
    q: 'What makes DevSync different from Jira or Linear?',
    a: 'DevSync combines issue tracking, real-time chat, and GitHub integration into a single unified interface — eliminating context switching between 3+ separate tools.',
  },
  {
    q: 'Can I self-host this?',
    a: 'Absolutely. DevSync runs on Node.js + PostgreSQL (Supabase). Clone the repo, set your environment variables, and you\'re live in under 5 minutes.',
  },
  {
    q: 'What tech stack does it use?',
    a: 'React 19, TypeScript, Vite, Tailwind CSS v4, Zustand on the frontend. Node.js, Express 5, Drizzle ORM, Socket.io, and PostgreSQL on the backend.',
  },
];

/* ─── Logos / social proof labels ─── */
const techBadges = ['React 19', 'TypeScript', 'Socket.io', 'PostgreSQL', 'Drizzle ORM', 'Tailwind CSS', 'Supabase', 'Vite'];

/* ════════════════════════════════════════════
   LANDING PAGE
   ════════════════════════════════════════════ */
export const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="dark min-h-screen bg-background font-sans text-foreground overflow-hidden selection:bg-primary-muted">
      {/* ─── NAVBAR ─── */}
      <nav className="fixed top-0 w-full z-(--z-sticky) bg-background/60 backdrop-blur-xl border-b border-border">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 bg-foreground rounded-lg flex items-center justify-center shadow-md">
              <Zap className="w-4.5 h-4.5 text-inverse fill-current" strokeWidth={1.75} />
            </div>
            <span className="font-[590] text-heading tracking-tight text-foreground">
              Dev<span className="text-muted-foreground">Sync</span>
            </span>
          </div>
          <div className="hidden md:flex items-center space-x-8">
            <a href="#features" className="text-sm font-[510] text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#how-it-works" className="text-sm font-[510] text-muted-foreground hover:text-foreground transition-colors">How it Works</a>
            <a href="#faq" className="text-sm font-[510] text-muted-foreground hover:text-foreground transition-colors">FAQ</a>
          </div>
          <div className="flex items-center space-x-4">
            
            <Button
              onClick={() => navigate('/login')}
              className="text-sm font-[510] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              variant="ghost" size="default"
            >
              Sign in
            </Button>
            <Button
              onClick={() => navigate('/register')}
              className="text-sm font-[590] bg-foreground text-inverse px-5 py-2 rounded-full hover:bg-foreground/90 transition-colors  active:scale-95 cursor-pointer"
              variant="primary" size="default"
            >
              Get Started
            </Button>
          </div>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section className="relative pt-36 pb-8 lg:pt-48 lg:pb-12 px-6">
        {/* Background glows */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-full pointer-events-none">
          <div className="absolute top-10 left-1/3 w-[600px] h-[600px] bg-foreground/[0.04] rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-foreground/[0.03] rounded-full blur-[150px]" />
        </div>

        <div className="relative z-[var(--z-sticky)] max-w-4xl mx-auto text-center">
          {/* Badge */}
          <FadeIn>
            <div className="inline-flex items-center space-x-2 bg-card border border-border rounded-full px-4 py-1.5 mb-8">
              <span className="flex h-2 w-2 rounded-full bg-success animate-pulse" />
              <span className="text-xs font-[510] text-foreground uppercase tracking-widest">
                DevSync v1.0 is live
              </span>
            </div>
          </FadeIn>

          {/* Headline */}
          <FadeIn delay={0.1}>
            <h1 className="text-heading md:text-heading lg:text-heading font-[590] text-foreground tracking-tight leading-[1.08] mb-7">
              The unified workspace{' '}
              <br className="hidden md:block" />
              for your dev team.
            </h1>
          </FadeIn>

          {/* Subheading */}
          <FadeIn delay={0.2}>
            <p className="text-heading md:text-heading text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
              Replace Jira, Slack, and GitHub dashboards with one blazing-fast
              platform. Track issues, chat in real-time, and monitor commits
              — all in one place.
            </p>
          </FadeIn>

          {/* CTAs */}
          <FadeIn delay={0.3}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                onClick={() => navigate('/register')}
                className="w-full sm:w-auto flex items-center justify-center px-8 py-4 text-base font-[590] text-inverse bg-foreground hover:bg-foreground/90 rounded-full transition-colors shadow-md .5 cursor-pointer"
                variant="primary" size="default"
              >
                Start Building for Free
                <ArrowRight className="ml-2 w-5 h-5" strokeWidth={1.75} />
              </Button>
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto flex items-center justify-center px-8 py-4 text-base font-[590] text-foreground bg-card border border-border hover:bg-hover rounded-full transition-colors"
              >
                <GitBranch className="mr-2 w-5 h-5" strokeWidth={1.75} />
                View Source
              </a>
            </div>
          </FadeIn>
        </div>

        {/* Hero Screenshot */}
        <FadeIn delay={0.45} className="relative z-[var(--z-sticky)] max-w-5xl mx-auto mt-16">
          <div className="relative rounded-lg overflow-hidden border border-border shadow-md">
            {/* Window chrome */}
            <div className="bg-elevated border-b border-border px-4 py-3 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-border-strong" />
              <div className="w-3 h-3 rounded-full bg-border-strong" />
              <div className="w-3 h-3 rounded-full bg-border-strong" />
              <div className="flex-1 flex justify-center">
                <div className="bg-hover rounded-md px-16 py-1 text-xs text-subtle-foreground">devsync.app</div>
              </div>
            </div>
            <img
              src={dashboardImg}
              alt="DevSync Kanban Board"
              className="w-full block"
            />
            {/* Bottom glow */}
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent pointer-events-none" />
          </div>
        </FadeIn>
      </section>

      {/* ─── SOCIAL PROOF QUOTE ─── */}
      <FadeIn>
        <section className="max-w-3xl mx-auto px-6 py-20 text-center">
          <blockquote className="text-heading md:text-heading font-[590] text-foreground leading-snug mb-6">
            "The teams who ship fastest are the teams who stop context-switching.{' '}
            <span className="text-subtle-foreground">DevSync makes that the default.</span>"
          </blockquote>
        </section>
      </FadeIn>

      {/* ─── Tech badges ticker ─── */}
      <div className="border-y border-border py-5 overflow-hidden">
        <div className="flex items-center justify-center gap-8 md:gap-14 flex-wrap px-6">
          {techBadges.map((badge) => (
            <span key={badge} className="text-sm font-[590] text-subtle-foreground uppercase tracking-widest whitespace-nowrap">
              {badge}
            </span>
          ))}
        </div>
      </div>

      {/* ─── FEATURES GRID ─── */}
      <section id="features" className="max-w-7xl mx-auto px-6 py-28">
        <FadeIn className="text-center mb-20">
          <span className="text-xs font-[590] text-subtle-foreground uppercase tracking-[0.2em] mb-4 block">
            What's inside
          </span>
          <h2 className="text-heading md:text-heading font-[590] text-foreground leading-tight">
            Everything a dev team needs{' '}
            <br className="hidden md:block" />
            to ship with confidence.
          </h2>
        </FadeIn>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <FadeIn key={f.title} delay={i * 0.08}>
              <div className="group bg-card border border-border rounded-lg p-7 hover:bg-hover hover:border-border-strong transition-colors duration-300">
                <div className="w-12 h-12 bg-hover border border-border rounded-lg flex items-center justify-center mb-5 text-muted-foreground group-hover:bg-secondary group-hover:text-foreground transition-colors">
                  {f.icon}
                </div>
                <h3 className="text-heading font-[590] text-foreground mb-2.5">{f.title}</h3>
                <p className="text-muted-foreground leading-relaxed text-body">{f.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ─── HOW IT WORKS — 3 Steps ─── */}
      <section id="how-it-works" className="max-w-7xl mx-auto px-6 py-28 border-t border-border">
        <FadeIn className="text-center mb-20">
          <span className="text-xs font-[590] text-subtle-foreground uppercase tracking-[0.2em] mb-4 block">
            How it works
          </span>
          <h2 className="text-heading md:text-heading font-[590] text-foreground leading-tight">
            Three steps.{' '}
            <span className="text-subtle-foreground">No friction.</span>
          </h2>
        </FadeIn>

        <div className="grid md:grid-cols-3 gap-6">
          {steps.map((s, i) => (
            <FadeIn key={s.num} delay={i * 0.12}>
              <div className="relative bg-card border border-border rounded-lg p-8 hover:bg-hover transition-colors duration-300 overflow-hidden">
                {/* Big number */}
                <span className="text-heading font-[590] text-foreground/5 absolute top-2 right-4 leading-none select-none">
                  {s.num}
                </span>
                <div className="relative z-[var(--z-sticky)]">
                  <span className="inline-block text-sm font-[590] text-foreground bg-hover border border-border-strong rounded-lg px-3 py-1 mb-5">
                    {s.num}
                  </span>
                  <h3 className="text-heading font-[590] text-foreground mb-3">{s.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{s.desc}</p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ─── PRODUCT SHOWCASE ─── */}
      <section className="max-w-7xl mx-auto px-6 py-28 border-t border-border">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left — Text */}
          <FadeIn>
            <div>
              <span className="text-xs font-[590] text-subtle-foreground uppercase tracking-[0.2em] mb-4 block">
                Built to impress
              </span>
              <h2 className="text-heading md:text-heading font-[590] text-foreground leading-tight mb-6">
                A finished product,{' '}
                <br className="hidden md:block" />
                not a boilerplate.
              </h2>
              <p className="text-muted-foreground text-heading leading-relaxed mb-8">
                DevSync isn't a starter template. It's a fully working,
                production-grade platform with real-time chat, Kanban boards,
                sprint management, and deep GitHub integration — all battle-tested
                and ready to use.
              </p>
              <ul className="space-y-4">
                {[
                  'Full Kanban + Backlog + Sprint workflow',
                  'Real-time WebSocket messaging with threads',
                  'GitHub commits & CI/CD pipeline tracking',
                  'Role-based access control (RBAC)',
                  'PostgreSQL full-text search across everything',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <div className="mt-1 w-5 h-5 rounded-full bg-hover border border-border-strong flex items-center justify-center shrink-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-foreground" />
                    </div>
                    <span className="text-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </FadeIn>

          {/* Right — Screenshot */}
          <FadeIn delay={0.2}>
            <div className="relative">
              <div className="rounded-lg overflow-hidden border border-border shadow-md">
                <img
                  src={chatImg}
                  alt="DevSync Real-Time Chat"
                  className="w-full block"
                />
              </div>
              {/* Floating decorative element */}
              <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-card rounded-lg border border-border flex items-center justify-center">
                <MessageSquare className="w-8 h-8 text-subtle-foreground" strokeWidth={1.5} />
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section id="faq" className="max-w-3xl mx-auto px-6 py-28 border-t border-border">
        <FadeIn className="mb-14">
          <h2 className="text-heading md:text-heading font-[590] text-foreground text-center">
            The honest answers.
          </h2>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div>
            {faqs.map((faq) => (
              <FAQItem key={faq.q} question={faq.q} answer={faq.a} />
            ))}
          </div>
        </FadeIn>
      </section>

      {/* ─── CTA BANNER ─── */}
      <section className="px-6 pb-20">
        <FadeIn>
          {/* Inverted panel: `bg-foreground` + `text-inverse` is the system's
              inversion pair, so this flips correctly in either mode instead of
              being hardcoded white-on-black. */}
          <div className="max-w-5xl mx-auto relative overflow-hidden rounded-lg bg-foreground py-20 px-8 text-center">
            {/* Subtle grid pattern overlay. Inlined rather than a `.cta-grid`
                helper class so the legacy decoration block in index.css could be
                deleted outright (design system §5). Lines are drawn in the
                inverse text color because the panel itself is inverted. */}
            <div
              className="absolute inset-0 opacity-[0.06]"
              style={{
                backgroundImage:
                  'linear-gradient(var(--inverse) 1px, transparent 1px), linear-gradient(90deg, var(--inverse) 1px, transparent 1px)',
                backgroundSize: '40px 40px',
              }}
              aria-hidden="true"
            />
            <div className="relative z-[var(--z-sticky)]">
              <h2 className="text-heading md:text-6xl font-[590] text-inverse leading-tight mb-4">
                Make your team{' '}
                <span className="text-inverse/60">
                  sync.
                </span>
              </h2>
              <p className="text-inverse/70 text-heading mb-8 max-w-lg mx-auto">
                Join the workspace where every commit, message, and task lives in one place.
              </p>
              <Button
                onClick={() => navigate('/register')}
                className="inline-flex items-center px-8 py-4 text-base font-[590] text-foreground bg-inverse hover:bg-inverse/90 rounded-full transition-colors  active:scale-95 cursor-pointer"
                variant="primary" size="default"
              >
                Get Started — Free
                <ArrowRight className="ml-2 w-5 h-5" strokeWidth={1.75} />
              </Button>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-border bg-background py-14">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center space-x-2.5">
              <div className="w-7 h-7 bg-foreground rounded-lg flex items-center justify-center">
                <Zap className="w-4 h-4 text-inverse fill-current" strokeWidth={1.75} />
              </div>
              <span className="font-[590] text-heading text-foreground tracking-tight">DevSync</span>
            </div>
            <div className="flex items-center gap-8">
              <a href="#features" className="text-sm text-subtle-foreground hover:text-foreground transition-colors">Features</a>
              <a href="#how-it-works" className="text-sm text-subtle-foreground hover:text-foreground transition-colors">How it Works</a>
              <a href="#faq" className="text-sm text-subtle-foreground hover:text-foreground transition-colors">FAQ</a>
            </div>
            <p className="text-sm text-subtle-foreground">
              © 2026 DevSync. Built for the final year project.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};
