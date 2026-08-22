import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ShieldAlert, Trash2, Edit2, UserMinus, PlusCircle, Activity } from 'lucide-react';
import { apiFetch } from '../../lib/api.js';
import type { Json } from '../../types';

/**
 * A row from `GET /audit/workspace/:workspaceId`. `oldValues`/`newValues` are
 * `jsonb` snapshots whose shape depends on the entity that was mutated, so they
 * stay `Json` — this view only stringifies them.
 */
interface AuditLog {
  logId: string;
  action: string;
  actorName: string | null;
  createdAt: string;
  oldValues: Json | null;
  newValues: Json | null;
}

export const WorkspaceAuditLogs = () => {
  const { slug } = useParams();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        // First get the workspaceId from the current slug
        const wsData = await apiFetch(`/workspaces/${slug}`);
        if (!wsData.workspace?.workspaceId) return;

        // Fetch logs
        const data = await apiFetch(`/audit/workspace/${wsData.workspace.workspaceId}`);
        setLogs(data.logs || []);
      } catch (err) {
        console.error('Failed to fetch audit logs', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    if (slug) fetchLogs();
  }, [slug]);

  const getActionIcon = (action: string) => {
    if (action.includes('deleted') || action.includes('removed')) return <Trash2 className="w-4 h-4 text-danger" />;
    if (action.includes('created') || action.includes('added')) return <PlusCircle className="w-4 h-4 text-success" />;
    if (action.includes('updated') || action.includes('archived')) return <Edit2 className="w-4 h-4 text-primary" />;
    if (action.includes('member')) return <UserMinus className="w-4 h-4 text-warning" />;
    return <Activity className="w-4 h-4 text-muted-foreground" />;
  };

  const formatActionName = (action: string) => {
    return action.replace('.', ' ').replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="h-full overflow-y-auto p-8 bg-background font-sans">
    <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm">
      <div className="p-6 border-b border-border flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-background border border-border flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground mb-0.5">Audit Logs</h2>
            <p className="text-sm text-subtle-foreground">A read-only log of destructive and administrative actions in this workspace.</p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted text-xs uppercase tracking-wider text-subtle-foreground font-semibold">
              <th className="px-6 py-4">Action</th>
              <th className="px-6 py-4">Performed By</th>
              <th className="px-6 py-4">Date</th>
              <th className="px-6 py-4">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-subtle-foreground">
                  <div className="animate-pulse space-y-3 max-w-md mx-auto">
                    <div className="h-4 bg-secondary rounded w-full"></div>
                    <div className="h-4 bg-secondary rounded w-3/4"></div>
                    <div className="h-4 bg-secondary rounded w-5/6"></div>
                  </div>
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-subtle-foreground">
                  <ShieldAlert className="w-8 h-8 mx-auto mb-3 opacity-20" />
                  No audit logs found for this workspace.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.logId} className="hover:bg-hover transition-colors group">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      {getActionIcon(log.action)}
                      <span className="font-medium text-foreground">{formatActionName(log.action)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 rounded bg-secondary flex items-center justify-center text-xs font-bold text-foreground">
                        {log.actorName?.charAt(0) || 'U'}
                      </div>
                      <span className="text-muted-foreground">{log.actorName || 'Unknown User'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-subtle-foreground">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      {log.oldValues && (
                        <div className="text-xs text-subtle-foreground bg-muted p-2 rounded border border-border max-w-xs truncate" title={JSON.stringify(log.oldValues)}>
                          <span className="font-mono text-muted-foreground">Old: {JSON.stringify(log.oldValues)}</span>
                        </div>
                      )}
                      {log.newValues && (
                        <div className="text-xs text-subtle-foreground bg-muted p-2 rounded border border-border max-w-xs truncate" title={JSON.stringify(log.newValues)}>
                          <span className="font-mono text-success">New: {JSON.stringify(log.newValues)}</span>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
    </div>
  );
};
