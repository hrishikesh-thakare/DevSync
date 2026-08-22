import { Project, SyntaxKind } from 'ts-morph';
import path from 'path';
import fs from 'fs';

const project = new Project({
  tsConfigFilePath: path.join(process.cwd(), 'tsconfig.app.json'),
});

const sourceFiles = project.getSourceFiles();

const rules = [
  {
    desc: 'Banned Tailwind Color',
    test: (cls) => /^(bg|text|border|ring)-(white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[1-9]00$/.test(cls),
  },
  {
    desc: 'Raw CSS Variable Class',
    test: (cls) => /^(bg|text|border)-\[var\(--.*\)$/.test(cls) || cls.includes('var(--bg-') || cls.includes('var(--text-') || cls.includes('var(--border-'),
  },
  {
    desc: 'Banned Typography Size',
    test: (cls) => /^(text-lg|text-xl|text-2xl|text-3xl|text-4xl|text-5xl|text-6xl|text-7xl|text-8xl|text-9xl)$/.test(cls) || /^text-\[\d+(\.\d+)?(px|rem|em)\]$/.test(cls),
  },
  {
    desc: 'Banned Font Weight',
    test: (cls) => /^(font-bold|font-extrabold|font-black|font-\[600\]|font-\[700\]|font-\[800\]|font-\[900\])$/.test(cls),
  },
  {
    desc: 'Raw Z-Index',
    test: (cls) => /^z-(0|10|20|30|40|50|60|70|80|90|100|\[\d+\])$/.test(cls),
  },
  {
    desc: 'Banned Radius',
    test: (cls) => /^(rounded-xl|rounded-2xl|rounded-3xl|rounded-\[1[0-9]px\]|rounded-\[[2-9][0-9]px\])$/.test(cls),
  },
  {
    desc: 'Banned Duration',
    test: (cls) => /^duration-(400|500|700|1000|\[[4-9]\d{2}ms\]|\[\d{4,}ms\])$/.test(cls),
  },
  {
    desc: 'Banned Motion',
    test: (cls) => cls === 'transition-all' || /^hover:scale-\d+$/.test(cls) || /^hover:-?translate-[xy]-\d+$/.test(cls),
  }
];

let totalViolations = 0;
let report = '# AST-Based Codebase Audit\n\n';

for (const sf of sourceFiles) {
  if (sf.getFilePath().includes('theme/colors.ts') || sf.getFilePath().includes('App.tsx')) continue;

  const violations = [];

  // Find all string literals and template expressions that might be classes
  const stringLiterals = sf.getDescendantsOfKind(SyntaxKind.StringLiteral);
  const noSubstitutionTemplateLiterals = sf.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral);
  const templateHeads = sf.getDescendantsOfKind(SyntaxKind.TemplateHead);
  const templateMiddles = sf.getDescendantsOfKind(SyntaxKind.TemplateMiddle);
  const templateTails = sf.getDescendantsOfKind(SyntaxKind.TemplateTail);

  const allStrings = [
    ...stringLiterals,
    ...noSubstitutionTemplateLiterals,
    ...templateHeads,
    ...templateMiddles,
    ...templateTails
  ];

  for (const strNode of allStrings) {
    const text = strNode.getLiteralText ? strNode.getLiteralText() : strNode.getText().replace(/^`|`$/g, '').replace(/\$\{$/g, '').replace(/^\}/g, '');
    const classes = text.split(/\s+/).filter(Boolean);

    for (const cls of classes) {
      for (const rule of rules) {
        if (rule.test(cls)) {
          violations.push({
            rule: rule.desc,
            line: strNode.getStartLineNumber(),
            cls: cls,
          });
        }
      }
    }
  }

  if (violations.length > 0) {
    report += `### ${sf.getBaseName()}\n`;
    for (const v of violations) {
      report += `- **Line ${v.line}** [${v.rule}]: \`${v.cls}\`\n`;
      totalViolations++;
    }
    report += '\n';
  }
}

report += `---\n**Total AST Violations: ${totalViolations}**\n`;
fs.writeFileSync('audit-ast.md', report);
console.log(`AST Audit complete. Found ${totalViolations} violations.`);
