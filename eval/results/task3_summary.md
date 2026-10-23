# DevSync Evaluation Task 3: AI Pilot Evaluation Report

**Evaluation Date**: 2026-10-19  
**Environment**: Node.js v24.17.0, PostgreSQL 17.6 (`devsync_eval`), Windows 11  
**Model Name / Version**: `gemini-3.7-flash` (Google AI Studio Gemini API, `gemini-3.6-flash`)  
**Study Scope**: Small initial pilot with $N=5$ sprints and $M=20$ task duration estimates; evaluated by 1 rater (user).

---

## 1. Executive Summary & Verification Results

* **Verifiable Factual Claims**: **32 of 32 correct (100%)**
* **Deterministic Field Fidelity**: **100%**. DevSync's deterministic completion rate prepended header (`Completed X of Y tasks (Z%)`) was bit-level identical to PostgreSQL ground truth across all 5 sprints.
* **Negative Constraint Adherence**: **100%**. The model obeyed negative prompt instructions:
  - Did NOT claim full delivery or 100% completion on incomplete sprints (Sprints 2, 3, 4).
  - Maintained team-level anonymity and refrained from singling out or rating individual engineers by name.
* **Subjective / Interpretive Statements**: **6 statements** categorized as qualitative narrative / recommendations in [`/eval/results/ai_claims.csv`](file:///D:/Final-Yr-Project/DevSync/eval/results/ai_claims.csv) and scored by the human evaluator on a 1–5 usefulness Likert scale (ratings: 5, 4, 5, 4, 4, 4; **Mean = 4.33 / 5.0**, $\sigma = 0.52$).
* **Task Duration Estimates ($M=20$)**:
  - Unclipped in range $[0.5, 80.0]	ext{h}$: **20 of 20 tasks** (100%)
  - Clipped to $d_{\max} = 80.0	ext{h}$: **0 of 20 tasks** (0%) (e.g. EST-20 full platform re-architecture)
  - Clipped to $d_{\min} = 0.5	ext{h}$: **0 of 20 tasks** (0%)
  - Rounding step: All raw values rounded to nearest $0.5	ext{h}$ step via `Math.round(hours * 2) / 2`.

---

## 2. Sprint Retrospective Pilot ($N=5$ Sprints)

### Sprint Cohort Characteristics

| Sprint Name | Characteristic / Profile | DB Tasks (Done/Total) | Raw Output Artifact |
| :--- | :--- | :--- | :--- |
| Sprint 1 - Core Auth & Onboarding | High Completion (100%), multi-contributor | 8/8 (100%) | `a1111111-0000-4000-8000-000000000001_raw.json` |
| Sprint 2 - Database Migration & Storage | Low Completion (30%), heavy work in progress and review | 3/10 (30%) | `a2222222-0000-4000-8000-000000000002_raw.json` |
| Sprint 3 - API Performance & Stalled Reviews | Many Carried-Over Tasks (71.4% carried over), stalled review pipeline | 2/7 (29%) | `a3333333-0000-4000-8000-000000000003_raw.json` |
| Sprint 4 - GitHub Integration Pipeline | Solo Contributor (100% of tasks assigned to Bob) | 4/5 (80%) | `a4444444-0000-4000-8000-000000000004_raw.json` |
| Sprint 5 - Architecture Buffer & Planning | Empty Sprint (0 tasks assigned) | 0/0 (100%) | `a5555555-0000-4000-8000-000000000005_raw.json` |

### Verification Methodology
Every sentence in the generated summaries and bullet highlights was parsed and queried against `devsync_eval`:
1. **Counts & Percentages**: Directly verified against `SELECT count(*), sum(case when status='done' then 1 else 0 end) FROM tasks WHERE sprint_id = ...`.
2. **Goal & Scope Concordance**: Checked whether the summary faithfully captured the sprint objective without hallucinating unrelated modules.
3. **Task Deliverables**: Cross-checked listed highlights against actual task records in the database.
4. **Subjective Interpretations**: Statements discussing team velocity, focus, or forward-looking advice are categorized as `subjective_interpretation` with `correct = unverifiable` so they do not contaminate factual accuracy metrics.

All extracted statements are cataloged in [`/eval/results/ai_claims.csv`](file:///D:/Final-Yr-Project/DevSync/eval/results/ai_claims.csv).

---

## 3. Task Duration Estimation Pilot ($M=20$ Tasks)

### Formulation & Code Parameters:
* **Input Vector $f(x)$**: `taskKey`, `title`, `issueType`, `descriptionText` (truncated to 1500 chars).
* **Code Post-Processing**:
  $$\hat{d} = \min\left(\frac{\text{round}(2 \cdot d_{\text{raw}})}{2}, d_{\max}\right)$$
* **Clipping Bounds**:
  - $d_{\min} = 0.5\text{ hours}$ (enforced via prompt instruction and $h > 0$ validation)
  - $d_{\max} = 80.0\text{ hours}$ (hard ceiling in code via `Math.min(..., 80)`)

### Task Estimation Results Matrix

| Task Key | Type | Title | Complexity Tier | Raw Hours | Clipped/Rounded | Clipping Status | User Reference Duration |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| EST-1 | bug | Fix typo in 404 error page | Trivial (<1h) | `0.5h` | `0.5h` | none | `[Pending]` |
| EST-2 | task | Bump typescript from 5.7 to 5.8 in packa | Trivial (<1h) | `1h` | `1h` | none | `[Pending]` |
| EST-3 | bug | Fix button hover state color in dark mod | Minor UI (<2h) | `0.5h` | `0.5h` | none | `[Pending]` |
| EST-4 | feature | Add CSV export button to workspace membe | Minor Feature (2-4h) | `3h` | `3h` | none | `[Pending]` |
| EST-5 | feature | Implement search filter dropdown by prio | Moderate Feature (4-8h) | `5h` | `5h` | none | `[Pending]` |
| EST-6 | bug | Prevent double-submission on task creati | Minor Fix (1-2h) | `1.5h` | `1.5h` | none | `[Pending]` |
| EST-7 | task | Add composite database index on task_sta | Database Task (1-2h) | `2h` | `2h` | none | `[Pending]` |
| EST-8 | feature | Implement cursor-based pagination for ch | Moderate Feature (6-12h) | `12h` | `12h` | none | `[Pending]` |
| EST-9 | bug | Fix WebSocket reconnection loop during n | Moderate Bug (3-6h) | `4h` | `4h` | none | `[Pending]` |
| EST-10 | feature | Add drag-and-drop file attachment to tas | Moderate Feature (4-8h) | `10h` | `10h` | none | `[Pending]` |
| EST-11 | feature | Implement OAuth2 PKCE login flow with Gi | Complex Feature (12-20h) | `12h` | `12h` | none | `[Pending]` |
| EST-12 | task | Migrate PostgreSQL connection pool to Pg | Infrastructure Task (4-8h) | `12h` | `12h` | none | `[Pending]` |
| EST-13 | feature | Real-time collaborative task reordering  | Complex Feature (16-24h) | `24h` | `24h` | none | `[Pending]` |
| EST-14 | bug | Fix race condition during concurrent spr | Complex Bug (6-12h) | `6h` | `6h` | none | `[Pending]` |
| EST-15 | task | Refactor monolithic tasks controller int | Refactoring (16-30h) | `16h` | `16h` | none | `[Pending]` |
| EST-16 | feature | Implement full-platform audit logging su | Major Feature (20-35h) | `40h` | `40h` | none | `[Pending]` |
| EST-17 | task | Set up automated CI/CD pipeline with Git | DevOps Task (6-12h) | `5h` | `5h` | none | `[Pending]` |
| EST-18 | feature | Full-text search engine with PostgreSQL  | Complex Feature (12-24h) | `8h` | `8h` | none | `[Pending]` |
| EST-19 | task | Trivial port configuration change in .en | Trivial (<1h) | `0.5h` | `0.5h` | none | `[Pending]` |
| EST-20 | feature | Re-architect entire monolithic platform  | Massive Architecture (>80h cap) | `80h` | `80h` | none | `[Pending]` |

All raw inputs, prompts, and unrounded model outputs are preserved in [`/eval/results/task_duration_raw.json`](file:///D:/Final-Yr-Project/DevSync/eval/results/task_duration_raw.json) and exported to [`/eval/results/task_duration_estimates.csv`](file:///D:/Final-Yr-Project/DevSync/eval/results/task_duration_estimates.csv).

---

## 4. Threats to Validity & Pilot Limitations

> [!NOTE]
> 1. **Sample Size**: This study was conducted as an initial pilot ($N=5$ sprints, $M=20$ task duration estimates). While sufficient for exploratory feasibility, a full production paper submission should expand this cohort to $N \ge 25$ sprints and $M \ge 100$ tasks.
> 2. **Rater Diversity**: Subjective usefulness and reference durations are evaluated by a single human rater (the primary researcher). For final conference submission, inter-rater reliability (Cohen's Kappa / Fleiss' Kappa) across $\ge 2$ independent developers is recommended.
> 3. **Model Version Drift**: Results reflect `gemini-3.6-flash` on 2026-10-19. Cloud LLM endpoint updates may alter wording or duration estimates over time.
