import { useEffect } from 'react';
import { Outlet, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { TriangleAlertIcon } from 'lucide-react';

import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { WorkspaceSidebar } from '@/components/layout/WorkspaceSidebar';
import { WorkspaceTopBar } from '@/components/layout/WorkspaceTopBar';
import { useCurrentWorkspaceStore } from '@/store/currentWorkspace';
import { useNotificationStore } from '@/store/notificationStore';
import { socketClient } from '@/lib/socket';
import type { AppNotification, Presence } from '@/types/api';

export function WorkspaceLayout() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const { fetchWorkspaceData, updateMemberPresence, isLoading, error, workspaceId } =
    useCurrentWorkspaceStore();
  const addNotification = useNotificationStore((s) => s.addNotification);

  useEffect(() => {
    if (slug) void fetchWorkspaceData(slug);
  }, [slug, fetchWorkspaceData]);

  // Realtime. The handshake authenticates with the access JWT, not the refresh
  // cookie, so this must run after the session is resolved.
  useEffect(() => {
    if (!workspaceId) return;
    const socket = socketClient.connect();

    const onNotification = (notification: AppNotification) => {
      addNotification(notification);
      toast(notification.title, { description: notification.body ?? undefined });
    };

    const onPresence = (payload: { userId: string; presence: Presence; statusText?: string }) => {
      updateMemberPresence(payload.userId, {
        presence: payload.presence,
        statusText: payload.statusText,
      });
    };

    socket.on('new_notification', onNotification);
    socket.on('user_presence_updated', onPresence);

    return () => {
      socket.off('new_notification', onNotification);
      socket.off('user_presence_updated', onPresence);
    };
  }, [workspaceId, addNotification, updateMemberPresence]);

  // Tear the connection down when leaving the workspace shell entirely.
  useEffect(() => () => socketClient.disconnect(), []);

  if (error && !isLoading) {
    return (
      <Empty className="min-h-svh">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TriangleAlertIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>Couldn&apos;t open this workspace</EmptyTitle>
          <EmptyDescription>{error}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={() => navigate('/workspaces')}>Back to workspaces</Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <SidebarProvider>
      {/* First focusable element on the page, so the sidebar's ~25 nav items
          are skippable. Visually hidden until it takes focus. */}
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <WorkspaceSidebar />
      <SidebarInset>
        <WorkspaceTopBar slug={slug} />
        {/* `<main>` stays the semantic element and the skip-link target —
            `ScrollArea`'s Root renders a plain div, so it goes inside rather
            than replacing `<main>`, and does the actual scrolling. */}
        <main id="main-content" tabIndex={-1} className="flex min-h-0 flex-1 flex-col">
          <ScrollArea className="flex-1">
            <Outlet />
          </ScrollArea>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
