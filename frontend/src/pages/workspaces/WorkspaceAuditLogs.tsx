import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ShieldAlert, Trash2, Edit2, UserMinus, PlusCircle, Activity } from 'lucide-react';
import { apiFetch } from '../../lib/api.js';

export const WorkspaceAuditLogs = () => {
  const { slug } = useParams();
  const [logs, setLogs] = useState<any[]>([]);
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
    if (action.includes('deleted') || action.includes('removed')) return <Trash2 className="w-4 h-4 text-red-400" />;
    if (action.includes('created') || action.includes('added')) return <PlusCircle className="w-4 h-4 text-green-400" />;
    if (action.includes('updated') || action.includes('archived')) return <Edit2 className="w-4 h-4 text-blue-400" />;
    if (action.includes('member')) return <UserMinus className="w-4 h-4 text-yellow-400" />;
    return <Activity className="w-4 h-4 text-gray-400" />;
  };

  const formatActionName = (action: string) => {
    return action.replace('.', ' ').replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-8 bg-gray-950 font-sans">
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
      <div className="p-6 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-gray-950 border border-gray-800 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-gray-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white mb-0.5">Audit Logs</h2>
            <p className="text-sm text-gray-500">A read-only log of destructive and administrative actions in this workspace.</p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-800 bg-gray-900/80 text-xs uppercase tracking-wider text-gray-500 font-semibold">
              <th className="px-6 py-4">Action</th>
              <th className="px-6 py-4">Performed By</th>
              <th className="px-6 py-4">Date</th>
              <th className="px-6 py-4">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/60 text-sm">
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                  <div className="animate-pulse space-y-3 max-w-md mx-auto">
                    <div className="h-4 bg-gray-800 rounded w-full"></div>
                    <div className="h-4 bg-gray-800 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-800 rounded w-5/6"></div>
                  </div>
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                  <ShieldAlert className="w-8 h-8 mx-auto mb-3 opacity-20" />
                  No audit logs found for this workspace.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.logId} className="hover:bg-gray-800/30 transition-colors group">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      {getActionIcon(log.action)}
                      <span className="font-medium text-gray-300">{formatActionName(log.action)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 rounded bg-gray-800 flex items-center justify-center text-xs font-bold text-white">
                        {log.actorName?.charAt(0) || 'U'}
                      </div>
                      <span className="text-gray-400">{log.actorName || 'Unknown User'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      {log.oldValues && (
                        <div className="text-xs text-gray-500 bg-gray-950 p-2 rounded border border-gray-800/50 max-w-xs truncate" title={JSON.stringify(log.oldValues)}>
                          <span className="font-mono text-gray-400">Old: {JSON.stringify(log.oldValues)}</span>
                        </div>
                      )}
                      {log.newValues && (
                        <div className="text-xs text-gray-500 bg-gray-950 p-2 rounded border border-gray-800/50 max-w-xs truncate" title={JSON.stringify(log.newValues)}>
                          <span className="font-mono text-green-400/80">New: {JSON.stringify(log.newValues)}</span>
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
