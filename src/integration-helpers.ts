import { App } from 'obsidian';

export function pluginEnabled(app: App, id: string): boolean {
  const enabled = (app as unknown as { plugins?: { enabledPlugins?: Set<string> } }).plugins?.enabledPlugins;
  return Boolean(enabled?.has(id));
}

export function lifeOSDataviewQuery(): string {
  return `TABLE date, studyMinutes, exerciseMinutes, prayerCompleted, prayerLate, prayerMissed, tasksPlanned, tasksCompleted\nFROM "Life OS/Daily"\nWHERE life-os = true\nSORT date DESC`;
}

export function lifeOSDataviewSummaryQuery(): string {
  return `TABLE sum(studyMinutes) AS "Study min", sum(exerciseMinutes) AS "Exercise min", sum(prayerCompleted) AS "Prayers", sum(tasksCompleted) AS "Tasks completed"\nFROM "Life OS/Daily"\nWHERE life-os = true`;
}

export function lifeOSTemplaterTemplate(): string {
  return `---\nlife-os: true\ndate: <% tp.date.now("YYYY-MM-DD") %>\n---\n\n# Daily Life Log — <% tp.date.now("YYYY-MM-DD") %>\n\n## Priorities\n- [ ] \n\n## Study\n\n## Exercise\n\n## Food\n\n## Prayer\n\n## Habits\n\n## Reflection\n`;
}

export function tasksMetadataGuide(): string {
  return `# Life OS task metadata\n\nExample:\n- [ ] Finish RLC transient analysis [life-os-id:: task-001] [priority:: high] [duration-min:: 60] [deadline:: 2026-08-25] [goal:: circuits-exam]\n`;
}
