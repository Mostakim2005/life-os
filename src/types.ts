// Life OS
export interface LifeOSSettings {
  dailyNotesFolder: string;
  prayerEnabled: boolean;
  sleepTracking: boolean;
  waterTracking: boolean;
  exerciseTracking: boolean;
  studyTracking: boolean;
  taskTracking: boolean;
  habitTracking: boolean;
}

export interface DailyRecord {
  date: string;
  prayer?: Record<string, unknown>;
  sleep?: Record<string, unknown>;
  water?: number;
  exercise?: Record<string, unknown>;
  study?: Record<string, unknown>;
  habits?: Record<string, unknown>;
}

