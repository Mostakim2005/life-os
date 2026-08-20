import { App, TFile } from 'obsidian';
import { DailyRecord, LifeOSSettings } from './types';
import { dailyPath, loadRecord } from './storage';

type CacheEntry = { mtime: number; size: number; loadedAt: number; record: DailyRecord };

const recordCache = new Map<string, CacheEntry>();
const dateCache = new Map<string, { expiresAt: number; dates: string[] }>();

function folderKey(settings: LifeOSSettings): string {
  return settings.dailyNotesFolder.replace(/\/+$/, '');
}

function cacheKey(settings: LifeOSSettings, date: string): string {
  return `${folderKey(settings)}::${date}`;
}

export function invalidateLifeOSCache(path?: string): void {
  if (!path) {
    recordCache.clear();
    dateCache.clear();
    return;
  }
  for (const key of recordCache.keys()) if (key.endsWith(`::${path.split('/').pop()?.replace(/\.md$/, '') ?? ''}`)) recordCache.delete(key);
  for (const key of dateCache.keys()) if (path.startsWith(key + '/')) dateCache.delete(key);
}

export async function loadRecordCached(app: App, date: string, settings: LifeOSSettings): Promise<DailyRecord | null> {
  if (!settings.performance.cacheEnabled) return loadRecord(app, date, settings);
  const file = app.vault.getAbstractFileByPath(dailyPath(settings, date));
  if (!(file instanceof TFile)) return null;
  const key = cacheKey(settings, date);
  const now = Date.now();
  const hit = recordCache.get(key);
  const ttl = Math.max(1, settings.performance.cacheTtlMinutes) * 60_000;
  if (hit && hit.mtime === file.stat.mtime && hit.size === file.stat.size && now - hit.loadedAt <= ttl) return hit.record;
  const record = await loadRecord(app, date, settings);
  if (!record) return null;
  recordCache.set(key, { mtime: file.stat.mtime, size: file.stat.size, loadedAt: now, record });
  trimCache(Math.max(50, settings.performance.maxCachedDays));
  return record;
}

function trimCache(maxEntries: number): void {
  while (recordCache.size > maxEntries) {
    const oldest = recordCache.keys().next().value;
    if (!oldest) break;
    recordCache.delete(oldest);
  }
}

export function listCachedDailyDates(app: App, settings: LifeOSSettings, from: string, to: string): string[] {
  const root = folderKey(settings);
  const now = Date.now();
  const hit = dateCache.get(root);
  if (!hit || hit.expiresAt <= now) {
    const dates = app.vault.getMarkdownFiles()
      .filter((file: TFile) => file.path.startsWith(`${root}/`) && /^\d{4}-\d{2}-\d{2}\.md$/.test(file.name))
      .map((file: TFile) => file.basename)
      .sort();
    dateCache.set(root, { dates, expiresAt: now + Math.max(1, settings.performance.cacheTtlMinutes) * 60_000 });
    return dates.filter((date: string) => date >= from && date <= to);
  }
  return hit.dates.filter((date) => date >= from && date <= to);
}

export async function collectRecordsCached(app: App, settings: LifeOSSettings, dates: string[]): Promise<DailyRecord[]> {
  const result: DailyRecord[] = [];
  const batchSize = 4;
  for (let i = 0; i < dates.length; i += batchSize) {
    const batch = dates.slice(i, i + batchSize);
    const records = await Promise.all(batch.map((date) => loadRecordCached(app, date, settings)));
    for (const record of records) if (record) result.push(record);
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
  }
  return result;
}

export function invalidateDateIndex(settings: LifeOSSettings): void {
  dateCache.delete(folderKey(settings));
}
