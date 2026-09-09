import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

interface Prefs {
  notifyOnlyMentions: boolean;
  muteGithubBot: boolean;
}

/**
 * The only two preference keys the backend actually reads. `createNotification`
 * in notifications.controller.ts checks exactly these before writing a row —
 * anything else stored under `users.preferences` would be inert, so no other
 * toggle is offered here.
 */
export function PreferencesCard() {
  const updatePreferences = useAuthStore((s) => s.updatePreferences);
  const [prefs, setPrefs] = useState<Prefs>({ notifyOnlyMentions: false, muteGithubBot: false });
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState<keyof Prefs | null>(null);

  useEffect(() => {
    // No endpoint returns the stored preferences — neither `GET /auth/me` nor
    // the login payload includes them. `PATCH /auth/preferences` merges the
    // body into what is already there and returns the result, so patching an
    // empty object is a read that changes nothing.
    void (async () => {
      try {
        const data = await apiFetch('/auth/preferences', {
          method: 'PATCH',
          body: JSON.stringify({ preferences: {} }),
        });
        setPrefs({
          notifyOnlyMentions: !!data.preferences?.notifyOnlyMentions,
          muteGithubBot: !!data.preferences?.muteGithubBot,
        });
      } catch {
        // Falls back to both off, which is what an empty `preferences` means.
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const toggle = async (key: keyof Prefs, next: boolean) => {
    const previous = prefs;
    setPrefs({ ...prefs, [key]: next });
    setSaving(key);
    try {
      await updatePreferences({ [key]: next });
    } catch (err) {
      setPrefs(previous);
      toast.error(err instanceof Error ? err.message : 'Could not save that preference.');
    } finally {
      setSaving(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>
          These apply everywhere — the server checks them before a notification is created.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-20 w-full rounded-xl" />
        ) : (
          <FieldGroup>
            <Field orientation="horizontal">
              <Checkbox
                id="notifyOnlyMentions"
                checked={prefs.notifyOnlyMentions}
                disabled={saving === 'notifyOnlyMentions'}
                onCheckedChange={(v) => void toggle('notifyOnlyMentions', v === true)}
              />
              <FieldContent>
                <FieldLabel htmlFor="notifyOnlyMentions" className="font-normal">
                  Only notify me when I&apos;m mentioned
                </FieldLabel>
                <FieldDescription>
                  Assignments, comments and status changes stop producing notifications.
                </FieldDescription>
              </FieldContent>
            </Field>

            <Field orientation="horizontal">
              <Checkbox
                id="muteGithubBot"
                checked={prefs.muteGithubBot}
                disabled={saving === 'muteGithubBot'}
                onCheckedChange={(v) => void toggle('muteGithubBot', v === true)}
              />
              <FieldContent>
                <FieldLabel htmlFor="muteGithubBot" className="font-normal">
                  Mute GitHub activity
                </FieldLabel>
                <FieldDescription>
                  Silences commit, pull request and CI notifications.
                </FieldDescription>
              </FieldContent>
            </Field>
          </FieldGroup>
        )}
      </CardContent>
    </Card>
  );
}
