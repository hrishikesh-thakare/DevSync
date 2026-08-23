import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.tsx';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';

import { CommandPalette } from '@/components/CommandPalette';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <TooltipProvider delayDuration={300}>
        <App />
        <CommandPalette />
        <Toaster position="bottom-right" richColors closeButton />
      </TooltipProvider>
    </BrowserRouter>
  </StrictMode>,
);
