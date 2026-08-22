import React, { useCallback, useRef, useEffect, useState } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot, $getSelection, COMMAND_PRIORITY_LOW, COMMAND_PRIORITY_CRITICAL, KEY_ENTER_COMMAND, FORMAT_TEXT_COMMAND, TextNode, EditorState, $isRangeSelection, SELECTION_CHANGE_COMMAND, $createParagraphNode } from 'lexical';
import { $generateHtmlFromNodes, $generateNodesFromDOM } from '@lexical/html';
import { HeadingNode, QuoteNode, $createQuoteNode } from '@lexical/rich-text';
import { ListItemNode, ListNode, INSERT_UNORDERED_LIST_COMMAND, REMOVE_LIST_COMMAND } from '@lexical/list';
import { CodeHighlightNode, CodeNode, $createCodeNode } from '@lexical/code';
import { AutoLinkNode, LinkNode, $createLinkNode } from '@lexical/link';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { $setBlocksType } from '@lexical/selection';

import {
  Bold, Italic, Strikethrough, Code, SendHorizontal,
  Plus, Quote, List
} from 'lucide-react';
import clsx from 'clsx';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useChatStore as useUploadStore } from '../../store/useChatStore.js';
import { useCurrentWorkspaceStore } from '../../store/currentWorkspace.js';


const theme = {
  text: {
    bold: 'font-[590] text-foreground',
    italic: 'italic text-foreground',
    strikethrough: 'line-through',
    code: 'bg-hover border border-border rounded px-1 py-0.5 text-caption font-mono text-foreground',
  },
  link: 'text-primary font-[510] hover:text-primary-hover cursor-pointer bg-primary-muted px-2 py-0.5 rounded font-mono text-caption border border-primary-border no-underline inline-flex items-center gap-1 my-0.5',
  quote: 'border-l-4 border-strong pl-3 text-muted-foreground italic my-0.5 block',
  list: {
    ul: 'list-disc list-inside space-y-0.5 my-0.5',
    ol: 'list-decimal list-inside space-y-0.5 my-0.5',
    listitem: 'marker:text-subtle-foreground',
  },
  code: 'bg-muted border border-border rounded-md px-3 py-2 text-ui font-mono text-foreground whitespace-pre-wrap my-1 block',
};


// ── Toolbar ──────────────────────────────────────────────────────────────────
interface ToolbarPluginProps {
  isSending: boolean;
  onUploadClick: () => void;
}

function ToolbarPlugin({ isSending, onUploadClick }: ToolbarPluginProps) {
  const [editor] = useLexicalComposerContext();
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isStrikethrough, setIsStrikethrough] = useState(false);
  const [isCode, setIsCode] = useState(false);
  const [blockType, setBlockType] = useState('paragraph');

  const updateToolbar = useCallback(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      setIsBold(selection.hasFormat('bold'));
      setIsItalic(selection.hasFormat('italic'));
      setIsStrikethrough(selection.hasFormat('strikethrough'));
      setIsCode(selection.hasFormat('code'));
      
      const anchorNode = selection.anchor.getNode();
      const element = anchorNode.getKey() === 'root' ? anchorNode : anchorNode.getTopLevelElementOrThrow();
      setBlockType(element.getType());
    }
  }, []);

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }: { editorState: EditorState }) => {
      editorState.read(() => {
        updateToolbar();
      });
    });
  }, [editor, updateToolbar]);

  useEffect(() => {
    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        updateToolbar();
        return false;
      },
      COMMAND_PRIORITY_LOW
    );
  }, [editor, updateToolbar]);

  const formatCodeBlock = () => {
    if (blockType !== 'code') {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createCodeNode());
        }
      });
    } else {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createParagraphNode());
        }
      });
    }
  };

  const formatQuote = () => {
    if (blockType !== 'quote') {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createQuoteNode());
        }
      });
    } else {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createParagraphNode());
        }
      });
    }
  };

  const formatBulletList = () => {
    if (blockType !== 'bullet') {
      editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
    } else {
      editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
    }
  };
  
  return (
    <div className="flex items-center justify-between px-2 py-1.5 bg-background border-t border-border">
      <div className="flex items-center gap-0.5">
        <ToolBtn title="Attach file" onClick={onUploadClick} disabled={isSending}>
          <Plus className="w-4 h-4" strokeWidth={1.75} />
        </ToolBtn>
        <Sep />
        <ToolBtn active={isBold} title="Bold — Ctrl+B" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')}>
          <Bold className="w-4 h-4" strokeWidth={1.75} />
        </ToolBtn>
        <ToolBtn active={isItalic} title="Italic — Ctrl+I" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')}>
          <Italic className="w-4 h-4" strokeWidth={1.75} />
        </ToolBtn>
        <ToolBtn active={isStrikethrough} title="Strikethrough" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough')}>
          <Strikethrough className="w-4 h-4" strokeWidth={1.75} />
        </ToolBtn>
        <Sep />
        <ToolBtn active={isCode} title="Inline code" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'code')}>
          <Code className="w-4 h-4" strokeWidth={1.75} />
        </ToolBtn>
        <ToolBtn active={blockType === 'code'} title="Code block" onClick={formatCodeBlock}>
          <span className="text-micro font-mono font-[590]">{`</>`}</span>
        </ToolBtn>
        <ToolBtn active={blockType === 'quote'} title="Blockquote" onClick={formatQuote}>
          <Quote className="w-4 h-4" strokeWidth={1.75} />
        </ToolBtn>
        <ToolBtn active={blockType === 'bullet'} title="Bullet list" onClick={formatBulletList}>
          <List className="w-4 h-4" strokeWidth={1.75} />
        </ToolBtn>
      </div>
    </div>
  );
}

// ── Submit logic ─────────────────────────────────────────────────────────────
function SubmitPlugin({ onSubmit, isSending, setIsEmpty, submitTrigger, onSubmitted }: { onSubmit: (html: string) => void, isSending: boolean, setIsEmpty: (val: boolean) => void, submitTrigger: number, onSubmitted: () => void }) {
  const [editor] = useLexicalComposerContext();
  const submitRef = useRef(onSubmit);
  const isSendingRef = useRef(isSending);
  
  useEffect(() => {
    submitRef.current = onSubmit;
    isSendingRef.current = isSending;
  }, [onSubmit, isSending]);

  const doSubmit = useCallback(() => {
    if (isSendingRef.current) return;
    
    let html = '';
    let isEmptyContent = true;
    
    editor.update(() => {
      const root = $getRoot();
      if (root.getTextContent().trim() !== '') {
        isEmptyContent = false;
        let rawHtml = $generateHtmlFromNodes(editor, null);
        // Convert Lexical file link nodes <a href="#file:ID">...</a> back to markdown format [FILENAME](file:ID)
        rawHtml = rawHtml.replace(/<a [^>]*href="#file:([a-zA-Z0-9-]+)"[^>]*>(?:📎\s*)?(.*?)<\/a>/g, '[$2](file:$1)');
        html = rawHtml;
      }
    });
    
    if (!isEmptyContent && html) {
      submitRef.current(html);
      editor.update(() => {
        $getRoot().clear();
      });
      setIsEmpty(true);
      onSubmitted();
    }
  }, [editor, onSubmitted, setIsEmpty]);

  useEffect(() => {
    if (submitTrigger > 0) {
      doSubmit();
    }
  }, [submitTrigger, doSubmit]);

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }: { editorState: EditorState }) => {
      editorState.read(() => {
        const root = $getRoot();
        const text = root.getTextContent().trim();
        setIsEmpty(text === '');
      });
    });
  }, [editor, setIsEmpty]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        if (isSendingRef.current) return;
        event.preventDefault();
        event.stopPropagation();
        doSubmit();
      }
    };

    let cleanupListener: (() => void) | null = null;

    const addListener = (element: HTMLElement | null) => {
      if (cleanupListener) {
        cleanupListener();
        cleanupListener = null;
      }
      if (element) {
        element.addEventListener('keydown', handleKeyDown, true);
        cleanupListener = () => element.removeEventListener('keydown', handleKeyDown, true);
      }
    };

    addListener(editor.getRootElement());

    const unregisterRoot = editor.registerRootListener((rootElement) => {
      addListener(rootElement);
    });

    const unregisterCommand = editor.registerCommand<KeyboardEvent | null>(
      KEY_ENTER_COMMAND,
      (event) => {
        if (isSendingRef.current) return true;
        if (event && event.shiftKey) return false;
        if (event) {
          event.preventDefault();
          event.stopPropagation();
        }
        doSubmit();
        return true;
      },
      COMMAND_PRIORITY_CRITICAL
    );

    return () => {
      if (cleanupListener) cleanupListener();
      unregisterRoot();
      unregisterCommand();
    };
  }, [editor, doSubmit]);
  
  return null;
}

interface WorkspaceMember {
  userId: string;
  fullName: string;
  /** Nullable in the API payload, so this mirrors the store's `WorkspaceMember`. */
  displayName?: string | null;
}

interface TaskItem {
  id: string;
  taskKey?: string;
  title: string;
}

// ── Mentions Plugin ────────────────────────────────────────────────────────
function MentionsPlugin({ members, tasks = [] }: { members: WorkspaceMember[]; tasks?: TaskItem[] }) {
  const [editor] = useLexicalComposerContext();
  const [query, setQuery] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ x: number, y: number, topY: number } | null>(null);
  
  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
          setQuery(null);
          return;
        }
        
        const anchor = selection.anchor;
        const node = anchor.getNode();
        if (node.getType() !== 'text') {
          setQuery(null);
          return;
        }
        
        const textContent = node.getTextContent();
        const textBeforeCursor = textContent.slice(0, anchor.offset);
        
        const match = textBeforeCursor.match(/(?:^|\s)@([a-zA-Z0-9_-]*)$/);
        if (match) {
          setQuery(match[1].toLowerCase());
          const domSelection = window.getSelection();
          if (domSelection && domSelection.rangeCount > 0) {
            const range = domSelection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            setCoords({ x: rect.left, y: rect.bottom, topY: rect.top });
          }
        } else {
          setQuery(null);
        }
      });
    });
  }, [editor]);

  const filteredMembers = query !== null 
    ? members.filter(m => m.fullName.toLowerCase().includes(query) || m.displayName?.toLowerCase().includes(query))
    : [];

  const filteredTasks = query !== null && tasks.length > 0
    ? tasks.filter(t => 
        (t.taskKey && t.taskKey.toLowerCase().includes(query)) ||
        (t.title && t.title.toLowerCase().includes(query))
      )
    : [];

  const handleSelect = (mentionTextStr: string) => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection) || !selection.isCollapsed()) return;
      
      const anchor = selection.anchor;
      const node = anchor.getNode() as TextNode;
      const textContent = node.getTextContent();
      const textBeforeCursor = textContent.slice(0, anchor.offset);
      
      const match = textBeforeCursor.match(/(?:^|\s)@([a-zA-Z0-9_-]*)$/);
      if (match) {
        const startOffset = anchor.offset - match[0].length + (match[0].startsWith(' ') ? 1 : 0);
        const endOffset = anchor.offset;
        
        const splitNodes = node.splitText(startOffset, endOffset);
        const textToReplace = splitNodes.length > 1 ? splitNodes[1] : splitNodes[0];
        
        const mentionText = `@${mentionTextStr} `;
        textToReplace.setTextContent(mentionText);
        textToReplace.selectNext();
      }
    });
    setQuery(null);
  };

  if (query === null || (filteredMembers.length === 0 && filteredTasks.length === 0) || !coords) return null;

  const openUpward = window.innerHeight - coords.y < 240;

  return (
    <div 
      className="fixed z-(--z-dropdown) bg-card border border-border rounded-lg shadow-md w-72 overflow-hidden"
      style={{ 
        left: Math.max(16, Math.min(coords.x, window.innerWidth - 300)),
        top: openUpward ? undefined : coords.y + 4,
        bottom: openUpward ? (window.innerHeight - coords.topY + 6) : undefined
      }}
    >
      <div className="max-h-56 overflow-y-auto py-1">
        {filteredMembers.length > 0 && (
          <div>
            <div className="px-3 py-1 text-micro font-[590] text-subtle-foreground uppercase bg-muted">Members</div>
            {filteredMembers.map((m) => (
              <div 
                key={m.userId}
                className="px-3 py-1.5 hover:bg-hover cursor-pointer flex items-center space-x-2"
                onMouseDown={(e) => { e.preventDefault(); handleSelect(m.fullName.replace(/\s+/g, '')); }}
              >
                <Avatar size="sm" className="size-5 shrink-0">
                  <AvatarFallback className="bg-hover text-micro text-foreground font-[590]">
                    {m.fullName[0]}
                  </AvatarFallback>
                </Avatar>
                <span className="text-ui text-foreground truncate">{m.fullName}</span>
              </div>
            ))}
          </div>
        )}

        {filteredTasks.length > 0 && (
          <div>
            <div className="px-3 py-1 text-micro font-[590] text-subtle-foreground uppercase bg-muted border-t border-border">Project Tasks</div>
            {filteredTasks.map((t) => (
              <div 
                key={t.id}
                className="px-3 py-1.5 hover:bg-hover cursor-pointer flex items-center justify-between space-x-2"
                onMouseDown={(e) => { e.preventDefault(); handleSelect(t.taskKey || t.id); }}
              >
                <span className="text-caption font-mono font-[590] text-primary shrink-0">{t.taskKey || t.id}</span>
                <span className="text-caption text-foreground truncate flex-1 text-right">{t.title}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Initial Content ──────────────────────────────────────────────────────────
function InitialContentPlugin({ initialContent }: { initialContent: string }) {
  const [editor] = useLexicalComposerContext();
  const hasSet = useRef(false);

  useEffect(() => {
    if (initialContent && !hasSet.current) {
      hasSet.current = true;
      editor.update(() => {
        const formattedHtml = initialContent.replace(/\[(.*?)\]\(file:([a-zA-Z0-9-]+)\)/g, '<a href="#file:$2">📎 $1</a>');
        const parser = new DOMParser();
        const dom = parser.parseFromString(formattedHtml, 'text/html');
        const nodes = $generateNodesFromDOM(editor, dom);
        const root = $getRoot();
        root.clear();
        root.append(...nodes);
      });
    }
  }, [editor, initialContent]);

  return null;
}

// ── Insert File Plugin ───────────────────────────────────────────────────────
function InsertFilePlugin({ fileInfo }: { fileInfo: { filename: string; fileId: string } | null }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    if (fileInfo) {
      editor.update(() => {
        const linkNode = $createLinkNode(`#file:${fileInfo.fileId}`);
        const textNode = new TextNode(`📎 ${fileInfo.filename}`);
        linkNode.append(textNode);
        
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          selection.insertNodes([linkNode, new TextNode(' ')]);
        } else {
          const root = $getRoot();
          root.append(linkNode, new TextNode(' '));
        }
      });
    }
  }, [fileInfo, editor]);
  return null;
}


interface LexicalEditorProps {
  onSubmit: (content: string) => void;
  placeholder?: string;
  isSending?: boolean;
  initialContent?: string;
  tasks?: TaskItem[];
}

export const LexicalEditor = ({
  onSubmit,
  placeholder = 'Type a message… Use @name to mention',
  isSending = false,
  initialContent = '',
  tasks = [],
}: LexicalEditorProps) => {
  const { uploadFile } = useUploadStore();
  const [isUploading, setIsUploading] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);
  const [submitTrigger, setSubmitTrigger] = useState(0);
  const [fileInfo, setFileInfo] = useState<{ filename: string; fileId: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { members } = useCurrentWorkspaceStore();

  const initialConfig = {
    namespace: 'DevSyncChatEditor',
    theme,
    nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, CodeNode, CodeHighlightNode, AutoLinkNode, LinkNode],
    onError: (error: Error) => console.error(error),
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const result = await uploadFile(file);
    setIsUploading(false);
    
    if (result) {
      setFileInfo({ filename: result.filename, fileId: result.fileId });
      setTimeout(() => setFileInfo(null), 100);
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="relative">
        <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm focus-within:ring-1 focus-within:ring-ring focus-within:border-ring transition-colors">
          <div className="relative">
            <RichTextPlugin
              contentEditable={
                <ContentEditable className="message-body max-w-none focus:outline-none min-h-[52px] max-h-[300px] overflow-y-auto px-4 py-3 text-foreground cursor-text" />
              }
              placeholder={<div className="absolute top-3 left-4 text-body text-subtle-foreground pointer-events-none select-none z-[var(--z-sticky)]">{placeholder}</div>}
              ErrorBoundary={LexicalErrorBoundary}
            />
            <HistoryPlugin />
            <ListPlugin />
            <LinkPlugin />
            <AutoFocusPlugin />
            <SubmitPlugin onSubmit={onSubmit} isSending={isSending || isUploading} setIsEmpty={setIsEmpty} submitTrigger={submitTrigger} onSubmitted={() => setSubmitTrigger(0)} />
            <InitialContentPlugin initialContent={initialContent} />
            <InsertFilePlugin fileInfo={fileInfo} />
            <MentionsPlugin members={members} tasks={tasks} />
          </div>
          
          <ToolbarPlugin 
            isSending={isSending || isUploading} 
            onUploadClick={() => fileInputRef.current?.click()} 
          />
          <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
          
<Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => {
                    setSubmitTrigger(t => t + 1);
                  }}
                  disabled={isSending || isUploading || isEmpty}
                  aria-label="Send message"
                  className="absolute right-2 bottom-1.5 flex items-center justify-center p-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed z-[var(--z-dropdown)]"
                  size="icon" variant="primary"
                >
                  <SendHorizontal className="w-4 h-4" strokeWidth={1.75} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Send (Enter)</TooltipContent>
            </Tooltip>
        </div>
      </div>
    </LexicalComposer>
  );
};

const Sep = () => <div className="w-px h-4 bg-border mx-1 shrink-0" />;

const ToolBtn = ({
  children, onClick, disabled = false, title, active = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  active?: boolean;
}) => {
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

export default LexicalEditor;
