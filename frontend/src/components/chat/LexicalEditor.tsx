import React, { useCallback, useRef, useEffect, useState } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot, $getSelection, COMMAND_PRIORITY_LOW, KEY_ENTER_COMMAND, FORMAT_TEXT_COMMAND, TextNode, EditorState, $isRangeSelection, SELECTION_CHANGE_COMMAND, $createParagraphNode } from 'lexical';
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
import { useChatStore as useUploadStore } from '../../store/useChatStore.js';
import { useCurrentWorkspaceStore } from '../../store/currentWorkspace.js';


const theme = {
  text: {
    bold: 'font-bold text-gray-100',
    italic: 'italic text-gray-300',
    strikethrough: 'line-through',
    code: 'bg-gray-800 border border-gray-700 rounded px-1 py-0.5 text-xs font-mono text-gray-200',
  },
  link: 'text-blue-400 font-medium hover:text-blue-300 cursor-pointer bg-blue-500/10 px-2 py-0.5 rounded font-mono text-xs border border-blue-500/20 no-underline inline-flex items-center gap-1 my-0.5',
  quote: 'border-l-4 border-gray-600 pl-3 text-gray-400 italic my-0.5 block',
  list: {
    ul: 'list-disc list-inside space-y-0.5 my-0.5',
    ol: 'list-decimal list-inside space-y-0.5 my-0.5',
    listitem: 'marker:text-gray-500',
  },
  code: 'bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-sm font-mono text-gray-200 whitespace-pre-wrap my-1 block',
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
    <div className="flex items-center justify-between px-2 py-1.5 bg-gray-950 border-t border-gray-800/60">
      <div className="flex items-center gap-0.5">
        <ToolBtn title="Attach file" onClick={onUploadClick} disabled={isSending}>
          <Plus className="w-4 h-4" />
        </ToolBtn>
        <Sep />
        <ToolBtn active={isBold} title="Bold — Ctrl+B" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')}>
          <Bold className="w-4 h-4" />
        </ToolBtn>
        <ToolBtn active={isItalic} title="Italic — Ctrl+I" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')}>
          <Italic className="w-4 h-4" />
        </ToolBtn>
        <ToolBtn active={isStrikethrough} title="Strikethrough" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough')}>
          <Strikethrough className="w-4 h-4" />
        </ToolBtn>
        <Sep />
        <ToolBtn active={isCode} title="Inline code" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'code')}>
          <Code className="w-4 h-4" />
        </ToolBtn>
        <ToolBtn active={blockType === 'code'} title="Code block" onClick={formatCodeBlock}>
          <span className="text-[11px] font-mono font-bold">{`</>`}</span>
        </ToolBtn>
        <ToolBtn active={blockType === 'quote'} title="Blockquote" onClick={formatQuote}>
          <Quote className="w-4 h-4" />
        </ToolBtn>
        <ToolBtn active={blockType === 'bullet'} title="Bullet list" onClick={formatBulletList}>
          <List className="w-4 h-4" />
        </ToolBtn>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-gray-600 hidden md:block">
          Enter to send · Shift+Enter for newline
        </span>
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
    return editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event: KeyboardEvent) => {
        if (isSendingRef.current) return true;
        if (event.shiftKey) return false;
        
        // Prevent default newline insertion
        event.preventDefault();
        doSubmit();
        return true;
      },
      COMMAND_PRIORITY_LOW
    );
  }, [editor, doSubmit]);
  
  return null;
}

interface WorkspaceMember {
  userId: string;
  fullName: string;
  displayName?: string;
  [key: string]: unknown;
}

// ── Mentions Plugin ────────────────────────────────────────────────────────
function MentionsPlugin({ members }: { members: WorkspaceMember[] }) {
  const [editor] = useLexicalComposerContext();
  const [query, setQuery] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ x: number, y: number } | null>(null);
  
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
            // Get coordinates relative to the nearest positioned ancestor
            setCoords({ x: rect.left, y: rect.bottom });
          }
        } else {
          setQuery(null);
        }
      });
    });
  }, [editor]);

  const filteredMembers = query !== null 
    ? members.filter(m => m.fullName.toLowerCase().startsWith(query) || m.displayName?.toLowerCase().startsWith(query))
    : [];

  const handleSelect = (username: string) => {
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
        
        const mentionText = `@${username} `;
        textToReplace.setTextContent(mentionText);
        textToReplace.selectNext();
      }
    });
    setQuery(null);
  };

  if (query === null || filteredMembers.length === 0 || !coords) return null;

  return (
    <div 
      className="fixed z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-xl w-64 overflow-hidden"
      style={{ top: coords.y + 4, left: coords.x }}
    >
      <div className="max-h-48 overflow-y-auto py-1">
        {filteredMembers.map((m) => (
          <div 
            key={m.userId}
            className="px-3 py-2 hover:bg-gray-800 cursor-pointer flex items-center space-x-2"
            onMouseDown={(e) => { e.preventDefault(); handleSelect(m.fullName.replace(/\s+/g, '')); }}
          >
            <div className="w-5 h-5 rounded-full bg-gray-700 flex items-center justify-center text-[10px] text-white">
              {m.fullName[0]}
            </div>
            <span className="text-sm text-gray-200">{m.fullName}</span>
          </div>
        ))}
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
}

export const LexicalEditor = ({
  onSubmit,
  placeholder = 'Type a message… Use @name to mention',
  isSending = false,
  initialContent = '',
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
        <div className="bg-gray-900 border border-gray-700/60 rounded-xl overflow-hidden shadow-lg focus-within:ring-1 focus-within:ring-white/30 focus-within:border-white/40 transition-all">
          <div className="relative">
            <RichTextPlugin
              contentEditable={
                <ContentEditable className="prose prose-invert max-w-none focus:outline-none min-h-[52px] max-h-[300px] overflow-y-auto px-4 py-3 text-[15px] text-gray-200 leading-relaxed cursor-text" />
              }
              placeholder={<div className="absolute top-3 left-4 text-[15px] text-gray-500 pointer-events-none select-none z-10">{placeholder}</div>}
              ErrorBoundary={LexicalErrorBoundary}
            />
            <HistoryPlugin />
            <ListPlugin />
            <LinkPlugin />
            <AutoFocusPlugin />
            <SubmitPlugin onSubmit={onSubmit} isSending={isSending || isUploading} setIsEmpty={setIsEmpty} submitTrigger={submitTrigger} onSubmitted={() => setSubmitTrigger(0)} />
            <InitialContentPlugin initialContent={initialContent} />
            <InsertFilePlugin fileInfo={fileInfo} />
            <MentionsPlugin members={members} />
          </div>
          
          <ToolbarPlugin 
            isSending={isSending || isUploading} 
            onUploadClick={() => fileInputRef.current?.click()} 
          />
          <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
          
          <button
              onClick={() => {
                setSubmitTrigger(t => t + 1);
              }}
              disabled={isSending || isUploading || isEmpty}
              title="Send (Enter)"
              className="absolute right-2 bottom-1.5 flex items-center justify-center p-2 rounded-lg bg-white hover:bg-gray-200 text-gray-950 transition-colors disabled:opacity-40 disabled:cursor-not-allowed z-20"
            >
              <SendHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>
    </LexicalComposer>
  );
};

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

export default LexicalEditor;
