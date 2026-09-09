import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  build: {
    // Routes are lazy-loaded in App.tsx, which leaves the entry chunk as the
    // framework plus the three eager pages. Splitting the framework out again
    // means a deploy that only changes app code does not invalidate it in
    // everyone's cache.
    // Vite 8 bundles with rolldown, whose `manualChunks` takes the function
    // form only — the object form throws "manualChunks is not a function".
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (/node_modules[/\\](react|react-dom|react-router|react-router-dom|scheduler)[/\\]/.test(id)) {
            return 'react-vendor';
          }
          return undefined;
        },
      },
    },
    // The remaining chunks over the default 500 kB ceiling are the editor
    // (Tiptap, loaded only on a channel) and the charts (Recharts, only on
    // analytics). Both are behind a lazy route, so the number that matters —
    // the initial download — is well under it. Raised so the warning stays
    // meaningful instead of firing on every build.
    chunkSizeWarningLimit: 700,
  },
})
