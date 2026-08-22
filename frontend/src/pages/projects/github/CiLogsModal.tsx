import { useState, useEffect } from 'react';
import { Loader2, Terminal } from 'lucide-react';
import { apiFetch } from '../../../lib/api.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

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
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-5xl h-[85vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 py-4 border-b border-border shrink-0">
          <DialogTitle className="flex items-center">
            <Terminal className="w-5 h-5 mr-2 text-subtle-foreground" strokeWidth={1.75} />
            Terminal Logs — Run #{runId}
          </DialogTitle>
          <DialogDescription>
            CI/CD job output for this run
          </DialogDescription>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col p-6 bg-code-bg">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 text-info animate-spin" strokeWidth={1.5} />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full text-destructive font-mono text-ui">
              {error}
            </div>
          ) : logsData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-subtle-foreground font-mono text-ui">
              No logs found for this run.
            </div>
          ) : (
            <div className="h-full overflow-y-auto pr-4 space-y-6">
              {logsData.map((job, idx) => (
                <div key={idx} className="flex flex-col">
                  <div className="text-subtle-foreground text-caption font-[590] uppercase tracking-wider mb-2 border-b border-border pb-1">
                    Job: {job.jobName}
                  </div>
                  <pre className="font-mono text-micro text-code-foreground whitespace-pre-wrap leading-relaxed break-words">
                    {job.logs || 'No log output.'}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};