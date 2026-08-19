import { App, TFile } from 'obsidian';
import { DailyRecord, LifeOSSettings, Priority } from './types';

export interface RichTask {
  id: string;
  title: string;
  completed: boolean;
  optional: boolean;
  priority: Priority;
  durationMin?: number;
  deadline?: string;
  goalId?: string;
  subject?: string;
  topic?: string;
  scheduledDate?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  sourcePath?: string;
  sourceLine?: number;
}

export interface RichStudyPlan {
  id: string;
  subject: string;
  topic: string;
  targetMinutes: number;
  priority: Priority;
  goalId?: string;
  deadline?: string;
  optional: boolean;
  plannedDate?: string;
  start?: string;
  end?: string;
  completed: boolean;
}

export interface IntegrationSnapshot {
  tasksPluginDetected: boolean;
  dataviewDetected: boolean;
  templaterDetected: boolean;
  importedTaskCount: number;
}

export function buildIntegrationSnapshot(app: App, settings: LifeOSSettings, records: DailyRecord[]): IntegrationSnapshot {
  const plugins = (app as unknown as { plugins?: { enabledPlugins?: Set<string> } }).plugins;
  const enabled = plugins?.enabledPlugins;
  return {
    tasksPluginDetected: Boolean(enabled?.has('obsidian-tasks-plugin')),
    dataviewDetected: Boolean(enabled?.has('dataview')),
    templaterDetected: Boolean(enabled?.has('templater-obsidian')),
    importedTaskCount: records.reduce((sum, r) => sum + (r.richTasks?.length ?? 0), 0)
  };
}

export function serializeTaskMetadata(task: RichTask): string {
  const parts = [`[life-os-id:: ${task.id}]`, `[priority:: ${task.priority}]`];
  if (task.durationMin !== undefined) parts.push(`[duration-min:: ${task.durationMin}]`);
  if (task.deadline) parts.push(`[deadline:: ${task.deadline}]`);
  if (task.goalId) parts.push(`[goal:: ${task.goalId}]`);
  if (task.subject) parts.push(`[subject:: ${task.subject}]`);
  if (task.topic) parts.push(`[topic:: ${task.topic}]`);
  return parts.join(' ');
}

export async function importMarkdownTasks(app: App, goalId?: string): Promise<RichTask[]> {
  const result: RichTask[] = [];
  for (const file of app.vault.getMarkdownFiles()) {
    const text = await app.vault.cachedRead(file);
    const lines = text.split('\n');
    lines.forEach((line: string, index: number) => {
      const match = line.match(/^\s*- \[([ xX])\]\s+(.+)$/);
      if (!match) return;
      const completed = (match[1] ?? '').toLowerCase() === 'x';
      const body = (match[2] ?? '').trim();
      const metadata = parseInlineMetadata(body);
      if (goalId && metadata.goal !== goalId) return;
      result.push({
        id: metadata['life-os-id'] ?? `import:${file.path}:${index + 1}`,
        title: body.replace(/\s+\[[^\]]+::[^\]]*\]/g, '').trim(),
        completed,
        optional: Boolean(metadata.optional),
        priority: priorityFrom(metadata.priority),
        durationMin: num(metadata['duration-min']),
        deadline: metadata.deadline,
        goalId: metadata.goal,
        subject: metadata.subject,
        topic: metadata.topic,
        sourcePath: file.path,
        sourceLine: index + 1
      });
    });
  }
  return result;
}

export function dataviewProperties(record: DailyRecord): Record<string, unknown> {
  return {
    'life-os': true,
    date: record.date,
    mood: record.mood,
    energy: record.energy,
    sleep: record.sleepHours,
    restMinutes: record.restMinutes,
    studyMinutes: record.studySessions.reduce((n, s) => n + s.durationMin, 0),
    exerciseMinutes: record.exercises.reduce((n, e) => n + e.durationMin, 0),
    meals: record.meals.length,
    prayerCompleted: record.prayers.filter((p) => p.status === 'completed').length,
    prayerLate: record.prayers.filter((p) => p.status === 'late').length,
    prayerMissed: record.prayers.filter((p) => p.status === 'missed').length,
    tasksPlanned: record.tasksPlanned.length,
    tasksCompleted: record.tasksCompleted.length
  };
}

export function templaterTemplate(): string {
  return `---\nlife-os: true\ndate: <% tp.date.now("YYYY-MM-DD") %>\n---\n\n# Daily Life Log — <% tp.date.now("YYYY-MM-DD") %>\n\n## Priorities\n\n- [ ] \n\n## Study\n\n## Exercise\n\n## Food\n\n## Prayer\n\n## Reflection\n`;
}

function parseInlineMetadata(value: string): Record<string, string> {
  const result: Record<string, string> = {};
  const regex = /\[([^:\]]+)::\s*([^\]]*)\]/g; let match: RegExpExecArray | null;
  while ((match = regex.exec(value)) !== null) {
    const key = (match[1] ?? '').trim();
    const entry = (match[2] ?? '').trim();
    if (key) result[key] = entry;
  }
  return result;
}
function num(value?: string): number | undefined { if (!value) return undefined; const n = Number(value); return Number.isFinite(n) ? n : undefined; }
function priorityFrom(value?: string): Priority { return value === 'critical' || value === 'high' || value === 'low' ? value : 'medium'; }
