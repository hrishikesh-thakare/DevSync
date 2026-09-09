import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const TARGET_PORTS = [3001, 3002];

function parseArgs(argv) {
  const args = [...argv];
  const yes = args.includes('--yes') || args.includes('-y');
  const passthrough = args.filter((arg) => arg !== '--yes' && arg !== '-y');
  return { yes, passthrough };
}

async function runPowerShell(command) {
  const { stdout } = await execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command],
    { windowsHide: true, maxBuffer: 1024 * 1024 }
  );
  return stdout.trim();
}

async function getListeners() {
  const portsCsv = TARGET_PORTS.join(',');
  const command = `
$ports = @(${portsCsv});
$rows = @();
foreach ($p in $ports) {
  $conns = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue;
  foreach ($c in $conns) {
    $proc = Get-CimInstance Win32_Process -Filter \"ProcessId=$($c.OwningProcess)\" -ErrorAction SilentlyContinue;
    $rows += [PSCustomObject]@{
      port = [int]$p;
      pid = [int]$c.OwningProcess;
      processName = if ($proc) { $proc.Name } else { \"unknown\" };
      commandLine = if ($proc) { $proc.CommandLine } else { \"\" };
    };
  }
}
$rows | Sort-Object port,pid | ConvertTo-Json -Compress
`.trim();

  const stdout = await runPowerShell(command);
  if (!stdout) return [];

  const parsed = JSON.parse(stdout);
  return Array.isArray(parsed) ? parsed : [parsed];
}

async function killPids(pids) {
  if (!pids.length) return;
  const unique = [...new Set(pids)];
  const command = unique
    .map((pid) => `Stop-Process -Id ${pid} -Force -ErrorAction SilentlyContinue`)
    .join('; ');
  await runPowerShell(command);
}

async function promptConfirm(listeners) {
  const rl = createInterface({ input, output });
  try {
    output.write('\nPorts already in use by running processes:\n');
    for (const row of listeners) {
      output.write(`- port ${row.port} | pid ${row.pid} | ${row.processName}\n`);
      if (row.commandLine) {
        output.write(`  ${row.commandLine}\n`);
      }
    }
    const answer = await rl.question('\nKill these processes and continue? [y/N] ');
    return /^y(es)?$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}

async function runPlaywright(args) {
  const quoteForCmd = (value) => {
    if (!value || /[\s"]/u.test(value)) {
      return `"${String(value).replace(/"/g, '\\"')}"`;
    }
    return value;
  };

  const cmd = ['playwright', 'test', ...args].map(quoteForCmd).join(' ');
  await new Promise((resolve, reject) => {
    const child = process.platform === 'win32'
      ? spawn('cmd.exe', ['/d', '/s', '/c', `npx ${cmd}`], { stdio: 'inherit', shell: false })
      : spawn('npx', ['playwright', 'test', ...args], { stdio: 'inherit', shell: false });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`playwright exited with code ${code}`));
      }
    });
  });
}

async function main() {
  const { yes, passthrough } = parseArgs(process.argv.slice(2));

  if (process.platform !== 'win32') {
    console.warn('[e2e:test:clean] Non-Windows platform detected. Skipping port cleanup.');
    await runPlaywright(passthrough);
    return;
  }

  const listeners = await getListeners();
  if (listeners.length) {
    const approved = yes || (await promptConfirm(listeners));
    if (!approved) {
      console.log('[e2e:test:clean] Aborted by user.');
      process.exit(1);
    }

    await killPids(listeners.map((row) => row.pid));
    console.log(`[e2e:test:clean] Stopped ${new Set(listeners.map((row) => row.pid)).size} process(es).`);
  } else {
    console.log('[e2e:test:clean] Ports 3001/3002 are free.');
  }

  await runPlaywright(passthrough);
}

main().catch((err) => {
  console.error('[e2e:test:clean] Failed:', err.message || err);
  process.exit(1);
});
