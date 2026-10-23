import { io, Socket } from 'socket.io-client';
import { getEvalSql } from './db.js';
import { mintEvalToken } from './auth.js';
import { computeStats, BenchmarkStats } from './bench_latency.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SERVER_BASE_URL = process.env.SERVER_BASE_URL || 'http://localhost:3099';
const TRIALS_PER_N = 100;
const CONCURRENT_CLIENT_LEVELS = [10, 50, 100];

export async function runSocketBenchmark() {
  console.log('=== Starting DevSync Socket.IO Broadcast Latency Benchmark ===');
  console.log(`Server URL: ${SERVER_BASE_URL}`);
  console.log(`Concurrent Client Levels N: ${CONCURRENT_CLIENT_LEVELS.join(', ')}`);
  console.log(`Trials per level: ${TRIALS_PER_N}\n`);

  // Verify server
  const healthRes = await fetch(`${SERVER_BASE_URL}/api/health`);
  if (!healthRes.ok) throw new Error('Server not running');

  // Query test channel and users from devsync_eval
  const sql = getEvalSql(2);
  let channelId: string;
  let workspaceSlug: string;
  let usersList: { userId: string; email: string }[];
  try {
    const [ch] = await sql`
      SELECT c.channel_id, w.slug
      FROM channels c
      JOIN workspaces w ON c.workspace_id = w.workspace_id
      WHERE w.slug = 'eval-ws-small' AND c.name = 'general'
      LIMIT 1
    `;
    if (!ch) throw new Error('Test channel not found in eval-ws-small');
    channelId = ch.channel_id;
    workspaceSlug = ch.slug;

    const uRows = await sql`
      SELECT user_id, email FROM users
      WHERE email LIKE 'eval_user_%@devsync.eval'
      ORDER BY email ASC
    `;
    if (uRows.length === 0) throw new Error('Eval users not found');
    usersList = uRows.map(u => ({ userId: u.user_id, email: u.email }));
  } finally {
    await sql.end();
  }

  // Pre-mint tokens for users
  const tokens = usersList.map(u => mintEvalToken(u));
  const senderToken = tokens[0]; // eval_user_1 is workspace admin

  const socketResults: Record<number, { stats: BenchmarkStats; raw: number[] }> = {};
  const csvRows: string[] = ['concurrent_clients_N,trial_num,receiver_index,latency_ms'];

  for (const N of CONCURRENT_CLIENT_LEVELS) {
    console.log(`\n========================================`);
    console.log(`Benchmarking Socket.IO with N = ${N} concurrent clients`);
    console.log(`========================================`);

    // 1. Establish N concurrent connections
    process.stdout.write(`Connecting ${N} sockets... `);
    const sockets: Socket[] = [];
    const connectPromises: Promise<void>[] = [];

    for (let i = 0; i < N; i++) {
      const userToken = tokens[i % tokens.length];
      const s = io(SERVER_BASE_URL, {
        auth: { token: userToken },
        transports: ['websocket'],
        reconnection: false,
      });

      sockets.push(s);
      connectPromises.push(
        new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error(`Socket ${i} connection timed out`)), 10000);
          s.on('connect', () => {
            clearTimeout(timer);
            resolve();
          });
          s.on('connect_error', (err) => {
            clearTimeout(timer);
            reject(err);
          });
        })
      );
    }

    await Promise.all(connectPromises);
    console.log('all connected.');

    // 2. Join channel room for all N sockets
    process.stdout.write(`Joining room channel:${channelId} for all ${N} sockets... `);
    for (const s of sockets) {
      s.emit('join_room', `channel:${channelId}`);
    }
    // Give room joins 300ms to register in Socket.io
    await new Promise(r => setTimeout(r, 300));
    console.log('joined.');

    // 3. Run TRIALS_PER_N trials
    console.log(`Running ${TRIALS_PER_N} broadcast latency trials...`);
    const allLatenciesForN: number[] = [];

    for (let trial = 1; trial <= TRIALS_PER_N; trial++) {
      const nonce = `nonce_${N}_${trial}_${Date.now()}`;

      // Set up receiver promises on all N sockets
      const receivePromises = sockets.map((s, idx) => {
        return new Promise<number>((resolve, reject) => {
          const timeout = setTimeout(() => {
            s.off('new_message', handler);
            reject(new Error(`Socket ${idx} did not receive trial ${trial} within 5s`));
          }, 5000);

          const handler = (msg: any) => {
            if (msg?.bodyText && msg.bodyText.includes(nonce)) {
              const tReceive = performance.now();
              clearTimeout(timeout);
              s.off('new_message', handler);
              resolve(tReceive);
            }
          };

          s.on('new_message', handler);
        });
      });

      // Post real message via REST API
      const postUrl = `${SERVER_BASE_URL}/api/workspaces/${workspaceSlug}/channels/${channelId}/messages`;
      let tTrigger = performance.now();
      let posted = false;

      for (let attempt = 0; attempt < 3; attempt++) {
        tTrigger = performance.now();
        try {
          const postRes = await fetch(postUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${senderToken}`,
            },
            body: JSON.stringify({
              bodyText: `Socket latency test trial ${trial} with ${nonce}`,
            }),
          });
          if (postRes.ok) {
            posted = true;
            break;
          }
        } catch {}
        await new Promise(r => setTimeout(r, 100));
      }

      if (!posted) {
        throw new Error(`Failed to post message for trial ${trial} after 3 attempts`);
      }

      // Collect receipt times across all N receivers
      const receiveTimes = await Promise.all(receivePromises);

      for (let r = 0; r < receiveTimes.length; r++) {
        const latency = receiveTimes[r] - tTrigger;
        allLatenciesForN.push(Number(latency.toFixed(3)));
        csvRows.push(`${N},${trial},${r},${latency.toFixed(3)}`);
      }

      if (trial % 25 === 0 || trial === TRIALS_PER_N) {
        process.stdout.write(`  [N=${N}] Progress: ${trial}/${TRIALS_PER_N} trials completed...\n`);
      }

      // Brief yield between trials
      await new Promise(r => setTimeout(r, 20));
    }

    // Disconnect all sockets
    for (const s of sockets) {
      s.disconnect();
    }
    // Give sockets time to close
    await new Promise(r => setTimeout(r, 300));

    const stats = computeStats(allLatenciesForN);
    socketResults[N] = { stats, raw: allLatenciesForN };
    console.log(`✓ Completed N=${N}: Median=${stats.median}ms, p95=${stats.p95}ms, p99=${stats.p99}ms (Min=${stats.min}ms, Max=${stats.max}ms, Samples=${allLatenciesForN.length})`);
  }

  // Save raw data and summary
  const resultsDir = path.resolve(__dirname, 'results');
  if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });

  const rawJsonPath = path.join(resultsDir, 'socket_raw.json');
  fs.writeFileSync(rawJsonPath, JSON.stringify(socketResults, null, 2));
  console.log(`\n✓ Saved raw socket timings to: ${rawJsonPath}`);

  const rawCsvPath = path.join(resultsDir, 'socket_raw.csv');
  fs.writeFileSync(rawCsvPath, csvRows.join('\n'));
  console.log(`✓ Saved raw socket CSV to: ${rawCsvPath}`);

  const summaryObj: Record<string, BenchmarkStats> = {};
  for (const N of CONCURRENT_CLIENT_LEVELS) {
    summaryObj[`N_${N}`] = socketResults[N].stats;
  }
  const summaryJsonPath = path.join(resultsDir, 'socket_summary.json');
  fs.writeFileSync(summaryJsonPath, JSON.stringify(summaryObj, null, 2));
  console.log(`✓ Saved socket summary JSON to: ${summaryJsonPath}`);

  return summaryObj;
}

if (process.argv[1] && process.argv[1].endsWith('bench_socket.ts')) {
  runSocketBenchmark().catch(err => {
    console.error('Fatal socket benchmark error:', err);
    process.exit(1);
  });
}
