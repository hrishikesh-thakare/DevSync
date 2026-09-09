import { env } from '../config/env.js';

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_MODEL = 'gemini-3.6-flash';

const isEnabled = (): boolean => !!env.GEMINI_API_KEY;

const callGemini = async (prompt: string): Promise<string | null> => {
  if (!isEnabled()) return null;

  try {
    const res = await fetch(
      `${GEMINI_ENDPOINT}/models/${GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
        }),
      }
    );

    if (!res.ok) {
      console.warn(`Gemini API error ${res.status}:`, await res.text());
      return null;
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text as string | undefined;
    if (!text) return null;

    // Strip markdown code fences if the model wraps the JSON
    return text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/m, '').trim();
  } catch (err) {
    console.warn('Gemini call failed:', err);
    return null;
  }
};

const parseJson = <T>(text: string | null): T | null => {
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
};

// ─── Sprint Report ───────────────────────────────────────────────────────────

export interface SprintTaskInput {
  taskKey: string;
  title: string;
  issueType: string | null;
  status: string | null;
  assigneeName: string | null;
  assigneeId: string | null;
}

// Deliberately team-level only. This used to also return a
// `contributionReport` — one AI-written sentence per assignee judging "their
// contribution" plus a task count, posted automatically and publicly to the
// project channel on every sprint close, no review step. Individual
// activity-count metrics are a documented anti-pattern (see the Analytics
// Contribution chart removed the same session this was) — a narrative
// sentence stated with false authority from nothing but a task list is a
// sharper version of the same problem, not a milder one.
export interface SprintReport {
  summary: string;
  highlights: string[];
}

export const generateSprintReport = async (params: {
  sprintName: string;
  goal: string | null;
  startDate: Date | null;
  endDate: Date | null;
  completedCount: number;
  totalCount: number;
  tasks: SprintTaskInput[];
}): Promise<SprintReport | null> => {
  const { sprintName, goal, startDate, endDate, completedCount, totalCount, tasks } = params;

  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 100;

  const taskLines = tasks
    .map(t =>
      `- ${t.taskKey} [${t.issueType || 'task'}] (${t.status || 'todo'}) assigned to ${t.assigneeName || 'unassigned'}: ${t.title}`
    )
    .join('\n');

  const prompt = `You are an agile project management assistant. Write a concise sprint retrospective for the team.

Sprint: ${sprintName}
Goal: ${goal || 'None'}
Dates: ${startDate ? startDate.toISOString().split('T')[0] : 'N/A'} to ${endDate ? endDate.toISOString().split('T')[0] : 'N/A'}
Completed: ${completedCount}/${totalCount} tasks (${completionRate}% completion rate)

IMPORTANT: The completion rate is EXACTLY ${completionRate}%. Do NOT state or imply a higher completion rate (no "100%", no "all work delivered") unless ${completionRate} === 100. Do NOT mention the completion rate in the highlights — the system adds it automatically.

Tasks:
${taskLines || '(no tasks)'}

Describe the sprint as a whole — do not single out or evaluate individual
people. Do not claim a completion rate higher than the percentage provided
above. Respond with STRICT JSON (no markdown, no commentary) in exactly this
shape:
{
  "summary": "2-3 sentence retrospective summary, professional and neutral tone",
  "highlights": ["2-4 bullet highlights, one line each"]
}`;

  const text = await callGemini(prompt);
  const parsed = parseJson<Partial<SprintReport>>(text);

  if (!parsed || typeof parsed.summary !== 'string') {
    console.warn('Gemini sprint report: unexpected response shape:', text);
    return null;
  }

  return {
    summary: parsed.summary,
    highlights: [
      `Completed ${completedCount} of ${totalCount} tasks (${completionRate}%)`,
      ...(Array.isArray(parsed.highlights) ? parsed.highlights : []),
    ],
  };
};

// ─── Task Duration Estimate ──────────────────────────────────────────────────

export const estimateTaskDuration = async (params: {
  taskKey: string;
  title: string;
  issueType: string | null;
  descriptionText: string | null;
}): Promise<number | null> => {
  const { taskKey, title, issueType, descriptionText } = params;

  const prompt = `You are a software estimation assistant. Estimate how long (in hours, between 0.5 and 80) this task will take a developer.

Task: ${taskKey} (${issueType || 'task'})
Title: ${title}
Description: ${(descriptionText || '').slice(0, 1500) || '(none)'}

Respond with STRICT JSON (no markdown): {"estimatedHours": <number>}`;

  const text = await callGemini(prompt);
  const parsed = parseJson<{ estimatedHours?: number }>(text);
  const hours = parsed?.estimatedHours;

  if (typeof hours !== 'number' || !isFinite(hours) || hours <= 0) {
    console.warn('Gemini duration estimate: unexpected response:', text);
    return null;
  }

  return Math.min(Math.round(hours * 2) / 2, 80);
};

// ─── CI Failure Summary ──────────────────────────────────────────────────────
//
// Manual-only, unlike the two generators above — triggered by the Summarize
// button in github.controller.ts, never automatically from the webhook. That
// was tried (fire-and-forget on every reported failure) and deliberately
// reverted: confirmed live that firing immediately on webhook delivery can
// race GitHub's own Actions logs API, which briefly 404s on a run's logs
// right after it completes. Manual-only means it only ever runs while
// someone is actually looking at the screen, which sidesteps that race
// entirely and keeps a person in the loop rather than a silent background
// failure nobody sees.

export const summarizeCiFailure = async (params: {
  workflowName: string | null;
  headBranch: string | null;
  jobs: { jobName: string; logs: string }[];
}): Promise<string | null> => {
  const { workflowName, headBranch, jobs } = params;

  // The actual error is almost always in the last few thousand characters of
  // a job log — dependency installs and cache restores dominate the start.
  // Keeping only the tail per job is what keeps this prompt cheap.
  const MAX_CHARS_PER_JOB = 6000;
  const jobSections = jobs
    .map(j => `--- Job: ${j.jobName} ---\n${j.logs.slice(-MAX_CHARS_PER_JOB)}`)
    .join('\n\n');

  const prompt = `You are a CI/CD debugging assistant. A GitHub Actions workflow run failed. Read the job logs below (each may be truncated to its tail) and explain it to a teammate who has NOT seen the logs and will not go read them.

Workflow: ${workflowName || 'Unknown'}
Branch: ${headBranch || 'unknown'}

${jobSections.slice(0, 24000)}

Write an INTERPRETATION, not a transcript. Do not quote or paraphrase raw log
lines back — restating "expected: 200, got: 500" or "exited with code 1" in
sentence form tells a reader nothing they couldn't get by scrolling the log
themselves, and it is not useful. Instead say, in plain language a non-expert
could follow:
1. What kind of failure this is (a test assertion, a build/compile error, a
   missing dependency, a timeout, a syntax error, etc.)
2. What in the code or config most likely needs to change, as specifically as
   the logs actually support — name the file, function or step if it is
   identifiable, but do not invent a location the logs don't show.
3. If the logs are too sparse to say anything concrete, say that plainly
   instead of dressing up a guess as an explanation.

Respond with STRICT JSON (no markdown, no commentary) in exactly this shape:
{"cause": "2-4 sentences of plain-language interpretation, not a restatement of the log text"}`;

  const text = await callGemini(prompt);
  const parsed = parseJson<{ cause?: string }>(text);

  if (!parsed || typeof parsed.cause !== 'string') {
    console.warn('Gemini CI failure summary: unexpected response shape:', text);
    return null;
  }

  return parsed.cause;
};