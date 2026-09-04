import { Request, Response } from 'express';
import { assertPublicHttpUrl, BlockedUrlError } from '../../lib/ssrf.js';

export const unfurlUrl = async (req: Request, res: Response): Promise<void> => {
  try {
    const { url } = req.query;
    if (!url || typeof url !== 'string') {
      res.status(400).json({ error: 'URL parameter is required' });
      return;
    }

    // This is the one place the server fetches a URL chosen by a user, so the
    // host has to be proven publicly routable before we connect to it.
    let targetUrl: URL;
    try {
      targetUrl = await assertPublicHttpUrl(url);
    } catch (err) {
      if (err instanceof BlockedUrlError) {
        res.status(400).json({ error: err.message });
        return;
      }
      throw err;
    }

    // Fetch the URL with a timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

    // `Response` here is Express's, not fetch's — hence the inferred type.
    let response: Awaited<ReturnType<typeof fetch>>;
    try {
      response = await fetch(targetUrl, {
        signal: controller.signal,
        // `manual` rather than the default `follow`: an allowed public host can
        // still answer `302 http://169.254.169.254/`, and fetch would follow it
        // without re-running the check above. One hop, no exceptions.
        redirect: 'manual',
        headers: {
          'User-Agent': 'DevSyncBot/1.0 (+https://devsync.com)',
          'Accept': 'text/html',
        },
      });
    } finally {
      clearTimeout(timeoutId);
    }

    // Upstream's status is deliberately not echoed. Reflecting it turned this
    // endpoint into a port and host scanner: the caller could tell a refused
    // connection from a 401 from a 404 on any address the server can reach.
    if (response.status >= 300 && response.status < 400) {
      res.status(400).json({ error: 'URL redirects, which is not supported' });
      return;
    }

    if (!response.ok) {
      res.status(400).json({ error: 'Failed to fetch URL' });
      return;
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('text/html')) {
      res.status(400).json({ error: 'URL does not return HTML' });
      return;
    }

    // Only the <head> matters for og: tags, so there is no reason to buffer a
    // response of unbounded size into memory.
    const MAX_HTML_BYTES = 512 * 1024;
    const raw = await response.arrayBuffer();
    const html = Buffer.from(raw.slice(0, MAX_HTML_BYTES)).toString('utf8');

    // Very simple regex-based metadata extractor
    const extractMeta = (regex: RegExp) => {
      const match = html.match(regex);
      return match && match[1] ? match[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&') : null;
    };

    let title = extractMeta(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"[^>]*>/i)
             || extractMeta(/<meta[^>]*content="([^"]*)"[^>]*property="og:title"[^>]*>/i)
             || extractMeta(/<title>([^<]*)<\/title>/i);
             
    let description = extractMeta(/<meta[^>]*property="og:description"[^>]*content="([^"]*)"[^>]*>/i)
                   || extractMeta(/<meta[^>]*content="([^"]*)"[^>]*property="og:description"[^>]*>/i)
                   || extractMeta(/<meta[^>]*name="description"[^>]*content="([^"]*)"[^>]*>/i);
                   
    let image = extractMeta(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"[^>]*>/i)
             || extractMeta(/<meta[^>]*content="([^"]*)"[^>]*property="og:image"[^>]*>/i);

    // Make image URLs absolute if they are relative
    if (image && !image.startsWith('http')) {
      try {
        image = new URL(image, targetUrl.origin).toString();
      } catch (e) {
        image = null;
      }
    }

    res.json({
      url,
      domain: targetUrl.hostname,
      title: title || targetUrl.hostname,
      description,
      image,
    });
  } catch (err: any) {
    if (err.name === 'AbortError') {
      res.status(408).json({ error: 'Request timeout fetching URL' });
    } else {
      console.error('Error in unfurlUrl:', err);
      res.status(500).json({ error: 'Failed to unfurl URL' });
    }
  }
};
