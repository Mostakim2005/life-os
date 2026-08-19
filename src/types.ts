export type TrackerType = 'boolean' | 'count' | 'duration' | 'quantity' | 'points' | 'subtasks';
export type PrayerStatus = 'completed' | 'late' | 'missed' | 'not-tracked';
export type StudySessionType = 'study' | 'revision' | 'practice' | 'lecture' | 'reading' | 'exam' | 'assignment' | 'other';
export type RecurrenceType = 'once' | 'daily' | 'weekly' | 'interval';
export type PlanningRuleKind = 'habit' | 'task' | 'study' | 'exercise' | 'rest' | 'other';
export type GoalMetric = 'manual' | 'task-completion' | 'habit-consistency' | 'study-minutes' | 'exercise-minutes' | 'prayer-completion';
export type GoalStatus = 'active' | 'paused' | 'completed';
export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type PrayerCalculationMethod = 'karachi' | 'mwl' | 'isna' | 'egyptian' | 'tehran' | 'jafari';
export type AsrMadhab = 'shafii' | 'hanafi';

export interface HabitSchedule {
  recurrence: RecurrenceType;
  daysOfWeek?: number[];
  intervalDays?: number;
  startTime?: string;
  endTime?: string;
  optional?: boolean;
  anchorDate?: string;
}

export interface HabitDefinition {
  id: string;
  name: string;
  icon: string;
  type: TrackerType;
  target?: number;
  unit?: string;
  points?: number;
  subtasks?: string[];
  enabled: boolean;
  schedule?: HabitSchedule;
  description?: string;
}

export interface HabitEntry {
  value: boolean | number | number[];
  note?: string;
}

export interface PrayerEntry {
  name: string;
  time: string;
  status: PrayerStatus;
  reason?: string;
}

export interface ExerciseEntry {
  name: string;
  category: string;
  durationMin: number;
  sets?: number;
  reps?: number;
  loadKg?: number;
  distanceKm?: number;
  intensity?: number;
  muscleGroup?: string;
  note?: string;
}


export interface MealEntry {
  meal: string;
  food: string;
  category: 'muscle' | 'stamina' | 'health' | 'budget' | 'general';
  estimatedProteinG?: number;
  estimatedCalories?: number;
  estimatedCarbsG?: number;
  estimatedFatG?: number;
  estimatedFiberG?: number;
  servings?: number;
}


export interface StudySession {
  id: string;
  subject: string;
  topic: string;
  durationMin: number;
  plannedDurationMin?: number;
  type: StudySessionType;
  completed: boolean;
  focus?: number;
  note?: string;
}

export interface StudyPlanItem {
  id: string;
  subject: string;
  topic: string;
  start?: string;
  end?: string;
  targetMinutes: number;
  optional: boolean;
  completed: boolean;
  priority?: Priority;
  goalId?: string;
  deadline?: string;
}

export interface TimelineEntry {
  id: string;
  title: string;
  start: string;
  end: string;
  type: 'task' | 'habit' | 'exercise' | 'meal' | 'prayer' | 'study' | 'rest' | 'other';
  planned: boolean;
  actual: boolean;
  note?: string;
}


export interface PlanningRule {
  id: string;
  name: string;
  kind: PlanningRuleKind;
  recurrence: RecurrenceType;
  daysOfWeek?: number[];
  intervalDays?: number;
  startDate?: string;
  endDate?: string;
  startTime: string;
  endTime: string;
  optional: boolean;
  enabled: boolean;
  anchorDate?: string;
  habitId?: string;
  subject?: string;
  topic?: string;
}


export interface Goal {
  id: string;
  title: string;
  description?: string;
  category?: string;
  priority: Priority;
  status: GoalStatus;
  metric: GoalMetric;
  target: number;
  current: number;
  unit?: string;
  deadline?: string;
  weeklyTarget?: number;
  estimatedMinutesPerWeek?: number;
  protectedTime?: boolean;
}

export interface AdaptivePlanSuggestion {
  date: string;
  start: string;
  end: string;
  title: string;
  reason: string;
  priority: Priority;
  score: number;
}

export interface PlanningConflict {
  date: string;
  incoming: TimelineEntry | PlanningRule;
  existing: TimelineEntry | PlanningRule;
  overlapMinutes: number;
  severity: 'warning' | 'error';
  message: string;
}

export interface DailyRecord {
  schemaVersion?: number;
  date: string;
  mood: number;
  energy: number;
  sleepHours: number;
  restMinutes: number;
  weightKg?: number;
  prayers: PrayerEntry[];
  habits: Record<string, HabitEntry>;
  exercises: ExerciseEntry[];
  meals: MealEntry[];
  studySessions: StudySession[];
  studyPlan: StudyPlanItem[];
  timeline: TimelineEntry[];
  tasksPlanned: string[];
  tasksCompleted: string[];
  optionalTasks: string[];
  richTasks?: import('./integrations').RichTask[];
  richStudyPlans?: import('./integrations').RichStudyPlan[];
  reflection: string;
  notePath: string;
  updatedAt: string;
}

export interface PrayerCalculationSettings {
  enabled: boolean;
  latitude: number;
  longitude: number;
  timezone?: number;
  method: PrayerCalculationMethod;
  madhab: AsrMadhab;
  minuteAdjustment: number;
}

export interface PlanningPreferences {
  intelligentScheduling: boolean;
  showFreeTime: boolean;
  showConflictSuggestions: boolean;
  enableDragUnscheduled: boolean;
  enableAdaptiveRescheduling: boolean;
  goalAwareScheduling: boolean;
  showPlanningBadges: boolean;
  slotMinutes: number;
  quietHoursStart: string;
  quietHoursEnd: string;
}

export interface PerformanceSettings {
  cacheEnabled: boolean;
  cacheTtlMinutes: number;
  maxCachedDays: number;
  analyticsLookbackDays: number;
  lazyRenderAnalytics: boolean;
}

export interface LifeOSSettings {
  schemaVersion?: number;
  dailyNotesFolder: string;
  dashboardNoteFolder: string;
  defaultPrayerTimes: Record<string, string>;
  habits: HabitDefinition[];
  goals: Goal[];
  enabledFoodPresetCategories: string[];
  defaultStudySubjects: string[];
  planningRules: PlanningRule[];
  planningOverrides: Record<string, { date?: string; start?: string; end?: string; suppressed?: boolean }>;
  planningPreferences: PlanningPreferences;
  prayerCalculation: PrayerCalculationSettings;
  integrations: { tasks: boolean; dataview: boolean; templater: boolean; autoImportTasks: boolean };
  reportFolder: string;
  performance: PerformanceSettings;
  migration: { createBackups: boolean };
}

export interface LifeOSStats {
  from: string;
  to: string;
  daysWithRecords: number;
  taskPlanned: number;
  taskCompleted: number;
  taskCompletionPct: number;
  optionalTasks: number;
  habitCompletionPct: number;
  habitDaysTracked: number;
  prayerCompleted: number;
  prayerLate: number;
  prayerMissed: number;
  prayerTracked: number;
  prayerCompletionPct: number;
  studyMinutes: number;
  studyPlannedMinutes: number;
  studySessions: number;
  studyCompletedSessions: number;
  studyPlanCompletionPct: number;
  exerciseSessions: number;
  exerciseMinutes: number;
  bookedMinutes: number;
  actualMinutes: number;
  plannedActualPct: number;
  averageSleepHours: number;
  averageMood: number;
  averageEnergy: number;
  daysTracked: number;
  monthCount: number;
  yearCount: number;
  habitBreakdown: Record<string, { completedDays: number; trackedDays: number; pct: number }>;
  subjectBreakdown: Record<string, { minutes: number; sessions: number }>;
  nutrition?: { meals: number; servings: number; calories: number; proteinG: number; carbsG: number; fatG: number; fiberG: number };
  exerciseBreakdown?: Record<string, { minutes: number; sessions: number; volumeKg: number }>;
}

