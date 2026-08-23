import { useEffect, useState } from 'react';

import { apiFetch } from '@/lib/api';

interface Unfurled {
  url: string;
  domain: string;
  title: string;
  description: string | null;
  image: string | null;
}

/**
 * Per-session cache keyed by URL, shared across every message that links the
 * same page. A `null` entry records a URL that could not be unfurled, so a dead
 * link is asked about once rather than on every mount.
 */
const cache = new Map<string, Unfurled | null>();

/**
 * Renders `GET /workspaces/:slug/unfurl?url=…` as a compact card under a message.
 *
 * The endpoint answers 400 for non-HTML targets, 408 on its 5-second timeout,
 * and the upstream status when the fetch fails — all of which just mean "no
 * preview", so every failure renders nothing rather than an error.
 */
export function LinkPreview({ slug, url }: { slug: string; url: string }) {
  // Holds its own url so a changed prop never shows the previous link's card
  // for a frame. The cache is consulted during render, which keeps the effect
  // free of any synchronous setState.
  const [fetched, setFetched] = useState<{ url: string; data: Unfurled | null } | null>(null);

  const cached = cache.get(url);
  const data = cached !== undefined ? cached : fetched?.url === url ? fetched.data : null;

  useEffect(() => {
    if (cache.has(url)) return;

    let cancelled = false;
    void (async () => {
      let result: Unfurled | null;
      try {
        result = await apiFetch(`/workspaces/${slug}/unfurl?url=${encodeURIComponent(url)}`);
      } catch {
        result = null;
      }
      cache.set(url, result);
      if (!cancelled) setFetched({ url, data: result });
    })();

    return () => {
      cancelled = true;
    };
  }, [slug, url]);

  if (!data) return null;

  return (
    <a
      href={data.url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1.5 flex max-w-md gap-3 rounded-xl border p-2.5 transition-colors hover:bg-accent/40"
    >
      {data.image ? (
        <img
          src={data.image}
          alt=""
          loading="lazy"
          className="size-14 shrink-0 rounded-lg object-cover"
          // A broken og:image should leave the text card intact, not a torn icon.
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-muted-foreground">{data.domain}</p>
        <p className="truncate text-sm font-medium text-foreground">{data.title}</p>
        {data.description ? (
          <p className="line-clamp-2 text-xs text-muted-foreground">{data.description}</p>
        ) : null}
      </div>
    </a>
  );
}
