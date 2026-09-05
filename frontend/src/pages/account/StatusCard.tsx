import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2Icon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api';
import type { Presence } from '@/types/api';

const PRESENCE_LABELS: Record<Presence, string> = {
  online: 'Online',
  away: 'Away',
  offline: 'Offline',
};

export function StatusCard({ onSaved }: { onSaved?: (presence: Presence) => void }) {
  const [presence, setPresence] = useState<Presence>('online');
  const [statusText, setStatusText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // There is no read endpoint for status: `GET /auth/me` returns only
    // userId/email/fullName, and the login payload carries no statusText. The
    // one place the current values surface is the response to `POST
    // /auth/status`, whose fields are all optional — so an empty body updates
    // nothing but `lastActiveAt` and hands back what is already stored.
    void (async () => {
      try {
        const data = await apiFetch('/auth/status', { method: 'POST', body: JSON.stringify({}) });
        setPresence((data.user?.presence as Presence) ?? 'online');
        setStatusText(data.user?.statusText ?? '');
      } catch {
        // A failure here just means the form starts from defaults; saving still
        // works, so there is nothing worth interrupting the page for.
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const save = async () => {
    setIsSaving(true);
    try {
      // `updateStatusSchema` is `.strict()` and caps statusText at 100 chars.
      await apiFetch('/auth/status', {
        method: 'POST',
        body: JSON.stringify({ presence, statusText: statusText.slice(0, 100) }),
      });
      onSaved?.(presence);
      toast.success('Status updated.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update your status.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Status</CardTitle>
        <CardDescription>
          What your teammates see next to your name across the workspace.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-28 w-full rounded-xl" />
        ) : (
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="presence">Presence</FieldLabel>
              <Select value={presence} onValueChange={(v) => setPresence(v as Presence)}>
                <SelectTrigger id="presence" className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PRESENCE_LABELS) as Presence[]).map((p) => (
                    <SelectItem key={p} value={p}>
                      {PRESENCE_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="statusText">Status message</FieldLabel>
              <Input
                id="statusText"
                value={statusText}
                maxLength={100}
                placeholder="Heads down on the sprint"
                onChange={(e) => setStatusText(e.target.value)}
              />
              <FieldDescription>{statusText.length}/100 characters</FieldDescription>
            </Field>

            <div>
              <Button onClick={() => void save()} disabled={isSaving}>
                {isSaving ? <Loader2Icon className="size-4 animate-spin" aria-hidden="true" /> : null}
                Save status
              </Button>
            </div>
          </FieldGroup>
        )}
      </CardContent>
    </Card>
  );
}
