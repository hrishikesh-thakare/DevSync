import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api.js';

interface LinkUnfurlProps {
  url: string;
  workspaceSlug: string;
}

interface UnfurlData {
  url: string;
  domain: string;
  title: string;
  description: string | null;
  image: string | null;
}

export const LinkUnfurl: React.FC<LinkUnfurlProps> = ({ url, workspaceSlug }) => {
  const [data, setData] = useState<UnfurlData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;
    
    const fetchMetadata = async () => {
      try {
        const response = await apiFetch(`/workspaces/${workspaceSlug}/unfurl?url=${encodeURIComponent(url)}`);
        if (mounted) {
          setData(response);
          setLoading(false);
        }
      } catch (err) {
        console.error('Link unfurl failed:', err);
        if (mounted) {
          setError(true);
          setLoading(false);
        }
      }
    };

    fetchMetadata();
    
    return () => {
      mounted = false;
    };
  }, [url, workspaceSlug]);

  if (loading || error || !data) return null;

  // Render nothing if it's just a generic page with no title or image that is useful
  if (!data.title && !data.image && !data.domain) return null;

  return (
    <a 
      href={url} 
      target="_blank" 
      rel="noopener noreferrer"
      className="mt-2 flex flex-col md:flex-row border border-border rounded-lg overflow-hidden max-w-2xl bg-card hover:bg-hover transition-colors group no-underline text-left"
    >
      {data.image && (
        <div className="md:w-1/3 bg-muted shrink-0">
          <img 
            src={data.image} 
            alt={data.title || 'Preview'} 
            className="w-full h-full object-cover max-h-48 md:max-h-full"
            loading="lazy"
          />
        </div>
      )}
      <div className="p-4 flex flex-col justify-center flex-1 min-w-0">
        {data.domain && (
          <div className="text-xs font-semibold text-subtle-foreground uppercase tracking-wider mb-1 truncate">
            {data.domain}
          </div>
        )}
        <div className="text-sm font-bold text-foreground mb-1.5 group-hover:text-primary transition-colors line-clamp-2">
          {data.title || url}
        </div>
        {data.description && (
          <div className="text-xs text-muted-foreground line-clamp-3">
            {data.description}
          </div>
        )}
      </div>
    </a>
  );
};
