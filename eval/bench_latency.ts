import { getEvalSql } from './db.js';
import { mintEvalToken } from './auth.js';
import { DATASET_CONFIGS } from './seed.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SERVER_BASE_URL = process.env.SERVER_BASE_URL || 'http://localhost:3099';
const WARMUP_COUNT = 5;
const MEASURED_COUNT = 200;

interface EndpointSpec {
  id: string;
  name: string;
  getPath: (slug: string, key: string) => string;
}

const ENDPOINTS: EndpointSpec[] = [
  {
    id: 'analytics_delivery',
    name: 'Analytics (Cycle Time, Throughput, Velocity, CI)',
    getPath: (slug, key) => `/api/workspaces/${slug}/analytics?projectKey=${key}`,
  },
  {
    id: 'dashboard_workload',
    name: 'Dashboard (Contributor Activity & Workload)',
    getPath: (slug) => `/api/workspaces/${slug}/dashboard`,
  },
  {
    id: 'github_commits',
    name: 'GitHub Commits (Contributor Activity)',
    getPath: (slug, key) => `/api/workspaces/${slug}/projects/${key}/github/commits`,
  },
  {
    id: 'github_pull_requests',
    name: 'GitHub Pull Requests (PR Trends)',
    getPath: (slug, key) => `/api/workspaces/${slug}/projects/${key}/github/pull-requests`,
  },
  {
    id: 'github_ci_runs',
    name: 'GitHub CI Status (CI Trends)',
    getPath: (slug, key) => `/api/workspaces/${slug}/projects/${key}/github/ci`,
  },
];

export interface BenchmarkStats {
  min: number;
  max: number;
  mean: number;
  median: number;
  p95: number;
  p99: number;
  std: number;
}

export function computeStats(samples: number[]): BenchmarkStats {
  if (samples.length === 0) {
    return { min: 0, max: 0, mean: 0, median: 0, p95: 0, p99: 0, std: 0 };
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const n = sorted.length;
  const min = sorted[0];
  const max = sorted[n - 1];
  const sum = sorted.reduce((a, b) => a + b, 0);
  const mean = sum / n;
  const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];
  const p95 = sorted[Math.floor(n * 0.95)];
  const p99 = sorted[Math.floor(n * 0.99)];
  const variance = sorted.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / n;
  const std = Math.sqrt(variance);

  const round2 = (num: number) => Number(num.toFixed(2));
  return {
    min: round2(min),
    max: round2(max),
    mean: round2(mean),
    median: round2(median),
    p95: round2(p95),
    p99: round2(p99),
    std: round2(std),
  };
}

export async function runLatencyBenchmark() {
  console.log('=== Starting DevSync Latency Benchmark ===');
  console.log(`Server URL: ${SERVER_BASE_URL}`);
  console.log(`Warmup Requests: ${WARMUP_COUNT}, Measured Requests: ${MEASURED_COUNT} per endpoint per dataset size\n`);

  // Verify server is alive
  const healthRes = await fetch(`${SERVER_BASE_URL}/api/health`);
  if (!healthRes.ok) {
    throw new Error(`Server at ${SERVER_BASE_URL} is not healthy: ${healthRes.statusText}`);
  }

  // Get test user and token
  const sql = getEvalSql(2);
  let token: string;
  try {
    const [user] = await sql`SELECT user_id, email FROM users WHERE email = 'eval_user_1@devsync.eval' LIMIT 1`;
    if (!user) throw new Error('Test user eval_user_1@devsync.eval not found. Run seed first.');
    token = mintEvalToken({ userId: user.user_id, email: user.email });
  } finally {
    await sql.end();
  }

  const results: Record<string, Record<string, { stats: BenchmarkStats; raw: number[] }>> = {};
  const csvRows: string[] = ['dataset_size,endpoint_id,endpoint_name,request_num,latency_ms'];

  const sizes: Array<'small' | 'medium' | 'large'> = ['small', 'medium', 'large'];

  for (const size of sizes) {
    const cfg = DATASET_CONFIGS[size];
    results[size] = {};
    console.log(`\n========================================`);
    console.log(`Testing Dataset Size: [${size.toUpperCase()}]`);
    console.log(`Workspace: ${cfg.slug}, Project: ${cfg.projectKey}`);
    console.log(`Tasks: ${cfg.taskCount}, Transitions: ${cfg.transitionCount}`);
    console.log(`========================================`);

    for (const ep of ENDPOINTS) {
      const urlPath = ep.getPath(cfg.slug, cfg.projectKey);
      const fullUrl = `${SERVER_BASE_URL}${urlPath}`;
      console.log(`\nBenchmarking: ${ep.name}`);
      console.log(`URL: ${urlPath}`);

      // Warm-up phase
      process.stdout.write(`  Warming up (${WARMUP_COUNT} requests)... `);
      for (let w = 0; w < WARMUP_COUNT; w++) {
        let ok = false;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const res = await fetch(fullUrl, { headers: { Authorization: `Bearer ${token}` } });
            if (res.ok) {
              await res.text();
              ok = true;
              break;
            }
          } catch {}
          await new Promise((r) => setTimeout(r, 100));
        }
        if (!ok) throw new Error(`Warmup persistently failed on ${fullUrl}`);
        await new Promise((r) => setTimeout(r, 5));
      }
      console.log('done.');

      // Measurement phase
      process.stdout.write(`  Measuring (${MEASURED_COUNT} requests)... `);
      const samples: number[] = [];
      for (let m = 0; m < MEASURED_COUNT; m++) {
        let duration = 0;
        let success = false;
        for (let attempt = 0; attempt < 3; attempt++) {
          const start = performance.now();
          try {
            const res = await fetch(fullUrl, { headers: { Authorization: `Bearer ${token}` } });
            duration = performance.now() - start;
            if (res.ok) {
              await res.text();
              success = true;
              break;
            }
          } catch {}
          await new Promise((r) => setTimeout(r, 100));
        }

        if (!success) {
          throw new Error(`Measurement persistently failed on ${fullUrl}`);
        }

        samples.push(Number(duration.toFixed(3)));
        csvRows.push(`${size},${ep.id},"${ep.name}",${m + 1},${duration.toFixed(3)}`);
        await new Promise((r) => setTimeout(r, 5));
      }
      console.log('done.');

      const stats = computeStats(samples);
      results[size][ep.id] = { stats, raw: samples };
      console.log(`  Results: Median=${stats.median}ms, p95=${stats.p95}ms, p99=${stats.p99}ms (Min=${stats.min}ms, Max=${stats.max}ms)`);
    }
  }

  // Ensure results dir exists
  const resultsDir = path.resolve(__dirname, 'results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  // Save raw data to JSON and CSV
  const jsonRawPath = path.join(resultsDir, 'latency_raw.json');
  fs.writeFileSync(jsonRawPath, JSON.stringify(results, null, 2));
  console.log(`\n✓ Saved raw JSON timings to: ${jsonRawPath}`);

  const csvPath = path.join(resultsDir, 'latency_raw.csv');
  fs.writeFileSync(csvPath, csvRows.join('\n'));
  console.log(`✓ Saved raw CSV timings to: ${csvPath}`);

  // Save summary JSON
  const summary: Record<string, Record<string, BenchmarkStats>> = {};
  for (const size of sizes) {
    summary[size] = {};
    for (const ep of ENDPOINTS) {
      summary[size][ep.id] = results[size][ep.id].stats;
    }
  }
  const jsonSummaryPath = path.join(resultsDir, 'latency_summary.json');
  fs.writeFileSync(jsonSummaryPath, JSON.stringify(summary, null, 2));
  console.log(`✓ Saved summary JSON to: ${jsonSummaryPath}`);

  return summary;
}

if (process.argv[1] && process.argv[1].endsWith('bench_latency.ts')) {
  runLatencyBenchmark().catch(err => {
    console.error('Fatal benchmark error:', err);
    process.exit(1);
  });
}
