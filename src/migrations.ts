import { App, TFile } from 'obsidian';
import { LifeOSSettings } from './types';
import { RichTask } from './integrations';
import { loadRecord, saveRecord } from './storage';
import { importMarkdownTasks } from './integrations';
import { normalizeDailyRecord, validateRecord } from './schema';

async function backupBeforeMigration(app: App, settings: LifeOSSettings, file: TFile): Promise<void> {
  const root = `${settings.dashboardNoteFolder.replace(/\/+$/, '')}/Migration Backups`;
  const parts = root.split('/').filter(Boolean);
  let current = '';
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    if (!app.vault.getAbstractFileByPath(current)) await app.vault.createFolder(current);
  }
  const backupPath = `${root}/${file.basename}.backup.md`;
  if (!app.vault.getAbstractFileByPath(backupPath)) await app.vault.create(backupPath, await app.vault.read(file));
}

export interface MigrationResult {
  scanned: number;
  migrated: number;
  importedTasks: number;
  normalized: number;
  skipped: number;
  warnings: string[];
}

/**
 * Safe, linear-time migration pass. Task import is performed once and grouped
 * by source note instead of rescanning the whole vault for every daily note.
 */
export async function migrateLegacyDailyNotes(app: App, settings: LifeOSSettings, createBackups = true): Promise<MigrationResult> {
  const result: MigrationResult = { scanned: 0, migrated: 0, importedTasks: 0, normalized: 0, skipped: 0, warnings: [] };
  const root = settings.dailyNotesFolder.replace(/\/+$/, '') + '/';
  const importedByPath = new Map<string, RichTask[]>();
  try {
    const tasks = await importMarkdownTasks(app);
    for (const task of tasks) {
      if (!task.sourcePath?.startsWith(root)) continue;
      const list = importedByPath.get(task.sourcePath) ?? [];
      list.push(task);
      importedByPath.set(task.sourcePath, list);
    }
  } catch (error) {
    result.warnings.push(`Task import skipped: ${error instanceof Error ? error.message : String(error)}`);
  }

  for (const file of app.vault.getMarkdownFiles()) {
    if (!file.path.startsWith(root) || !/^\d{4}-\d{2}-\d{2}\.md$/.test(file.name)) continue;
    result.scanned++;
    try {
      const date = file.basename;
      const loaded = await loadRecord(app, date, settings);
      if (!loaded) { result.skipped++; continue; }
      const record = normalizeDailyRecord(loaded, date, settings);
      const warnings = validateRecord(record);
      result.warnings.push(...warnings.map((warning) => `${file.path}: ${warning}`));
      const imported = importedByPath.get(file.path) ?? [];
      if (!record.richTasks?.length && imported.length) {
        record.richTasks = imported;
        result.importedTasks += imported.length;
      }
      const needsNormalization = loaded.schemaVersion !== record.schemaVersion;
      if (needsNormalization || imported.length > 0) {
        if (createBackups) await backupBeforeMigration(app, settings, file);
        await saveRecord(app, record, settings);
        if (needsNormalization) result.normalized++;
        if (imported.length > 0) result.migrated++;
      }
    } catch (error) {
      result.skipped++;
      result.warnings.push(`${file.path}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return result;
}
