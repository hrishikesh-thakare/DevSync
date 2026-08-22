import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Bold, Italic, Strikethrough, Code, List, SendHorizontal, Plus,
  Eye, EyeOff, Quote, Link2,
} from 'lucide-react';
import clsx from 'clsx';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Command, CommandList, CommandItem } from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { useCurrentWorkspaceStore } from '../../store/currentWorkspace.js';
import { useChatStore as useUploadStore } from '../../store/useChatStore.js';
import DOMPurify from 'dompurify';

// ─────────────────────────────────────────────────────────────────────────────
// Slack mrkdwn → HTML converter (used on submit + preview)
// ─────────────────────────────────────────────────────────────────────────────
function mrkdwnToHtml(raw: string): string {
  let text = raw;

  // Fenced code block  ```…```
  text = text.replace(/```([\s\S]*?)```/g, (_, code) =>
    `<pre class="bg-muted border border-border rounded-md px-3 py-2 text-ui font-mono text-foreground whitespace-pre-wrap my-1 overflow-x-auto">${escapeHtml(code.trim())}</pre>`
  );

  // Process line-by-line for block-level elements
  const lines = text.split('\n');
  let html = '';
  let inList = false;

  for (const line of lines) {
    // Blockquote
    if (line.startsWith('> ')) {
      if (inList) { html += '</ul>'; inList = false; }
      html += `<blockquote class="border-l-4 border-strong pl-3 text-muted-foreground italic my-0.5">${processInline(line.slice(2))}</blockquote>`;
      continue;
    }

    // Bullet list
    if (/^[-•*]\s/.test(line)) {
      if (!inList) { html += '<ul class="list-disc list-inside space-y-0.5 my-0.5">'; inList = true; }
      html += `<li>${processInline(line.replace(/^[-•*]\s/, ''))}</li>`;
      continue;
    }

    if (inList) { html += '</ul>'; inList = false; }

    // Regular paragraph / inline
    if (line.trim() === '') {
      html += '<br />';
    } else {
      html += `<p class="my-0">${processInline(line)}</p>`;
    }
  }
  if (inList) html += '</ul>';

  return html;
}

function processInline(text: string): string {
  // File attachment links: [filename](file:UUID)  — must come before generic links
  text = text.replace(/\[(.*?)\]\(file:([a-zA-Z0-9-]+)\)/g,
    (_, name, id) =>
      `<a href="#" data-file-id="${id}" class="inline-flex items-center gap-1.5 px-2 py-0.5 mx-0.5 bg-hover rounded border border-border text-primary hover:bg-hover transition-colors no-underline text-caption font-[510]">📎 ${escapeHtml(name)}</a>`
  );

  // Bold+Italic  ***text***
  text = text.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  // Bold  *text*
  text = text.replace(/\*([^*\n]+?)\*/g, '<strong>$1</strong>');
  // Italic  _text_
  text = text.replace(/_(.*?)_/g, '<em>$1</em>');
  // Strikethrough  ~text~
  text = text.replace(/~(.*?)~/g, '<del>$1</del>');
  // Inline code  `text`
  text = text.replace(/`([^`\n]+?)`/g, '<code class="bg-hover border border-border rounded px-1 py-0.5 text-caption font-mono text-foreground">$1</code>');
  // Hyperlinks  [label](url)
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary underline">$1</a>'
  );
  // @mentions
  text = text.replace(/@([\w\s]+?)(?=\s|$|[^a-zA-Z0-9_ ])/g,
    '<span class="text-primary-on-muted bg-primary-muted px-1 rounded font-[510]">@$1</span>'
  );

  return text;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ─────────────────────────────────────────────────────────────────────────────
// Wrap selected text in the textarea with a marker
// ─────────────────────────────────────────────────────────────────────────────
function wrapSelection(
  ta: HTMLTextAreaElement,
  open: string,
  close: string,
  setValue: (v: string) => void,
) {
  const { selectionStart: s, selectionEnd: e, value } = ta;
  const selected = value.slice(s, e);
  const newVal = value.slice(0, s) + open + selected + close + value.slice(e);
  setValue(newVal);
  requestAnimationFrame(() => {
    ta.focus();
    ta.selectionStart = s + open.length;
    ta.selectionEnd = e + open.length;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
interface ChatEditorProps {
  onSubmit: (htmlContent: string) => void;
  placeholder?: string;
  isSending?: boolean;
  initialContent?: string;
}

export const ChatEditor = ({
  onSubmit,
  placeholder = 'Message… (Slack-style: *bold*, _italic_, ~strike~, `code`)',
  isSending = false,
  initialContent = '',
}: ChatEditorProps) => {
  const [value, setValue] = useState(initialContent);
  const [isUploading, setIsUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);

  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { members } = useCurrentWorkspaceStore();
  const { uploadFile } = useUploadStore();

  // Sync initial content (e.g. @task prefill)
  const [prevInitial, setPrevInitial] = useState(initialContent);
  if (initialContent !== prevInitial) {
    setPrevInitial(initialContent);
    setValue(initialContent);
  }

  // Auto-resize textarea
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 300)}px`;
  }, [value]);

  // Filtered mention list
  const filteredMembers = mentionQuery !== null
    ? members.filter(m => m.fullName.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 6)
    : [];

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isSending) return;
    onSubmit(mrkdwnToHtml(trimmed));
    setValue('');
    if (taRef.current) taRef.current.style.height = 'auto';
  }, [value, isSending, onSubmit]);

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = taRef.current!;

    // Ctrl / Cmd shortcuts
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'b': e.preventDefault(); wrapSelection(ta, '*', '*', setValue); return;
        case 'i': e.preventDefault(); wrapSelection(ta, '_', '_', setValue); return;
        case 'e': e.preventDefault(); wrapSelection(ta, '`', '`', setValue); return;
        case 'k': e.preventDefault(); wrapSelection(ta, '[', '](url)', setValue); return;
        case 'x': if (e.shiftKey) { e.preventDefault(); wrapSelection(ta, '~', '~', setValue); return; } break;
      }
    }

    // Enter = send, Shift+Enter = newline
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // ── @mention detection ──────────────────────────────────────────────────────
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setValue(val);
    const caret = e.target.selectionStart;
    const match = val.slice(0, caret).match(/@([\w ]*)$/);
    if (match) { setMentionQuery(match[1]); }
    else setMentionQuery(null);
  };

  const insertMention = (member: { fullName: string }) => {
    const ta = taRef.current;
    if (!ta) return;
    const caret = ta.selectionStart;
    const before = value.slice(0, caret).replace(/@([\w ]*)$/, '');
    const after = value.slice(caret);
    const mention = `@${member.fullName} `;
    setValue(`${before}${mention}${after}`);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = before.length + mention.length;
      ta.selectionStart = ta.selectionEnd = pos;
    });
  };

  // ── File upload ─────────────────────────────────────────────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const result = await uploadFile(file);
    setIsUploading(false);
    if (result) {
      const ref = `[${result.filename}](file:${result.fileId})`;
      setValue(prev => prev ? `${prev} ${ref}` : ref);
      taRef.current?.focus();
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Toolbar action ──────────────────────────────────────────────────────────
  const fmt = (open: string, close: string) => {
    if (taRef.current) wrapSelection(taRef.current, open, close, setValue);
  };

  return (
    <div className="relative">
      {/* @mention popup */}
      {mentionQuery !== null && filteredMembers.length > 0 && (
        <div className="absolute bottom-full left-0 mb-2 w-64 z-(--z-dropdown) overflow-hidden rounded-lg border border-border bg-card shadow-md">
          <Command shouldFilter={false} className="rounded-none">
            <div className="px-3 py-1.5 text-micro text-muted-foreground font-[590] uppercase border-b border-border">Members</div>
            <CommandList>
              {filteredMembers.map(m => (
                <CommandItem key={m.userId} value={m.fullName} onSelect={() => insertMention(m)} className="flex items-center gap-2.5 px-3 py-2 text-ui">
                  <Avatar size="sm" className="shrink-0">
                    <AvatarFallback className="bg-primary text-micro font-[590] text-primary-foreground">{m.fullName[0].toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span>{m.fullName}</span>
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </div>
      )}

      {/* Editor card */}
      <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm focus-within:ring-1 focus-within:ring-ring focus-within:border-ring transition-colors">

        {/* Preview mode */}
        {showPreview && (
          <div
            className="message-body px-4 py-3 min-h-[60px] max-h-[300px] overflow-y-auto text-foreground max-w-none"
            dangerouslySetInnerHTML={{ __html: value.trim() ? DOMPurify.sanitize(mrkdwnToHtml(value)) : DOMPurify.sanitize(`<span class="text-subtle-foreground">${placeholder}</span>`) }}
          />
        )}

        {/* Textarea (hidden when preview) */}
        <Textarea
          ref={taRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          className={clsx(
            'w-full bg-transparent resize-none border-none outline-none px-4 pt-3 pb-2 text-body text-foreground placeholder:text-subtle-foreground leading-relaxed min-h-0 h-auto md:text-body',
            showPreview && 'hidden',
          )}
          style={{ maxHeight: '300px', overflowY: 'auto' }}
        />

        {/* Formatting hints strip */}
        {!showPreview && value.trim() === '' && (
          <div className="px-4 pb-1.5 flex items-center gap-3 flex-wrap">
            {[
              { label: '*bold*', tip: 'Ctrl+B' },
              { label: '_italic_', tip: 'Ctrl+I' },
              { label: '~strike~', tip: 'Ctrl+Shift+X' },
              { label: '`code`', tip: 'Ctrl+E' },
              { label: '> quote', tip: '' },
              { label: '- list', tip: '' },
            ].map(({ label, tip }) => (
              <span key={label} className="text-micro text-subtle-foreground font-mono" title={tip}>
                {label}
                {tip && <span className="text-subtle-foreground ml-1 font-sans not-italic">{tip}</span>}
              </span>
            ))}
          </div>
        )}

        {/* Toolbar */}
        <div className="flex items-center justify-between px-2 py-1.5 bg-background border-t border-border">
          <div className="flex items-center gap-0.5">
            {/* File attach */}
            <ToolBtn title="Attach file (+)" onClick={() => fileInputRef.current?.click()} disabled={isUploading || isSending}>
              {isUploading
                ? <div className="w-4 h-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                : <Plus className="w-4 h-4" strokeWidth={1.75} />
              }
            </ToolBtn>
            <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileChange} />

            <Sep />

            <ToolBtn title="Bold — Ctrl+B" onClick={() => fmt('*', '*')}><Bold className="w-4 h-4" strokeWidth={1.75} /></ToolBtn>
            <ToolBtn title="Italic — Ctrl+I" onClick={() => fmt('_', '_')}><Italic className="w-4 h-4" strokeWidth={1.75} /></ToolBtn>
            <ToolBtn title="Strikethrough — Ctrl+Shift+X" onClick={() => fmt('~', '~')}><Strikethrough className="w-4 h-4" strokeWidth={1.75} /></ToolBtn>

            <Sep />

            <ToolBtn title="Inline code — Ctrl+E" onClick={() => fmt('`', '`')}><Code className="w-4 h-4" strokeWidth={1.75} /></ToolBtn>
            <ToolBtn title="Code block" onClick={() => fmt('```\n', '\n```')}><span className="text-micro font-mono font-[590]">{ `</>` }</span></ToolBtn>
            <ToolBtn title="Blockquote" onClick={() => fmt('> ', '')}><Quote className="w-4 h-4" strokeWidth={1.75} /></ToolBtn>
            <ToolBtn title="Bullet list" onClick={() => fmt('- ', '')}><List className="w-4 h-4" strokeWidth={1.75} /></ToolBtn>
            <ToolBtn title="Link — Ctrl+K" onClick={() => fmt('[', '](url)')}><Link2 className="w-4 h-4" strokeWidth={1.75} /></ToolBtn>

            <Sep />

            {/* Preview toggle */}
            <ToolBtn
              title={showPreview ? 'Edit' : 'Preview'}
              onClick={() => setShowPreview(p => !p)}
              active={showPreview}
            >
              {showPreview ? <EyeOff className="w-4 h-4" strokeWidth={1.75} /> : <Eye className="w-4 h-4" strokeWidth={1.75} />}
            </ToolBtn>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-micro text-subtle-foreground hidden sm:block">
              {showPreview ? 'Preview' : 'Enter to send · Shift+Enter for newline'}
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleSubmit}
                  disabled={isSending || !value.trim()}
                  aria-label="Send message"
                  className="flex items-center justify-center p-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  size="icon" variant="primary"
                >
                  <SendHorizontal className="w-4 h-4" strokeWidth={1.75} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Send (Enter)</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const Sep = () => <div className="w-px h-4 bg-border mx-1 shrink-0" />;

const ToolBtn = ({
  children, onClick, disabled = false, title, active = false,
}: { children: React.ReactNode; onClick: () => void; disabled?: boolean; title?: string; active?: boolean }) => {
  const button = (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); }}
      onClick={onClick}
      disabled={disabled}
      aria-label={title}
      aria-pressed={active}
      className={clsx(
        'p-1.5 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-ring',
        active
          ? 'bg-hover text-foreground'
          : 'text-subtle-foreground hover:text-foreground hover:bg-hover',
      )}
    >
      {children}
    </button>
  );

  if (!title) return button;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent>{title}</TooltipContent>
    </Tooltip>
  );
};

export default ChatEditor;
