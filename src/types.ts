export type PrayerMethodKey = "Karachi" | "MuslimWorldLeague" | "NorthAmerica" | "Egyptian" | "UmmAlQura" | "MoonsightingCommittee";

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
  prayerEnabled: boolean;
  prayer: PrayerSettings;
  sleepTracking: boolean;
  waterTracking: boolean;
  exerciseTracking: boolean;
  studyTracking: boolean;
  taskTracking: boolean;
  habitTracking: boolean;
  emitDataviewInlineFields: boolean;
  emitTasksEmojiSyntax: boolean;
  emitDayPlannerBlocks: boolean;
  glassmorphism: boolean;
}

export interface DailyRecord {
  dateKey: string; // DD-MM-YYYY
  isoDate: string; // YYYY-MM-DD
  prayer?: Record<string, string>;
  sleep?: number;
  water?: number;
  habits?: Record<string, boolean | number>;
}
