import type { LifeOSSettings } from "./types";

export const DEFAULT_SETTINGS: LifeOSSettings = {
  dailyNotesFolder: "Life OS",
  dateFormat: "DD-MM-YYYY",
  prayerEnabled: true,
  prayer: {
    latitude: 24.8835,
    longitude: 90.7279,
    method: "Karachi",
    madhab: "hanafi",
    adjustments: { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 },
  },
  sleepTracking: true,
  waterTracking: true,
  exerciseTracking: true,
  studyTracking: true,
  taskTracking: true,
  habitTracking: true,
  emitDataviewInlineFields: true,
  emitTasksEmojiSyntax: true,
  emitDayPlannerBlocks: true,
  glassmorphism: true,
};
