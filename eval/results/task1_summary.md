# Task 1: DevSync Latency Evaluation Benchmark

## 1. Experimental Setup
* **Operating System**: Windows 11 Home Single Language (Build 26300, 64-bit)
* **CPU**: 13th Gen Intel Core i5-13450HX (10 Cores, 16 Threads, up to 4.60 GHz)
* **RAM**: 16.0 GB DDR5
* **Node.js Runtime**: v24.17.0
* **Database Engine**: PostgreSQL 17.6 (Supabase Cloud (aws-1-ap-south-1.pooler.supabase.com))
* **Execution Topology**: Client and API server running on same host (localhost:3099); PostgreSQL database hosted remotely on Supabase Cloud.
* **Random Seed**: Fixed deterministic PRNG (Seed = 42)
* **Isolated Environment**: Dedicated separate test database (`devsync_eval`), preserving all production data.

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
   * High-resolution request-to-response duration was captured using `performance.now()` with millisecond precision.
2. **Socket.IO Event Broadcast Latency Benchmark**:
   * Evaluated real-time broadcast fan-out latency across $N \in \{10, 50, 100\}$ concurrent authenticated client connections.
   * In each trial, an authenticated client initiates an event (posting a channel message with an indexed nonce) over HTTP REST.
   * The server broadcasts the event to the target room.
   * Latency is measured from trigger initiation to receipt across all $N$ receiver sockets.
   * Repeated for 100 trials per $N$ ($100 \times N$ total measurements per concurrency level: 1,000 for $N=10$, 5,000 for $N=50$, 10,000 for $N=100$).

---

## 3. Results

### Table 1: Analytics & Delivery Endpoint Latency (200 requests per cell, in ms)
| Endpoint Under Test | Dataset Size | Min (ms) | Median (ms) | Mean (ms) | p95 (ms) | p99 (ms) | Max (ms) | Std Dev |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Analytics Delivery (Cycle Time, Throughput, Velocity, CI)** | SMALL | 441.71 | **490.38** | 495.04 | 529.07 | 701.4 | 880.5 | 38.35 |
| **Analytics Delivery (Cycle Time, Throughput, Velocity, CI)** | MEDIUM | 481.48 | **549.4** | 551.2 | 591.4 | 660.53 | 764.69 | 29.8 |
| **Analytics Delivery (Cycle Time, Throughput, Velocity, CI)** | LARGE | 812.07 | **893.6** | 910.89 | 1051.93 | 1203.19 | 1277.8 | 72.8 |
| **Dashboard Workload & Activity** | SMALL | 446.42 | **506.63** | 508.2 | 545.09 | 611.75 | 782.85 | 30.05 |
| **Dashboard Workload & Activity** | MEDIUM | 445.03 | **487.77** | 503.69 | 642.76 | 746.36 | 748.4 | 55.51 |
| **Dashboard Workload & Activity** | LARGE | 507.49 | **559.49** | 567.44 | 621.34 | 798.38 | 840.22 | 40.51 |
| **GitHub Commits (Contributor History)** | SMALL | 449.68 | **525.76** | 525.03 | 573.63 | 751.52 | 777.17 | 40.19 |
| **GitHub Commits (Contributor History)** | MEDIUM | 464.52 | **490.22** | 495.26 | 522.43 | 738.82 | 745.87 | 33.63 |
| **GitHub Commits (Contributor History)** | LARGE | 487.18 | **504.69** | 506.97 | 529.14 | 537.46 | 555.79 | 12 |
| **GitHub Pull Requests** | SMALL | 405.05 | **451.14** | 464.81 | 587.52 | 759.27 | 821.94 | 54.43 |
| **GitHub Pull Requests** | MEDIUM | 413.96 | **438.38** | 449.08 | 487.12 | 685.71 | 1061.75 | 55.82 |
| **GitHub Pull Requests** | LARGE | 410.23 | **444.42** | 451.73 | 515.35 | 593.08 | 598.76 | 29.53 |
| **GitHub CI Status** | SMALL | 451.22 | **483.8** | 490.54 | 532.18 | 655.43 | 699.84 | 31.5 |
| **GitHub CI Status** | MEDIUM | 452.12 | **491.86** | 499.33 | 544.96 | 691.02 | 710.6 | 36.34 |
| **GitHub CI Status** | LARGE | 453.61 | **481.08** | 485.83 | 520.91 | 710.5 | 738.39 | 32.32 |

### Table 2: Socket.IO Event Broadcast Latency Across Concurrency Levels (100 trials per $N$, in ms)
| Concurrent Clients ($N$) | Total Samples | Min (ms) | Median (ms) | Mean (ms) | p95 (ms) | p99 (ms) | Max (ms) | Std Dev |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **N = 10** | 1,000 | 378.19 | **434.48** | 440 | 504.6 | 680.68 | 680.87 | 36.02 |
| **N = 50** | 5,000 | 363.09 | **697.13** | 650.61 | 823.07 | 1401.8 | 1402.73 | 166.86 |
| **N = 100** | 10,000 | 360.72 | **431.69** | 465.9 | 631.28 | 1636.09 | 1637.34 | 137.25 |

---

## 4. Discussion & Caveats
* **Network Latency & Topology**: The test runner client and DevSync Node/Express API server were co-located on the same local benchmark workstation (`localhost:3099`), eliminating wide-area client-to-server Internet transit delay. However, the PostgreSQL database was hosted remotely on Supabase Cloud (`aws-1-ap-south-1.pooler.supabase.com`), introducing real-world network latency (round-trip transit of ~30–50ms per database query) into every API call.
* **Socket.IO Clock Synchronization**: Because all concurrent WebSocket client connections and trigger callers ran on the same operating system instance, high-resolution timers (`performance.now()`) operated on a single shared hardware monotonic clock. This eliminated cross-machine clock drift or NTP skew in receiver latency measurements. In a geographically distributed deployment, client-perceived latency would also include individual last-mile network latencies.
* **Synthetic vs. Production Workloads**: The benchmark dataset was generated synthetically with a deterministic pseudo-random number generator (PRNG seed = 42). While realistic state progressions, dwell times, and commit/PR links were modeled, actual enterprise usage will feature varying concurrency, complex cache effects, and non-uniform query parameters.
