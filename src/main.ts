import { ItemView, Notice, Plugin, PluginSettingTab, Setting, TAbstractFile, TFile, WorkspaceLeaf } from 'obsidian';
import { calculateStats, collectRecords, lastNDays, calculateYearlyStats, monthlyTrendPoints } from './analytics';
import { DEFAULT_HABITS, EXERCISE_PRESETS, FOOD_PRESETS } from './presets';
import { DailyRecord, HabitDefinition, HabitEntry, LifeOSSettings, PrayerStatus, StudySessionType, TimelineEntry } from './types';
import { buildMonthlyReview, buildWeeklyReview, getMonthRange, getWeekRange } from './review';
import { DEFAULT_SETTINGS, ensureFolder, loadRecord, makeEmptyRecord, saveRecord, serializeRecord } from './storage';
import { niceLabel } from './charting';
import { renderHabitBuilder } from './habit-builder';
import { generatedEntries, getConflicts, overrideKey } from './planning';
import { adaptiveSuggestions, allEntriesForDate, freeWindows, getUnscheduledItems, suggestSlots, goalAwareAdaptiveSuggestions } from './scheduling';
import { createGoal, deleteGoal, goalProgressPct, goalSummary, metricLabel, priorityWeight, refreshAutoGoals } from './goals';
import { calculatePrayerTimes } from './prayer-times';
import { buildReport, saveReport, ReportFormat, ReportPeriod } from './reporting';
import { buildIntegrationSnapshot, dataviewProperties, importMarkdownTasks, templaterTemplate } from './integrations';
import { calculateDeepAnalytics } from './deep-analytics';
import { invalidateDateIndex, invalidateLifeOSCache } from './performance';
import { migrateSettings } from './schema';
import { lifeOSDataviewQuery, lifeOSDataviewSummaryQuery, lifeOSTemplaterTemplate, tasksMetadataGuide } from './integration-helpers';
import { migrateLegacyDailyNotes } from './migrations';
import { LIFE_OS_CSS } from './styles';
import { editExercise, editMeal } from './editor-modals';

const VIEW_TYPE = 'life-os-dashboard';
type LifeOSTab = 'daily' | 'planner' | 'reviews' | 'stats' | 'habits' | 'goals' | 'reports';

function todayISO(): string {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export class LifeOSPlugin extends Plugin {
  settings: LifeOSSettings = DEFAULT_SETTINGS;

  async onload(): Promise<void> {
    const migration = migrateSettings(await this.loadData());
    this.settings = migration.settings;
    if (migration.audit.changed) await this.saveData(this.settings);
    const dailyRoot = this.settings.dailyNotesFolder.replace(/\/+$/, '') + '/';
    this.registerEvent(this.app.vault.on('modify', (file: TAbstractFile) => { if (file instanceof TFile && file.path.startsWith(dailyRoot)) invalidateLifeOSCache(file.path); }));
    this.registerEvent(this.app.vault.on('create', (file: TAbstractFile) => { if (file instanceof TFile && file.path.startsWith(dailyRoot)) { invalidateDateIndex(this.settings); invalidateLifeOSCache(file.path); } }));
    this.registerEvent(this.app.vault.on('delete', (file: TAbstractFile) => { if (file instanceof TFile && file.path.startsWith(dailyRoot)) { invalidateDateIndex(this.settings); invalidateLifeOSCache(file.path); } }));
    this.registerView(VIEW_TYPE, (leaf: WorkspaceLeaf) => new LifeOSView(leaf, this));
    this.addRibbonIcon('heart-pulse', 'Open Life OS', () => void this.activateView());
    this.addCommand({ id: 'open-dashboard', name: 'Open Life OS dashboard', callback: () => void this.activateView() });
    this.addCommand({ id: 'create-daily-note', name: "Create/open today's life note", callback: () => void this.openDaily(todayISO()) });
    this.addCommand({ id: 'open-planner', name: 'Open Life OS visual planner', callback: () => void this.activateView('planner') });
    this.addCommand({ id: 'open-weekly-review', name: 'Open Life OS weekly review', callback: () => void this.activateView('reviews') });
    this.addCommand({ id: 'open-statistics', name: 'Open Life OS statistics', callback: () => void this.activateView('stats') });
    this.addCommand({ id: 'open-habit-builder', name: 'Open Life OS habit builder', callback: () => void this.activateView('habits') });
    this.addCommand({ id: 'open-goals', name: 'Open Life OS goals', callback: () => void this.activateView('goals') });
    this.addCommand({ id: 'export-today-json', name: 'Export today as JSON', callback: () => void this.exportDate(todayISO(), 'json') });
    this.addCommand({ id: 'export-today-markdown', name: 'Export today as Markdown', callback: () => void this.exportDate(todayISO(), 'md') });
    (['day', 'week', 'month'] as ReportPeriod[]).forEach((period) => {
      (['md', 'json', 'csv'] as ReportFormat[]).forEach((format) => {
        this.addCommand({ id: `export-${period}-${format}`, name: `Export ${period} Life OS report as ${format.toUpperCase()}`, callback: () => void this.exportReport(todayISO(), period, format) });
      });
    });
    this.addCommand({ id: 'calculate-prayer-times', name: 'Calculate today prayer times', callback: () => void this.applyPrayerTimes(todayISO(), true) });
    this.addCommand({ id: 'import-markdown-tasks', name: 'Import Markdown/Tasks into Life OS', callback: () => void this.importTasksIntoDay(todayISO()) });
    this.addCommand({ id: 'create-templater-template', name: 'Create Life OS Templater template', callback: () => void this.createTemplaterTemplate() });
    this.addCommand({ id: 'migrate-life-os-data', name: 'Migrate/import Life OS legacy data', callback: () => void this.migrateData() });
    this.addCommand({ id: 'life-os-copy-dataview-query', name: 'Copy Dataview Life OS query', callback: () => this.settings.integrations.dataview ? copyText(lifeOSDataviewQuery(), 'Dataview query copied') : Promise.resolve(new Notice('Dataview integration is disabled in settings.')) });
    this.addCommand({ id: 'life-os-copy-dataview-summary-query', name: 'Copy Dataview Life OS summary query', callback: () => this.settings.integrations.dataview ? copyText(lifeOSDataviewSummaryQuery(), 'Dataview summary query copied') : Promise.resolve(new Notice('Dataview integration is disabled in settings.')) });
    this.addCommand({ id: 'life-os-copy-templater-template', name: 'Copy Life OS Templater template', callback: () => this.settings.integrations.templater ? copyText(lifeOSTemplaterTemplate(), 'Templater template copied') : Promise.resolve(new Notice('Templater integration is disabled in settings.')) });
    this.addCommand({ id: 'life-os-copy-task-metadata-guide', name: 'Copy Life OS task metadata guide', callback: () => copyText(tasksMetadataGuide(), 'Task metadata guide copied') });
    this.addSettingTab(new LifeOSSettingTab(this.app, this));
  }

  async activateView(tab: LifeOSTab = 'daily'): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE);
    if (existing.length) {
      const leaf = existing[0];
      if (!leaf) return;
      this.app.workspace.revealLeaf(leaf);
      const view = leaf.view as LifeOSView;
      view.activeTab = tab;
      await view.render();
      return;
    }
    const leaf = this.app.workspace.getLeaf('tab');
    await leaf.setViewState({ type: VIEW_TYPE, active: true });
    this.app.workspace.revealLeaf(leaf);
    const view = leaf.view as LifeOSView;
    view.activeTab = tab;
    await view.render();
  }

  async openDaily(date: string): Promise<void> {
    const record = (await loadRecord(this.app, date, this.settings)) ?? makeEmptyRecord(date, this.settings);
    const file = await saveRecord(this.app, record, this.settings);
    await this.app.workspace.getLeaf('tab').openFile(file);
  }

  async exportReport(anchorDate: string, period: ReportPeriod, format: ReportFormat): Promise<void> {
    const report = await buildReport(this.app, this.settings, anchorDate, period);
    const path = await saveReport(this.app, this.settings, report, format);
    new Notice(`Exported ${period} report → ${path}`);
  }

  async applyPrayerTimes(date: string, notify = false): Promise<void> {
    const record = (await loadRecord(this.app, date, this.settings)) ?? makeEmptyRecord(date, this.settings);
    if (!this.settings.prayerCalculation.enabled) return;
    const result = calculatePrayerTimes({
      date, latitude: this.settings.prayerCalculation.latitude, longitude: this.settings.prayerCalculation.longitude,
      timezone: this.settings.prayerCalculation.timezone, method: this.settings.prayerCalculation.method,
      madhab: this.settings.prayerCalculation.madhab, minuteAdjustment: this.settings.prayerCalculation.minuteAdjustment
    });
    record.prayers = record.prayers.map((prayer) => ({ ...prayer, time: result[prayer.name] ?? prayer.time }));
    await saveRecord(this.app, record, this.settings);
    if (notify) new Notice(`Prayer times calculated for ${date}`);
  }

  async importTasksIntoDay(date: string): Promise<void> {
    if (!this.settings.integrations.tasks) { new Notice('Tasks integration is disabled in Life OS settings.'); return; }
    const record = (await loadRecord(this.app, date, this.settings)) ?? makeEmptyRecord(date, this.settings);
    const tasks = await importMarkdownTasks(this.app);
    record.richTasks = tasks;
    for (const task of tasks) if (!record.tasksPlanned.includes(task.title)) record.tasksPlanned.push(task.title);
    record.tasksCompleted = tasks.filter((task) => task.completed).map((task) => task.title);
    await saveRecord(this.app, record, this.settings);
    new Notice(`Imported ${tasks.length} Markdown/Tasks items into ${date}`);
  }

  async createTemplaterTemplate(): Promise<void> {
    if (!this.settings.integrations.templater) { new Notice('Templater integration is disabled in Life OS settings.'); return; }
    const folder = `${this.settings.dashboardNoteFolder.replace(/\/+$/, '')}/Templates`;
    await ensureFolder(this.app.vault, folder);
    const path = `${folder}/Life OS Daily.md`;
    const existing = this.app.vault.getAbstractFileByPath(path);
    const content = templaterTemplate();
    if (existing instanceof TFile) await this.app.vault.modify(existing, content); else await this.app.vault.create(path, content);
    new Notice(`Template ready → ${path}`);
  }

  async migrateData(): Promise<void> {
    const result = await migrateLegacyDailyNotes(this.app, this.settings, this.settings.migration.createBackups);
    new Notice(`Migration scanned ${result.scanned} notes, imported ${result.importedTasks} tasks and skipped ${result.skipped}${result.warnings.length ? ` · ${result.warnings.length} warnings` : ''}.`);
  }

  async exportDate(date: string, kind: 'json' | 'md'): Promise<void> {
    const record = (await loadRecord(this.app, date, this.settings)) ?? makeEmptyRecord(date, this.settings);
    const base = `${this.settings.dashboardNoteFolder.replace(/\/+$/, '')}/exports`;
    const path = `${base}/${record.date}.${kind}`;
    await ensureFolder(this.app.vault, base);
    const payload = kind === 'json' ? JSON.stringify(record, null, 2) : serializeRecord(record);
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) await this.app.vault.modify(existing, payload);
    else await this.app.vault.create(path, payload);
    new Notice(`Life OS exported ${kind.toUpperCase()} → ${path}`);
  }

  async saveReview(period: 'week' | 'month', date = todayISO()): Promise<void> {
    const range = period === 'week' ? getWeekRange(date) : getMonthRange(date);
    const base = `${this.settings.dashboardNoteFolder.replace(/\/+$/, '')}/reviews`;
    await ensureFolder(this.app.vault, base);
    const filename = period === 'week' ? `${range.from}-weekly-review.md` : `${range.from.slice(0, 7)}-monthly-review.md`;
    const path = `${base}/${filename}`;
    const content = period === 'week'
      ? await buildWeeklyReview(this.app, this.settings, range.from, range.to)
      : await buildMonthlyReview(this.app, this.settings, range.from, range.to);
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) await this.app.vault.modify(existing, content);
    else await this.app.vault.create(path, content);
    new Notice(`Saved ${period} review → ${path}`);
  }
}

class LifeOSView extends ItemView {
  plugin: LifeOSPlugin;
  selectedDate = todayISO();
  record!: DailyRecord;
  activeTab: LifeOSTab = 'daily';

  constructor(leaf: WorkspaceLeaf, plugin: LifeOSPlugin) { super(leaf); this.plugin = plugin; }
  getViewType(): string { return VIEW_TYPE; }
  getDisplayText(): string { return 'Life OS'; }
  getIcon(): string { return 'heart-pulse'; }
  async onOpen(): Promise<void> { await this.render(); }

  async render(): Promise<void> {
    this.record = (await loadRecord(this.app, this.selectedDate, this.plugin.settings)) ?? makeEmptyRecord(this.selectedDate, this.plugin.settings);
    if (this.plugin.settings.prayerCalculation.enabled) {
      const calculated = calculatePrayerTimes({ date: this.selectedDate, latitude: this.plugin.settings.prayerCalculation.latitude, longitude: this.plugin.settings.prayerCalculation.longitude, timezone: this.plugin.settings.prayerCalculation.timezone, method: this.plugin.settings.prayerCalculation.method, madhab: this.plugin.settings.prayerCalculation.madhab, minuteAdjustment: this.plugin.settings.prayerCalculation.minuteAdjustment });
      this.record.prayers = this.record.prayers.map((prayer) => ({ ...prayer, time: calculated[prayer.name] ?? prayer.time }));
    }
    const root = this.containerEl;
    root.empty();
    root.addClass('life-os-root');
    this.injectStyles();

    const header = root.createDiv({ cls: 'life-os-header' });
    const title = header.createDiv();
    title.createEl('h1', { text: 'Life OS' });
    title.createDiv({ text: 'Plan your day. Track reality. Understand your patterns.', cls: 'life-os-subtitle' });

    const nav = header.createDiv({ cls: 'life-os-tabs' }); nav.setAttr('role', 'tablist');
    (['daily', 'planner', 'reviews', 'stats', 'habits', 'goals', 'reports'] as LifeOSTab[]).forEach((tab) => {
      const labels: Record<LifeOSTab, string> = { daily: 'Daily', planner: 'Planner', reviews: 'Reviews', stats: 'Statistics', habits: 'Habits', goals: 'Goals', reports: 'Reports' };
      const button = nav.createEl('button', { text: labels[tab] });
      button.setAttr('role', 'tab');
      button.setAttr('aria-selected', this.activeTab === tab ? 'true' : 'false');
      button.setAttr('aria-label', labels[tab]);
      button.toggleClass('is-active', this.activeTab === tab);
      button.onclick = async () => { this.activeTab = tab; await this.render(); };
    });

    if (this.activeTab === 'planner') { await this.renderPlanner(root); return; }
    if (this.activeTab === 'reviews') { await this.renderReviews(root); return; }
    if (this.activeTab === 'stats') { await this.renderStatistics(root); return; }
    if (this.activeTab === 'habits') { renderHabitBuilder(root, this.plugin, async () => { await this.render(); }); return; }
    if (this.activeTab === 'goals') { await this.renderGoals(root); return; }
    if (this.activeTab === 'reports') { await this.renderReports(root); return; }

    const controls = header.createDiv({ cls: 'life-os-header-controls' });
    const date = controls.createEl('input', { type: 'date' }) as HTMLInputElement;
    date.value = this.selectedDate;
    date.onchange = async () => { this.selectedDate = date.value; await this.render(); };
    const today = controls.createEl('button', { text: 'Today' });
    today.onclick = async () => { this.selectedDate = todayISO(); await this.render(); };
    const planner = controls.createEl('button', { text: 'Plan week' });
    planner.onclick = async () => { this.activeTab = 'planner'; await this.render(); };
    const open = controls.createEl('button', { text: 'Open note' });
    open.onclick = () => void this.plugin.openDaily(this.selectedDate);
    const save = controls.createEl('button', { text: 'Save' });
    save.onclick = () => void this.persist(true);

    this.renderKpis(root);
    const grid = root.createDiv({ cls: 'life-os-grid' });
    this.renderPrayers(grid);
    this.renderStudy(grid);
    this.renderHabits(grid);
    this.renderExercise(grid);
    this.renderFood(grid);
    this.renderTimeline(grid);
    this.renderCalendar(grid);
    this.renderRichTaskPlanner(grid);
    this.renderReflection(grid);
  }

  renderKpis(root: HTMLElement): void {
    const row = root.createDiv({ cls: 'life-os-kpis' });
    const habits = this.plugin.settings.habits.filter((habit) => habit.enabled);
    const habitDone = habits.filter((habit) => habitDoneForRecord(habit, this.record.habits[habit.id])).length;
    const prayerDone = this.record.prayers.filter((p) => p.status === 'completed').length;
    const bookedMinutes = this.record.timeline.reduce((sum, item) => sum + diffMinutes(item.start, item.end), 0);
    const taskDone = this.record.tasksCompleted.filter((task) => this.record.tasksPlanned.includes(task)).length;
    const studyMinutes = this.record.studySessions.reduce((sum, s) => sum + s.durationMin, 0);
    const values: [string, string][] = [
      ['Sleep', `${this.record.sleepHours.toFixed(1)}h`],
      ['Habits', `${habitDone}/${habits.length}`],
      ['Prayer', `${prayerDone}/${this.record.prayers.length}`],
      ['Study', `${studyMinutes}m`],
      ['Tasks', `${taskDone}/${this.record.tasksPlanned.length}`],
      ['Booked', `${Math.round(bookedMinutes / 60)}h / 24h`]
    ];
    values.forEach(([label, value]) => {
      const card = row.createDiv({ cls: 'life-os-kpi' });
      card.createDiv({ text: label, cls: 'life-os-kpi-label' });
      card.createDiv({ text: value, cls: 'life-os-kpi-value' });
    });
  }

  renderPrayers(parent: HTMLElement): void {
    const section = this.section(parent, '🕌 Prayer');
    section.createDiv({ text: 'Times can be changed per day. Late/missed prayers can carry a reason for later review.', cls: 'life-os-help' });
    this.record.prayers.forEach((prayer) => {
      const row = section.createDiv({ cls: 'life-os-row' });
      row.createDiv({ text: prayer.name, cls: 'life-os-row-title' });
      const time = row.createEl('input', { type: 'time' }) as HTMLInputElement;
      time.value = prayer.time;
      time.onchange = async () => { prayer.time = time.value; await this.persist(false); };
      const select = row.createEl('select') as HTMLSelectElement;
      (['not-tracked', 'completed', 'late', 'missed'] as PrayerStatus[]).forEach((status) => select.add(new Option(status.replace('-', ' '), status)));
      select.value = prayer.status;
      select.onchange = async () => {
        prayer.status = select.value as PrayerStatus;
        if (prayer.status === 'late' || prayer.status === 'missed') prayer.reason = window.prompt('Why was it late/missed?', prayer.reason ?? '') || undefined;
        else prayer.reason = undefined;
        await this.persist(true);
        await this.render();
      };
      const reason = row.createSpan({ text: prayer.reason ? `Reason: ${prayer.reason}` : '', cls: 'life-os-reason' });
      reason.title = prayer.reason ?? '';
    });
    const add = section.createEl('button', { text: '＋ Add prayer / spiritual event' });
    add.onclick = async () => { const name = window.prompt('Name:'); if (!name) return; const time = window.prompt('Time (HH:MM):', '12:00') || '12:00'; this.record.prayers.push({ name, time, status: 'not-tracked' }); await this.persist(false); await this.render(); };
  }

  renderStudy(parent: HTMLElement): void {
    const section = this.section(parent, '📚 Study planner & tracker');
    section.createDiv({ text: 'Track subject/topic, study type, actual minutes and planned study blocks.', cls: 'life-os-help' });
    const controls = section.createDiv({ cls: 'life-os-inline-form' });
    const subject = controls.createEl('select');
    this.plugin.settings.defaultStudySubjects.forEach((value) => subject.add(new Option(value, value)));
    subject.add(new Option('Custom subject…', '__custom__'));
    const topic = controls.createEl('input'); topic.placeholder = 'Topic / chapter';
    const minutes = controls.createEl('input', { type: 'number' }) as HTMLInputElement; minutes.min = '1'; minutes.value = '60';
    const type = controls.createEl('select');
    (['study', 'revision', 'practice', 'lecture', 'reading', 'exam', 'assignment', 'other'] as StudySessionType[]).forEach((value) => type.add(new Option(value, value)));
    const add = controls.createEl('button', { text: 'Log study' });
    add.onclick = async () => {
      if (subject.value === '__custom__') { const custom = window.prompt('Subject name:'); if (!custom) return; subject.value = custom; }
      if (!topic.value.trim()) { new Notice('Enter a study topic.'); return; }
      const value = Number(minutes.value) || 0;
      if (value <= 0) return;
      this.record.studySessions.push({ id: crypto.randomUUID(), subject: subject.value, topic: topic.value.trim(), durationMin: value, type: type.value as StudySessionType, completed: true });
      const old = Number(this.record.habits.study?.value) || 0;
      this.record.habits.study = { value: old + value };
      topic.value = '';
      await this.persist(true);
      await this.render();
    };

    const planControls = section.createDiv({ cls: 'life-os-inline-form' });
    const planSubject = planControls.createEl('input'); planSubject.placeholder = 'Plan subject';
    const planTopic = planControls.createEl('input'); planTopic.placeholder = 'Plan topic';
    const planMinutes = planControls.createEl('input', { type: 'number' }) as HTMLInputElement; planMinutes.value = '60'; planMinutes.min = '1';
    const planStart = planControls.createEl('input', { type: 'time' }) as HTMLInputElement; planStart.value = '19:00';
    const planEnd = planControls.createEl('input', { type: 'time' }) as HTMLInputElement; planEnd.value = '20:00';
    const priority = planControls.createEl('select'); ['low','medium','high','critical'].forEach((v) => priority.add(new Option(v, v))); priority.value = 'medium';
    const goal = planControls.createEl('select'); goal.add(new Option('No goal', '')); this.plugin.settings.goals.filter((g) => g.status === 'active').forEach((g) => goal.add(new Option(g.title, g.id)));
    const optional = planControls.createEl('label'); const opt = optional.createEl('input', { type: 'checkbox' }) as HTMLInputElement; optional.appendText(' optional');
    const plan = planControls.createEl('button', { text: '＋ Add study plan' });
    plan.onclick = async () => {
      if (!planSubject.value.trim() || !planTopic.value.trim()) { new Notice('Enter subject and topic.'); return; }
      const targetMinutes = Number(planMinutes.value) || 0;
      if (!targetMinutes) return;
      this.record.studyPlan.push({ id: crypto.randomUUID(), subject: planSubject.value.trim(), topic: planTopic.value.trim(), start: planStart.value, end: planEnd.value, targetMinutes, optional: opt.checked, completed: false });
      this.record.timeline.push({ id: crypto.randomUUID(), title: `Planned study: ${planSubject.value.trim()} — ${planTopic.value.trim()}`, start: planStart.value, end: planEnd.value, type: 'study', planned: true, actual: false });
      await this.persist(true);
      await this.render();
    };

    this.record.studySessions.forEach((session, index) => {
      const row = section.createDiv({ cls: 'life-os-row' });
      row.createDiv({ text: `${session.subject} · ${session.topic}`, cls: 'life-os-row-title' });
      row.createSpan({ text: `${session.durationMin} min · ${session.type}` });
      const done = row.createEl('input', { type: 'checkbox' }) as HTMLInputElement; done.checked = session.completed; done.title = 'Completed';
      done.onchange = async () => { session.completed = done.checked; await this.persist(false); };
      const del = row.createEl('button', { text: '×' });
      del.onclick = async () => { this.record.studySessions.splice(index, 1); await this.persist(true); await this.render(); };
    });

    if (this.record.studyPlan.length) {
      section.createDiv({ text: 'Planned study', cls: 'life-os-subheading' });
      this.record.studyPlan.forEach((item, index) => {
        const row = section.createDiv({ cls: 'life-os-row' });
        row.createDiv({ text: `${item.subject} · ${item.topic}`, cls: 'life-os-row-title' });
        row.createSpan({ text: `${item.targetMinutes} min${item.start ? ` · ${item.start}-${item.end}` : ''}${item.optional ? ' · optional' : ''}` });
        const done = row.createEl('input', { type: 'checkbox' }) as HTMLInputElement; done.checked = item.completed;
        done.onchange = async () => { item.completed = done.checked; await this.persist(false); };
        const del = row.createEl('button', { text: '×' });
        del.onclick = async () => { this.record.studyPlan.splice(index, 1); await this.persist(true); await this.render(); };
      });
    }
  }

  renderHabits(parent: HTMLElement): void {
    const section = this.section(parent, '✅ Habits');
    section.createDiv({ text: 'Different habits can use different measurement styles.', cls: 'life-os-help' });
    this.plugin.settings.habits.filter((habit) => habit.enabled).forEach((habit) => {
      const row = section.createDiv({ cls: 'life-os-row' });
      row.createDiv({ text: `${habit.icon} ${habit.name}`, cls: 'life-os-row-title' });
      const current = this.record.habits[habit.id] ?? defaultHabitEntry(habit);
      if (habit.type === 'boolean') {
        const input = row.createEl('input', { type: 'checkbox' }) as HTMLInputElement; input.checked = Boolean(current.value);
        input.onchange = async () => { current.value = input.checked; this.record.habits[habit.id] = current; await this.persist(false); };
      } else if (habit.type === 'subtasks') {
        const wrap = row.createDiv({ cls: 'life-os-subtasks' });
        const vals = Array.isArray(current.value) ? current.value : [];
        (habit.subtasks ?? []).forEach((name, i) => {
          const label = wrap.createEl('label');
          const input = label.createEl('input', { type: 'checkbox' }) as HTMLInputElement; input.checked = Number(vals[i]) === 1;
          input.onchange = async () => { const next = (Array.isArray(current.value) ? [...current.value] : []).map(Number); while (next.length < (habit.subtasks ?? []).length) next.push(0); next[i] = input.checked ? 1 : 0; current.value = next; this.record.habits[habit.id] = current; await this.persist(false); };
          label.appendText(name);
        });
      } else {
        const input = row.createEl('input', { type: 'number' }) as HTMLInputElement;
        input.min = '0'; input.step = '0.1'; input.value = String(typeof current.value === 'number' ? current.value : 0);
        input.onchange = async () => { current.value = Number(input.value) || 0; this.record.habits[habit.id] = current; await this.persist(false); };
        if (habit.target !== undefined) row.createSpan({ text: ` / ${habit.target} ${habit.unit ?? ''}` });
      }
    });
  }

  renderExercise(parent: HTMLElement): void {
    const section = this.section(parent, '🏋️ Exercise');
    const select = section.createEl('select');
    select.add(new Option('Add preset exercise…', ''));
    EXERCISE_PRESETS.forEach((exercise) => select.add(new Option(`${exercise.name} · ${exercise.category}`, exercise.name)));
    select.onchange = async () => {
      const preset = EXERCISE_PRESETS.find((exercise) => exercise.name === select.value);
      if (!preset) return;
      this.record.exercises.push({ ...preset });
      this.record.habits.exercise = { value: (Number(this.record.habits.exercise?.value) || 0) + preset.durationMin };
      await this.persist(true);
      await this.render();
    };
    this.record.exercises.forEach((exercise, index) => {
      const row = section.createDiv({ cls: 'life-os-row' }); row.createDiv({ text: `${exercise.name} · ${exercise.durationMin} min`, cls: 'life-os-row-title' }); row.createSpan({ text: exercise.category });
      const edit = row.createEl('button', { text: 'Edit' }); edit.setAttr('aria-label', `Edit ${exercise.name}`); edit.onclick = async () => { const updated = await editExercise(this.app, exercise); if (!updated) return; this.record.exercises[index] = updated; await this.persist(true); await this.render(); };
      const del = row.createEl('button', { text: '×' }); del.setAttr('aria-label', `Delete ${exercise.name}`); del.onclick = async () => { this.record.exercises.splice(index, 1); await this.persist(true); await this.render(); };
    });
  }

  renderFood(parent: HTMLElement): void {
    const section = this.section(parent, '🍲 Food');
    const select = section.createEl('select');
    select.add(new Option('Add affordable Bangladesh-friendly food…', ''));
    FOOD_PRESETS.filter((food) => this.plugin.settings.enabledFoodPresetCategories.includes(food.category)).forEach((food) => select.add(new Option(`${food.name} · ${food.category}`, food.name)));
    select.onchange = async () => {
      const preset = FOOD_PRESETS.find((food) => food.name === select.value);
      if (!preset) return;
      const meal = window.prompt('Meal (Breakfast/Lunch/Dinner/Snack):', 'Meal') || 'Meal';
      const servings = Number(window.prompt('Servings:', '1')) || 1;
      this.record.meals.push({
        meal,
        food: preset.name,
        category: preset.category,
        estimatedProteinG: preset.proteinGPer100g ? Number((preset.proteinGPer100g * servings).toFixed(1)) : undefined,
        estimatedCalories: preset.caloriesPer100g ? Number((preset.caloriesPer100g * servings).toFixed(0)) : undefined,
        estimatedCarbsG: preset.carbsGPer100g ? Number((preset.carbsGPer100g * servings).toFixed(1)) : undefined,
        estimatedFatG: preset.fatGPer100g ? Number((preset.fatGPer100g * servings).toFixed(1)) : undefined,
        estimatedFiberG: preset.fiberGPer100g ? Number((preset.fiberGPer100g * servings).toFixed(1)) : undefined,
        servings
      });
      await this.persist(true);
      await this.render();
    };
    this.record.meals.forEach((meal, index) => {
      const row = section.createDiv({ cls: 'life-os-row' }); row.createDiv({ text: `${meal.meal}: ${meal.food}`, cls: 'life-os-row-title' }); row.createSpan({ text: `${meal.category}${meal.servings ? ` · ${meal.servings} serving(s)` : ''}` });
      const edit = row.createEl('button', { text: 'Edit' }); edit.setAttr('aria-label', `Edit ${meal.food}`); edit.onclick = async () => { const updated = await editMeal(this.app, meal); if (!updated) return; this.record.meals[index] = updated; await this.persist(true); await this.render(); };
      const del = row.createEl('button', { text: '×' }); del.setAttr('aria-label', `Delete ${meal.food}`); del.onclick = async () => { this.record.meals.splice(index, 1); await this.persist(true); await this.render(); };
    });
  }

  renderTimeline(parent: HTMLElement): void {
    const section = this.section(parent, '🕒 24-hour timeline');
    section.createDiv({ text: 'Book time for study, tasks, habits, rest, exercise and other plans. Planned and actual states remain separate.', cls: 'life-os-help' });
    const add = section.createEl('button', { text: '＋ Book time' });
    add.onclick = async () => { await this.addTimelineItem(this.selectedDate); };
    const bar = section.createDiv({ cls: 'life-os-timeline' });
    const scale = bar.createDiv({ cls: 'life-os-timeline-scale' });
    for (let hour = 0; hour < 24; hour++) scale.createDiv({ cls: 'life-os-timeline-hour', text: `${String(hour).padStart(2, '0')}` });
    const blocks = bar.createDiv({ cls: 'life-os-timeline-blocks' });
    this.record.timeline.forEach((item) => this.createTimelineBlock(blocks, item));
    [...this.record.timeline].sort((a, b) => a.start.localeCompare(b.start)).forEach((item) => {
      const row = section.createDiv({ cls: 'life-os-row' });
      row.createDiv({ text: `${item.start}-${item.end}`, cls: 'life-os-time' });
      row.createDiv({ text: item.title, cls: 'life-os-row-title' });
      row.createSpan({ text: `${item.type} · ${item.planned ? 'planned' : 'unplanned'}` });
      const actual = row.createEl('input', { type: 'checkbox' }) as HTMLInputElement; actual.checked = item.actual; actual.title = 'Actual/completed';
      actual.onchange = async () => { item.actual = actual.checked; await this.persist(false); await this.render(); };
      const edit = row.createEl('button', { text: 'Edit' }); edit.onclick = async () => { await this.editTimelineItem(item); };
      const del = row.createEl('button', { text: '×' }); del.onclick = async () => { this.record.timeline = this.record.timeline.filter((entry) => entry.id !== item.id); await this.persist(true); await this.render(); };
    });
  }

  createTimelineBlock(parent: HTMLElement, item: TimelineEntry): void {
    const start = timeToMinutes(item.start);
    const duration = diffMinutes(item.start, item.end);
    const block = parent.createDiv({ cls: `life-os-time-block ${item.actual ? 'is-actual' : 'is-planned'}` });
    block.style.left = `${Math.min(start / 1440, 1) * 100}%`;
    block.style.width = `${Math.max(1, Math.min(duration / 1440, 1) * 100)}%`;
    block.textContent = item.title;
    block.title = `${item.start}-${item.end} · ${item.type} · ${item.actual ? 'actual' : 'planned'}`;
    block.onclick = () => void this.editTimelineItem(item);
  }

  async addTimelineItem(date: string): Promise<void> {
    const title = window.prompt(`Plan for ${date}:`);
    if (!title) return;
    const start = window.prompt('Start (HH:MM):', '09:00') || '09:00';
    const end = window.prompt('End (HH:MM):', '10:00') || '10:00';
    const type = window.prompt('Type: task / habit / study / exercise / meal / prayer / rest / other', 'task') || 'other';
    const safeType = ['task', 'habit', 'study', 'exercise', 'meal', 'prayer', 'rest', 'other'].includes(type) ? type : 'other';
    const record = date === this.selectedDate ? this.record : ((await loadRecord(this.app, date, this.plugin.settings)) ?? makeEmptyRecord(date, this.plugin.settings));
    const candidate = { id: 'candidate', title, start, end, type: safeType as TimelineEntry['type'], planned: true, actual: false };
    const conflicts = getConflicts([...record.timeline, candidate]).filter((conflict) => conflict.incoming.id === 'candidate' || conflict.existing.id === 'candidate');
    const firstConflict = conflicts[0];
    if (firstConflict && !window.confirm(`${firstConflict.message}\n\nAdd it anyway?`)) return;
    record.timeline.push({ ...candidate, id: crypto.randomUUID() });
    await saveRecord(this.app, record, this.plugin.settings);
    if (date !== this.selectedDate) new Notice(`Planned ${title} on ${date}`);
    await this.render();
  }

  async editTimelineItem(item: TimelineEntry): Promise<void> {
    const title = window.prompt('Title:', item.title); if (!title) return;
    const start = window.prompt('Start (HH:MM):', item.start) || item.start;
    const end = window.prompt('End (HH:MM):', item.end) || item.end;
    item.title = title; item.start = start; item.end = end;
    await this.persist(true); await this.render();
  }

  renderCalendar(parent: HTMLElement): void {
    const section = this.section(parent, '📅 Activity calendar');
    section.createDiv({ text: 'Habit activity, planned work and completed work are shown as separate markers.', cls: 'life-os-help' });
    const monthInput = section.createEl('input', { type: 'month' }) as HTMLInputElement;
    monthInput.value = this.selectedDate.slice(0, 7);
    monthInput.onchange = () => this.renderCalendarGrid(section, monthInput.value);
    this.renderCalendarGrid(section, monthInput.value);
  }

  private renderCalendarGrid(section: HTMLElement, month: string): void {
    section.querySelector('.life-os-calendar-grid')?.remove();
    const grid = section.createDiv({ cls: 'life-os-calendar-grid' });
    const parts = month.split('-').map(Number);
    const year = parts[0];
    const mon = parts[1];
    if (year === undefined || mon === undefined || !Number.isFinite(year) || !Number.isFinite(mon)) return;
    const first = new Date(year, mon - 1, 1).getDay();
    const days = new Date(year, mon, 0).getDate();
    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach((day) => grid.createDiv({ text: day, cls: 'life-os-calendar-head' }));
    for (let i = 0; i < first; i++) grid.createDiv({ cls: 'life-os-calendar-empty' });
    for (let d = 1; d <= days; d++) {
      const date = `${year}-${String(mon).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const cell = grid.createEl('button', { text: String(d), cls: 'life-os-calendar-day' });
      if (date === this.selectedDate) cell.addClass('is-selected');
      cell.onclick = async () => { this.selectedDate = date; await this.render(); };
      void loadRecord(this.app, date, this.plugin.settings).then((record) => {
        if (!record) return;
        if (Object.values(record.habits).some((entry) => habitEntryHasActivity(entry))) cell.addClass('has-habit');
        if (record.tasksPlanned.length || record.studyPlan.length || record.timeline.some((item) => item.planned)) cell.addClass('has-plan');
        if (record.tasksCompleted.length || record.studySessions.some((s) => s.completed) || record.timeline.some((item) => item.actual)) cell.addClass('has-complete');
      });
    }
  }

  async renderPlanner(root: HTMLElement): Promise<void> {
    const range = getWeekRange(this.selectedDate);
    const toolbar = root.createDiv({ cls: 'life-os-planner-toolbar' });
    const title = toolbar.createDiv();
    title.createEl('h2', { text: `Weekly Planner · ${range.from} → ${range.to}` });
    title.createDiv({ text: 'Plan visually, discover free time, resolve conflicts, and drop unscheduled work directly onto the week.', cls: 'life-os-help' });
    const controls = toolbar.createDiv({ cls: 'life-os-actions' });
    const prev = controls.createEl('button', { text: '← Previous week' }); prev.onclick = async () => { this.selectedDate = shiftDate(this.selectedDate, -7); await this.render(); };
    const today = controls.createEl('button', { text: 'This week' }); today.onclick = async () => { this.selectedDate = todayISO(); await this.render(); };
    const next = controls.createEl('button', { text: 'Next week →' }); next.onclick = async () => { this.selectedDate = shiftDate(this.selectedDate, 7); await this.render(); };
    const add = controls.createEl('button', { text: '＋ Plan time' }); add.onclick = async () => { await this.addTimelineItem(this.selectedDate); };


    this.currentWeekRecords = {};
    for (let i = 0; i < 7; i++) {
      const date = shiftDate(range.from, i);
      this.currentWeekRecords[date] = (await loadRecord(this.app, date, this.plugin.settings)) ?? makeEmptyRecord(date, this.plugin.settings);
    }

    const intelligence = root.createDiv({ cls: 'life-os-smart-panel' });
    const smartHead = intelligence.createDiv({ cls: 'life-os-smart-panel-head' });
    smartHead.createDiv({ text: '✨ Intelligent planning', cls: 'life-os-section-title' });
    smartHead.createDiv({ text: this.plugin.settings.planningPreferences.intelligentScheduling ? 'On' : 'Off', cls: 'life-os-smart-status' });
    if (!this.plugin.settings.planningPreferences.intelligentScheduling) {
      intelligence.createDiv({ text: 'Smart scheduling is disabled. Enable it in Life OS settings.', cls: 'life-os-help' });
    } else {
      const weekRecords = this.currentWeekRecords;
      const unscheduled = Object.entries(weekRecords).flatMap(([date, record]) => getUnscheduledItems(record).map((item) => ({ ...item, title: `${item.title}`, sourceIndex: item.sourceIndex, id: `${date}|${item.id}` })));
      const totalFree = Object.values(weekRecords).reduce((sum, record) => sum + freeWindows(allEntriesForDate(this.plugin.settings, record, record.date), 30).reduce((a, b) => a + b.minutes, 0), 0);
      const summary = intelligence.createDiv({ cls: 'life-os-smart-summary' });
      summary.createDiv({ text: `${unscheduled.length} unscheduled item${unscheduled.length === 1 ? '' : 's'}` });
      summary.createDiv({ text: `${Math.round(totalFree / 60)}h ${totalFree % 60}m free across the week` });
      if (this.plugin.settings.planningPreferences.enableAdaptiveRescheduling) {
        const best = weekRecords[range.from];
        if (best) {
          const free = freeWindows(allEntriesForDate(this.plugin.settings, best, range.from), 30);
          const firstFree = free[0];
          if (firstFree) summary.createDiv({ text: `Next open window: ${firstFree.start}–${firstFree.end} on ${formatDay(range.from)}` });
        }
      }
    }

    const priorities = root.createDiv({ cls: 'life-os-smart-panel' });
    priorities.createDiv({ text: '🎯 Priority-aware planning', cls: 'life-os-section-title' });
    const activeGoals = this.plugin.settings.goals.filter((goal) => goal.status === 'active').sort((a, b) => priorityWeight(b.priority) - priorityWeight(a.priority));
    if (!activeGoals.length) priorities.createDiv({ text: 'Create goals to make adaptive scheduling priority-aware.', cls: 'life-os-help' });
    activeGoals.slice(0, 5).forEach((goal) => {
      const row = priorities.createDiv({ cls: 'life-os-priority-row' });
      row.createDiv({ text: `${goal.priority.toUpperCase()} · ${goal.title}`, cls: 'life-os-row-title' });
      row.createSpan({ text: `${goalProgressPct(goal)}%`, cls: 'life-os-help' });
      if (goal.deadline) row.createSpan({ text: `due ${goal.deadline}`, cls: 'life-os-help' });
    });

    if (this.plugin.settings.planningPreferences.enableDragUnscheduled) {
      this.renderUnscheduledTray(root, range.from);
    }
    if (this.plugin.settings.planningPreferences.showFreeTime) {
      const freePanel = root.createDiv({ cls: 'life-os-free-time-panel' });
      freePanel.createDiv({ text: 'Free time by day', cls: 'life-os-section-title' });
      for (let i = 0; i < 7; i++) {
        const date = shiftDate(range.from, i);
        const record = (this.currentWeekRecords?.[date]) ?? makeEmptyRecord(date, this.plugin.settings);
        const total = freeWindows(allEntriesForDate(this.plugin.settings, record, date), 30).reduce((sum, w) => sum + w.minutes, 0);
        const pill = freePanel.createDiv({ cls: 'life-os-free-pill' });
        pill.createDiv({ text: `${formatDay(date)} ${date.slice(5)}` });
        pill.createDiv({ text: `${Math.floor(total / 60)}h ${total % 60}m`, cls: 'life-os-free-value' });
      }
    }

    const exceptionPanel = root.createDiv({ cls: 'life-os-exceptions-panel' });
    const exceptionHead = exceptionPanel.createDiv({ cls: 'life-os-smart-panel-head' });
    exceptionHead.createDiv({ text: '↪ Recurring-plan exceptions', cls: 'life-os-section-title' });
    const exceptionEntries = Object.entries(this.plugin.settings.planningOverrides);
    exceptionHead.createDiv({ text: String(exceptionEntries.length), cls: 'life-os-count-badge' });
    if (!exceptionEntries.length) exceptionPanel.createDiv({ text: 'No one-off changes yet. Moving a recurring block creates an exception instead of changing the original schedule.', cls: 'life-os-help' });
    exceptionEntries.slice(0, 12).forEach(([key, override]) => {
      const row = exceptionPanel.createDiv({ cls: 'life-os-exception-row' });
      row.createDiv({ text: key });
      row.createDiv({ text: override.suppressed ? 'suppressed' : `${override.date ?? 'same day'} ${override.start ?? ''}–${override.end ?? ''}`, cls: 'life-os-help' });
      const reset = row.createEl('button', { text: 'Reset' });
      reset.onclick = async () => { delete this.plugin.settings.planningOverrides[key]; await this.plugin.saveData(this.plugin.settings); await this.render(); };
    });

    const hint = root.createDiv({ cls: 'life-os-planner-hint' });
    hint.textContent = `Snap: ${this.plugin.settings.planningPreferences.slotMinutes} min. Drag to move, resize from the bottom, or drag an unscheduled task/study item into a free slot. Conflict handling can suggest alternatives.`;

    const grid = root.createDiv({ cls: 'life-os-week-grid life-os-week-grid-interactive' });
    for (let hour = 0; hour < 24; hour++) {
      const label = grid.createDiv({ cls: 'life-os-week-hour', text: `${String(hour).padStart(2, '0')}:00` });
      label.style.gridRow = String(hour + 2); label.style.gridColumn = '1';
    }
    for (let day = 0; day < 7; day++) {
      const date = shiftDate(range.from, day);
      const column = grid.createDiv({ cls: 'life-os-week-day' });
      column.dataset.date = date;
      column.style.gridColumn = String(day + 2); column.style.gridRow = '1 / span 25';
      const head = column.createDiv({ cls: 'life-os-week-day-head' });
      head.createDiv({ text: formatDay(date) }); head.createDiv({ text: date.slice(5), cls: 'life-os-help' });
      for (let h = 0; h < 24; h++) { const slot = column.createDiv({ cls: 'life-os-week-slot' }); slot.style.top = `${38 + h * 42}px`; }
      column.addEventListener('dragover', (event) => { if (this.plugin.settings.planningPreferences.enableDragUnscheduled) event.preventDefault(); });
      column.addEventListener('drop', (event) => { event.preventDefault(); void this.dropUnscheduledOnPlanner(event, column, date); });
      const generated = generatedEntries(this.plugin.settings, date);
      const dayRecord = this.currentWeekRecords[date];
      const entries = [...(dayRecord?.timeline ?? []), ...generated];
      const conflicts = getConflicts(entries);
      if (conflicts.length && this.plugin.settings.planningPreferences.showPlanningBadges) {
        const badge = column.createDiv({ cls: 'life-os-conflict-badge', text: `⚠ ${conflicts.length} conflict${conflicts.length === 1 ? '' : 's'}` });
        badge.title = conflicts.map((conflict) => conflict.message).join('\n');
      }
      for (const item of entries) this.createPlannerBlock(column, date, item);
      const planButton = column.createEl('button', { text: '+', cls: 'life-os-day-add' });
      planButton.style.top = '6px'; planButton.onclick = async () => { await this.addTimelineItem(date); };
    }
  }

  currentWeekRecords: Record<string, DailyRecord> = {};

  renderUnscheduledTray(root: HTMLElement, weekStart: string): void {
    const tray = root.createDiv({ cls: 'life-os-unscheduled-tray' });
    tray.createDiv({ text: 'Unscheduled work', cls: 'life-os-section-title' });
    tray.createDiv({ text: 'Drag a card into any free time slot. Life OS will find a slot close to the drop point and warn about conflicts.', cls: 'life-os-help' });
    const grid = tray.createDiv({ cls: 'life-os-unscheduled-grid' });
    let count = 0;
    for (let i = 0; i < 7; i++) {
      const date = shiftDate(weekStart, i);
      const record = this.currentWeekRecords[date];
      if (!record) continue;
      for (const item of getUnscheduledItems(record)) {
        count++;
        const card = grid.createDiv({ cls: 'life-os-unscheduled-card' });
        card.draggable = true;
        card.dataset.payload = JSON.stringify({ date, id: item.id });
        card.createDiv({ text: item.type === 'study' ? '📚' : '✅', cls: 'life-os-unscheduled-icon' });
        const body = card.createDiv();
        body.createDiv({ text: item.title, cls: 'life-os-row-title' });
        body.createDiv({ text: `${date.slice(5)} · ${item.durationMin} min${item.optional ? ' · optional' : ''}`, cls: 'life-os-help' });
        card.addEventListener('dragstart', (event) => { event.dataTransfer?.setData('text/life-os-unscheduled', card.dataset.payload ?? ''); card.addClass('is-dragging'); });
        card.addEventListener('dragend', () => card.removeClass('is-dragging'));
      }
    }
    if (!count) tray.createDiv({ text: 'Everything planned — nice. 🎯', cls: 'life-os-empty-state' });
  }

  async dropUnscheduledOnPlanner(event: DragEvent, column: HTMLElement, targetDate: string): Promise<void> {
    const raw = event.dataTransfer?.getData('text/life-os-unscheduled');
    if (!raw) return;
    let payload: { date: string; id: string };
    try { payload = JSON.parse(raw) as { date: string; id: string }; } catch { return; }
    const sourceRecord = (await loadRecord(this.app, payload.date, this.plugin.settings)) ?? makeEmptyRecord(payload.date, this.plugin.settings);
    const item = getUnscheduledItems(sourceRecord).find((entry) => entry.id === payload.id);
    if (!item) return;
    const rect = column.getBoundingClientRect();
    const minutesFromTop = ((event.clientY - rect.top - 38) / 42) * 60;
    const preferredStart = snapMinutes(Math.max(0, Math.min(1440 - item.durationMin, minutesFromTop)), this.plugin.settings.planningPreferences.slotMinutes);
    const targetRecord = (await loadRecord(this.app, targetDate, this.plugin.settings)) ?? makeEmptyRecord(targetDate, this.plugin.settings);
    const entries = allEntriesForDate(this.plugin.settings, targetRecord, targetDate);
    let start = preferredStart;
    let end = Math.min(1440, start + item.durationMin);
    let candidate: TimelineEntry = { id: `planned:${Date.now()}`, title: item.title, start: minutesToTime(start), end: minutesToTime(end), type: item.type, planned: true, actual: false, note: item.subject ? `${item.subject}${item.topic ? ` · ${item.topic}` : ''}` : undefined };
    if (getConflicts([...entries, candidate]).length) {
      if (!this.plugin.settings.planningPreferences.showConflictSuggestions) { new Notice('That time conflicts with another block.'); return; }
      const alternatives = this.plugin.settings.planningPreferences.enableAdaptiveRescheduling
        ? (this.plugin.settings.planningPreferences.goalAwareScheduling ? goalAwareAdaptiveSuggestions(this.plugin.settings, entries, item.durationMin, preferredStart) : adaptiveSuggestions(entries, item.durationMin, preferredStart))
        : suggestSlots(entries, item.durationMin, preferredStart, 15, 5);
      if (!alternatives.length) { new Notice('No conflict-free slot was found that day.'); return; }
      const suggestionPanel = column.closest('.life-os-root')?.createDiv({ cls: 'life-os-conflict-suggestions' });
      suggestionPanel?.createDiv({ text: `No room at ${candidate.start}. Suggested slots:` });
      alternatives.forEach((suggestion) => {
        const button = suggestionPanel?.createEl('button', { text: `${suggestion.start}–${suggestion.end}` });
        button?.addEventListener('click', () => { void this.createUnscheduledEntry(payload.date, payload.id, targetDate, suggestion.start, suggestion.end); });
      });
      new Notice(`Conflict detected. ${alternatives.length} alternative slot${alternatives.length === 1 ? '' : 's'} suggested.`);
      return;
    }
    await this.createUnscheduledEntry(payload.date, payload.id, targetDate, candidate.start, candidate.end);
  }

  async createUnscheduledEntry(sourceDate: string, unscheduledId: string, targetDate: string, start: string, end: string): Promise<void> {
    const sourceRecord = (await loadRecord(this.app, sourceDate, this.plugin.settings)) ?? makeEmptyRecord(sourceDate, this.plugin.settings);
    const item = getUnscheduledItems(sourceRecord).find((entry) => entry.id === unscheduledId);
    if (!item) return;
    const targetRecord = (await loadRecord(this.app, targetDate, this.plugin.settings)) ?? makeEmptyRecord(targetDate, this.plugin.settings);
    const note = item.subject ? `${item.subject}${item.topic ? ` · ${item.topic}` : ''}` : undefined;
    targetRecord.timeline.push({ id: crypto.randomUUID(), title: item.title, start, end, type: item.type, planned: true, actual: false, note });
    if (item.source === 'study') {
      const study = targetRecord.studyPlan.find((plan) => plan.id === (sourceRecord.studyPlan[item.sourceIndex]?.id ?? ''));
      if (study) { study.start = start; study.end = end; }
    }
    await saveRecord(this.app, targetRecord, this.plugin.settings);
    this.selectedDate = targetDate;
    new Notice(`Planned “${item.title}” on ${targetDate} at ${start}.`);
    await this.render();
  }

  createPlannerBlock(column: HTMLElement, date: string, item: TimelineEntry): void {
    const block = column.createDiv({ cls: `life-os-planner-block ${item.actual ? 'is-actual' : 'is-planned'}` });
    block.dataset.id = item.id;
    block.dataset.date = date;
    if (item.id.startsWith('rule:')) block.dataset.rule = 'true';
    const start = timeToMinutes(item.start);
    const duration = diffMinutes(item.start, item.end);
    block.style.top = `${38 + (start / 60) * 42}px`;
    block.style.height = `${Math.max(24, (duration / 60) * 42 - 2)}px`;
    block.createDiv({ text: item.title, cls: 'life-os-planner-block-title' });
    block.createDiv({ text: `${item.start}–${item.end} · ${item.type}`, cls: 'life-os-planner-block-meta' });
    const resize = block.createDiv({ cls: 'life-os-planner-resize' });
    resize.setAttribute('aria-label', 'Resize time block');
    let mode: 'drag' | 'resize' | null = null;
    let pointerStartY = 0;
    let originalStart = start;
    let originalDuration = duration;
    let moved = false;

    const finish = async (event: PointerEvent): Promise<void> => {
      if (!mode) return;
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', finish);
      document.body.classList.remove('life-os-planner-dragging');
      const sourceDate = date;
      const targetNode = document.elementFromPoint(event.clientX, event.clientY);
      const targetEl = targetNode instanceof HTMLElement ? targetNode.closest('.life-os-week-day') as HTMLElement | null : null;
      const targetDate = targetEl?.dataset.date ?? sourceDate;
      const sourceRecord = (await loadRecord(this.app, sourceDate, this.plugin.settings)) ?? makeEmptyRecord(sourceDate, this.plugin.settings);
      const ruleGenerated = item.id.startsWith('rule:');
      const sourceItem = ruleGenerated ? { ...item } : sourceRecord.timeline.find((entry) => entry.id === item.id);
      if (!sourceItem) return;
      let newStart = originalStart; let newEnd = originalStart + originalDuration;
      const targetColumn = targetEl ?? column;
      const rect = targetColumn.getBoundingClientRect();
      if (mode === 'drag') {
        const minutesFromTop = ((event.clientY - rect.top - 38) / 42) * 60;
        newStart = snapMinutes(Math.max(0, Math.min(1439, minutesFromTop)), this.plugin.settings.planningPreferences.slotMinutes);
        newEnd = newStart + originalDuration;
        if (newEnd > 1440) { newEnd = 1440; newStart = Math.max(0, newEnd - originalDuration); }
      } else {
        const minutesFromTop = ((event.clientY - rect.top - 38) / 42) * 60;
        newEnd = snapMinutes(Math.max(originalStart + this.plugin.settings.planningPreferences.slotMinutes, Math.min(1440, minutesFromTop)), this.plugin.settings.planningPreferences.slotMinutes);
        if (newEnd <= originalStart) newEnd = Math.min(1440, originalStart + 15);
      }
      const changed = sourceDate !== targetDate || newStart !== originalStart || newEnd !== originalStart + originalDuration;
      if (changed) {
        sourceItem.start = minutesToTime(newStart); sourceItem.end = minutesToTime(newEnd);
        const conflictRecord = targetDate === sourceDate ? sourceRecord : ((await loadRecord(this.app, targetDate, this.plugin.settings)) ?? makeEmptyRecord(targetDate, this.plugin.settings));
        const candidateEntries = [...conflictRecord.timeline.filter((entry) => entry.id !== item.id), ...generatedEntries(this.plugin.settings, targetDate), sourceItem];
        const conflicts = getConflicts(candidateEntries).filter((conflict) => conflict.incoming.id === sourceItem.id || conflict.existing.id === sourceItem.id);
        if (conflicts.length) {
          const firstConflict = conflicts[0];
          if (!firstConflict) return;
          new Notice(`Planner conflict: ${firstConflict.message}`);
          block.style.top = `${38 + (originalStart / 60) * 42}px`;
          block.style.height = `${Math.max(24, (originalDuration / 60) * 42 - 2)}px`;
          return;
        }
        if (ruleGenerated) {
          const key = overrideKey(item.id.replace(/^rule:/, '').replace(/:\d{4}-\d{2}-\d{2}$/, ''), sourceDate);
          const targetKey = overrideKey(item.id.replace(/^rule:/, '').replace(/:\d{4}-\d{2}-\d{2}$/, ''), targetDate);
          this.plugin.settings.planningOverrides[key] = { date: targetDate, suppressed: targetDate !== sourceDate, start: sourceItem.start, end: sourceItem.end };
          this.plugin.settings.planningOverrides[targetKey] = { date: targetDate, start: sourceItem.start, end: sourceItem.end };
          await this.plugin.saveData(this.plugin.settings);
          this.selectedDate = targetDate;
        } else if (targetDate !== sourceDate) {
          sourceRecord.timeline = sourceRecord.timeline.filter((entry) => entry.id !== item.id);
          const targetRecord = (await loadRecord(this.app, targetDate, this.plugin.settings)) ?? makeEmptyRecord(targetDate, this.plugin.settings);
          targetRecord.timeline.push({ ...sourceItem, id: crypto.randomUUID() });
          await saveRecord(this.app, sourceRecord, this.plugin.settings);
          await saveRecord(this.app, targetRecord, this.plugin.settings);
          this.selectedDate = targetDate;
          new Notice(`Moved “${sourceItem.title}” to ${targetDate}`);
        } else {
          await saveRecord(this.app, sourceRecord, this.plugin.settings);
        }
      }
      if (moved) { await this.render(); }
    };
    const move = (event: PointerEvent): void => {
      if (!mode) return;
      moved = true;
      const delta = event.clientY - pointerStartY;
      if (mode === 'drag') {
        const provisional = snapMinutes(originalStart + (delta / 42) * 60, this.plugin.settings.planningPreferences.slotMinutes);
        block.style.top = `${38 + (provisional / 60) * 42}px`;
      } else {
        const provisional = snapMinutes(originalDuration + (delta / 42) * 60, this.plugin.settings.planningPreferences.slotMinutes);
        block.style.height = `${Math.max(24, (Math.max(15, provisional) / 60) * 42 - 2)}px`;
      }
    };
    const begin = (event: PointerEvent, nextMode: 'drag' | 'resize'): void => {
      if (event.button !== 0) return;
      event.preventDefault(); event.stopPropagation();
      mode = nextMode; pointerStartY = event.clientY; originalStart = timeToMinutes(item.start); originalDuration = diffMinutes(item.start, item.end); moved = false;
      document.body.classList.add('life-os-planner-dragging');
      document.addEventListener('pointermove', move); document.addEventListener('pointerup', finish);
    };
    block.addEventListener('pointerdown', (event) => {
      if ((event.target as HTMLElement).closest('.life-os-planner-resize')) return;
      begin(event, 'drag');
    });
    resize.addEventListener('pointerdown', (event) => begin(event, 'resize'));
    block.ondblclick = async (event) => { event.stopPropagation(); this.selectedDate = date; if (item.id.startsWith('rule:')) { this.activeTab = 'habits'; await this.render(); } else { await this.loadAndEditCrossDayTimeline(date, item.id); } };
    block.onclick = () => { if (!moved) block.classList.add('life-os-planner-block-pulse'); window.setTimeout(() => block.classList.remove('life-os-planner-block-pulse'), 180); };
  }

  async loadAndEditCrossDayTimeline(date: string, id: string): Promise<void> {
    const record = (await loadRecord(this.app, date, this.plugin.settings)) ?? makeEmptyRecord(date, this.plugin.settings);
    const item = record.timeline.find((entry) => entry.id === id);
    if (!item) return;
    const title = window.prompt('Title:', item.title); if (!title) return;
    item.title = title;
    item.start = window.prompt('Start (HH:MM):', item.start) || item.start;
    item.end = window.prompt('End (HH:MM):', item.end) || item.end;
    await saveRecord(this.app, record, this.plugin.settings);
    await this.render();
  }

  async renderReports(root: HTMLElement): Promise<void> {
    const header = root.createDiv({ cls: 'life-os-review-toolbar' });
    header.createEl('h2', { text: '📊 Reports & exports' });
    header.createDiv({ text: 'Printable daily, weekly and monthly reports with food, exercise, study, prayer, tasks, habits, sleep, goals and time-allocation statistics.', cls: 'life-os-help' });
    const controls = header.createDiv({ cls: 'life-os-actions' });
    const period = controls.createEl('select');
    (['day', 'week', 'month'] as ReportPeriod[]).forEach((p) => period.add(new Option(p.charAt(0).toUpperCase() + p.slice(1), p)));
    const format = controls.createEl('select');
    (['md', 'json', 'csv'] as ReportFormat[]).forEach((f) => format.add(new Option(f.toUpperCase(), f)));
    const exportButton = controls.createEl('button', { text: 'Export report' });
    exportButton.onclick = async () => { await this.plugin.exportReport(this.selectedDate, period.value as ReportPeriod, format.value as ReportFormat); };
    const range = root.createDiv({ cls: 'life-os-report-range' });
    const report = await buildReport(this.app, this.plugin.settings, this.selectedDate, 'month');
    const cards = root.createDiv({ cls: 'life-os-kpis' });
    const entries: [string, string][] = [
      ['Food items', String(report.meals.length)],
      ['Protein', `${report.meals.reduce((n, m) => n + m.proteinG, 0).toFixed(0)} g`],
      ['Exercise', `${report.stats.exerciseMinutes} min`],
      ['Study', `${report.stats.studyMinutes} min`],
      ['Prayer', `${report.stats.prayerCompletionPct}%`],
      ['Tasks', `${report.stats.taskCompletionPct}%`]
    ];
    entries.forEach(([label, value]) => { const card = cards.createDiv({ cls: 'life-os-kpi' }); card.createDiv({ text: label, cls: 'life-os-kpi-label' }); card.createDiv({ text: value, cls: 'life-os-kpi-value' }); });
    range.createDiv({ text: `Default preview: ${report.from} → ${report.to}` });
    const integration = root.createDiv({ cls: 'life-os-card' });
    integration.createEl('h3', { text: 'Integrations' });
    const snapshot = report.integrations;
    integration.createDiv({ text: `Tasks plugin: ${snapshot.tasksPluginDetected ? 'detected' : 'not detected'} · Dataview: ${snapshot.dataviewDetected ? 'detected' : 'not detected'} · Templater: ${snapshot.templaterDetected ? 'detected' : 'not detected'}` });
    integration.createDiv({ text: 'Daily notes also expose Life OS properties for Dataview queries.', cls: 'life-os-help' });
    const dv = integration.createEl('pre'); dv.textContent = JSON.stringify(dataviewProperties(this.record), null, 2);
    const migration = integration.createEl('button', { text: 'Import Markdown/Tasks now' }); migration.onclick = () => void this.plugin.importTasksIntoDay(this.selectedDate);
  }

  async renderGoals(root: HTMLElement): Promise<void> {
    const header = root.createDiv({ cls: 'life-os-review-toolbar' });
    header.createEl('h2', { text: '🎯 Goals & priorities' });
    header.createDiv({ text: 'Goals guide planning. Higher priorities receive more weight in adaptive scheduling.', cls: 'life-os-help' });
    const controls = header.createDiv({ cls: 'life-os-actions' });
    const refresh = controls.createEl('button', { text: 'Refresh auto-progress' });
    refresh.onclick = async () => {
      this.plugin.settings.goals = await refreshAutoGoals(this.app, this.plugin.settings, getMonthRange(this.selectedDate).from, getMonthRange(this.selectedDate).to);
      await this.plugin.saveData(this.plugin.settings);
      await this.render();
    };
    const add = controls.createEl('button', { text: '＋ New goal' });
    add.onclick = async () => {
      const title = window.prompt('Goal name:', 'New goal');
      if (!title?.trim()) return;
      const goal = createGoal({ title: title.trim(), priority: 'medium', target: 100, metric: 'manual' });
      this.plugin.settings.goals.push(goal);
      await this.plugin.saveData(this.plugin.settings);
      await this.render();
    };
    const active = this.plugin.settings.goals.filter((goal) => goal.status === 'active');
    const grid = root.createDiv({ cls: 'life-os-goal-grid' });
    active.sort((a, b) => priorityWeight(b.priority) - priorityWeight(a.priority)).forEach((goal) => {
      const card = grid.createDiv({ cls: 'life-os-goal-card' });
      const head = card.createDiv({ cls: 'life-os-goal-head' });
      head.createDiv({ text: goal.title, cls: 'life-os-row-title' });
      const priority = head.createEl('select');
      ['low', 'medium', 'high', 'critical'].forEach((value) => priority.add(new Option(value, value)));
      priority.value = goal.priority;
      priority.onchange = async () => { goal.priority = priority.value as typeof goal.priority; await this.plugin.saveData(this.plugin.settings); await this.render(); };
      const meta = card.createDiv({ text: `${goalSummary(goal)} · ${metricLabel(goal.metric)}`, cls: 'life-os-help' });
      const bar = card.createDiv({ cls: 'life-os-goal-bar' });
      bar.createDiv({ cls: 'life-os-goal-fill' }).style.width = `${goalProgressPct(goal)}%`;
      const row = card.createDiv({ cls: 'life-os-goal-actions' });
      const metric = row.createEl('select');
      Object.entries({ manual: 'Manual', 'task-completion': 'Task completion', 'habit-consistency': 'Habit consistency', 'study-minutes': 'Study minutes', 'exercise-minutes': 'Exercise minutes', 'prayer-completion': 'Prayer completion' }).forEach(([value, label]) => metric.add(new Option(label, value)));
      metric.value = goal.metric;
      metric.onchange = async () => { goal.metric = metric.value as typeof goal.metric; await this.plugin.saveData(this.plugin.settings); await this.render(); };
      const target = row.createEl('input', { type: 'number' }) as HTMLInputElement; target.value = String(goal.target); target.min = '1'; target.placeholder = 'Target'; target.onchange = async () => { goal.target = Number(target.value) || goal.target; await this.plugin.saveData(this.plugin.settings); await this.render(); };
      const deadline = row.createEl('input', { type: 'date' }) as HTMLInputElement; deadline.value = goal.deadline ?? ''; deadline.onchange = async () => { goal.deadline = deadline.value || undefined; await this.plugin.saveData(this.plugin.settings); await this.render(); };
      const remove = row.createEl('button', { text: 'Delete' });
      remove.onclick = async () => { deleteGoal(this.plugin.settings, goal.id); await this.plugin.saveData(this.plugin.settings); await this.render(); };
      if (goal.description) card.createDiv({ text: goal.description, cls: 'life-os-help' });
      void meta;
    });
    if (!active.length) root.createDiv({ text: 'No active goals yet. Create one to make priorities visible to your planner.', cls: 'life-os-empty-state' });
    const guide = this.section(root, 'How goals affect planning');
    guide.createDiv({ text: 'Critical/high-priority goals are given more weight. Goals with near deadlines are boosted further. Protected goals can later reserve time automatically as the adaptive planner matures.', cls: 'life-os-help' });
  }

  async renderReviews(root: HTMLElement): Promise<void> {
    const header = root.createDiv({ cls: 'life-os-review-toolbar' });
    header.createEl('h2', { text: 'Weekly & Monthly Reviews' });
    header.createDiv({ text: 'Generate review notes from the same Markdown-backed statistics used by the dashboard.', cls: 'life-os-help' });
    const weekRange = getWeekRange(this.selectedDate);
    const monthRange = getMonthRange(this.selectedDate);
    const actions = header.createDiv({ cls: 'life-os-actions' });
    const saveWeek = actions.createEl('button', { text: 'Save weekly review' }); saveWeek.onclick = () => void this.plugin.saveReview('week', this.selectedDate);
    const saveMonth = actions.createEl('button', { text: 'Save monthly review' }); saveMonth.onclick = () => void this.plugin.saveReview('month', this.selectedDate);
    const exportWeek = actions.createEl('button', { text: 'Export weekly review' }); exportWeek.onclick = async () => { await this.saveReviewPreview('week', weekRange.from, weekRange.to); };
    const exportMonth = actions.createEl('button', { text: 'Export monthly review' }); exportMonth.onclick = async () => { await this.saveReviewPreview('month', monthRange.from, monthRange.to); };

    const weeklyStats = await calculateStats(this.app, this.plugin.settings, weekRange.from, weekRange.to);
    const monthlyStats = await calculateStats(this.app, this.plugin.settings, monthRange.from, monthRange.to);
    const grid = root.createDiv({ cls: 'life-os-grid' });
    this.renderReviewCard(grid, 'This week', weekRange, weeklyStats, `Study ${weeklyStats.studyMinutes}m · Tasks ${weeklyStats.taskCompletionPct}% · Habits ${weeklyStats.habitCompletionPct}%`);
    this.renderReviewCard(grid, 'This month', monthRange, monthlyStats, `Study ${monthlyStats.studyMinutes}m · Exercise ${monthlyStats.exerciseMinutes}m · Planned→actual ${monthlyStats.plannedActualPct}%`);

    const trendRecords = await collectRecords(this.app, this.plugin.settings, monthRange.from, monthRange.to);
    const charts = root.createDiv({ cls: 'life-os-chart-grid' });
    this.renderTrendChart(charts, 'Daily completion trend', trendRecords.map((record) => ({ label: record.date.slice(8), value: this.dailyCompletionScore(record) })), '%');
    this.renderTrendChart(charts, 'Study minutes', trendRecords.map((record) => ({ label: record.date.slice(8), value: record.studySessions.reduce((sum, session) => sum + session.durationMin, 0) })), 'm');
    this.renderTrendChart(charts, 'Sleep hours', trendRecords.map((record) => ({ label: record.date.slice(8), value: record.sleepHours })), 'h');
    const moodEnergyPoints: { label: string; value: number }[] = [];
    trendRecords.forEach((record) => { moodEnergyPoints.push({ label: `${record.date.slice(8)} M`, value: record.mood }, { label: `${record.date.slice(8)} E`, value: record.energy }); });
    this.renderTrendChart(charts, 'Mood / energy', moodEnergyPoints, '/5');

    const prompts = this.section(grid, '🧭 Review prompts');
    ['What worked unusually well?', 'What kept getting postponed?', 'Which habit is worth protecting next week/month?', 'Which subject or topic deserves more scheduled time?', 'What should be removed or simplified?'].forEach((prompt) => prompts.createDiv({ text: `• ${prompt}`, cls: 'life-os-review-prompt' }));
  }

  renderReviewCard(parent: HTMLElement, title: string, range: { from: string; to: string }, stats: Awaited<ReturnType<typeof calculateStats>>, detail: string): void {
    const section = this.section(parent, `📊 ${title}`);
    section.createDiv({ text: `${range.from} → ${range.to}`, cls: 'life-os-help' });
    const rows: [string, string][] = [['Tasks', `${stats.taskCompletionPct}%`], ['Habits', `${stats.habitCompletionPct}%`], ['Prayer', `${stats.prayerCompletionPct}%`], ['Study', `${stats.studyMinutes}m`], ['Exercise', `${stats.exerciseMinutes}m`], ['Sleep', `${stats.averageSleepHours}h avg`], ['Mood', `${stats.averageMood}/5`], ['Energy', `${stats.averageEnergy}/5`]];
    rows.forEach(([label, value]) => { const row = section.createDiv({ cls: 'life-os-stat-row' }); row.createDiv({ text: label, cls: 'life-os-row-title' }); row.createSpan({ text: value }); });
    section.createDiv({ text: detail, cls: 'life-os-help' });
  }

  dailyCompletionScore(record: DailyRecord): number {
    const taskScore = record.tasksPlanned.length ? (record.tasksCompleted.filter((task) => record.tasksPlanned.includes(task)).length / record.tasksPlanned.length) * 100 : 0;
    const prayerDenom = record.prayers.filter((p) => p.status !== 'not-tracked').length;
    const prayerScore = prayerDenom ? (record.prayers.filter((p) => p.status === 'completed').length / prayerDenom) * 100 : 0;
    const habits = this.plugin.settings.habits.filter((habit) => habit.enabled);
    const habitScore = habits.length ? (habits.filter((habit) => habitDoneForRecord(habit, record.habits[habit.id])).length / habits.length) * 100 : 0;
    const scores = [taskScore, prayerScore, habitScore].filter((score) => score > 0 || (taskScore === 0 && prayerScore === 0 && habitScore === 0));
    return scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0;
  }

  renderTrendChart(parent: HTMLElement, title: string, points: { label: string; value: number }[], suffix: string): void {
    const card = parent.createDiv({ cls: 'life-os-chart-card' });
    card.createEl('h3', { text: title });
    if (!points.length) { card.createDiv({ text: 'No data for this period.', cls: 'life-os-help' }); return; }
    const max = Math.max(1, ...points.map((point) => point.value));
    const plot = card.createDiv({ cls: 'life-os-chart-bars' });
    points.forEach((point) => {
      const item = plot.createDiv({ cls: 'life-os-chart-point' });
      const bar = item.createDiv({ cls: 'life-os-chart-bar' });
      bar.style.height = `${Math.max(3, (point.value / max) * 100)}%`;
      bar.title = `${point.label}: ${niceLabel(point.value)}${suffix}`;
      item.createDiv({ text: point.label, cls: 'life-os-chart-label' });
    });
    const footer = card.createDiv({ cls: 'life-os-chart-footer' });
    const avg = points.reduce((sum, point) => sum + point.value, 0) / points.length;
    footer.createSpan({ text: `Avg ${niceLabel(avg)}${suffix}` });
    footer.createSpan({ text: `Peak ${niceLabel(max)}${suffix}` });
  }

  async saveReviewPreview(period: 'week' | 'month', from: string, to: string): Promise<void> {
    const content = period === 'week'
      ? await buildWeeklyReview(this.app, this.plugin.settings, from, to)
      : await buildMonthlyReview(this.app, this.plugin.settings, from, to);
    const base = `${this.plugin.settings.dashboardNoteFolder.replace(/\/+$/, '')}/reviews`;
    await ensureFolder(this.app.vault, base);
    const filename = period === 'week' ? `${from}-weekly-review.md` : `${from.slice(0, 7)}-monthly-review.md`;
    const path = `${base}/${filename}`;
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) await this.app.vault.modify(existing, content); else await this.app.vault.create(path, content);
    const file = this.app.vault.getAbstractFileByPath(path);
    if (file instanceof TFile) await this.app.workspace.getLeaf('tab').openFile(file);
  }

  async renderStatistics(root: HTMLElement): Promise<void> {
    const range = lastNDays(Math.max(30, this.plugin.settings.performance.analyticsLookbackDays));
    const stats = await calculateStats(this.app, this.plugin.settings, range.from, range.to);
    const year = Number(this.selectedDate.slice(0, 4));
    const yearly = await calculateYearlyStats(this.app, this.plugin.settings, year);
    const deep = await calculateDeepAnalytics(this.app, this.plugin.settings, range.from, range.to);
    const heading = root.createDiv({ cls: 'life-os-stats-heading' }); heading.createEl('h2', { text: `Statistics · ${year}` }); heading.createDiv({ text: `Last 30 days: ${range.from} → ${range.to}. Use the yearly trends below for the bigger picture.`, cls: 'life-os-help' });
    const cards = root.createDiv({ cls: 'life-os-kpis' });
    const values: [string, string][] = [['Task completion', `${stats.taskCompletionPct}%`], ['Habit consistency', `${stats.habitCompletionPct}%`], ['Prayer completion', `${stats.prayerCompletionPct}%`], ['Study', `${Math.round(stats.studyMinutes / 60)}h ${stats.studyMinutes % 60}m`], ['Exercise', `${Math.round(stats.exerciseMinutes / 60)}h ${stats.exerciseMinutes % 60}m`], ['Planned→actual', `${stats.plannedActualPct}%`], ['Sleep avg', `${stats.averageSleepHours}h`], ['Mood avg', `${stats.averageMood}/5`], ['Energy avg', `${stats.averageEnergy}/5`]];
    values.forEach(([label, value]) => { const card = cards.createDiv({ cls: 'life-os-kpi' }); card.createDiv({ text: label, cls: 'life-os-kpi-label' }); card.createDiv({ text: value, cls: 'life-os-kpi-value' }); });
    const yearlyCharts = root.createDiv({ cls: 'life-os-chart-grid' });
    this.renderTrendChart(yearlyCharts, 'Monthly task completion', monthlyTrendPoints(yearly, (item) => item.taskCompletionPct), '%');
    this.renderTrendChart(yearlyCharts, 'Monthly habit consistency', monthlyTrendPoints(yearly, (item) => item.habitCompletionPct), '%');
    this.renderTrendChart(yearlyCharts, 'Monthly study time', monthlyTrendPoints(yearly, (item) => item.studyMinutes), 'm');
    this.renderTrendChart(yearlyCharts, 'Monthly exercise time', monthlyTrendPoints(yearly, (item) => item.exerciseMinutes), 'm');
    const grid = root.createDiv({ cls: 'life-os-grid' });
    const taskSection = this.section(grid, '✅ Tasks & planning'); taskSection.createDiv({ text: `${stats.taskCompleted}/${stats.taskPlanned} planned tasks completed · ${stats.optionalTasks} optional tasks logged.` });
    const studySection = this.section(grid, '📚 Study by subject'); Object.entries(stats.subjectBreakdown).sort((a, b) => b[1].minutes - a[1].minutes).forEach(([subject, data]) => { const row = studySection.createDiv({ cls: 'life-os-stat-row' }); row.createDiv({ text: subject, cls: 'life-os-row-title' }); row.createSpan({ text: `${data.minutes} min · ${data.sessions} session(s)` }); }); if (!Object.keys(stats.subjectBreakdown).length) studySection.createDiv({ text: 'No study sessions yet.', cls: 'life-os-help' });
    const habitSection = this.section(grid, '🌱 Habit statistics'); Object.entries(stats.habitBreakdown).forEach(([id, data]) => { const habit = this.plugin.settings.habits.find((item) => item.id === id); const row = habitSection.createDiv({ cls: 'life-os-stat-row' }); row.createDiv({ text: habit ? `${habit.icon} ${habit.name}` : id, cls: 'life-os-row-title' }); row.createSpan({ text: `${data.pct}% · ${data.completedDays}/${data.trackedDays} tracked days` }); });
    const prayerSection = this.section(grid, '🕌 Prayer statistics'); prayerSection.createDiv({ text: `Completed ${stats.prayerCompleted} · Late ${stats.prayerLate} · Missed ${stats.prayerMissed} · Tracked ${stats.prayerTracked}` });
    const timelineSection = this.section(grid, '🕒 Time allocation'); timelineSection.createDiv({ text: `Booked ${Math.round(stats.bookedMinutes / 60)}h · actual/completed ${Math.round(stats.actualMinutes / 60)}h · ${stats.plannedActualPct}% of booked time marked actual.` });
    const nutritionSection = this.section(grid, '🍽️ Nutrition analytics'); nutritionSection.createDiv({ text: `${deep.nutrition.meals} meals · ${Math.round(deep.nutrition.servings)} servings · ${Math.round(deep.nutrition.calories)} kcal estimated · ${Math.round(deep.nutrition.proteinG)}g protein · ${Math.round(deep.nutrition.carbsG)}g carbs · ${Math.round(deep.nutrition.fatG)}g fat · ${Math.round(deep.nutrition.fiberG)}g fiber` });
    Object.values(deep.nutrition.topFoods).slice(0, 6).forEach((item) => { const row = nutritionSection.createDiv({ cls: 'life-os-stat-row' }); row.createDiv({ text: item.food, cls: 'life-os-row-title' }); row.createSpan({ text: `${item.servings.toFixed(1)} serving(s) · ${Math.round(item.proteinG)}g protein` }); });
    const exerciseSection = this.section(grid, '🏋️ Exercise analytics'); exerciseSection.createDiv({ text: `${deep.exercise.sessions} sessions · ${Math.round(deep.exercise.minutes)} min · ${Math.round(deep.exercise.totalVolumeKg)} kg volume · ${deep.exercise.distanceKm.toFixed(1)} km · avg intensity ${deep.exercise.averageIntensity || '—'}/5` });
    Object.values(deep.exercise.topExercises).slice(0, 6).forEach((item) => { const row = exerciseSection.createDiv({ cls: 'life-os-stat-row' }); row.createDiv({ text: item.name, cls: 'life-os-row-title' }); row.createSpan({ text: `${item.sessions} session(s) · ${Math.round(item.minutes)} min · ${Math.round(item.volumeKg)} kg` }); });
    const actions = timelineSection.createDiv({ cls: 'life-os-actions' });
    const week = actions.createEl('button', { text: 'Open weekly review' }); week.onclick = async () => { this.activeTab = 'reviews'; await this.render(); };
  }

  renderRichTaskPlanner(parent: HTMLElement): void {
    const section = this.section(parent, '🧩 Rich task planner');
    section.createDiv({ text: 'Create tasks with duration, priority, deadline and an optional goal link. These can later be placed into the visual planner.', cls: 'life-os-help' });
    const form = section.createDiv({ cls: 'life-os-inline-form' });
    const title = form.createEl('input'); title.placeholder = 'Task title';
    const duration = form.createEl('input', { type: 'number' }) as HTMLInputElement; duration.placeholder = 'min'; duration.value = '30'; duration.min = '5';
    const priority = form.createEl('select'); ['low','medium','high','critical'].forEach((v) => priority.add(new Option(v, v))); priority.value = 'medium';
    const deadline = form.createEl('input', { type: 'date' }) as HTMLInputElement;
    const goal = form.createEl('select'); goal.add(new Option('No goal', '')); this.plugin.settings.goals.filter((g) => g.status === 'active').forEach((g) => goal.add(new Option(g.title, g.id)));
    const optionalLabel = form.createEl('label'); const optional = optionalLabel.createEl('input', { type: 'checkbox' }) as HTMLInputElement; optionalLabel.appendText(' optional');
    const add = form.createEl('button', { text: '＋ Add rich task' });
    add.onclick = async () => {
      if (!title.value.trim()) { new Notice('Enter a task title.'); return; }
      const task = { id: crypto.randomUUID(), title: title.value.trim(), completed: false, optional: optional.checked, priority: priority.value as any, durationMin: Number(duration.value) || 30, deadline: deadline.value || undefined, goalId: goal.value || undefined };
      this.record.richTasks = [...(this.record.richTasks ?? []), task];
      if (!this.record.tasksPlanned.includes(task.title)) this.record.tasksPlanned.push(task.title);
      await this.persist(true); await this.render();
    };
    (this.record.richTasks ?? []).forEach((task, index) => {
      const row = section.createDiv({ cls: 'life-os-row' });
      row.createDiv({ text: task.title, cls: 'life-os-row-title' });
      row.createSpan({ text: `${task.durationMin ?? 0}m · ${task.priority}${task.deadline ? ` · due ${task.deadline}` : ''}` });
      const goalText = task.goalId ? this.plugin.settings.goals.find((g) => g.id === task.goalId)?.title : undefined; if (goalText) row.createSpan({ text: `🎯 ${goalText}`, cls: 'life-os-help' });
      const done = row.createEl('input', { type: 'checkbox' }) as HTMLInputElement; done.checked = task.completed; done.onchange = async () => { task.completed = done.checked; if (done.checked && !this.record.tasksCompleted.includes(task.title)) this.record.tasksCompleted.push(task.title); await this.persist(false); };
      const del = row.createEl('button', { text: '×' }); del.onclick = async () => { this.record.richTasks?.splice(index, 1); await this.persist(true); await this.render(); };
    });
  }

  renderReflection(parent: HTMLElement): void {
    const section = this.section(parent, '📝 Reflection & daily planning');
    this.formNumber(section, 'Sleep hours', this.record.sleepHours, (v) => { this.record.sleepHours = v; }, 0, 24, 0.25);
    this.formNumber(section, 'Rest / nap minutes', this.record.restMinutes, (v) => { this.record.restMinutes = v; }, 0, 1440, 5);
    this.formNumber(section, 'Mood (1–5)', this.record.mood, (v) => { this.record.mood = v; }, 1, 5, 1);
    this.formNumber(section, 'Energy (1–5)', this.record.energy, (v) => { this.record.energy = v; }, 1, 5, 1);
    const planned = section.createEl('textarea'); planned.placeholder = 'Planned tasks — one per line'; planned.value = this.record.tasksPlanned.join('\n'); planned.onchange = async () => { this.record.tasksPlanned = planned.value.split('\n').map((x: string) => x.trim()).filter(Boolean); await this.persist(false); };
    const done = section.createEl('textarea'); done.placeholder = 'Completed tasks — one per line'; done.value = this.record.tasksCompleted.join('\n'); done.onchange = async () => { this.record.tasksCompleted = done.value.split('\n').map((x: string) => x.trim()).filter(Boolean); await this.persist(false); };
    const optional = section.createEl('textarea'); optional.placeholder = 'Optional tasks — one per line'; optional.value = this.record.optionalTasks.join('\n'); optional.onchange = async () => { this.record.optionalTasks = optional.value.split('\n').map((x: string) => x.trim()).filter(Boolean); await this.persist(false); };
    const reflection = section.createEl('textarea'); reflection.placeholder = 'How was your day? What went well? What should change tomorrow?'; reflection.value = this.record.reflection; reflection.onchange = async () => { this.record.reflection = reflection.value; await this.persist(false); };
    const actions = section.createDiv({ cls: 'life-os-actions' });
    const json = actions.createEl('button', { text: 'Export JSON' }); json.onclick = () => void this.plugin.exportDate(this.selectedDate, 'json');
    const md = actions.createEl('button', { text: 'Export Markdown' }); md.onclick = () => void this.plugin.exportDate(this.selectedDate, 'md');
  }

  formNumber(parent: HTMLElement, label: string, value: number, set: (v: number) => void, min: number, max: number, step: number): void {
    const row = parent.createDiv({ cls: 'life-os-form-row' }); row.createSpan({ text: label });
    const input = row.createEl('input', { type: 'number' }) as HTMLInputElement; input.value = String(value); input.min = String(min); input.max = String(max); input.step = String(step);
    input.onchange = async () => { set(Number(input.value) || 0); await this.persist(false); };
  }

  section(parent: HTMLElement, title: string): HTMLElement { const section = parent.createDiv({ cls: 'life-os-section' }); section.createEl('h2', { text: title }); return section; }
  async persist(notice: boolean): Promise<void> { this.record.updatedAt = new Date().toISOString(); await saveRecord(this.app, this.record, this.plugin.settings); if (notice) new Notice('Life OS saved'); }

  injectStyles(): void {
    if (document.getElementById('life-os-styles')) return;
    const style = document.createElement('style'); style.id = 'life-os-styles';
    style.textContent = LIFE_OS_CSS;
    /* Legacy inline stylesheet removed in v0.10; styles live in src/styles.ts. */
    document.head.appendChild(style);
  }
}

class LifeOSSettingTab extends PluginSettingTab {
  plugin: LifeOSPlugin;
  constructor(app: import('obsidian').App, plugin: LifeOSPlugin) { super(app, plugin); this.plugin = plugin; }
  display(): void {
    const { containerEl } = this; containerEl.empty();
    new Setting(containerEl).setName('Life OS').setDesc('Local-first daily life, study, planning and review tracker.');
    new Setting(containerEl).setName('Daily notes folder').addText((text: any) => text.setValue(this.plugin.settings.dailyNotesFolder).onChange(async (value: string) => { this.plugin.settings.dailyNotesFolder = value.trim() || DEFAULT_SETTINGS.dailyNotesFolder; await this.plugin.saveData(this.plugin.settings); }));
    new Setting(containerEl).setName('Export/review folder').addText((text: any) => text.setValue(this.plugin.settings.dashboardNoteFolder).onChange(async (value: string) => { this.plugin.settings.dashboardNoteFolder = value.trim() || DEFAULT_SETTINGS.dashboardNoteFolder; await this.plugin.saveData(this.plugin.settings); }));
    new Setting(containerEl).setName('Reports folder').addText((text: any) => text.setValue(this.plugin.settings.reportFolder).onChange(async (value: string) => { this.plugin.settings.reportFolder = value.trim() || DEFAULT_SETTINGS.reportFolder; await this.plugin.saveData(this.plugin.settings); }));
    new Setting(containerEl).setName('Automatic prayer-time calculation').setDesc('Calculate prayer times from date, latitude, longitude, method and madhab. Turn off to use manual default times.').addToggle((toggle: any) => toggle.setValue(this.plugin.settings.prayerCalculation.enabled).onChange(async (value: boolean) => { this.plugin.settings.prayerCalculation.enabled = value; await this.plugin.saveData(this.plugin.settings); }));
    new Setting(containerEl).setName('Prayer latitude').addText((text: any) => text.setValue(String(this.plugin.settings.prayerCalculation.latitude)).onChange(async (value: string) => { this.plugin.settings.prayerCalculation.latitude = Number(value) || this.plugin.settings.prayerCalculation.latitude; await this.plugin.saveData(this.plugin.settings); }));
    new Setting(containerEl).setName('Prayer longitude').addText((text: any) => text.setValue(String(this.plugin.settings.prayerCalculation.longitude)).onChange(async (value: string) => { this.plugin.settings.prayerCalculation.longitude = Number(value) || this.plugin.settings.prayerCalculation.longitude; await this.plugin.saveData(this.plugin.settings); }));
    new Setting(containerEl).setName('Prayer calculation method').addDropdown((dropdown: any) => { ['karachi','mwl','isna','egyptian','tehran','jafari'].forEach((v: string) => dropdown.addOption(v, v.toUpperCase())); dropdown.setValue(this.plugin.settings.prayerCalculation.method).onChange(async (value: string) => { this.plugin.settings.prayerCalculation.method = value as any; await this.plugin.saveData(this.plugin.settings); }); });
    new Setting(containerEl).setName('Asr madhab').addDropdown((dropdown: any) => { dropdown.addOption('hanafi','Hanafi'); dropdown.addOption('shafii','Shafi / standard'); dropdown.setValue(this.plugin.settings.prayerCalculation.madhab).onChange(async (value: string) => { this.plugin.settings.prayerCalculation.madhab = value as any; await this.plugin.saveData(this.plugin.settings); }); });
    new Setting(containerEl).setName('Prayer minute adjustment').setDesc('Add/subtract minutes from calculated times.').addText((text: any) => text.setValue(String(this.plugin.settings.prayerCalculation.minuteAdjustment)).onChange(async (value: string) => { this.plugin.settings.prayerCalculation.minuteAdjustment = Number(value) || 0; await this.plugin.saveData(this.plugin.settings); }));
    new Setting(containerEl).setName('Prayer & integration features').setHeading();
    new Setting(containerEl).setName('Default prayer times').setDesc('Copied into newly-created daily records when automatic calculation is disabled.');
    Object.entries(this.plugin.settings.defaultPrayerTimes).forEach(([name, currentValue]) => new Setting(containerEl).setName(name).addText((text: any) => text.setValue(currentValue).onChange(async (value: string) => { this.plugin.settings.defaultPrayerTimes[name] = value; await this.plugin.saveData(this.plugin.settings); })));
    new Setting(containerEl).setName('Study subjects').setDesc('Comma-separated preset subjects.').addText((text: any) => text.setValue(this.plugin.settings.defaultStudySubjects.join(', ')).onChange(async (value: string) => { this.plugin.settings.defaultStudySubjects = value.split(',').map((v: string) => v.trim()).filter(Boolean); await this.plugin.saveData(this.plugin.settings); }));
    new Setting(containerEl).setName('Habits').setDesc('Enable or disable starter habits.').setHeading();
    this.plugin.settings.habits.forEach((habit) => new Setting(containerEl).setName(`${habit.icon} ${habit.name} · ${habit.type}`).addToggle((toggle: any) => toggle.setValue(habit.enabled).onChange(async (value: boolean) => { habit.enabled = value; await this.plugin.saveData(this.plugin.settings); })));
    new Setting(containerEl).setName('Food categories').setDesc('Comma-separated preset categories.').addText((text: any) => text.setValue(this.plugin.settings.enabledFoodPresetCategories.join(', ')).onChange(async (value: string) => { this.plugin.settings.enabledFoodPresetCategories = value.split(',').map((v: string) => v.trim()).filter(Boolean); await this.plugin.saveData(this.plugin.settings); }));
    new Setting(containerEl).setName('Intelligent scheduling').setDesc('Turn the planning assistant on/off.').addToggle((toggle: any) => toggle.setValue(this.plugin.settings.planningPreferences.intelligentScheduling).onChange(async (value: boolean) => { this.plugin.settings.planningPreferences.intelligentScheduling = value; await this.plugin.saveData(this.plugin.settings); }));
    new Setting(containerEl).setName('Show free-time discovery').addToggle((toggle: any) => toggle.setValue(this.plugin.settings.planningPreferences.showFreeTime).onChange(async (value: boolean) => { this.plugin.settings.planningPreferences.showFreeTime = value; await this.plugin.saveData(this.plugin.settings); }));
    new Setting(containerEl).setName('Conflict suggestions').addToggle((toggle: any) => toggle.setValue(this.plugin.settings.planningPreferences.showConflictSuggestions).onChange(async (value: boolean) => { this.plugin.settings.planningPreferences.showConflictSuggestions = value; await this.plugin.saveData(this.plugin.settings); }));
    new Setting(containerEl).setName('Drag unscheduled tasks/study into planner').addToggle((toggle: any) => toggle.setValue(this.plugin.settings.planningPreferences.enableDragUnscheduled).onChange(async (value: boolean) => { this.plugin.settings.planningPreferences.enableDragUnscheduled = value; await this.plugin.saveData(this.plugin.settings); }));
    new Setting(containerEl).setName('Adaptive rescheduling suggestions').addToggle((toggle: any) => toggle.setValue(this.plugin.settings.planningPreferences.enableAdaptiveRescheduling).onChange(async (value: boolean) => { this.plugin.settings.planningPreferences.enableAdaptiveRescheduling = value; await this.plugin.saveData(this.plugin.settings); }));
    new Setting(containerEl).setName('Goal-aware adaptive priorities').setDesc('Use active goal priority and deadlines when ranking suggested planning slots.').addToggle((toggle: any) => toggle.setValue(this.plugin.settings.planningPreferences.goalAwareScheduling).onChange(async (value: boolean) => { this.plugin.settings.planningPreferences.goalAwareScheduling = value; await this.plugin.saveData(this.plugin.settings); }));
    new Setting(containerEl).setName('Planning conflict badges').addToggle((toggle: any) => toggle.setValue(this.plugin.settings.planningPreferences.showPlanningBadges).onChange(async (value: boolean) => { this.plugin.settings.planningPreferences.showPlanningBadges = value; await this.plugin.saveData(this.plugin.settings); }));
    new Setting(containerEl).setName('Planner snap minutes').addDropdown((dropdown: any) => { [5, 10, 15, 30].forEach((v: number) => dropdown.addOption(String(v), `${v} minutes`)); dropdown.setValue(String(this.plugin.settings.planningPreferences.slotMinutes)); dropdown.onChange(async (value: string) => { this.plugin.settings.planningPreferences.slotMinutes = Number(value) || 15; await this.plugin.saveData(this.plugin.settings); }); });
    new Setting(containerEl).setName('Quiet hours').setDesc('Used later by adaptive scheduling/reminder logic.').addText((text: any) => text.setValue(`${this.plugin.settings.planningPreferences.quietHoursStart}–${this.plugin.settings.planningPreferences.quietHoursEnd}`).onChange(async (value: string) => { const parts = value.split(/[–-]/); const start = parts[0]; const end = parts[1]; if (start !== undefined && end !== undefined) { this.plugin.settings.planningPreferences.quietHoursStart = start.trim(); this.plugin.settings.planningPreferences.quietHoursEnd = end.trim(); await this.plugin.saveData(this.plugin.settings); } }));
    new Setting(containerEl).setName('Performance & mobile optimization').setHeading();
    new Setting(containerEl).setName('Analytics cache').setDesc('Keep parsed daily records in memory to avoid repeated vault reads.').addToggle((toggle: any) => toggle.setValue(this.plugin.settings.performance.cacheEnabled).onChange(async (value: boolean) => { this.plugin.settings.performance.cacheEnabled = value; invalidateLifeOSCache(); await this.plugin.saveData(this.plugin.settings); }));
    new Setting(containerEl).setName('Cache TTL (minutes)').addText((text: any) => text.setValue(String(this.plugin.settings.performance.cacheTtlMinutes)).onChange(async (value: string) => { const n = Math.min(1440, Math.max(1, Number(value) || 10)); this.plugin.settings.performance.cacheTtlMinutes = n; await this.plugin.saveData(this.plugin.settings); }));
    new Setting(containerEl).setName('Maximum cached daily records').setDesc('Lower values reduce RAM usage on phones.').addText((text: any) => text.setValue(String(this.plugin.settings.performance.maxCachedDays)).onChange(async (value: string) => { const n = Math.min(5000, Math.max(50, Number(value) || 500)); this.plugin.settings.performance.maxCachedDays = n; invalidateLifeOSCache(); await this.plugin.saveData(this.plugin.settings); }));
    new Setting(containerEl).setName('Analytics lookback').setDesc('Default statistics window for detailed analytics.').addDropdown((dropdown: any) => { [30, 60, 90, 180, 365].forEach((n) => dropdown.addOption(String(n), `${n} days`)); dropdown.setValue(String(this.plugin.settings.performance.analyticsLookbackDays)); dropdown.onChange(async (value: string) => { this.plugin.settings.performance.analyticsLookbackDays = Number(value) || 90; await this.plugin.saveData(this.plugin.settings); }); });
    new Setting(containerEl).setName('Lazy analytics UI').setDesc('Render expensive analytics only after the statistics view is opened.').addToggle((toggle: any) => toggle.setValue(this.plugin.settings.performance.lazyRenderAnalytics).onChange(async (value: boolean) => { this.plugin.settings.performance.lazyRenderAnalytics = value; await this.plugin.saveData(this.plugin.settings); }));
    new Setting(containerEl).setName('Native integration helpers').setHeading();
    new Setting(containerEl).setName('Tasks metadata guide').setDesc('Use the command palette to copy a Life OS metadata example for Tasks-style Markdown.');
    new Setting(containerEl).setName('Dataview queries').setDesc('Use the command palette to copy ready-made Life OS Dataview queries.');
    new Setting(containerEl).setName('Templater template').setDesc('Use the command palette to copy the Life OS daily template.');
    const integrationStatus = buildIntegrationSnapshot(this.app, this.plugin.settings, []);
    new Setting(containerEl).setName('Integration status').setDesc(`Tasks: ${integrationStatus.tasksPluginDetected ? 'detected' : 'not detected'} · Dataview: ${integrationStatus.dataviewDetected ? 'detected' : 'not detected'} · Templater: ${integrationStatus.templaterDetected ? 'detected' : 'not detected'}`);
    new Setting(containerEl).setName('Use Tasks integration').addToggle((toggle: any) => toggle.setValue(this.plugin.settings.integrations.tasks).onChange(async (value: boolean) => { this.plugin.settings.integrations.tasks = value; await this.plugin.saveData(this.plugin.settings); }));
    new Setting(containerEl).setName('Use Dataview helpers').addToggle((toggle: any) => toggle.setValue(this.plugin.settings.integrations.dataview).onChange(async (value: boolean) => { this.plugin.settings.integrations.dataview = value; await this.plugin.saveData(this.plugin.settings); }));
    new Setting(containerEl).setName('Use Templater helpers').addToggle((toggle: any) => toggle.setValue(this.plugin.settings.integrations.templater).onChange(async (value: boolean) => { this.plugin.settings.integrations.templater = value; await this.plugin.saveData(this.plugin.settings); }));
    new Setting(containerEl).setName('Automatic task import').setDesc('Off by default for performance. When enabled, task imports should be run deliberately from the command palette.').addToggle((toggle: any) => toggle.setValue(this.plugin.settings.integrations.autoImportTasks).onChange(async (value: boolean) => { this.plugin.settings.integrations.autoImportTasks = value; await this.plugin.saveData(this.plugin.settings); }));
    new Setting(containerEl).setName('Migration safety').setHeading();
    new Setting(containerEl).setName('Create migration backups').setDesc('Keep the original daily note before a migration changes it.').addToggle((toggle: any) => toggle.setValue(this.plugin.settings.migration.createBackups).onChange(async (value: boolean) => { this.plugin.settings.migration.createBackups = value; await this.plugin.saveData(this.plugin.settings); }));
    new Setting(containerEl).setName('Restore default habits').addButton((button: any) => button.setButtonText('Restore').onClick(async () => { this.plugin.settings.habits = DEFAULT_HABITS.map((habit) => ({ ...habit, subtasks: habit.subtasks ? [...habit.subtasks] : undefined })); await this.plugin.saveData(this.plugin.settings); this.display(); new Notice('Default habits restored'); }));
  }
}


async function copyText(value: string, successMessage: string): Promise<void> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      new Notice(successMessage);
      return;
    }
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.style.position = 'fixed'; textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    new Notice(copied ? successMessage : 'Clipboard access is unavailable on this device.');
  } catch {
    new Notice('Clipboard access is unavailable on this device.');
  }
}

function defaultHabitEntry(habit: HabitDefinition): HabitEntry { if (habit.type === 'subtasks') return { value: (habit.subtasks ?? []).map(() => 0) }; return { value: habit.type === 'boolean' ? false : 0 }; }
function snapMinutes(value: number, increment = 15): number {
  const safe = Math.max(1, increment);
  return Math.round(value / safe) * safe;
}

function minutesToTime(value: number): string {
  const clamped = Math.max(0, Math.min(1440, Math.round(value)));
  if (clamped === 1440) return '24:00';
  const hours = Math.floor(clamped / 60);
  const minutes = clamped % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function timeToMinutes(value: string): number { const parts = value.split(':').map(Number); const hours = parts[0] ?? 0; const minutes = parts[1] ?? 0; return hours * 60 + minutes; }
function diffMinutes(start: string, end: string): number { let diff = timeToMinutes(end) - timeToMinutes(start); if (diff < 0) diff += 1440; return diff; }
function shiftDate(date: string, deltaDays: number): string { const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate() + deltaDays); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function formatDay(date: string): string { return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' }); }
function habitEntryHasActivity(entry: HabitEntry): boolean { return Array.isArray(entry.value) ? entry.value.some((value) => Number(value) > 0) : Boolean(entry.value); }
function habitDoneForRecord(habit: HabitDefinition, entry?: HabitEntry): boolean { if (!entry) return false; if (habit.type === 'boolean') return Boolean(entry.value); if (habit.type === 'subtasks') return Array.isArray(entry.value) && entry.value.some((v) => Number(v) > 0); if (habit.target !== undefined) return Number(entry.value) >= habit.target; return Number(entry.value) > 0; }
