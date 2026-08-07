import { useState, useEffect } from 'react';
import { X, Loader2, Terminal } from 'lucide-react';
import { apiFetch } from '../../../lib/api.js';

interface CiLogsModalProps {
  slug: string;
  keyStr: string;
  runId: number;
  onClose: () => void;
}

export const CiLogsModal = ({ slug, keyStr, runId, onClose }: CiLogsModalProps) => {
  const [logsData, setLogsData] = useState<{ jobName: string; logs: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchLogs = async () => {
      try {
        const res = await apiFetch(`/workspaces/${slug}/projects/${keyStr}/github/ci/${runId}/logs`);
        if (isMounted) setLogsData(res.jobs || []);
      } catch (err: unknown) {
        const e = err as Error;
        if (isMounted) setError(e.message || 'Failed to load logs');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    fetchLogs();
    return () => { isMounted = false; };
  }, [slug, keyStr, runId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
          <h2 className="text-lg font-bold text-gray-100 flex items-center">
            <Terminal className="w-5 h-5 mr-2 text-gray-400" />
            Terminal Logs — Run #{runId}
          </h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col p-6 bg-[#0d1117]">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full text-red-400 font-mono text-sm">
              {error}
            </div>
          ) : logsData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500 font-mono text-sm">
              No logs found for this run.
            </div>
          ) : (
            <div className="h-full overflow-y-auto custom-scrollbar pr-4 space-y-6">
              {logsData.map((job, idx) => (
                <div key={idx} className="flex flex-col">
                  <div className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2 border-b border-gray-800 pb-1">
                    Job: {job.jobName}
                  </div>
                  <pre className="font-mono text-[11px] text-gray-300 whitespace-pre-wrap leading-relaxed break-words">
                    {job.logs || 'No log output.'}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
