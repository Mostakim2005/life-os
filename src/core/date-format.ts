/**
 * Formats a Date as DD-MM-YYYY (Date-Month-Year) by default.
 */
export function formatDateDMY(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

export function todayDMY(): string {
  return formatDateDMY(new Date());
}

/**
 * Parses either DD-MM-YYYY (new canonical format) or legacy YYYY-MM-DD into a local Date.
 */
export function parseAnyDateKey(key: string): Date | null {
  const clean = String(key || "").trim();
  const dmy = /^(\d{2})-(\d{2})-(\d{4})$/.exec(clean);
  if (dmy) {
    return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
  }
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(clean);
  if (ymd) {
    return new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
  }
  return null;
}

export function toDMYKey(key: string): string | null {
  const d = parseAnyDateKey(key);
  return d ? formatDateDMY(d) : null;
}

export function toISOKey(key: string): string | null {
  const d = parseAnyDateKey(key);
  if (!d) return null;
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}
