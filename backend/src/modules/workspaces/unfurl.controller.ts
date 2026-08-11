import { Request, Response } from 'express';

export const unfurlUrl = async (req: Request, res: Response): Promise<void> => {
  try {
    const { url } = req.query;
    if (!url || typeof url !== 'string') {
      res.status(400).json({ error: 'URL parameter is required' });
      return;
    }

    // Basic validation
    let targetUrl: URL;
    try {
      targetUrl = new URL(url);
    } catch {
      res.status(400).json({ error: 'Invalid URL format' });
      return;
    }

    if (!['http:', 'https:'].includes(targetUrl.protocol)) {
      res.status(400).json({ error: 'Only http and https protocols are supported' });
      return;
    }

    // Fetch the URL with a timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'DevSyncBot/1.0 (+https://devsync.com)',
        'Accept': 'text/html',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      res.status(response.status).json({ error: 'Failed to fetch URL' });
      return;
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('text/html')) {
      res.status(400).json({ error: 'URL does not return HTML' });
      return;
    }

    const html = await response.text();

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
