import { DailyRecord, LifeOSSettings, HabitEntry, PrayerEntry, ExerciseEntry, MealEntry, StudySession, StudyPlanItem, TimelineEntry } from './types';
import { CURRENT_SCHEMA_VERSION, makeEmptyRecord, settingsWithDefaults } from './storage';

export interface MigrationAudit { fromVersion: number; toVersion: number; changed: boolean; warnings: string[]; }

function asArray<T>(value: unknown): T[] { return Array.isArray(value) ? value as T[] : []; }
function cleanNumber(value: unknown, fallback = 0): number { return typeof value === 'number' && Number.isFinite(value) ? value : fallback; }

export function migrateSettings(raw: Partial<LifeOSSettings> | null | undefined): { settings: LifeOSSettings; audit: MigrationAudit } {
  const fromVersion = Number(raw?.schemaVersion ?? 1);
  const settings = settingsWithDefaults(raw);
  const warnings: string[] = [];
  if (!settings.performance.maxCachedDays || settings.performance.maxCachedDays < 50) { settings.performance.maxCachedDays = 500; warnings.push('Restored an invalid cache limit.'); }
  if (settings.performance.cacheTtlMinutes < 1 || settings.performance.cacheTtlMinutes > 1440) { settings.performance.cacheTtlMinutes = 10; warnings.push('Restored an invalid cache TTL.'); }
  if (!Number.isFinite(settings.prayerCalculation.latitude) || settings.prayerCalculation.latitude < -90 || settings.prayerCalculation.latitude > 90) { settings.prayerCalculation.latitude = 23.8103; warnings.push('Restored an invalid prayer latitude.'); }
  if (!Number.isFinite(settings.prayerCalculation.longitude) || settings.prayerCalculation.longitude < -180 || settings.prayerCalculation.longitude > 180) { settings.prayerCalculation.longitude = 90.4125; warnings.push('Restored an invalid prayer longitude.'); }
  if (![5, 10, 15, 30].includes(settings.planningPreferences.slotMinutes)) { settings.planningPreferences.slotMinutes = 15; warnings.push('Restored an invalid planner snap interval.'); }
  if (![30, 60, 90, 180, 365].includes(settings.performance.analyticsLookbackDays)) { settings.performance.analyticsLookbackDays = 90; warnings.push('Restored an invalid analytics lookback.'); }
  settings.schemaVersion = CURRENT_SCHEMA_VERSION;
  if (typeof settings.migration.createBackups !== 'boolean') { settings.migration.createBackups = true; warnings.push('Restored migration backup preference.'); }
  return { settings, audit: { fromVersion, toVersion: CURRENT_SCHEMA_VERSION, changed: fromVersion !== CURRENT_SCHEMA_VERSION || warnings.length > 0, warnings } };
}

export function normalizeDailyRecord(input: Partial<DailyRecord>, date: string, settings: LifeOSSettings): DailyRecord {
  const base = makeEmptyRecord(date, settings);
  return {
    ...base,
    ...input,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    date,
    mood: cleanNumber(input.mood, 3),
    energy: cleanNumber(input.energy, 3),
    sleepHours: Math.max(0, cleanNumber(input.sleepHours)),
    restMinutes: Math.max(0, cleanNumber(input.restMinutes)),
    prayers: asArray<PrayerEntry>(input.prayers),
    habits: (input.habits && typeof input.habits === 'object') ? input.habits : {},
    exercises: asArray<ExerciseEntry>(input.exercises),
    meals: asArray<MealEntry>(input.meals),
    studySessions: asArray<StudySession>(input.studySessions),
    studyPlan: asArray<StudyPlanItem>(input.studyPlan),
    timeline: asArray<TimelineEntry>(input.timeline),
    tasksPlanned: asArray<string>(input.tasksPlanned),
    tasksCompleted: asArray<string>(input.tasksCompleted),
    optionalTasks: asArray<string>(input.optionalTasks),
    richTasks: asArray(input.richTasks),
    richStudyPlans: asArray(input.richStudyPlans),
    reflection: typeof input.reflection === 'string' ? input.reflection : '',
    notePath: base.notePath,
    updatedAt: typeof input.updatedAt === 'string' ? input.updatedAt : new Date().toISOString()
  };
}

export function validateRecord(record: DailyRecord): string[] {
  const warnings: string[] = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(record.date)) warnings.push('Invalid date.');
  if (record.timeline.length > 200) warnings.push('Timeline contains more than 200 entries.');
  if (record.meals.length > 300) warnings.push('Meal list is unusually large.');
  if (record.studySessions.length > 300) warnings.push('Study session list is unusually large.');
  return warnings;
}
