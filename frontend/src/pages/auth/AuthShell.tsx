import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Shared frame for the signed-out pages: a single centred card on the canvas.
 * The heading is a real `<h1>` so the accessible name is unambiguous — the
 * Playwright suite locates the login page by `getByRole('heading')`.
 */
export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-100">
        <Card>
          <CardHeader>
            <CardTitle>
              <h1 className="text-xl">{title}</h1>
            </CardTitle>
            {description ? <CardDescription>{description}</CardDescription> : null}
          </CardHeader>
          <CardContent className="flex flex-col gap-6">{children}</CardContent>
        </Card>
        {footer ? <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div> : null}
      </div>
    </div>
  );
}
