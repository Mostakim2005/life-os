import { App, TFile, Vault } from 'obsidian';
import { DEFAULT_HABITS } from './presets';
import { DailyRecord, Goal, HabitDefinition, LifeOSSettings } from './types';
import { isIsoDate, sanitizeDailyRecord } from './record-validation';

export const CURRENT_SCHEMA_VERSION = 3;

export const DEFAULT_SETTINGS: LifeOSSettings = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  dailyNotesFolder: 'Life OS/Daily',
  dashboardNoteFolder: 'Life OS',
  defaultPrayerTimes: { Fajr: '04:30', Dhuhr: '13:00', Asr: '16:30', Maghrib: '18:30', Isha: '20:00' },
  habits: DEFAULT_HABITS,
  goals: [],
  enabledFoodPresetCategories: ['muscle', 'stamina', 'health', 'budget'],
  defaultStudySubjects: ['Mathematics', 'Physics', 'Chemistry', 'Electrical Engineering', 'English'],
  planningRules: [],
  planningOverrides: {},
  reportFolder: 'Life OS/Reports',
  performance: { cacheEnabled: true, cacheTtlMinutes: 10, maxCachedDays: 500, analyticsLookbackDays: 90, lazyRenderAnalytics: true },
  migration: { createBackups: true },
  prayerCalculation: { enabled: true, latitude: 23.8103, longitude: 90.4125, method: 'karachi', madhab: 'hanafi', minuteAdjustment: 0 },
  integrations: { tasks: true, dataview: true, templater: true, autoImportTasks: false },
  planningPreferences: {
    intelligentScheduling: true,
    showFreeTime: true,
    showConflictSuggestions: true,
    enableDragUnscheduled: true,
    enableAdaptiveRescheduling: true,
    goalAwareScheduling: true,
    showPlanningBadges: true,
    slotMinutes: 15,
    quietHoursStart: '23:00',
    quietHoursEnd: '06:00'
  }
};

export function makeEmptyRecord(date: string, settings: LifeOSSettings): DailyRecord {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    date,
    mood: 3,
    energy: 3,
    sleepHours: 0,
    restMinutes: 0,
    prayers: Object.entries(settings.defaultPrayerTimes).map(([name, time]) => ({ name, time, status: 'not-tracked' })),
    habits: {},
    exercises: [],
    meals: [],
    studySessions: [],
    studyPlan: [],
    timeline: [],
    tasksPlanned: [],
    tasksCompleted: [],
    optionalTasks: [],
    richTasks: [],
    richStudyPlans: [],
    reflection: '',
    notePath: dailyPath(settings, date),
    updatedAt: new Date().toISOString()
  };
}

export function dailyPath(settings: LifeOSSettings, date: string): string {
  const folder = settings.dailyNotesFolder.replace(/\/+$/, '');
  return `${folder}/${date}.md`;
}

export async function ensureFolder(vault: Vault, folder: string): Promise<void> {
  const parts = folder.split('/').filter(Boolean);
  let current = '';
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    if (!vault.getAbstractFileByPath(current)) await vault.createFolder(current);
  }
}

export function serializeRecord(record: DailyRecord): string {
  const summary = [
    '---',
    'life-os: true',
    `date: ${JSON.stringify(record.date)}`,
    `mood: ${record.mood}`,
    `energy: ${record.energy}`,
    `sleepHours: ${record.sleepHours}`,
    `restMinutes: ${record.restMinutes}`,
    `studyMinutes: ${record.studySessions.reduce((n, session) => n + session.durationMin, 0)}`,
    `exerciseMinutes: ${record.exercises.reduce((n, exercise) => n + exercise.durationMin, 0)}`,
    `prayerCompleted: ${record.prayers.filter((p) => p.status === 'completed').length}`,
    `prayerLate: ${record.prayers.filter((p) => p.status === 'late').length}`,
    `prayerMissed: ${record.prayers.filter((p) => p.status === 'missed').length}`,
    `tasksPlanned: ${record.tasksPlanned.length}`,
    `tasksCompleted: ${record.tasksCompleted.length}`,
    record.weightKg !== undefined ? `weightKg: ${record.weightKg}` : '',
    '---', ''
  ].filter(Boolean);

  const lines = [
    ...summary,
    `# Daily Life Log — ${record.date}`,
    '',
    '## Tasks',
    '',
    '### Planned',
    ...record.tasksPlanned.map((task) => `- [${record.tasksCompleted.includes(task) ? 'x' : ' '}] ${task}`),
    '',
    '### Optional',
    ...record.optionalTasks.map((task) => `- ${task}`),
    '',
    '## Study',
    '',
    ...record.studySessions.map((session) => `- ${session.subject} — ${session.topic} — ${session.durationMin} min — ${session.type} — ${session.completed ? 'completed' : 'incomplete'}`),
    '',
    '## Study Plan',
    '',
    ...record.studyPlan.map((item) => `- [${item.completed ? 'x' : ' '}] ${item.subject} — ${item.topic} — ${item.targetMinutes} min${item.start && item.end ? ` — ${item.start}-${item.end}` : ''}${item.optional ? ' — optional' : ''}`),
    '',
    '## Prayers',
    '',
    ...record.prayers.map((prayer) => `- ${prayer.name} — ${prayer.time} — ${prayer.status}${prayer.reason ? ` — ${prayer.reason}` : ''}`),
    '',
    '## Habits',
    '',
    ...Object.entries(record.habits).map(([id, entry]) => `- ${id}: ${JSON.stringify(entry)}`),
    '',
    '## Exercise',
    '',
    ...record.exercises.map((exercise) => `- ${exercise.name} — ${exercise.durationMin} min — ${exercise.category}${exercise.sets !== undefined ? ` — ${exercise.sets} sets` : ''}${exercise.reps !== undefined ? ` — ${exercise.reps} reps` : ''}${exercise.loadKg !== undefined ? ` — ${exercise.loadKg} kg` : ''}${exercise.distanceKm !== undefined ? ` — ${exercise.distanceKm} km` : ''}${exercise.intensity !== undefined ? ` — RPE ${exercise.intensity}` : ''}${exercise.muscleGroup ? ` — ${exercise.muscleGroup}` : ''}${exercise.note ? ` — ${exercise.note}` : ''}`),
    '',
    '## Food',
    '',
    ...record.meals.map((meal) => `- ${meal.meal}: ${meal.food} [${meal.category}]${meal.servings !== undefined ? ` — ${meal.servings} serving(s)` : ''}${meal.estimatedCalories !== undefined ? ` — ${meal.estimatedCalories} kcal` : ''}${meal.estimatedProteinG !== undefined ? ` — ${meal.estimatedProteinG}g protein` : ''}${meal.estimatedCarbsG !== undefined ? ` — ${meal.estimatedCarbsG}g carbs` : ''}${meal.estimatedFatG !== undefined ? ` — ${meal.estimatedFatG}g fat` : ''}${meal.estimatedFiberG !== undefined ? ` — ${meal.estimatedFiberG}g fiber` : ''}`),
    '',
    '## Timeline',
    '',
    '| Start | End | Activity | Type | Planned | Actual |',
    '| --- | --- | --- | --- | --- | --- |',
    ...record.timeline.map((item) => `| ${item.start} | ${item.end} | ${item.title.replace(/\|/g, '/')} | ${item.type} | ${item.planned ? 'yes' : 'no'} | ${item.actual ? 'yes' : 'no'} |`),
    '',
    '## Reflection',
    '',
    record.reflection || '_No reflection recorded._',
    '',
    '## Life OS Data',
    '',
    '<!-- The JSON block below is the structured backing data used by Life OS. It keeps the note portable and recoverable. -->',
    '```json',
    JSON.stringify({ ...record, notePath: undefined }, null, 2),
    '```',
    '',
    `<!-- life-os-updated: ${record.updatedAt} -->`,
    ''
  ];
  return lines.join('\n');
}

export async function saveRecord(app: App, record: DailyRecord, settings: LifeOSSettings): Promise<TFile> {
  if (!isIsoDate(record.date)) throw new Error(`Invalid Life OS date: ${record.date}`);
  await ensureFolder(app.vault, settings.dailyNotesFolder);
  const path = dailyPath(settings, record.date);
  const content = serializeRecord(record);
  const existing = app.vault.getAbstractFileByPath(path);
  if (existing instanceof TFile) {
    await app.vault.modify(existing, content);
    return existing;
  }
  return app.vault.create(path, content);
}

export async function loadRecord(app: App, date: string, settings: LifeOSSettings): Promise<DailyRecord | null> {
  if (!isIsoDate(date)) throw new Error(`Invalid Life OS date: ${date}`);
  const path = dailyPath(settings, date);
  const file = app.vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile)) return null;
  const text = await app.vault.read(file);
  const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1] ?? '{}') as Partial<DailyRecord>;
      const empty = makeEmptyRecord(date, settings);
      return sanitizeDailyRecord(parsed, date, path, empty);
    } catch {
      // Fall through to legacy parser.
    }
  }

  const record = makeEmptyRecord(date, settings);
  record.schemaVersion = CURRENT_SCHEMA_VERSION;
  const yaml = text.match(/^---\n([\s\S]*?)\n---/);
  if (yaml) {
    for (const line of (yaml[1] ?? '').split('\n')) {
      const [key, ...rest] = line.split(':');
      const value = rest.join(':').trim().replace(/^"|"$/g, '');
      if (key === 'mood') record.mood = Number(value) || 3;
      if (key === 'energy') record.energy = Number(value) || 3;
      if (key === 'sleepHours') record.sleepHours = Number(value) || 0;
      if (key === 'restMinutes') record.restMinutes = Number(value) || 0;
      if (key === 'weightKg') record.weightKg = Number(value) || undefined;
    }
  }
  return record;
}

export function settingsWithDefaults(raw: Partial<LifeOSSettings> | null | undefined): LifeOSSettings {
  const source = raw ?? {};
  return {
    ...DEFAULT_SETTINGS,
    ...source,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    defaultPrayerTimes: { ...DEFAULT_SETTINGS.defaultPrayerTimes, ...(source.defaultPrayerTimes ?? {}) },
    habits: source.habits?.length ? source.habits as HabitDefinition[] : DEFAULT_HABITS,
    enabledFoodPresetCategories: source.enabledFoodPresetCategories ?? DEFAULT_SETTINGS.enabledFoodPresetCategories,
    defaultStudySubjects: source.defaultStudySubjects?.length ? source.defaultStudySubjects : DEFAULT_SETTINGS.defaultStudySubjects,
    goals: Array.isArray(source.goals) ? source.goals as Goal[] : [],
    planningRules: Array.isArray(source.planningRules) ? source.planningRules : [],
    planningOverrides: source.planningOverrides ?? {},
    reportFolder: typeof source.reportFolder === 'string' ? source.reportFolder : DEFAULT_SETTINGS.reportFolder,
    prayerCalculation: { ...DEFAULT_SETTINGS.prayerCalculation, ...(source.prayerCalculation ?? {}) },
    integrations: { ...DEFAULT_SETTINGS.integrations, ...(source.integrations ?? {}) },
    planningPreferences: { ...DEFAULT_SETTINGS.planningPreferences, ...(source.planningPreferences ?? {}) },
    performance: { ...DEFAULT_SETTINGS.performance, ...(source.performance ?? {}) },
    migration: { ...DEFAULT_SETTINGS.migration, ...(source.migration ?? {}) }
  };
}
