// `tiptap-markdown` documents `editor.storage.markdown` (see its own
// `MarkdownStorage` export) but ships no augmentation of Tiptap's `Storage`
// interface for it — every extension is meant to declare its own slot there,
// and this one leaves that step to the consumer. Without this, every read of
// `editor.storage.markdown` is a type error (`RichTextEditor.tsx`).
import '@tiptap/core';
import type { MarkdownStorage } from 'tiptap-markdown';

declare module '@tiptap/core' {
  interface Storage {
    markdown: MarkdownStorage;
  }
}
