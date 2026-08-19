export type PrayerCalculationMethod = 'karachi' | 'mwl' | 'isna' | 'egyptian' | 'tehran' | 'jafari';
export type AsrMadhab = 'shafii' | 'hanafi';

const METHODS: Record<PrayerCalculationMethod, { fajr: number; isha: number }> = {
  karachi: { fajr: 18, isha: 18 },
  mwl: { fajr: 18, isha: 17 },
  isna: { fajr: 15, isha: 15 },
  egyptian: { fajr: 19.5, isha: 17.5 },
  tehran: { fajr: 17.7, isha: 14 },
  jafari: { fajr: 16, isha: 14 }
};

export interface PrayerCalculationOptions {
  latitude: number;
  longitude: number;
  date: string;
  timezone?: number;
  method?: PrayerCalculationMethod;
  madhab?: AsrMadhab;
  minuteAdjustment?: number;
}

export function calculatePrayerTimes(options: PrayerCalculationOptions): Record<string, string> {
  const method = METHODS[options.method ?? 'karachi'];
  const tz = options.timezone ?? -new Date(`${options.date}T12:00:00`).getTimezoneOffset() / 60;
  const jd = julianDay(options.date);
  const solar = solarPosition(jd);
  const noon = 12 + tz - options.longitude / 15 - solar.eqTime / 60;
  const times: Record<string, number> = {};
  times.Fajr = noon - hourAngle(options.latitude, solar.declination, method.fajr) / 15;
  times.Sunrise = noon - hourAngle(options.latitude, solar.declination, 0.833) / 15;
  times.Dhuhr = noon;
  times.Asr = noon + asrHourAngle(options.latitude, solar.declination, options.madhab === 'hanafi' ? 2 : 1) / 15;
  times.Sunset = noon + hourAngle(options.latitude, solar.declination, 0.833) / 15;
  times.Maghrib = times.Sunset;
  times.Isha = noon + hourAngle(options.latitude, solar.declination, method.isha) / 15;
  const adjust = options.minuteAdjustment ?? 0;
  return Object.fromEntries(['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Sunset', 'Maghrib', 'Isha'].map((name) => [name, toTime((times[name] ?? noon) + adjust / 60)]));
}

function julianDay(date: string): number { const d = new Date(`${date}T12:00:00Z`); return d.getTime() / 86400000 + 2440587.5; }
function solarPosition(jd: number): { declination: number; eqTime: number } {
  const d = jd - 2451545.0;
  const g = normalize(357.529 + 0.98560028 * d);
  const q = normalize(280.459 + 0.98564736 * d);
  const L = normalize(q + 1.915 * sind(g) + 0.020 * sind(2 * g));
  const e = 23.439 - 0.00000036 * d;
  const ra = atan2d(cosd(e) * sind(L), cosd(L)) / 15;
  const decl = asind(sind(e) * sind(L));
  const eq = 4 * (normalize(q / 15 - ra));
  return { declination: decl, eqTime: eq > 720 ? eq - 1440 : eq };
}
function hourAngle(lat: number, decl: number, angle: number): number { const cosH = (cosd(90 - angle) - sind(lat) * sind(decl)) / (cosd(lat) * cosd(decl)); return acosd(cosH); }
function asrHourAngle(lat: number, decl: number, factor: number): number { const altitude = -acotd(factor + tand(Math.abs(lat - decl))); return hourAngle(lat, decl, altitude); }
function toTime(hours: number): string { let h = ((hours % 24) + 24) % 24; let mins = Math.round(h * 60); if (mins >= 1440) mins -= 1440; return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`; }
function normalize(x: number): number { return ((x % 360) + 360) % 360; }
function sind(x: number): number { return Math.sin(x * Math.PI / 180); }
function cosd(x: number): number { return Math.cos(x * Math.PI / 180); }
function tand(x: number): number { return Math.tan(x * Math.PI / 180); }
function asind(x: number): number { return Math.asin(Math.max(-1, Math.min(1, x))) * 180 / Math.PI; }
function acosd(x: number): number { return Math.acos(Math.max(-1, Math.min(1, x))) * 180 / Math.PI; }
function atan2d(y: number, x: number): number { return Math.atan2(y, x) * 180 / Math.PI; }
function acotd(x: number): number { return 90 - Math.atan(x) * 180 / Math.PI; }
