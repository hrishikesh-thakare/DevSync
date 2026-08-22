import DOMPurify from 'dompurify';

export function renderMessageContent(html: string): string {
  let processed = html.replace(/\[(.*?)\]\(file:([a-zA-Z0-9-]+)\)/g, (_, name, id) => {
    // Strip HTML tags and escape double quotes to prevent breaking attributes
    const cleanName = name.replace(/<[^>]*>/g, '').replace(/"/g, '&quot;').replace(/📎\s*/g, '').trim();
    return `<a href="#" data-file-id="${id}" data-file-name="${cleanName}" class="inline-flex items-center gap-1.5 px-2 py-0.5 mx-0.5 bg-secondary rounded border border-border text-primary hover:bg-hover transition-colors no-underline text-xs font-medium">📎 ${cleanName}</a>`;
  });

  // Replace @TASK-123 with clickable spans
  processed = processed.replace(/(?<!["'])@([A-Za-z]+-\d+)/gi, (fullMatch, taskKey) => {
    return `<span data-task-key="${taskKey.toUpperCase()}" class="text-primary bg-primary-muted px-1 rounded font-medium cursor-pointer hover:underline" title="Go to task ${taskKey.toUpperCase()}">${fullMatch}</span>`;
  });

  // Replace @username and @everyone/@channel/@all mentions with blue mention pills
  processed = processed.replace(/(?<!["'\w])@([a-zA-Z0-9_-]+)/g, (fullMatch, name) => {
    if (/^[A-Za-z]+-\d+$/i.test(name)) return fullMatch; // Skip task mentions handled above
    return `<span class="bg-primary-muted text-primary border border-primary-border px-1.5 py-0.5 rounded font-medium">${fullMatch}</span>`;
  });

  // Sanitize the processed HTML with DOMPurify
  return DOMPurify.sanitize(processed, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'span', 'div', 'code', 'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 's', 'u'],
    ALLOWED_ATTR: ['href', 'target', 'class', 'data-file-id', 'data-file-name', 'data-task-key', 'title', 'data-id', 'data-type'],
  });
}
