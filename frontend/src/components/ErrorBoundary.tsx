import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  /** Shown instead of the default panel, for boundaries around a single region. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
  /** Distinguishes boundaries in the console when several are nested. */
  label?: string;
}

interface State {
  error: Error | null;
}

/**
 * Catches render-phase errors so one broken component does not blank the app.
 *
 * Without a boundary anywhere in the tree, React 19 unmounts the entire root on
 * an uncaught render error — the user gets a white page, no message, and no way
 * forward but a manual reload. Any of the deep-link routes can hit this by
 * rendering against a partially-shaped API response.
 *
 * Note the scope: this catches errors thrown while rendering, in lifecycle
 * methods, and in constructors below it. It does not catch errors inside event
 * handlers, in `setTimeout`, or in rejected promises — those never touch the
 * render path. Async data-loading failures still need their own handling.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.label ? `: ${this.props.label}` : ''}]`, error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <div className="flex min-h-[60vh] w-full items-center justify-center p-6">
        <div className="border-border bg-card w-full max-w-md rounded-lg border p-6 text-center">
          <div className="bg-destructive/10 text-destructive mx-auto flex size-11 items-center justify-center rounded-full">
            <AlertTriangle className="size-5" aria-hidden="true" />
          </div>

          <h1 className="text-foreground mt-4 text-lg font-semibold">This page stopped working</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Something in this view failed to render. Your work is saved — reloading usually clears it.
          </p>

          {/*
            The message is the one piece of detail worth surfacing: it is what
            makes a bug report actionable. The stack stays in the console.
          */}
          <p className="text-muted-foreground/80 mt-3 truncate font-mono text-xs" title={error.message}>
            {error.message}
          </p>

          <div className="mt-5 flex items-center justify-center gap-2">
            <Button onClick={() => window.location.reload()}>
              <RotateCw className="size-4" aria-hidden="true" />
              Reload
            </Button>
            <Button variant="outline" onClick={() => { window.location.href = '/'; }}>
              <Home className="size-4" aria-hidden="true" />
              Go home
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
