import { DailyRecord, ExerciseEntry, HabitEntry, MealEntry, PrayerEntry, StudyPlanItem, StudySession, TimelineEntry } from './types';

export function isIsoDate(value: unknown): boolean {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function isTime(value: unknown): value is string {
  return typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/.test(value);
}

export function finiteNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function safeString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function safeArray<T>(value: unknown, max: number): T[] {
  return Array.isArray(value) ? (value as T[]).slice(0, max) : [];
}

function normalizePrayer(value: unknown): PrayerEntry | null {
  if (!value || typeof value !== 'object') return null;
  const prayer = value as Partial<PrayerEntry>;
  const status = prayer.status === 'completed' || prayer.status === 'late' || prayer.status === 'missed' || prayer.status === 'not-tracked'
    ? prayer.status
    : 'not-tracked';
  return { name: safeString(prayer.name, 'Prayer'), time: isTime(prayer.time) ? prayer.time : '00:00', status, reason: typeof prayer.reason === 'string' ? prayer.reason.slice(0, 500) : undefined };
}

function normalizeExercise(value: unknown): ExerciseEntry | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Partial<ExerciseEntry>;
  return {
    name: safeString(item.name, 'Exercise').slice(0, 200),
    category: safeString(item.category, 'general').slice(0, 100),
    durationMin: Math.max(0, finiteNumber(item.durationMin)),
    sets: item.sets === undefined ? undefined : Math.max(0, Math.floor(finiteNumber(item.sets))),
    reps: item.reps === undefined ? undefined : Math.max(0, Math.floor(finiteNumber(item.reps))),
    loadKg: item.loadKg === undefined ? undefined : Math.max(0, finiteNumber(item.loadKg)),
    distanceKm: item.distanceKm === undefined ? undefined : Math.max(0, finiteNumber(item.distanceKm)),
    intensity: item.intensity === undefined ? undefined : Math.min(10, Math.max(0, finiteNumber(item.intensity))),
    muscleGroup: typeof item.muscleGroup === 'string' ? item.muscleGroup.slice(0, 100) : undefined,
    note: typeof item.note === 'string' ? item.note.slice(0, 1000) : undefined
  };
}

function normalizeMeal(value: unknown): MealEntry | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Partial<MealEntry>;
  const category = item.category === 'muscle' || item.category === 'stamina' || item.category === 'health' || item.category === 'budget' || item.category === 'general'
    ? item.category : 'general';
  return {
    meal: safeString(item.meal, 'Meal').slice(0, 80),
    food: safeString(item.food, '').slice(0, 300),
    category,
    estimatedProteinG: item.estimatedProteinG === undefined ? undefined : Math.max(0, finiteNumber(item.estimatedProteinG)),
    estimatedCalories: item.estimatedCalories === undefined ? undefined : Math.max(0, finiteNumber(item.estimatedCalories)),
    estimatedCarbsG: item.estimatedCarbsG === undefined ? undefined : Math.max(0, finiteNumber(item.estimatedCarbsG)),
    estimatedFatG: item.estimatedFatG === undefined ? undefined : Math.max(0, finiteNumber(item.estimatedFatG)),
    estimatedFiberG: item.estimatedFiberG === undefined ? undefined : Math.max(0, finiteNumber(item.estimatedFiberG)),
    servings: item.servings === undefined ? undefined : Math.max(0, finiteNumber(item.servings))
  };
}

function normalizeStudy(value: unknown): StudySession | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Partial<StudySession>;
  const type = ['study', 'revision', 'practice', 'lecture', 'reading', 'exam', 'assignment', 'other'].includes(String(item.type))
    ? item.type as StudySession['type'] : 'study';
  return {
    id: safeString(item.id, `study-${Math.random().toString(36).slice(2)}`),
    subject: safeString(item.subject, 'General').slice(0, 200),
    topic: safeString(item.topic, '').slice(0, 300),
    durationMin: Math.max(0, finiteNumber(item.durationMin)),
    plannedDurationMin: item.plannedDurationMin === undefined ? undefined : Math.max(0, finiteNumber(item.plannedDurationMin)),
    type,
    completed: Boolean(item.completed),
    focus: item.focus === undefined ? undefined : Math.min(10, Math.max(0, finiteNumber(item.focus))),
    note: typeof item.note === 'string' ? item.note.slice(0, 1000) : undefined
  };
}

function normalizeStudyPlan(value: unknown): StudyPlanItem | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Partial<StudyPlanItem>;
  return {
    id: safeString(item.id, `plan-${Math.random().toString(36).slice(2)}`),
    subject: safeString(item.subject, 'General').slice(0, 200),
    topic: safeString(item.topic, '').slice(0, 300),
    start: isTime(item.start) ? item.start : undefined,
    end: isTime(item.end) ? item.end : undefined,
    targetMinutes: Math.max(0, finiteNumber(item.targetMinutes)),
    optional: Boolean(item.optional),
    completed: Boolean(item.completed),
    priority: item.priority === 'low' || item.priority === 'medium' || item.priority === 'high' || item.priority === 'critical' ? item.priority : 'medium',
    goalId: typeof item.goalId === 'string' ? item.goalId : undefined,
    deadline: isIsoDate(item.deadline) ? item.deadline : undefined
  };
}

function normalizeTimeline(value: unknown): TimelineEntry | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Partial<TimelineEntry>;
  const type = ['task', 'habit', 'exercise', 'meal', 'prayer', 'study', 'rest', 'other'].includes(String(item.type))
    ? item.type as TimelineEntry['type'] : 'other';
  if (!isTime(item.start) || !isTime(item.end) || !safeString(item.title).trim()) return null;
  return {
    id: safeString(item.id, `timeline-${Math.random().toString(36).slice(2)}`),
    title: safeString(item.title).slice(0, 300),
    start: item.start,
    end: item.end,
    type,
    planned: Boolean(item.planned),
    actual: Boolean(item.actual),
    note: typeof item.note === 'string' ? item.note.slice(0, 1000) : undefined
  };
}

export function sanitizeDailyRecord(input: Partial<DailyRecord>, date: string, notePath: string, defaults: DailyRecord): DailyRecord {
  const habits: Record<string, HabitEntry> = {};
  if (input.habits && typeof input.habits === 'object') {
    for (const [id, raw] of Object.entries(input.habits).slice(0, 500)) {
      if (!raw || typeof raw !== 'object') continue;
      const value = raw.value;
      if (typeof value === 'boolean' || typeof value === 'number' || Array.isArray(value)) {
        const normalizedValue: HabitEntry['value'] = Array.isArray(value)
          ? value.slice(0, 50).map((v) => Math.max(0, finiteNumber(v)))
          : value;
        const rawNote = 'note' in raw ? raw.note : undefined;
        habits[id.slice(0, 100)] = { value: normalizedValue, note: typeof rawNote === 'string' ? rawNote.slice(0, 500) : undefined };
      }
    }
  }
  return {
    ...defaults,
    ...input,
    schemaVersion: defaults.schemaVersion,
    date,
    notePath,
    mood: Math.min(5, Math.max(1, finiteNumber(input.mood, defaults.mood))),
    energy: Math.min(5, Math.max(1, finiteNumber(input.energy, defaults.energy))),
    sleepHours: Math.min(24, Math.max(0, finiteNumber(input.sleepHours))),
    restMinutes: Math.min(1440, Math.max(0, finiteNumber(input.restMinutes))),
    weightKg: input.weightKg === undefined ? undefined : Math.max(0, finiteNumber(input.weightKg)),
    prayers: safeArray<unknown>(input.prayers, 50).map(normalizePrayer).filter((v): v is PrayerEntry => Boolean(v)),
    habits,
    exercises: safeArray<unknown>(input.exercises, 500).map(normalizeExercise).filter((v): v is ExerciseEntry => Boolean(v)),
    meals: safeArray<unknown>(input.meals, 500).map(normalizeMeal).filter((v): v is MealEntry => Boolean(v)),
    studySessions: safeArray<unknown>(input.studySessions, 500).map(normalizeStudy).filter((v): v is StudySession => Boolean(v)),
    studyPlan: safeArray<unknown>(input.studyPlan, 500).map(normalizeStudyPlan).filter((v): v is StudyPlanItem => Boolean(v)),
    timeline: safeArray<unknown>(input.timeline, 500).map(normalizeTimeline).filter((v): v is TimelineEntry => Boolean(v)),
    tasksPlanned: safeArray<string>(input.tasksPlanned, 500).filter((v) => typeof v === 'string').map((v) => v.slice(0, 500)),
    tasksCompleted: safeArray<string>(input.tasksCompleted, 500).filter((v) => typeof v === 'string').map((v) => v.slice(0, 500)),
    optionalTasks: safeArray<string>(input.optionalTasks, 500).filter((v) => typeof v === 'string').map((v) => v.slice(0, 500)),
    richTasks: safeArray(input.richTasks, 500),
    richStudyPlans: safeArray(input.richStudyPlans, 500),
    reflection: safeString(input.reflection).slice(0, 20000),
    updatedAt: typeof input.updatedAt === 'string' ? input.updatedAt : defaults.updatedAt
  };
}
