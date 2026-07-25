
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
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
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

/* ─── FAQ Item ─── */
const FAQItem = ({ question, answer }: { question: string; answer: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/10">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-6 text-left group cursor-pointer"
      >
        <span className="text-lg font-semibold text-white group-hover:text-gray-300 transition-colors pr-8">
          {question}
        </span>
        <ChevronDown
          className={`w-5 h-5 text-gray-400 shrink-0 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <motion.div
        initial={false}
        animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="overflow-hidden"
      >
        <p className="pb-6 text-gray-400 leading-relaxed">{answer}</p>
      </motion.div>
    </div>
  );
};

/* ─── Features data ─── */
const features = [
  {
    icon: <Layout className="w-6 h-6" />,
    title: 'Agile Kanban Boards',
    desc: 'Drag-and-drop tasks with zero latency. Assign points, priorities, and labels across custom columns.',
  },
  {
    icon: <MessageSquare className="w-6 h-6" />,
    title: 'Real-Time Messaging',
    desc: 'Socket.io-powered channels with threaded replies, rich text editing, code snippets, and @mentions.',
  },
  {
    icon: <GitBranch className="w-6 h-6" />,
    title: 'GitHub Integration',
    desc: 'Connect repos to auto-link commits to tasks. Monitor CI/CD workflows directly from the board.',
  },
  {
    icon: <Shield className="w-6 h-6" />,
    title: 'Role-Based Access',
    desc: 'Two-layered RBAC secures Workspace and Project boundaries with Owner, Admin, Member, and Viewer roles.',
  },
  {
    icon: <Target className="w-6 h-6" />,
    title: 'Sprint Planning',
    desc: 'Time-boxed iterations with velocity tracking, backlog prioritization, and LexoRank ordering.',
  },
  {
    icon: <Search className="w-6 h-6" />,
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
    <div className="min-h-screen bg-[#050505] font-sans text-gray-200 overflow-hidden selection:bg-white/20">
      {/* ─── NAVBAR ─── */}
      <nav className="fixed top-0 w-full z-50 bg-[#050505]/60 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-lg shadow-white/10">
              <Zap className="w-4.5 h-4.5 text-black fill-current" />
            </div>
            <span className="font-extrabold text-xl tracking-tight text-white">
              Dev<span className="text-gray-400">Sync</span>
            </span>
          </div>
          <div className="hidden md:flex items-center space-x-8">
            <a href="#features" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">How it Works</a>
            <a href="#faq" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">FAQ</a>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/login')}
              className="text-sm font-medium text-gray-300 hover:text-white transition-colors cursor-pointer"
            >
              Sign in
            </button>
            <button
              onClick={() => navigate('/register')}
              className="text-sm font-semibold bg-white text-black px-5 py-2 rounded-full hover:bg-gray-200 transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section className="relative pt-36 pb-8 lg:pt-48 lg:pb-12 px-6">
        {/* Background glows */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-full pointer-events-none">
          <div className="absolute top-10 left-1/3 w-[600px] h-[600px] bg-white/[0.04] rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-white/[0.03] rounded-full blur-[150px]" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          {/* Badge */}
          <FadeIn>
            <div className="inline-flex items-center space-x-2 bg-white/[0.06] border border-white/[0.08] rounded-full px-4 py-1.5 mb-8 backdrop-blur-sm">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-medium text-gray-300 uppercase tracking-widest">
                DevSync v1.0 is live
              </span>
            </div>
          </FadeIn>

          {/* Headline */}
          <FadeIn delay={0.1}>
            <h1 className="text-5xl md:text-7xl lg:text-[5.2rem] font-extrabold text-white tracking-tight leading-[1.08] mb-7">
              The unified workspace{' '}
              <br className="hidden md:block" />
              for your dev team.
            </h1>
          </FadeIn>

          {/* Subheading */}
          <FadeIn delay={0.2}>
            <p className="text-lg md:text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
              Replace Jira, Slack, and GitHub dashboards with one blazing-fast
              platform. Track issues, chat in real-time, and monitor commits
              — all in one place.
            </p>
          </FadeIn>

          {/* CTAs */}
          <FadeIn delay={0.3}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => navigate('/register')}
                className="w-full sm:w-auto flex items-center justify-center px-8 py-4 text-base font-bold text-black bg-white hover:bg-gray-100 rounded-full transition-all shadow-[0_0_40px_-8px_rgba(255,255,255,0.3)] hover:shadow-[0_0_50px_-5px_rgba(255,255,255,0.4)] hover:-translate-y-0.5 cursor-pointer"
              >
                Start Building for Free
                <ArrowRight className="ml-2 w-5 h-5" />
              </button>
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto flex items-center justify-center px-8 py-4 text-base font-bold text-white bg-white/[0.06] border border-white/[0.1] hover:bg-white/[0.1] rounded-full transition-all"
              >
                <GitBranch className="mr-2 w-5 h-5" />
                View Source
              </a>
            </div>
          </FadeIn>
        </div>

        {/* Hero Screenshot */}
        <FadeIn delay={0.45} className="relative z-10 max-w-5xl mx-auto mt-16">
          <div className="relative rounded-2xl overflow-hidden border border-white/[0.08] shadow-[0_20px_80px_-20px_rgba(0,0,0,0.8)]">
            {/* Window chrome */}
            <div className="bg-[#0e0e0e] border-b border-white/[0.06] px-4 py-3 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-white/10" />
              <div className="w-3 h-3 rounded-full bg-white/10" />
              <div className="w-3 h-3 rounded-full bg-white/10" />
              <div className="flex-1 flex justify-center">
                <div className="bg-white/[0.06] rounded-md px-16 py-1 text-xs text-gray-500">devsync.app</div>
              </div>
            </div>
            <img
              src={dashboardImg}
              alt="DevSync Kanban Board"
              className="w-full block"
            />
            {/* Bottom glow */}
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#050505] to-transparent pointer-events-none" />
          </div>
        </FadeIn>
      </section>

      {/* ─── SOCIAL PROOF QUOTE ─── */}
      <FadeIn>
        <section className="max-w-3xl mx-auto px-6 py-20 text-center">
          <blockquote className="text-2xl md:text-3xl font-bold text-white leading-snug mb-6">
            "The teams who ship fastest are the teams who stop context-switching.{' '}
            <span className="text-gray-500">DevSync makes that the default.</span>"
          </blockquote>
        </section>
      </FadeIn>

      {/* ─── Tech badges ticker ─── */}
      <div className="border-y border-white/[0.06] py-5 overflow-hidden">
        <div className="flex items-center justify-center gap-8 md:gap-14 flex-wrap px-6">
          {techBadges.map((badge) => (
            <span key={badge} className="text-sm font-semibold text-gray-500 uppercase tracking-widest whitespace-nowrap">
              {badge}
            </span>
          ))}
        </div>
      </div>

      {/* ─── FEATURES GRID ─── */}
      <section id="features" className="max-w-7xl mx-auto px-6 py-28">
        <FadeIn className="text-center mb-20">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-[0.2em] mb-4 block">
            What's inside
          </span>
          <h2 className="text-4xl md:text-5xl font-extrabold text-white leading-tight">
            Everything a dev team needs{' '}
            <br className="hidden md:block" />
            to ship with confidence.
          </h2>
        </FadeIn>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <FadeIn key={f.title} delay={i * 0.08}>
              <div className="group bg-white/[0.02] border border-white/[0.06] rounded-2xl p-7 hover:bg-white/[0.05] hover:border-white/[0.12] transition-all duration-300">
                <div className="w-12 h-12 bg-white/[0.06] border border-white/[0.1] rounded-xl flex items-center justify-center mb-5 text-gray-300 group-hover:bg-white/[0.1] group-hover:text-white transition-all">
                  {f.icon}
                </div>
                <h3 className="text-lg font-bold text-white mb-2.5">{f.title}</h3>
                <p className="text-gray-400 leading-relaxed text-[15px]">{f.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ─── HOW IT WORKS — 3 Steps ─── */}
      <section id="how-it-works" className="max-w-7xl mx-auto px-6 py-28 border-t border-white/[0.06]">
        <FadeIn className="text-center mb-20">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-[0.2em] mb-4 block">
            How it works
          </span>
          <h2 className="text-4xl md:text-5xl font-extrabold text-white leading-tight">
            Three steps.{' '}
            <span className="text-gray-500">No friction.</span>
          </h2>
        </FadeIn>

        <div className="grid md:grid-cols-3 gap-6">
          {steps.map((s, i) => (
            <FadeIn key={s.num} delay={i * 0.12}>
              <div className="relative bg-white/[0.02] border border-white/[0.06] rounded-2xl p-8 hover:bg-white/[0.04] transition-all duration-300 overflow-hidden">
                {/* Big number */}
                <span className="text-[5rem] font-black text-white/[0.04] absolute top-2 right-4 leading-none select-none">
                  {s.num}
                </span>
                <div className="relative z-10">
                  <span className="inline-block text-sm font-bold text-white bg-white/[0.08] border border-white/[0.12] rounded-lg px-3 py-1 mb-5">
                    {s.num}
                  </span>
                  <h3 className="text-xl font-bold text-white mb-3">{s.title}</h3>
                  <p className="text-gray-400 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ─── PRODUCT SHOWCASE ─── */}
      <section className="max-w-7xl mx-auto px-6 py-28 border-t border-white/[0.06]">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left — Text */}
          <FadeIn>
            <div>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-[0.2em] mb-4 block">
                Built to impress
              </span>
              <h2 className="text-4xl md:text-5xl font-extrabold text-white leading-tight mb-6">
                A finished product,{' '}
                <br className="hidden md:block" />
                not a boilerplate.
              </h2>
              <p className="text-gray-400 text-lg leading-relaxed mb-8">
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
                    <div className="mt-1 w-5 h-5 rounded-full bg-white/[0.08] border border-white/[0.15] flex items-center justify-center shrink-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-white" />
                    </div>
                    <span className="text-gray-300">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </FadeIn>

          {/* Right — Screenshot */}
          <FadeIn delay={0.2}>
            <div className="relative">
              <div className="rounded-2xl overflow-hidden border border-white/[0.08] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)]">
                <img
                  src={chatImg}
                  alt="DevSync Real-Time Chat"
                  className="w-full block"
                />
              </div>
              {/* Floating decorative element */}
              <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-white/[0.03] rounded-2xl border border-white/[0.06] backdrop-blur-xl flex items-center justify-center">
                <MessageSquare className="w-8 h-8 text-gray-500" />
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section id="faq" className="max-w-3xl mx-auto px-6 py-28 border-t border-white/[0.06]">
        <FadeIn className="mb-14">
          <h2 className="text-4xl md:text-5xl font-extrabold text-white text-center">
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
          <div className="max-w-5xl mx-auto relative overflow-hidden rounded-3xl bg-white py-20 px-8 text-center">
            {/* Subtle grid pattern overlay */}
            <div
              className="absolute inset-0 opacity-[0.03]"
              style={{
                backgroundImage: `linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)`,
                backgroundSize: '40px 40px',
              }}
            />
            <div className="relative z-10">
              <h2 className="text-4xl md:text-6xl font-extrabold text-black leading-tight mb-4">
                Make your team{' '}
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-gray-700 via-gray-500 to-gray-700">
                  sync.
                </span>
              </h2>
              <p className="text-gray-600 text-lg mb-8 max-w-lg mx-auto">
                Join the workspace where every commit, message, and task lives in one place.
              </p>
              <button
                onClick={() => navigate('/register')}
                className="inline-flex items-center px-8 py-4 text-base font-bold text-white bg-black hover:bg-gray-900 rounded-full transition-all hover:scale-105 active:scale-95 cursor-pointer"
              >
                Get Started — Free
                <ArrowRight className="ml-2 w-5 h-5" />
              </button>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-white/[0.06] bg-[#050505] py-14">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center space-x-2.5">
              <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center">
                <Zap className="w-4 h-4 text-black fill-current" />
              </div>
              <span className="font-bold text-lg text-white tracking-tight">DevSync</span>
            </div>
            <div className="flex items-center gap-8">
              <a href="#features" className="text-sm text-gray-500 hover:text-white transition-colors">Features</a>
              <a href="#how-it-works" className="text-sm text-gray-500 hover:text-white transition-colors">How it Works</a>
              <a href="#faq" className="text-sm text-gray-500 hover:text-white transition-colors">FAQ</a>
            </div>
            <p className="text-sm text-gray-600">
              © 2026 DevSync. Built for the final year project.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};
