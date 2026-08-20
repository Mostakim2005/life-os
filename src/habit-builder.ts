import { Setting } from 'obsidian';
import type { LifeOSPlugin } from './main';
import { HabitDefinition, PlanningRule, RecurrenceType, TrackerType } from './types';

const trackerTypes: TrackerType[] = ['boolean', 'count', 'duration', 'quantity', 'points', 'subtasks'];
const recurrenceTypes: RecurrenceType[] = ['daily', 'weekly', 'interval', 'once'];

function saveAndRefresh(plugin: LifeOSPlugin, onChanged: () => Promise<void>, mutate: () => void, refresh = false): void {
  mutate();
  void plugin.saveData(plugin.settings)
    .then(() => refresh ? onChanged() : undefined)
    .catch((error: unknown) => { console.error('Life OS habit save failed', error); });
}

export function renderHabitBuilder(parent: HTMLElement, plugin: LifeOSPlugin, onChanged: () => Promise<void>): void {
  const intro = parent.createDiv({ cls: 'life-os-section' });
  intro.createEl('h2', { text: '🌱 Habit Builder' });
  intro.createDiv({ text: 'Build habits with the tracking method, target, recurrence, time block, and optionality that actually fit them.', cls: 'life-os-help' });

  const actions = intro.createDiv({ cls: 'life-os-actions' });
  const add = actions.createEl('button', { text: '＋ New habit' });
  add.addClass('mod-cta');
  add.onclick = () => {
    const id = `habit-${Date.now()}`;
    const habit: HabitDefinition = { id, name: 'New habit', icon: '✅', type: 'boolean', enabled: true, schedule: { recurrence: 'daily' } };
    plugin.settings.habits.push(habit);
    void plugin.saveData(plugin.settings).then(() => onChanged()).catch((error: unknown) => { console.error('Life OS habit save failed', error); });
  };

  const list = parent.createDiv({ cls: 'life-os-habit-builder-list' });
  plugin.settings.habits.forEach((habit) => renderHabitCard(list, habit, plugin, onChanged));
  renderPlanningRules(parent, plugin, onChanged);
}

function renderPlanningRules(parent: HTMLElement, plugin: LifeOSPlugin, onChanged: () => Promise<void>): void {
  const section = parent.createDiv({ cls: 'life-os-section life-os-planning-rules' });
  section.createEl('h2', { text: '🗓 Recurring plans' });
  section.createDiv({ text: 'Use the same recurrence engine for recurring study, task, exercise, rest, or other time blocks.', cls: 'life-os-help' });
  const add = section.createEl('button', { text: '＋ New recurring plan' });
  add.onclick = () => {
    plugin.settings.planningRules.push({ id: `rule-${Date.now()}`, name: 'New plan', kind: 'task', recurrence: 'weekly', daysOfWeek: [1,2,3,4,5], startTime: '09:00', endTime: '10:00', optional: false, enabled: true });
    void plugin.saveData(plugin.settings).then(() => onChanged()).catch((error: unknown) => { console.error('Life OS planning rule save failed', error); });
  };
  const list = section.createDiv({ cls: 'life-os-planning-rule-list' });
  plugin.settings.planningRules.filter((rule) => !rule.habitId).forEach((rule) => renderPlanningRuleCard(list, rule, plugin, onChanged));
}

function renderPlanningRuleCard(parent: HTMLElement, rule: PlanningRule, plugin: LifeOSPlugin, onChanged: () => Promise<void>): void {
  const card = parent.createDiv({ cls: 'life-os-planning-rule-card' });
  const head = card.createDiv({ cls: 'life-os-habit-card-head' });
  head.createDiv({ text: `${rule.name} · ${rule.kind}`, cls: 'life-os-row-title' });
  const remove = head.createEl('button', { text: 'Delete' });
  remove.onclick = () => saveAndRefresh(plugin, onChanged, () => { plugin.settings.planningRules = plugin.settings.planningRules.filter((item) => item.id !== rule.id); }, true);
  new Setting(card).setName('Name').addText((input) => input.setValue(rule.name).onChange((value) => saveAndRefresh(plugin, onChanged, () => { rule.name = value || 'Plan'; })));
  new Setting(card).setName('Type').addDropdown((dropdown) => { ['task','study','exercise','rest','other'].forEach((v) => dropdown.addOption(v, v)); dropdown.setValue(rule.kind); dropdown.onChange((value) => saveAndRefresh(plugin, onChanged, () => { rule.kind = value as PlanningRule['kind']; }, true)); });
  new Setting(card).setName('Recurrence').addDropdown((dropdown) => { recurrenceTypes.forEach((v) => dropdown.addOption(v, v)); dropdown.setValue(rule.recurrence); dropdown.onChange((value) => saveAndRefresh(plugin, onChanged, () => { rule.recurrence = value as RecurrenceType; }, true)); });
  new Setting(card).setName('Start').addText((input) => input.setValue(rule.startTime).onChange((value) => saveAndRefresh(plugin, onChanged, () => { rule.startTime = value || rule.startTime; })));
  new Setting(card).setName('End').addText((input) => input.setValue(rule.endTime).onChange((value) => saveAndRefresh(plugin, onChanged, () => { rule.endTime = value || rule.endTime; })));
  new Setting(card).setName('Weekdays').setDesc('0=Sun ... 6=Sat').addText((input) => input.setValue((rule.daysOfWeek ?? []).join(',')).onChange((value) => saveAndRefresh(plugin, onChanged, () => { rule.daysOfWeek = value.split(',').map((v) => Number(v.trim())).filter((v) => Number.isInteger(v) && v >= 0 && v <= 6); })));
  new Setting(card).setName('Interval days').addText((input) => input.setValue(String(rule.intervalDays ?? 1)).onChange((value) => saveAndRefresh(plugin, onChanged, () => { rule.intervalDays = Math.max(1, Number(value) || 1); })));
  new Setting(card).setName('Optional').addToggle((toggle) => toggle.setValue(rule.optional).onChange((value) => saveAndRefresh(plugin, onChanged, () => { rule.optional = value; })));
  new Setting(card).setName('Enabled').addToggle((toggle) => toggle.setValue(rule.enabled).onChange((value) => saveAndRefresh(plugin, onChanged, () => { rule.enabled = value; }, true)));
}


function renderHabitCard(parent: HTMLElement, habit: HabitDefinition, plugin: LifeOSPlugin, onChanged: () => Promise<void>): void {
  const card = parent.createDiv({ cls: 'life-os-habit-card' });
  const heading = card.createDiv({ cls: 'life-os-habit-card-head' });
  heading.createDiv({ text: `${habit.icon} ${habit.name}`, cls: 'life-os-row-title' });
  const actions = heading.createDiv({ cls: 'life-os-actions' });
  const enabled = actions.createEl('button', { text: habit.enabled ? 'Enabled' : 'Disabled' });
  enabled.onclick = () => saveAndRefresh(plugin, onChanged, () => { habit.enabled = !habit.enabled; }, true);
  const remove = actions.createEl('button', { text: 'Delete' });
  remove.onclick = () => saveAndRefresh(plugin, onChanged, () => {
    plugin.settings.habits = plugin.settings.habits.filter((item) => item.id !== habit.id);
    plugin.settings.planningRules = plugin.settings.planningRules.filter((rule) => rule.habitId !== habit.id);
  }, true);

  new Setting(card).setName('Name').addText((input) => input.setValue(habit.name).onChange((value) => saveAndRefresh(plugin, onChanged, () => { habit.name = value.trim() || 'Habit'; })));
  new Setting(card).setName('Icon').addText((input) => input.setValue(habit.icon).onChange((value) => saveAndRefresh(plugin, onChanged, () => { habit.icon = value || '✅'; })));
  new Setting(card).setName('Tracking method').addDropdown((dropdown) => { trackerTypes.forEach((type) => dropdown.addOption(type, type)); dropdown.setValue(habit.type); dropdown.onChange((value) => saveAndRefresh(plugin, onChanged, () => { habit.type = value as TrackerType; }, true)); });
  new Setting(card).setName('Target').addText((input) => input.setValue(String(habit.target ?? 1)).onChange((value) => saveAndRefresh(plugin, onChanged, () => { habit.target = Number(value) || undefined; })));
  new Setting(card).setName('Unit').addText((input) => input.setValue(habit.unit ?? '').onChange((value) => saveAndRefresh(plugin, onChanged, () => { habit.unit = value.trim() || undefined; })));
  new Setting(card).setName('Description').addText((input) => input.setValue(habit.description ?? '').onChange((value) => saveAndRefresh(plugin, onChanged, () => { habit.description = value.trim() || undefined; })));

  const schedule = habit.schedule ?? { recurrence: 'daily' as RecurrenceType };
  habit.schedule = schedule;
  card.createDiv({ text: 'Scheduling', cls: 'life-os-subheading' });
  new Setting(card).setName('Recurrence').addDropdown((dropdown) => { recurrenceTypes.forEach((value) => dropdown.addOption(value, value)); dropdown.setValue(schedule.recurrence); dropdown.onChange((value) => saveAndRefresh(plugin, onChanged, () => { schedule.recurrence = value as RecurrenceType; syncHabitRule(plugin, habit); }, true)); });
  new Setting(card).setName('Start time').addText((input) => input.setValue(schedule.startTime ?? '').setPlaceholder('e.g. 18:00').onChange((value) => saveAndRefresh(plugin, onChanged, () => { schedule.startTime = value.trim() || undefined; syncHabitRule(plugin, habit); })));
  new Setting(card).setName('End time').addText((input) => input.setValue(schedule.endTime ?? '').setPlaceholder('e.g. 18:30').onChange((value) => saveAndRefresh(plugin, onChanged, () => { schedule.endTime = value.trim() || undefined; syncHabitRule(plugin, habit); })));
  new Setting(card).setName('Days of week').setDesc('For weekly schedules: 0=Sun ... 6=Sat. Example: 1,3,5').addText((input) => input.setValue((schedule.daysOfWeek ?? []).join(',')).onChange((value) => saveAndRefresh(plugin, onChanged, () => { schedule.daysOfWeek = value.split(',').map((v) => Number(v.trim())).filter((v) => Number.isInteger(v) && v >= 0 && v <= 6); syncHabitRule(plugin, habit); })));
  new Setting(card).setName('Interval days').addText((input) => input.setValue(String(schedule.intervalDays ?? 1)).onChange((value) => saveAndRefresh(plugin, onChanged, () => { schedule.intervalDays = Math.max(1, Number(value) || 1); syncHabitRule(plugin, habit); })));
  new Setting(card).setName('Optional').addToggle((toggle) => toggle.setValue(Boolean(schedule.optional)).onChange((value) => saveAndRefresh(plugin, onChanged, () => { schedule.optional = value; syncHabitRule(plugin, habit); })));
  const subtasks = card.createDiv({ cls: 'life-os-subtasks-editor' });
  subtasks.createDiv({ text: 'Subtasks (comma separated; useful for checklists)', cls: 'life-os-help' });
  const input = subtasks.createEl('input');
  input.value = (habit.subtasks ?? []).join(', ');
  input.onchange = () => saveAndRefresh(plugin, onChanged, () => { habit.subtasks = input.value.split(',').map((v) => v.trim()).filter(Boolean); }, true);
}


function syncHabitRule(plugin: LifeOSPlugin, habit: HabitDefinition): void {
  const schedule = habit.schedule;
  if (!schedule?.startTime || !schedule.endTime) return;
  const existing = plugin.settings.planningRules.find((rule) => rule.habitId === habit.id);
  const next: PlanningRule = existing ?? { id: `rule-${habit.id}`, name: habit.name, kind: 'habit', recurrence: schedule.recurrence, startTime: schedule.startTime, endTime: schedule.endTime, optional: Boolean(schedule.optional), enabled: habit.enabled, habitId: habit.id };
  next.name = habit.name;
  next.recurrence = schedule.recurrence;
  next.daysOfWeek = schedule.daysOfWeek;
  next.intervalDays = schedule.intervalDays;
  next.startTime = schedule.startTime;
  next.endTime = schedule.endTime;
  next.optional = Boolean(schedule.optional);
  next.enabled = habit.enabled;
  if (!existing) plugin.settings.planningRules.push(next);
}
