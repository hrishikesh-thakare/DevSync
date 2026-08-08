export function renderMessageContent(html: string): string {
  let processed = html.replace(/\[(.*?)\]\(file:([a-zA-Z0-9-]+)\)/g, (_, name, id) => {
    // Strip HTML tags and escape double quotes to prevent breaking attributes
    const cleanName = name.replace(/<[^>]*>/g, '').replace(/"/g, '&quot;').replace(/📎\s*/g, '').trim();
    return `<a href="#" data-file-id="${id}" data-file-name="${cleanName}" class="inline-flex items-center gap-1.5 px-2 py-0.5 mx-0.5 bg-gray-800 rounded border border-gray-700 text-blue-400 hover:bg-gray-700 transition-colors no-underline text-xs font-medium">📎 ${cleanName}</a>`;
  });

  // Replace @TASK-123 with clickable spans
  processed = processed.replace(/(?<!["'])@([A-Za-z]+-\d+)/gi, (fullMatch, taskKey) => {
    return `<span data-task-key="${taskKey.toUpperCase()}" class="text-blue-400 bg-blue-500/10 px-1 rounded font-medium cursor-pointer hover:underline" title="Go to task ${taskKey.toUpperCase()}">${fullMatch}</span>`;
  });

  return processed;
}
