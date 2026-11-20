import { CalculationMethod, Coordinates, HighLatitudeRule, Madhab, PrayerTimes, type CalculationParameters } from "adhan";
import type { PrayerMethodKey, PrayerSettings } from "../types";
import { parseAnyDateKey } from "./date-format";

export interface PrayerTimetable {
  Fajr: string;
  Sunrise: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
}

function fmtHHMM(date: Date): string {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function resolveMethod(key: PrayerMethodKey): CalculationParameters {
  switch (key) {
    case "MuslimWorldLeague": return CalculationMethod.MuslimWorldLeague();
    case "NorthAmerica": return CalculationMethod.NorthAmerica();
    case "Egyptian": return CalculationMethod.Egyptian();
    case "UmmAlQura": return CalculationMethod.UmmAlQura();
    case "MoonsightingCommittee": return CalculationMethod.MoonsightingCommittee();
    case "Karachi":
    default:
      return CalculationMethod.Karachi();
  }
}

export function computePrayerTimesWithAdhan(dateKey: string, cfg: PrayerSettings): PrayerTimetable {
  const date = parseAnyDateKey(dateKey) ?? new Date();
  const coords = new Coordinates(Number(cfg.latitude) || 24.8835, Number(cfg.longitude) || 90.7279);
  const params = resolveMethod(cfg.method || "Karachi");
  params.madhab = cfg.madhab === "shafi" ? Madhab.Shafi : Madhab.Hanafi;
  params.highLatitudeRule = HighLatitudeRule.recommended(coords);

  if (cfg.adjustments) {
    params.adjustments.fajr = Number(cfg.adjustments.fajr) || 0;
    params.adjustments.sunrise = Number(cfg.adjustments.sunrise) || 0;
    params.adjustments.dhuhr = Number(cfg.adjustments.dhuhr) || 0;
    params.adjustments.asr = Number(cfg.adjustments.asr) || 0;
    params.adjustments.maghrib = Number(cfg.adjustments.maghrib) || 0;
    params.adjustments.isha = Number(cfg.adjustments.isha) || 0;
  }

  const pt = new PrayerTimes(coords, date, params);
  return {
    Fajr: fmtHHMM(pt.fajr),
    Sunrise: fmtHHMM(pt.sunrise),
    Dhuhr: fmtHHMM(pt.dhuhr),
    Asr: fmtHHMM(pt.asr),
    Maghrib: fmtHHMM(pt.maghrib),
    Isha: fmtHHMM(pt.isha),
  };
}
