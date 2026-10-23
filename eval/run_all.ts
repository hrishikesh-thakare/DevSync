import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { runLatencyBenchmark } from './bench_latency.js';
import { runSocketBenchmark } from './bench_socket.js';
import { getEvalSql } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer(): Promise<ChildProcess> {
  console.log('[Runner] Launching dedicated test backend server on port 3099...');
  const serverProc = spawn('npx', ['tsx', 'eval/server.ts'], {
    cwd: path.resolve(__dirname, '..'),
    env: {
      ...process.env,
      PORT: '3099',
      NODE_ENV: 'test',
      DISABLE_RATE_LIMIT: 'true',
    },
    shell: true,
  });

  serverProc.stdout.on('data', (d) => {
    // Only log essential server lines
    const str = d.toString();
    if (str.includes('running on port') || str.includes('Error')) {
      process.stdout.write(`  [Server] ${str}`);
    }
  });

  serverProc.stderr.on('data', (d) => {
    const str = d.toString();
    if (!str.includes('DeprecationWarning')) {
      process.stderr.write(`  [Server Err] ${str}`);
    }
  });

  // Wait for health endpoint
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    try {
      const res = await fetch('http://localhost:3099/api/health');
      if (res.ok) {
        console.log('[Runner] Server is ready and healthy.\n');
        return serverProc;
      }
    } catch {}
  }
  serverProc.kill();
  throw new Error('Server failed to start within 30 seconds');
}

async function stopServer(proc: ChildProcess) {
  console.log('\n[Runner] Gracefully shutting down test server...');
  proc.kill('SIGTERM');
  await new Promise((r) => setTimeout(r, 1500));
}

async function main() {
  const tStart = performance.now();
  console.log('===============================================================');
  console.log(' DevSync Evaluation Task 1: End-to-End Latency Benchmark Suite ');
  console.log('===============================================================\n');

  // Verify database version and row counts
  const sql = getEvalSql(1);
  let pgVersion = '';
  try {
    const [row] = await sql`SELECT version()`;
    pgVersion = row.version;
  } finally {
    await sql.end();
  }

  const serverProc = await startServer();

  let latencyResults: any;
  let socketResults: any;

  try {
    // 1. Run HTTP Latency Benchmark (5 warm-up + 200 measured requests per endpoint per dataset size)
    latencyResults = await runLatencyBenchmark();

    // 2. Run Socket.IO Broadcast Benchmark (100 trials for N=10, 50, 100)
    socketResults = await runSocketBenchmark();
  } finally {
    await stopServer(serverProc);
  }

  // 3. System Specs
  const specs = {
    os: 'Windows 11 Home Single Language (Build 26300, 64-bit)',
    cpu: '13th Gen Intel Core i5-13450HX (10 Cores, 16 Threads, up to 4.60 GHz)',
    ram: '16.0 GB DDR5',
    nodeVersion: process.version,
    postgresVersion: pgVersion.split(' on ')[0] || 'PostgreSQL 17.6',
    databaseHost: 'Supabase Cloud (aws-1-ap-south-1.pooler.supabase.com)',
    topology: 'Client and API server running on same host (localhost:3099); PostgreSQL database hosted remotely on Supabase Cloud.',
  };

  // 4. Generate Paper-Ready Markdown Summary
  const summaryMdPath = path.resolve(__dirname, 'results/task1_summary.md');
  const resultsDir = path.resolve(__dirname, 'results');
  if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });

  const mdContent = `# Task 1: DevSync Latency Evaluation Benchmark

## 1. Experimental Setup
* **Operating System**: ${specs.os}
* **CPU**: ${specs.cpu}
* **RAM**: ${specs.ram}
* **Node.js Runtime**: ${specs.nodeVersion}
* **Database Engine**: ${specs.postgresVersion} (${specs.databaseHost})
* **Execution Topology**: ${specs.topology}
* **Random Seed**: Fixed deterministic PRNG (Seed = 42)
* **Isolated Environment**: Dedicated separate test database (\`devsync_eval\`), preserving all production data.

### Dataset Sizes Under Evaluation
| Dataset Size | Tasks | Status Transitions | Sprints | Git Commits | Pull Requests | CI Workflow Runs | Team Members |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Small** | 200 | 1,000 | 5 | 500 | 50 | 200 | 10 |
| **Medium** | 2,000 | 10,000 | 20 | 3,000 | 300 | 1,500 | 10 |
| **Large** | 20,000 | 100,000 | 50 | 15,000 | 1,500 | 5,000 | 10 |

---

## 2. Methodology
1. **HTTP Endpoint Latency Benchmark**:
   * Evaluated five core analytics and delivery endpoints across all three dataset sizes.
   * Execution Protocol: 5 unmeasured warm-up requests followed by 200 sequentially measured requests per endpoint per dataset size (3,000 measured requests total).
   * High-resolution request-to-response duration was captured using \`performance.now()\` with millisecond precision.
2. **Socket.IO Event Broadcast Latency Benchmark**:
   * Evaluated real-time broadcast fan-out latency across $N \\in \\{10, 50, 100\\}$ concurrent authenticated client connections.
   * In each trial, an authenticated client initiates an event (posting a channel message with an indexed nonce) over HTTP REST.
   * The server broadcasts the event to the target room.
   * Latency is measured from trigger initiation to receipt across all $N$ receiver sockets.
   * Repeated for 100 trials per $N$ ($100 \\times N$ total measurements per concurrency level: 1,000 for $N=10$, 5,000 for $N=50$, 10,000 for $N=100$).

---

## 3. Results

### Table 1: Analytics & Delivery Endpoint Latency (200 requests per cell, in ms)
| Endpoint Under Test | Dataset Size | Min (ms) | Median (ms) | Mean (ms) | p95 (ms) | p99 (ms) | Max (ms) | Std Dev |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
${formatEndpointRows(latencyResults)}

### Table 2: Socket.IO Event Broadcast Latency Across Concurrency Levels (100 trials per $N$, in ms)
| Concurrent Clients ($N$) | Total Samples | Min (ms) | Median (ms) | Mean (ms) | p95 (ms) | p99 (ms) | Max (ms) | Std Dev |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **N = 10** | 1,000 | ${socketResults.N_10.min} | **${socketResults.N_10.median}** | ${socketResults.N_10.mean} | ${socketResults.N_10.p95} | ${socketResults.N_10.p99} | ${socketResults.N_10.max} | ${socketResults.N_10.std} |
| **N = 50** | 5,000 | ${socketResults.N_50.min} | **${socketResults.N_50.median}** | ${socketResults.N_50.mean} | ${socketResults.N_50.p95} | ${socketResults.N_50.p99} | ${socketResults.N_50.max} | ${socketResults.N_50.std} |
| **N = 100** | 10,000 | ${socketResults.N_100.min} | **${socketResults.N_100.median}** | ${socketResults.N_100.mean} | ${socketResults.N_100.p95} | ${socketResults.N_100.p99} | ${socketResults.N_100.max} | ${socketResults.N_100.std} |

---

## 4. Discussion & Caveats
* **Network Latency & Topology**: The test runner client and DevSync Node/Express API server were co-located on the same local benchmark workstation (\`localhost:3099\`), eliminating wide-area client-to-server Internet transit delay. However, the PostgreSQL database was hosted remotely on Supabase Cloud (\`aws-1-ap-south-1.pooler.supabase.com\`), introducing real-world network latency (round-trip transit of ~30–50ms per database query) into every API call.
* **Socket.IO Clock Synchronization**: Because all concurrent WebSocket client connections and trigger callers ran on the same operating system instance, high-resolution timers (\`performance.now()\`) operated on a single shared hardware monotonic clock. This eliminated cross-machine clock drift or NTP skew in receiver latency measurements. In a geographically distributed deployment, client-perceived latency would also include individual last-mile network latencies.
* **Synthetic vs. Production Workloads**: The benchmark dataset was generated synthetically with a deterministic pseudo-random number generator (PRNG seed = 42). While realistic state progressions, dwell times, and commit/PR links were modeled, actual enterprise usage will feature varying concurrency, complex cache effects, and non-uniform query parameters.
`;

  fs.writeFileSync(summaryMdPath, mdContent);
  console.log(`\n===============================================================`);
  console.log(`✓ Benchmark Complete! Summary written to:`);
  console.log(`  ${summaryMdPath}`);
  console.log(`===============================================================\n`);

  const elapsedTotal = ((performance.now() - tStart) / 1000).toFixed(1);
  console.log(`Total benchmark execution time: ${elapsedTotal}s`);
}

function formatEndpointRows(results: any): string {
  const epNames: Record<string, string> = {
    analytics_delivery: 'Analytics Delivery (Cycle Time, Throughput, Velocity, CI)',
    dashboard_workload: 'Dashboard Workload & Activity',
    github_commits: 'GitHub Commits (Contributor History)',
    github_pull_requests: 'GitHub Pull Requests',
    github_ci_runs: 'GitHub CI Status',
  };

  const rows: string[] = [];
  for (const [epId, epName] of Object.entries(epNames)) {
    for (const size of ['small', 'medium', 'large']) {
      const s = results[size]?.[epId];
      if (s) {
        rows.push(`| **${epName}** | ${size.toUpperCase()} | ${s.min} | **${s.median}** | ${s.mean} | ${s.p95} | ${s.p99} | ${s.max} | ${s.std} |`);
      }
    }
  }
  return rows.join('\n');
}

if (process.argv[1] && process.argv[1].endsWith('run_all.ts')) {
  main().catch((err) => {
    console.error('Fatal execution error:', err);
    process.exit(1);
  });
}
