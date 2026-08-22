import fs from 'fs';
import path from 'path';

const SRC_DIR = path.join(process.cwd(), 'src');

function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllFiles(filePath, fileList);
    } else if (filePath.match(/\.(tsx|ts|css)$/)) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const files = getAllFiles(SRC_DIR);

const replacements = [
  { regex: /bg-\[var\(--bg-canvas\)\]/g, replacement: 'bg-background' },
  { regex: /bg-\[var\(--bg-surface\)\]/g, replacement: 'bg-card' },
  { regex: /bg-\[var\(--bg-surface-hover\)\]/g, replacement: 'bg-hover' },
  { regex: /bg-\[var\(--bg-surface-raised\)\]/g, replacement: 'bg-popover' }, // or bg-elevated, wait index.css has --color-elevated
  { regex: /bg-\[var\(--bg-inset\)\]/g, replacement: 'bg-muted' },
  
  { regex: /text-\[var\(--text-primary\)\]/g, replacement: 'text-foreground' },
  { regex: /text-\[var\(--text-secondary\)\]/g, replacement: 'text-muted-foreground' },
  { regex: /text-\[var\(--text-muted\)\]/g, replacement: 'text-subtle-foreground' },
  { regex: /text-\[var\(--text-inverse\)\]/g, replacement: 'text-inverse' },
  { regex: /text-\[var\(--text-disabled\)\]/g, replacement: 'text-disabled' }, // if we have it
  
  { regex: /border-\[var\(--border-subtle\)\]/g, replacement: 'border-border' },
  { regex: /border-\[var\(--border-default\)\]/g, replacement: 'border-input' },
  { regex: /border-\[var\(--border-strong\)\]/g, replacement: 'border-strong' }, // maybe we should add --color-border-strong to index.css
  
  { regex: /font-semibold/g, replacement: 'font-[590]' },
  { regex: /font-bold/g, replacement: 'font-[590]' },
  { regex: /font-medium/g, replacement: 'font-[510]' },
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf-8');
  let originalContent = content;

  for (const { regex, replacement } of replacements) {
    content = content.replace(regex, replacement);
  }
  
  // Custom fix for typography utilities
  content = content.replace(/text-(10|11|12|13|14|15|16|17|18)px/g, (match, p1) => {
      if (p1 === '10') return 'text-micro';
      if (p1 === '11') return 'text-micro';
      if (p1 === '12') return 'text-caption';
      if (p1 === '13') return 'text-ui';
      if (p1 === '14') return 'text-body';
      if (p1 === '15') return 'text-body';
      return 'text-heading';
  });

  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf-8');
  }
}

console.log(`Aliases and fonts fixed.`);
