# DevSync Empirical Evaluation & Benchmark Suite

This directory contains the reproducible benchmark suite for the research paper on DevSync.
All evaluation scripts run against an isolated PostgreSQL test database (`devsync_eval`), leaving production data untouched.

---

## 1. Prerequisites & Setup

1. **Node.js**: v20+ (tested on Node v24.17.0)
2. **PostgreSQL**: PostgreSQL 17+ (Supabase connection URL configured in `backend/.env`)
3. **Install Dependencies**:
   ```bash
   cd eval
   npm install
   ```

---

## 2. Experiments & Commands

### A. Seed the Benchmark Datasets (Deterministic Seed = 42)
Generates 3 dataset scales in `devsync_eval`:
* **Small**: 200 tasks, 5 sprints, 1,000 transitions, 500 commits, 50 PRs, 200 CI runs
* **Medium**: 2,000 tasks, 20 sprints, 10,000 transitions, 3,000 commits, 300 PRs, 1,500 CI runs
* **Large**: 20,000 tasks, 50 sprints, 100,000 transitions, 15,000 commits, 1,500 PRs, 5,000 CI runs

Command:
```bash
npm run seed
```

### B. Run Full Latency & Socket.IO Benchmark (One-Command Master Runner)
Spawns the test API server on port 3099, executes 5 warm-up + 200 measured requests per endpoint per dataset size, runs 100 broadcast trials across N=10, 50, 100 concurrent Socket.IO clients, records raw timings, and generates paper-ready markdown reports.

Command:
```bash
npm run bench:all
```

### C. Individual Component Benchmarks
* **HTTP Latency Only** (5 warm-up + 200 measured per endpoint per size):
  ```bash
  npm run bench:latency
  ```
* **Socket.IO Broadcast Latency Only** (100 trials across N=10, 50, 100):
  ```bash
  npm run bench:socket
  ```

---

## 3. Analytics Correctness Validation (Task 2)

A hand-verifiable dataset with 20 tasks across 2 closed sprints including edge cases:
- Task reopened after `DONE` (TASK-4)
- Task that skipped `IN REVIEW` (TASK-3, TASK-13)
- Tasks never completed (TASK-8 in `in_review`, TASK-9 and TASK-20 in `todo`, TASK-19 in `in_progress`)
- Tasks completed after sprint closed (TASK-7, TASK-18)
- Tasks completed across 5 distinct ISO weeks

### Commands:
* **Seed Correctness Dataset**:
  ```bash
  npm run seed:correctness
  ```
* **Run Correctness Verification**:
  ```bash
  npm run test:correctness
  ```

---

## 4. Benchmark & Evaluation Outputs
All raw measurements and summaries are saved to `eval/results/`:
* `eval/results/task1_summary.md`: Latency & Socket.IO empirical evaluation report.
* `eval/results/latency_raw.json` / `latency_raw.csv` / `latency_summary.json`: HTTP latency data.
* `eval/results/socket_raw.json` / `socket_raw.csv` / `socket_summary.json`: WebSocket broadcast timing data.
* `eval/expected.json`: Hand-calculated first-principles expected values for analytics.
* `eval/results/correctness_results.json`: Full JSON check matrix and actual endpoint responses for Task 2.
* `eval/results/task2_summary.md`: Analytics correctness validation report and mathematical definition comparison.

