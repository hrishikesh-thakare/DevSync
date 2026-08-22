import fs from 'fs';
import path from 'path';

const SRC_DIR = path.join(process.cwd(), 'src');

// We want to skip src/components/ui because it's already clean and hand-built
function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      if (!filePath.endsWith(path.join('src', 'components', 'ui'))) {
        getAllFiles(filePath, fileList);
      }
    } else if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const files = getAllFiles(SRC_DIR);
let changedFiles = 0;
let totalReplaces = 0;

const replacements = [
  // Typography sizes (cap at 16px)
  { regex: /\btext-(lg|xl|2xl|3xl|4xl|5xl|6xl|7xl)\b/g, replacement: 'text-[16px]' },
  { regex: /\btext-sm\b/g, replacement: 'text-[13px]' },
  { regex: /\btext-xs\b/g, replacement: 'text-[12px]' },
  { regex: /\btext-base\b/g, replacement: 'text-[14px]' },
  
  // Font weights
  { regex: /\bfont-(semibold|bold|extrabold|black)\b/g, replacement: 'font-[590]' },
  { regex: /\bfont-medium\b/g, replacement: 'font-[510]' },
  
  // Semantic shadcn class replacements to tokens
  { regex: /\bbg-background\b/g, replacement: 'bg-[var(--bg-canvas)]' },
  { regex: /\bbg-card\b/g, replacement: 'bg-[var(--bg-surface)]' },
  { regex: /\bbg-popover\b/g, replacement: 'bg-[var(--bg-surface)]' },
  { regex: /\bbg-muted\b/g, replacement: 'bg-[var(--bg-inset)]' },
  { regex: /\bbg-secondary\b/g, replacement: 'bg-[var(--bg-surface-hover)]' },
  
  { regex: /\btext-foreground\b/g, replacement: 'text-[var(--text-primary)]' },
  { regex: /\btext-card-foreground\b/g, replacement: 'text-[var(--text-primary)]' },
  { regex: /\btext-popover-foreground\b/g, replacement: 'text-[var(--text-primary)]' },
  { regex: /\btext-muted-foreground\b/g, replacement: 'text-[var(--text-secondary)]' },
  { regex: /\btext-secondary-foreground\b/g, replacement: 'text-[var(--text-primary)]' },
  
  { regex: /\bborder-border\b/g, replacement: 'border-[var(--border-default)]' },
  { regex: /\bborder-input\b/g, replacement: 'border-[var(--border-default)]' },
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf-8');
  let originalContent = content;

  for (const { regex, replacement } of replacements) {
    content = content.replace(regex, replacement);
  }

  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf-8');
    changedFiles++;
    
    // Count replacements for reporting
    let diffs = 0;
    let match;
    for (const { regex } of replacements) {
       // Reset regex state just to count
       const r = new RegExp(regex);
       const matches = originalContent.match(r);
       if (matches) diffs += matches.length;
    }
    totalReplaces += diffs;
  }
}

console.log(`Deep clean complete! Modified ${changedFiles} files with roughly ${totalReplaces} class replacements.`);
