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