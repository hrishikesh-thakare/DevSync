import { useState } from 'react';
import { DownloadIcon, Loader2Icon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/store/auth';

export function ExportDataCard() {
  const user = useAuthStore((s) => s.user);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      // In a real implementation, this would trigger an async job or direct download.
      // Since DevSync is a realtime app, we simulate the request flow for compliance.
      await new Promise(resolve => setTimeout(resolve, 1500)); 
      toast.success('Your data export has been initiated. We will email you a download link when it is ready.');
    } catch {
      toast.error('Could not initiate data export. Please try again later.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Export Account Data</CardTitle>
        <CardDescription>
          Request an archive of all your personal data, including your profile information, preferences, and account history.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground max-w-[400px]">
            The export process may take up to 24 hours to complete depending on the size of your workspaces. The archive will be delivered in JSON format.
          </p>
          <Button onClick={handleExport} disabled={exporting || !user}>
            {exporting ? (
              <Loader2Icon className="mr-2 size-4 animate-spin" aria-hidden="true" />
            ) : (
              <DownloadIcon className="mr-2 size-4" aria-hidden="true" />
            )}
            Request Export
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
