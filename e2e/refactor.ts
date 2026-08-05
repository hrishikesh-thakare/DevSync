import fs from 'fs';
import path from 'path';

const testsDir = path.join(import.meta.dirname, 'tests');

function processDirectory(dir: string) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.spec.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let modified = false;

      // 1. Replace apiLogin with getAuthToken
      const regex = /const\s+\{\s*accessToken\s*\}\s*=\s*await\s+apiLogin\(TEST_USERS\.([a-zA-Z0-9_]+)\.email\);/g;
      if (regex.test(content)) {
        content = content.replace(regex, "const accessToken = getAuthToken('$1');");
        modified = true;
      }

      // 2. Also replace ownerLogin
      const ownerRegex = /const\s+ownerLogin\s*=\s*await\s+apiLogin\(TEST_USERS\.owner\.email\);/g;
      if (ownerRegex.test(content)) {
        content = content.replace(ownerRegex, "const ownerLogin = { accessToken: getAuthToken('owner') };");
        modified = true;
      }

      // 3. Update imports to include getAuthToken
      if (modified && !content.includes('getAuthToken')) {
        content = content.replace(
          /import\s+\{\s*(.*?)apiLogin(.*?)\}\s+from\s+['"]\.\.\/\.\.\/helpers\/api-helpers\.js['"];/,
          (match, p1, p2) => {
            const inner = `${p1}apiLogin${p2}`.replace(/,\s*$/, '');
            return `import { ${inner}, getAuthToken } from '../../helpers/api-helpers.js';`;
          }
        );
      }

      if (modified) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Updated ${fullPath}`);
      }
    }
  }
}

processDirectory(testsDir);
