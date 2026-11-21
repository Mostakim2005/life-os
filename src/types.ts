export type PrayerMethodKey =
  | "Karachi"
  | "MuslimWorldLeague"
  | "NorthAmerica"
  | "Egyptian"
  | "UmmAlQura"
  | "MoonsightingCommittee";

export type StorageMode = "inline-only" | "inline-and-frontmatter";
export type WaterUnit = "glasses" | "bottle";
export type PrayerName = "Fajr" | "Dhuhr" | "Asr" | "Maghrib" | "Isha";
export type PrayerStatus = "" | "prayed" | "jamaah" | "late" | "missed";
export type TaskPriority = "high" | "medium" | "low" | "none";

export interface PrayerSettings {
  latitude: number;
  longitude: number;
  method: PrayerMethodKey;
  madhab: "hanafi" | "shafi";
  adjustments: Record<"fajr" | "sunrise" | "dhuhr" | "asr" | "maghrib" | "isha", number>;
}

export interface LifeOSSettings {
  dailyNotesFolder: string;
  dateFormat: "DD-MM-YYYY" | "YYYY-MM-DD";
  storageMode: StorageMode;
  autoPinCockpitTab: boolean;
  prayerEnabled: boolean;
  prayer: PrayerSettings;
  sleepTracking: boolean;
  sleepTargetHours: number;
  waterTracking: boolean;
  waterUnit: WaterUnit;
  glassVolumeLiters: number;
  bottleVolumeLiters: number;
  waterTargetLiters: number;
  exerciseTracking: boolean;
  studyTracking: boolean;
  taskTracking: boolean;
  habitTracking: boolean;
  customHabits: string[];
  emitDataviewInlineFields: boolean;
  emitTasksEmojiSyntax: boolean;
  emitDayPlannerBlocks: boolean;
  glassmorphism: boolean;
}

export interface PrayerEntry {
  name: PrayerName;
  time: string;
  status: PrayerStatus;
  done: boolean;
}

export interface HabitItem {
  name: string;
  done: boolean;
}

export interface TaskItem {
  id: string;
  title: string;
  done: boolean;
  priority: TaskPriority;
  dueDateIso?: string;
  doneDateIso?: string;
  recurrence?: string;
}

export interface TimelineBlock {
  id: string;
  startTime: string;
  endTime: string;
  title: string;
  done: boolean;
}

export interface ParsedDailyNote {
  dateKey: string; // DD-MM-YYYY
  isoDate: string; // YYYY-MM-DD
  sleepHours: number | null; // Strictly null or [1.0, 10.0] in 0.5 steps
  waterMode: WaterUnit;
  waterGlasses: number; // Strictly integer [0, 10]
  waterBottles: number; // Strictly [0, 5.0] in 0.5 steps
  waterLiters: number;
  prayers: PrayerEntry[];
  habits: HabitItem[];
  tasks: TaskItem[];
  timeline: TimelineBlock[];
  journal: string;
  reflection: string;
}

export interface DailyRecord {
  dateKey: string; // DD-MM-YYYY
  isoDate: string; // YYYY-MM-DD
  prayer?: Record<string, string>;
  sleep?: number;
  water?: number;
  waterLiters?: number;
  habits?: Record<string, boolean | number>;
}
