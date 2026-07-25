import React, { useCallback, useRef, useEffect, useState } from 'react';
import { useEditor, EditorContent, Extension } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Mention from '@tiptap/extension-mention';
import {
  Bold, Italic, Strikethrough, Code, List, SendHorizontal,
  Plus, Quote, Eye, EyeOff,
} from 'lucide-react';
import clsx from 'clsx';
import suggestion from './suggestion.js';
import { useCurrentWorkspaceStore } from '../../store/currentWorkspace.js';
import { useChatStore as useUploadStore } from '../../store/useChatStore.js';

export function renderMessageContent(html: string): string {
  let processed = html.replace(/\[(.*?)\]\(file:([a-zA-Z0-9-]+)\)/g, (_, name, id) =>
    `<a href="#" data-file-id="${id}" data-file-name="${name}" class="inline-flex items-center gap-1.5 px-2 py-0.5 mx-0.5 bg-gray-800 rounded border border-gray-700 text-blue-400 hover:bg-gray-700 transition-colors no-underline text-xs font-medium">📎 ${name}</a>`
  );

  // Replace @TASK-123 with clickable spans
  processed = processed.replace(/(?<!["'])@([A-Za-z]+-\d+)/gi, (fullMatch, taskKey) => {
    return `<span data-task-key="${taskKey.toUpperCase()}" class="text-blue-400 bg-blue-500/10 px-1 rounded font-medium cursor-pointer hover:underline" title="Go to task ${taskKey.toUpperCase()}">${fullMatch}</span>`;
  });

  return processed;
}

interface TiptapEditorProps {
  onSubmit: (content: string) => void;
  placeholder?: string;
  isSending?: boolean;
  initialContent?: string;
}

export const TiptapEditor = ({
  onSubmit,
  placeholder = 'Type a message… Use @name to mention',
  isSending = false,
  initialContent = '',
}: TiptapEditorProps) => {
  const submitRef = useRef(onSubmit);
  const isSendingRef = useRef(isSending);
  const { members } = useCurrentWorkspaceStore();
  const { uploadFile } = useUploadStore();

  const [isUploading, setIsUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    submitRef.current = onSubmit;
    isSendingRef.current = isSending;
  }, [onSubmit, isSending]);

  // ── Tiptap editor ──────────────────────────────────────────────────────────
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: {
          HTMLAttributes: {
            class: 'bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-sm font-mono text-gray-200 whitespace-pre-wrap my-1',
          },
        },
        code: {
          HTMLAttributes: {
            class: 'bg-gray-800 border border-gray-700 rounded px-1 py-0.5 text-xs font-mono text-gray-200',
          },
        },
        blockquote: {
          HTMLAttributes: {
            class: 'border-l-4 border-gray-600 pl-3 text-gray-400 italic my-0.5',
          },
        },
        bulletList: {
          HTMLAttributes: { class: 'list-disc list-inside space-y-0.5 my-0.5' },
        },
        orderedList: {
          HTMLAttributes: { class: 'list-decimal list-inside space-y-0.5 my-0.5' },
        },
      }),

      // Enter key submits; Shift+Enter creates new line
      Extension.create({
        name: 'submitOnEnter',
        priority: 1000,
        addKeyboardShortcuts() {
          return {
            Enter: () => {
              if (isSendingRef.current) return true;
              const html = this.editor.getHTML();
              const text = this.editor.getText().trim();
              if (text !== '') {
                submitRef.current(html);
                this.editor.commands.clearContent();
              }
              return true;
            },
          };
        },
      }),

      Mention.configure({
        HTMLAttributes: {
          class: 'text-blue-400 bg-blue-500/10 px-1 rounded font-medium',
        },
        suggestion: {
          ...suggestion,
          items: ({ query }: { query: string }) =>
            members
              .filter(m => m.fullName.toLowerCase().includes(query.toLowerCase()))
              .map(m => ({ id: m.userId, label: m.fullName }))
              .slice(0, 8),
        },
      }),
    ],

    content: initialContent,

    editorProps: {
      attributes: {
        class: [
          'prose prose-invert max-w-none focus:outline-none',
          'min-h-[52px] max-h-[300px] overflow-y-auto',
          'px-4 py-3 text-[15px] text-gray-200 leading-relaxed',
          'prose-p:my-0 prose-strong:text-gray-100 prose-em:text-gray-300',
          'prose-code:before:content-none prose-code:after:content-none',
        ].join(' '),
      },
    },
  });

  // Sync initialContent
  useEffect(() => {
    if (editor && initialContent) {
      editor.commands.setContent(initialContent);
      editor.commands.focus('end');
    }
  }, [editor, initialContent]);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(() => {
    if (!editor || isSending) return;
    const text = editor.getText().trim();
    if (!text) return;
    onSubmit(editor.getHTML());
    editor.commands.clearContent();
  }, [editor, onSubmit, isSending]);

  // ── File upload ────────────────────────────────────────────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    setIsUploading(true);
    const result = await uploadFile(file);
    setIsUploading(false);
    if (result) {
      editor.commands.insertContent(`[${result.filename}](file:${result.fileId}) `);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (!editor) return null;

  const isEmpty = editor.getText().trim() === '';

  return (
    <div className="relative">
      {/* Main editor card */}
      <div className="bg-gray-900 border border-gray-700/60 rounded-xl overflow-hidden shadow-lg focus-within:ring-1 focus-within:ring-white/30 focus-within:border-white/40 transition-all">

        {/* Placeholder overlay (Tiptap doesn't have built-in placeholder without extension) */}
        <div className="relative">
          {isEmpty && !showPreview && (
            <div className="absolute top-3 left-4 text-[15px] text-gray-500 pointer-events-none select-none z-10">
              {placeholder}
            </div>
          )}
          <div
            className={clsx('cursor-text', showPreview && 'hidden')}
            onClick={() => editor.chain().focus().run()}
          >
            <EditorContent editor={editor} />
          </div>

          {/* Preview panel */}
          {showPreview && (
            <div
              className="px-4 py-3 min-h-[52px] max-h-[300px] overflow-y-auto text-[15px] text-gray-200 leading-relaxed prose prose-invert max-w-none prose-p:my-0"
              dangerouslySetInnerHTML={{
                __html: isEmpty
                  ? `<span class="text-gray-500">${placeholder}</span>`
                  : editor.getHTML(),
              }}
            />
          )}
        </div>

        {/* ── Toolbar ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-2 py-1.5 bg-gray-950 border-t border-gray-800/60">
          <div className="flex items-center gap-0.5">

            {/* Attach file */}
            <ToolBtn
              title="Attach file"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || isSending}
            >
              {isUploading
                ? <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                : <Plus className="w-4 h-4" />
              }
            </ToolBtn>
            <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileChange} />

            <Sep />

            <ToolBtn
              active={editor.isActive('bold')}
              title="Bold — Ctrl+B"
              onClick={() => editor.chain().focus().toggleBold().run()}
            >
              <Bold className="w-4 h-4" />
            </ToolBtn>
            <ToolBtn
              active={editor.isActive('italic')}
              title="Italic — Ctrl+I"
              onClick={() => editor.chain().focus().toggleItalic().run()}
            >
              <Italic className="w-4 h-4" />
            </ToolBtn>
            <ToolBtn
              active={editor.isActive('strike')}
              title="Strikethrough — Ctrl+Shift+X"
              onClick={() => editor.chain().focus().toggleStrike().run()}
            >
              <Strikethrough className="w-4 h-4" />
            </ToolBtn>

            <Sep />

            <ToolBtn
              active={editor.isActive('code')}
              title="Inline code — Ctrl+E"
              onClick={() => editor.chain().focus().toggleCode().run()}
            >
              <Code className="w-4 h-4" />
            </ToolBtn>
            <ToolBtn
              active={editor.isActive('codeBlock')}
              title="Code block — Ctrl+Alt+C"
              onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            >
              <span className="text-[11px] font-mono font-bold">{`</>`}</span>
            </ToolBtn>
            <ToolBtn
              active={editor.isActive('blockquote')}
              title="Blockquote — Ctrl+Shift+B"
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
            >
              <Quote className="w-4 h-4" />
            </ToolBtn>
            <ToolBtn
              active={editor.isActive('bulletList')}
              title="Bullet list — Ctrl+Shift+8"
              onClick={() => editor.chain().focus().toggleBulletList().run()}
            >
              <List className="w-4 h-4" />
            </ToolBtn>

            <Sep />

            {/* Preview toggle */}
            <ToolBtn
              active={showPreview}
              title={showPreview ? 'Back to editing' : 'Preview rendered output'}
              onClick={() => setShowPreview(p => !p)}
            >
              {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </ToolBtn>
          </div>

          {/* Send button */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-600 hidden md:block">
              Enter to send · Shift+Enter for newline
            </span>
            <button
              onClick={handleSubmit}
              disabled={isSending || isEmpty}
              title="Send (Enter)"
              className="flex items-center justify-center p-2 rounded-lg bg-white hover:bg-gray-200 text-gray-950 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <SendHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const Sep = () => <div className="w-px h-4 bg-gray-800 mx-1 shrink-0" />;

const ToolBtn = ({
  children, onClick, disabled = false, title, active = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  active?: boolean;
}) => (
  <button
    onMouseDown={e => { e.preventDefault(); onClick(); }}
    disabled={disabled}
    title={title}
    className={clsx(
      'p-1.5 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
      active
        ? 'bg-gray-700 text-white'
        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800',
    )}
  >
    {children}
  </button>
);



export default TiptapEditor;
